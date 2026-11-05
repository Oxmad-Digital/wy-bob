// Accès aux produits et à leurs variantes (tables products / product_variants).
// Les fonctions renvoient des objets de même forme qu'un document Mongoose .lean()
// (`_id`, champs camelCase, `variants[]` avec leur `_id`) pour que les routes et le front
// restent inchangés. `_id` contient désormais l'uuid PostgreSQL.
import { query, queryOne, withTransaction, isUuid, isMongoId } from "@/app/lib/neon";

const PRODUCT_COLUMNS = `
  id, name, price, price_promo, stock, visible, weight, customs_description_en, created_at, updated_at`;
const VARIANT_COLUMNS = `
  id, product_id, position, color_name, color_code, text_color, description, image, stock, edition_size`;

const VARIANT_DEFAULTS = { textColor: "#ffffff", description: "", image: "", stock: 0, editionSize: 50 };

function toVariant(row) {
  return {
    _id: row.id,
    colorName: row.color_name,
    colorCode: row.color_code,
    textColor: row.text_color,
    description: row.description,
    image: row.image,
    stock: row.stock,
    editionSize: row.edition_size,
  };
}

function toProduct(row, variantRows) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    price: row.price,
    pricePromo: row.price_promo,
    stock: row.stock,
    visible: row.visible,
    variants: variantRows.filter((v) => v.product_id === row.id).map(toVariant),
    weight: row.weight,
    customsDescriptionEn: row.customs_description_en,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Équivalent du cast Mongoose vers Number : une valeur non numérique fait échouer l'écriture. */
function toNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Valeur numérique invalide pour "${field}" : ${value}`);
  return n;
}
function toInteger(value, field) {
  const n = toNumber(value, field);
  if (!Number.isInteger(n)) throw new Error(`Entier attendu pour "${field}" : ${value}`);
  return n;
}

async function loadVariants(db, productIds) {
  if (productIds.length === 0) return [];
  const { rows } = await db.query(
    `SELECT ${VARIANT_COLUMNS} FROM product_variants WHERE product_id = ANY($1::uuid[]) ORDER BY position, id`,
    [productIds]
  );
  return rows;
}

// `db` = pool (via les helpers) ou client de transaction : même interface .query()
const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

async function fetchProducts(db, whereSql, params) {
  const { rows } = await db.query(`SELECT ${PRODUCT_COLUMNS} FROM products ${whereSql}`, params);
  const variants = await loadVariants(db, rows.map((r) => r.id));
  return rows.map((r) => toProduct(r, variants));
}

/** Premier produit créé (équivalent de Product.findOne({}).sort({ _id: 1 })). */
export async function findFirstProduct() {
  const [product] = await fetchProducts(poolDb, "ORDER BY created_at, id LIMIT 1", []);
  return product ?? null;
}

/**
 * Produit par id. Accepte aussi un ancien ObjectId (24 hex) résolu via mongo_id :
 * les paniers persistés dans le localStorage des visiteurs contiennent encore ces ids.
 */
export async function findProductById(id, db = poolDb) {
  if (isUuid(id)) {
    const [p] = await fetchProducts(db, "WHERE id = $1", [id]);
    return p ?? null;
  }
  if (isMongoId(id)) {
    const [p] = await fetchProducts(db, "WHERE mongo_id = $1", [id.toLowerCase()]);
    return p ?? null;
  }
  return null;
}

/** Plusieurs produits par id (uuid ou ancien ObjectId), dans un objet Map clé = id demandé. */
export async function findProductsByIds(ids, db = poolDb) {
  const uuids = [...new Set(ids.filter(isUuid))];
  const mongoIds = [...new Set(ids.filter(isMongoId).map((i) => i.toLowerCase()))];
  if (uuids.length === 0 && mongoIds.length === 0) return new Map();
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}, mongo_id FROM products WHERE id = ANY($1::uuid[]) OR mongo_id = ANY($2::text[])`,
    [uuids, mongoIds]
  );
  const variants = await loadVariants(db, rows.map((r) => r.id));
  const byKey = new Map();
  for (const row of rows) {
    const product = toProduct(row, variants);
    byKey.set(row.id, product);
    if (row.mongo_id) byKey.set(row.mongo_id, product);
  }
  const result = new Map();
  for (const id of ids) {
    const product = typeof id === "string" ? byKey.get(id.toLowerCase()) : undefined;
    if (product) result.set(id, product);
  }
  return result;
}

