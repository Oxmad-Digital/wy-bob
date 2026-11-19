// Accès aux fiches clients CRM (table customers, liée aux users par email — pas de FK).
// Lot 2a : mise à jour après commande. Lot 3e : liste admin, fiche, création, modification,
// synchronisation depuis les commandes et les comptes. Lot 3f : suppression / anonymisation RGPD.
import { query, queryOne, withTransaction, isUuid } from "@/app/lib/neon";

/** Forme d'un document Customer Mongoose (.lean()). */
export function toCustomer(row) {
  if (!row) return null;
  return {
    _id: row.id,
    firstname: row.firstname,
    lastname: row.lastname,
    email: row.email,
    phone: row.phone,
    city: row.city,
    address: row.address,
    totalOrders: row.total_orders,
    totalSpent: row.total_spent,
    ...(row.last_order_at !== null ? { lastOrderAt: row.last_order_at } : {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Email déjà présent dans customers (création admin) : la route répond 400. */
export class CustomerExistsError extends Error {}

/** Mongoose refusait firstname / email vides (`required`) ; NOT NULL SQL accepterait ''. */
function assertRequired(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value === null || value === "") {
      throw new Error(`Customer validation failed: ${key}: Path \`${key}\` is required.`);
    }
  }
}

// -----------------------------------------------------------------------------
// Liste admin (GET /api/customers)
// -----------------------------------------------------------------------------

// Même projection que l'ancien pipeline User.aggregate : on part des COMPTES (users), joints
// à leur fiche par email ; un client sans compte (achat invité) n'apparaît donc pas.
// Prénom / nom de repli : premier mot du nom du compte, puis le reste (trim), comme
// $split(" ") + $reduce + $trim.
const ACCOUNT_CUSTOMERS = `
  SELECT COALESCE(c.id, u.id)                                   AS id,
         COALESCE(c.firstname, split_part(btrim(u.name), ' ', 1)) AS firstname,
         COALESCE(c.lastname,
                  CASE WHEN strpos(btrim(u.name), ' ') > 0
                       THEN btrim(substr(btrim(u.name), strpos(btrim(u.name), ' ') + 1))
                       ELSE '' END)                             AS lastname,
         u.email                                                AS email,
         COALESCE(c.phone, u.phone, '')                         AS phone,
         COALESCE(c.city, u.address_city, '')                   AS city,
         COALESCE(c.address, u.address_street, '')              AS address,
         COALESCE(c.total_orders, 0)                            AS total_orders,
         COALESCE(c.total_spent, 0)                             AS total_spent,
         c.last_order_at                                        AS last_order_at,
         COALESCE(c.status, 'active')                           AS status,
         COALESCE(u.role, 'customer')                           AS role,
         COALESCE(c.created_at, u.created_at)                   AS created_at,
         COALESCE(c.updated_at, u.created_at)                   AS updated_at
    FROM users u
    LEFT JOIN customers c ON c.email = u.email`;

// Champs triables (liste blanche de la route) -> expression SQL. Textes en COLLATE "C" :
// ordre binaire, comme le tri de chaînes de MongoDB.
const SORT_COLUMNS = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  totalOrders: "total_orders",
  totalSpent: "total_spent",
  lastOrderAt: "last_order_at",
  firstname: 'firstname COLLATE "C"',
  lastname: 'lastname COLLATE "C"',
  email: 'email COLLATE "C"',
};

/** Échappe %, _ et \ pour un motif ILIKE (recherche littérale, comme la regex échappée). */
function likePattern(search) {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Équivalent du pipeline $lookup / $project / $match / $sort / $facet de GET /api/customers.
 * Tri : MongoDB place les valeurs nulles en premier en ordre croissant et en dernier en ordre
 * décroissant (NULLS FIRST / NULLS LAST explicites) ; départage par id.
 * Renvoie { customers, total }.
 */
export async function listCustomersWithAccounts({ search, status, sortField, sortDir, page, limit }) {
  const params = [];
  const conditions = [];
  if (search) {
    params.push(likePattern(search));
    const p = `$${params.length}`;
    conditions.push(`(firstname ILIKE ${p} OR lastname ILIKE ${p} OR email ILIKE ${p} OR phone ILIKE ${p})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const column = SORT_COLUMNS[sortField] ?? SORT_COLUMNS.createdAt;
  const order = sortDir === 1 ? "ASC NULLS FIRST" : "DESC NULLS LAST";

  const [rows, countRow] = await Promise.all([
    query(
      `SELECT * FROM (${ACCOUNT_CUSTOMERS}) t ${where}
        ORDER BY ${column} ${order}, id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    ),
    queryOne(`SELECT COUNT(*) AS count FROM (${ACCOUNT_CUSTOMERS}) t ${where}`, params),
  ]);

  return {
    customers: rows.map((r) => ({
      _id: r.id,
      firstname: r.firstname,
      lastname: r.lastname,
      email: r.email,
      phone: r.phone,
      city: r.city,
      address: r.address,
      totalOrders: r.total_orders,
      totalSpent: r.total_spent,
      lastOrderAt: r.last_order_at,
      status: r.status,
      role: r.role,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total: countRow.count,
  };
}

// -----------------------------------------------------------------------------
// Fiche (GET / PUT /api/customers/[id]) et création (POST /api/customers)
// -----------------------------------------------------------------------------

/** Équivalent de Customer.findById(id) — null si absent ou id mal formé. */
export async function findCustomerById(id) {
  if (!isUuid(id)) return null;
  return toCustomer(await queryOne("SELECT * FROM customers WHERE id = $1", [id]));
}

/** Équivalent de Customer.findOne({ email }) !== null. */
export async function customerEmailExists(email) {
  const row = await queryOne("SELECT 1 FROM customers WHERE email = $1", [email]);
  return row !== null;
}

/** Équivalent de Customer.create({ firstname, lastname, email, phone, city, address }). */
export async function createCustomer({ firstname, lastname, email, phone, city, address }) {
  assertRequired({ firstname: firstname ?? null, email: email ?? null });
  try {
    const row = await queryOne(
      `INSERT INTO customers (firstname, lastname, email, phone, city, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [firstname, lastname ?? "", email, phone ?? "", city ?? "", address ?? ""]
    );
    return toCustomer(row);
  } catch (err) {
    if (err?.code === "23505") throw new CustomerExistsError("Ce client existe déjà");
    throw err;
  }
}

// Champs modifiables par PUT : ceux du schéma Customer (le mode strict de Mongoose ignorait
// les autres, dont `notes` envoyé par le formulaire admin). Textes nuls -> '' (colonnes NOT NULL).
const UPDATE_COLUMNS = {
  firstname: ["firstname", "text"],
  lastname: ["lastname", "text"],
  email: ["email", "email"],
  phone: ["phone", "text"],
  city: ["city", "text"],
  address: ["address", "text"],
  totalOrders: ["total_orders", "raw"],
  totalSpent: ["total_spent", "raw"],
  lastOrderAt: ["last_order_at", "raw"],
  status: ["status", "raw"],
};

function castUpdateValue(kind, value) {
  if (kind === "email") return typeof value === "string" ? value.toLowerCase() : value;
  if (kind === "text") return value ?? "";
  return value;
}

/**
 * Équivalent de Customer.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true }).
 * Renvoie la fiche mise à jour, ou null si l'id est mal formé ou absent.
 */
export async function updateCustomer(id, body) {
  const patch = body && typeof body === "object" ? body : {};
  assertRequired({ firstname: patch.firstname, email: patch.email });
  if (!isUuid(id)) return null;

  const sets = [];
  const params = [];
  for (const [key, [column, kind]] of Object.entries(UPDATE_COLUMNS)) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    params.push(castUpdateValue(kind, patch[key]));
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return findCustomerById(id);

  params.push(id);
  return toCustomer(
    await queryOne(`UPDATE customers SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params)
  );
}

/**
 * Équivalent de Customer.findOneAndUpdate({ email }, { $set: fields }, { upsert: true, new: true }) :
 * crée ou met à jour la fiche de l'email d'un compte (PUT sur un id de compte sans fiche).
 */
export async function upsertCustomerForEmail(email, { firstname, lastname, phone, city, address, status }) {
  assertRequired({ firstname, email });
  const row = await queryOne(
    `INSERT INTO customers (firstname, lastname, email, phone, city, address, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET
       firstname = EXCLUDED.firstname, lastname = EXCLUDED.lastname, phone = EXCLUDED.phone,
       city = EXCLUDED.city, address = EXCLUDED.address, status = EXCLUDED.status
     RETURNING *`,
    [firstname, lastname ?? "", email, phone ?? "", city ?? "", address ?? "", status]
  );
  return toCustomer(row);
}

// -----------------------------------------------------------------------------
// Synchronisation (POST /api/customers { action: "sync" })
// -----------------------------------------------------------------------------

/**
 * Équivalent de syncCustomersFromOrders() :
 *  1. par email de commande (en minuscules) : coordonnées de la commande la plus récente,
 *     nombre de commandes, somme des totaux, date de la dernière commande ;
 *  2. comptes non admin sans commande : prénom = premier mot du nom, nom = le reste (sans
 *     trim, comme avant), téléphone / ville / rue du compte, aucune commande ;
 *  3. upsert par email ($set) : le statut des fiches existantes n'est pas modifié.
 * Renvoie { created, updated }.
 */
export async function syncCustomersFromOrdersAndUsers() {
  const rows = await query(
    `WITH o AS (
       SELECT lower(customer_email) AS email, customer_firstname, customer_lastname,
              customer_phone, customer_city, customer_address, total, created_at, id
         FROM orders
        WHERE customer_email IS NOT NULL
     ),
     latest AS (
       SELECT DISTINCT ON (email) * FROM o ORDER BY email, created_at DESC, id DESC
     ),
     agg AS (
       SELECT email, COUNT(*)::int AS total_orders, COALESCE(SUM(COALESCE(total, 0)), 0) AS total_spent
         FROM o GROUP BY email
     ),
     from_orders AS (
       SELECT l.email,
              COALESCE(l.customer_firstname, '') AS firstname,
              COALESCE(l.customer_lastname, '')  AS lastname,
              COALESCE(l.customer_phone, '')     AS phone,
              COALESCE(l.customer_city, '')      AS city,
              COALESCE(l.customer_address, '')   AS address,
              a.total_orders, a.total_spent,
              l.created_at                       AS last_order_at
         FROM latest l JOIN agg a USING (email)
     ),
     from_users AS (
       SELECT lower(u.email) AS email,
              split_part(btrim(u.name), ' ', 1) AS firstname,
              CASE WHEN strpos(btrim(u.name), ' ') > 0
                   THEN substr(btrim(u.name), strpos(btrim(u.name), ' ') + 1)
                   ELSE '' END                  AS lastname,
              COALESCE(u.phone, '')             AS phone,
              COALESCE(u.address_city, '')      AS city,
              COALESCE(u.address_street, '')    AS address,
              0                                 AS total_orders,
              0::numeric                        AS total_spent,
              NULL::timestamptz                 AS last_order_at
         FROM users u
        WHERE u.role <> 'admin'
          AND NOT EXISTS (SELECT 1 FROM from_orders f WHERE f.email = lower(u.email))
     ),
     src AS (
       SELECT * FROM from_orders
       UNION ALL
       SELECT * FROM from_users
     )
     INSERT INTO customers (firstname, lastname, email, phone, city, address,
                            total_orders, total_spent, last_order_at)
     SELECT firstname, lastname, email, phone, city, address, total_orders, total_spent, last_order_at
       FROM src
     ON CONFLICT (email) DO UPDATE SET
       firstname     = EXCLUDED.firstname,
       lastname      = EXCLUDED.lastname,
       phone         = EXCLUDED.phone,
       city          = EXCLUDED.city,
       address       = EXCLUDED.address,
       total_orders  = EXCLUDED.total_orders,
       total_spent   = EXCLUDED.total_spent,
       last_order_at = EXCLUDED.last_order_at
     RETURNING (xmax = 0) AS inserted`
  );
  const created = rows.filter((r) => r.inserted).length;
  return { created, updated: rows.length - created };
}

/**
 * Met à jour (ou crée) la fiche client après une commande, dans la transaction `client`.
 * Même règles que l'ancien code de /api/order :
 *  - fiche existante : totalOrders + 1, totalSpent + total, lastOrderAt = maintenant, et
 *    phone / city / address ne sont renseignés que s'ils étaient vides ;
 *  - sinon : création avec status "active".
 * Un seul INSERT … ON CONFLICT : deux premières commandes simultanées du même email ne
 * peuvent pas créer de doublon ni faire échouer la commande.
 */
export async function recordCustomerOrder(client, { firstname, lastname, email, phone, city, address, total }) {
  await client.query(
    `INSERT INTO customers
       (firstname, lastname, email, phone, city, address, total_orders, total_spent, last_order_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7, now(), 'active')
     ON CONFLICT (email) DO UPDATE SET
       total_orders  = customers.total_orders + 1,
       total_spent   = customers.total_spent + EXCLUDED.total_spent,
       last_order_at = now(),
       phone   = CASE WHEN customers.phone   = '' AND EXCLUDED.phone   <> '' THEN EXCLUDED.phone   ELSE customers.phone   END,
       city    = CASE WHEN customers.city    = '' AND EXCLUDED.city    <> '' THEN EXCLUDED.city    ELSE customers.city    END,
       address = CASE WHEN customers.address = '' AND EXCLUDED.address <> '' THEN EXCLUDED.address ELSE customers.address END`,
    [firstname, lastname ?? "", email, phone || "", city || "", address || "", total]
  );
}

// -----------------------------------------------------------------------------
// Suppression / anonymisation RGPD (DELETE /api/customers/[id]) — lot 3f
// -----------------------------------------------------------------------------

/**
 * Supprime le compte (adresses en cascade), la fiche client et les codes de parrainage jamais
 * utilisés du parrain, dans la transaction `client`. Les codes de parrainage déjà utilisés
 * restent (historique, used_count conservé) mais sont désactivés (active = false) ; leur
 * referrer_id passe à NULL par la clé étrangère. L'ancien id Mongo
 * du compte est effacé des usages de codes (promo_code_uses.user_mongo_id).
 */
async function removeAccountAndCustomer(client, { user, customer }) {
  if (user) {
    await client.query(
      `DELETE FROM promo_codes p
        WHERE p.is_referral AND p.referrer_id = $1 AND p.used_count = 0
          AND NOT EXISTS (SELECT 1 FROM promo_code_uses x WHERE x.promo_code_id = p.id)`,
      [user.id]
    );
    await client.query("UPDATE promo_codes SET active = false WHERE is_referral AND referrer_id = $1", [user.id]);
    await client.query(
      `UPDATE promo_code_uses SET user_mongo_id = NULL
        WHERE user_id = $1 OR ($2::text IS NOT NULL AND user_mongo_id = $2)`,
      [user.id, user.mongo_id]
    );
    await client.query("DELETE FROM users WHERE id = $1", [user.id]);
  }
  if (customer) {
    await client.query("DELETE FROM customers WHERE id = $1", [customer.id]);
  }
}

/**
 * Équivalent du DELETE de /api/customers/[id], en une seule transaction. `id` = id de fiche
 * client, ou id de compte (utilisateur sans fiche). Renvoie :
 *   { kind: "not_found" }                       id mal formé, ni fiche ni compte
 *   { kind: "admin" }                           compte administrateur lié : refusé
 *   { kind: "deleted", hadCustomer }            aucune commande : compte + fiche supprimés
 *   { kind: "needs_action", ordersCount }       commandes et action !== "anonymize"
 *   { kind: "anonymized", ordersCount }         commandes anonymisées, compte + fiche supprimés
 *
 * Commandes concernées : email de commande égal à l'email du client (sans tenir compte de la
 * casse), ou rattachées au compte (user_id, ou ancien id Mongo resté dans user_mongo_id).
 * Anonymisation : seul le pays est conservé dans les coordonnées ; nom et email deviennent un
 * pseudonyme ("Client" / "Anonyme #XXXXXX" / deleted_<id>@anonymized.local) ; téléphone,
 * société, ville, adresse, code postal, point relais, numéro de suivi, user_id et user_mongo_id
 * à NULL ; historique de suivi vidé ; étiquettes et preuves de livraison supprimées.
 * Montants, remboursements, paiements complémentaires, payment_intent_id et factures (avec leur
 * PDF) sont conservés.
 */
export async function deleteOrAnonymizeCustomer(id, action) {
  if (!isUuid(id)) return { kind: "not_found" };

  return withTransaction(async (client) => {
    const one = async (sql, params) => (await client.query(sql, params)).rows[0] ?? null;

    let customer = await one("SELECT id, email FROM customers WHERE id = $1 FOR UPDATE", [id]);
    let user;
    if (customer) {
      user = await one("SELECT id, email, role, mongo_id FROM users WHERE email = $1 FOR UPDATE", [customer.email]);
    } else {
      // Fallback : l'id est celui d'un compte (utilisateur sans fiche client).
      user = await one("SELECT id, email, role, mongo_id FROM users WHERE id = $1 FOR UPDATE", [id]);
      if (!user) return { kind: "not_found" };
      customer = await one("SELECT id, email FROM customers WHERE email = $1 FOR UPDATE", [user.email]);
    }

    if (user?.role === "admin") return { kind: "admin" };

    const email = customer?.email ?? user.email;
    const { rows: orderRows } = await client.query(
      `SELECT id FROM orders
        WHERE lower(customer_email) = lower($1)
           OR ($2::uuid IS NOT NULL AND user_id = $2)
           OR ($3::text IS NOT NULL AND user_mongo_id = $3)
        FOR UPDATE`,
      [email, user?.id ?? null, user?.mongo_id ?? null]
    );
    const ordersCount = orderRows.length;

    if (ordersCount === 0) {
      await removeAccountAndCustomer(client, { user, customer });
      return { kind: "deleted", hadCustomer: customer !== null };
    }

    if (action !== "anonymize") return { kind: "needs_action", ordersCount };

    const orderIds = orderRows.map((r) => r.id);
    await client.query("DELETE FROM order_documents WHERE order_id = ANY($1::uuid[])", [orderIds]);
    await client.query(
      `UPDATE orders SET
         customer_firstname       = 'Client',
         customer_lastname        = $2,
         customer_email           = $3,
         customer_phone           = NULL,
         customer_company         = NULL,
         customer_city            = NULL,
         customer_address         = NULL,
         customer_postal_code     = NULL,
         recipient_pickup_name    = '',
         shipping_relay_point     = NULL,
         shipping_skybill_number  = NULL,
         shipping_tracking_events = '[]'::jsonb,
         user_id                  = NULL,
         user_mongo_id            = NULL
       WHERE id = ANY($1::uuid[])`,
      [orderIds, `Anonyme #${id.slice(-6).toUpperCase()}`, `deleted_${id}@anonymized.local`]
    );

    await removeAccountAndCustomer(client, { user, customer });
    return { kind: "anonymized", ordersCount };
  });
}