function normalizeVariant(v, index) {
  if (!v?.colorName) throw new Error(`Variante ${index + 1} : colorName est obligatoire`);
  if (!v?.colorCode) throw new Error(`Variante ${index + 1} : colorCode est obligatoire`);
  return {
    colorName: String(v.colorName),
    colorCode: String(v.colorCode),
    textColor: v.textColor === undefined ? VARIANT_DEFAULTS.textColor : String(v.textColor),
    description: v.description === undefined ? VARIANT_DEFAULTS.description : String(v.description),
    image: v.image === undefined ? VARIANT_DEFAULTS.image : String(v.image),
    stock: v.stock === undefined ? VARIANT_DEFAULTS.stock : toInteger(v.stock, `variants[${index}].stock`),
    editionSize: v.editionSize === undefined
      ? VARIANT_DEFAULTS.editionSize
      : toInteger(v.editionSize, `variants[${index}].editionSize`),
  };
}

async function insertVariant(client, productId, v, position) {
  await client.query(
    `INSERT INTO product_variants
       (product_id, position, color_name, color_code, text_color, description, image, stock, edition_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [productId, position, v.colorName, v.colorCode, v.textColor, v.description, v.image, v.stock, v.editionSize]
  );
}

/**
 * Remplace les variantes d'un produit par `variants` (équivalent de `product.variants = …`).
 * Les variantes envoyées avec un `_id` existant sont mises à jour (leur id est conservé :
 * les commandes y font référence), les autres sont créées, celles absentes sont supprimées.
 */
async function syncVariants(client, productId, variants) {
  const normalized = variants.map(normalizeVariant);
  const { rows: existing } = await client.query(
    "SELECT id FROM product_variants WHERE product_id = $1",
    [productId]
  );
  const existingIds = new Set(existing.map((r) => r.id));
  const keptIds = variants.map((v) => (isUuid(v?._id) && existingIds.has(v._id) ? v._id : null));

  await client.query(
    "DELETE FROM product_variants WHERE product_id = $1 AND NOT (id = ANY($2::uuid[]))",
    [productId, keptIds.filter(Boolean)]
  );

  for (let i = 0; i < normalized.length; i++) {
    const v = normalized[i];
    if (keptIds[i]) {
      await client.query(
        `UPDATE product_variants
            SET position = $2, color_name = $3, color_code = $4, text_color = $5, description = $6,
                image = $7, stock = $8, edition_size = $9
          WHERE id = $1`,
        [keptIds[i], i, v.colorName, v.colorCode, v.textColor, v.description, v.image, v.stock, v.editionSize]
      );
    } else {
      await insertVariant(client, productId, v, i);
    }
  }
}

/** Règle de l'ancien hook pre('save') : avec des variantes, stock global = somme de leurs stocks. */
async function recomputeStockFromVariants(client, productId) {
  await client.query(
    `UPDATE products p
        SET stock = s.total
       FROM (SELECT product_id, SUM(stock)::int AS total FROM product_variants
              WHERE product_id = $1 GROUP BY product_id) s
      WHERE p.id = s.product_id AND p.stock IS DISTINCT FROM s.total`,
    [productId]
  );
}

/** Crée un produit (et ses variantes). Équivalent de Product.create(data). */
export async function createProduct(data) {
  return withTransaction(async (client) => {
    const { rows: [row] } = await client.query(
      `INSERT INTO products (name, price, price_promo, stock, visible, weight, customs_description_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.name,
        data.price === undefined ? 85 : toNumber(data.price, "price"),
        data.pricePromo ?? null,
        data.stock === undefined ? 0 : toInteger(data.stock, "stock"),
        data.visible ?? true,
        data.weight === undefined ? 100 : toNumber(data.weight, "weight"),
        data.customsDescriptionEn ?? "",
      ]
    );
    const variants = (data.variants ?? []).map(normalizeVariant);
    for (let i = 0; i < variants.length; i++) await insertVariant(client, row.id, variants[i], i);
    if (variants.length > 0) await recomputeStockFromVariants(client, row.id);
    return findProductById(row.id, client);
  });
}

/** Remplace les variantes d'un produit (utilisé pour poser les variantes par défaut). */
export async function setProductVariants(productId, variants) {
  return withTransaction(async (client) => {
    await syncVariants(client, productId, variants);
    if (variants.length > 0) await recomputeStockFromVariants(client, productId);
    return findProductById(productId, client);
  });
}

/**
 * Mise à jour partielle (PATCH admin). `patch` contient uniquement les champs à modifier,
 * déjà convertis comme le faisait la route (Number, Boolean…). Renvoie le produit à jour
 * ou null s'il n'existe pas.
 */
export async function updateProduct(id, patch) {
  if (!isUuid(id)) return null;
  return withTransaction(async (client) => {
    const { rows: [current] } = await client.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [id]);
    if (!current) return null;

    const columns = {
      name: "name", price: "price", pricePromo: "price_promo", stock: "stock",
      visible: "visible", weight: "weight",
    };
    const sets = [];
    const params = [id];
    for (const [key, column] of Object.entries(columns)) {
      if (patch[key] === undefined) continue;
      let value = patch[key];
      if (key === "price" || key === "weight") value = toNumber(value, key);
      if (key === "pricePromo" && value !== null) value = toNumber(value, key);
      if (key === "stock") value = toInteger(value, key);
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    if (sets.length > 0) {
      await client.query(`UPDATE products SET ${sets.join(", ")} WHERE id = $1`, params);
    }
    if (patch.variants !== undefined) await syncVariants(client, id, patch.variants ?? []);

    // Comme pre('save') : à chaque sauvegarde, le stock global suit la somme des variantes.
    await recomputeStockFromVariants(client, id);
    return findProductById(id, client);
  });
}

/**
 * Ajustement du stock global (route admin /stock) : stock = max(0, stock + delta).
 * Comme avant, si le produit a des variantes, le stock global est ensuite recalculé comme
 * leur somme (le delta n'a alors pas d'effet durable). Renvoie le nouveau stock ou null.
 */
export async function adjustProductStock(id, delta) {
  if (!isUuid(id)) return null;
  return withTransaction(async (client) => {
    const { rows: [row] } = await client.query(
      "UPDATE products SET stock = GREATEST(0, stock + $2) WHERE id = $1 RETURNING id",
      [id, toInteger(delta, "delta")]
    );
    if (!row) return null;
    await recomputeStockFromVariants(client, id);
    const { rows: [{ stock }] } = await client.query("SELECT stock FROM products WHERE id = $1", [id]);
    return stock;
  });
}

/** Poids d'un produit (grammes), ou null s'il n'existe pas. Accepte aussi un ancien ObjectId. */
export async function findProductWeight(id) {
  if (isUuid(id)) return (await queryOne("SELECT weight FROM products WHERE id = $1", [id]))?.weight ?? null;
  if (isMongoId(id)) {
    return (await queryOne("SELECT weight FROM products WHERE mongo_id = $1", [id.toLowerCase()]))?.weight ?? null;
  }
  return null;
}

/**
 * Applique `delta` au stock d'une ligne de commande, dans la transaction `client`.
 * Reproduit /api/order (décrément, plancher à 0) et applyOrderStatusChange (restitution) :
 *  - ligne avec variante : stock de la variante (seulement si elle appartient bien au produit),
 *    puis stock global = somme des variantes ;
 *  - ligne dont la variante n'existe plus (variant_id NULL mais variant_mongo_id renseigné) :
 *    aucun effet, comme l'updateOne Mongo qui ne trouvait plus la variante ;
 *  - ligne sans variante : stock global du produit.
 */
export async function applyLineStockDelta(client, line, delta, { floorZero = false } = {}) {
  const { productId, variantId, variantMongoId } = line;
  if (!productId) return;
  const expr = floorZero ? "GREATEST(0, stock + $3)" : "stock + $3";

  if (variantId) {
    const { rowCount } = await client.query(
      `UPDATE product_variants SET stock = ${expr} WHERE id = $1 AND product_id = $2`,
      [variantId, productId, delta]
    );
    if (rowCount > 0) {
      await client.query(
        `UPDATE products
            SET stock = (SELECT COALESCE(SUM(stock), 0)::int FROM product_variants WHERE product_id = $1)
          WHERE id = $1`,
        [productId]
      );
    }
    return;
  }
  if (variantMongoId) return;

  await client.query(
    `UPDATE products SET stock = ${expr.replace("$3", "$2")} WHERE id = $1`,
    [productId, delta]
  );
}
