// Accès aux commandes : orders + order_items + order_extra_payments + order_refunds +
// order_documents (étiquette / preuve de livraison en base64).
// Les fonctions de lecture renvoient des objets de même forme qu'un document Mongoose
// .lean() (`_id`, `customer`, `products[]` — avec `product` peuplé comme populate(),
// `shipping`, `extraPayments[]`, `refunds[]`…) pour que les routes et le front restent
// inchangés. Les champs Mongo sans valeur par défaut et non renseignés étaient absents du
// JSON : ils sont omis de la même façon (voir compact()).
import { query, withTransaction, isUuid, isMongoId } from "@/app/lib/neon";
import { findProductsByIds } from "@/app/lib/repos/products";

const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

/** Retire les clés à null/undefined (champ absent dans le document Mongo). */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

function toOrderDoc(row, related, { populate, documents }) {
  const items = related.items.filter((i) => i.order_id === row.id);
  const docs = related.docs.filter((d) => d.order_id === row.id);
  const docOf = (kind) => docs.find((d) => d.kind === kind)?.content_base64 ?? null;

  return {
    _id: row.id,
    ...(row.order_number !== null ? { orderNumber: row.order_number } : {}),
    userId: row.user_id ?? null,
    customer: compact({
      firstname: row.customer_firstname,
      lastname: row.customer_lastname,
      email: row.customer_email,
      phone: row.customer_phone,
      company: row.customer_company,
      city: row.customer_city,
      address: row.customer_address,
      postalCode: row.customer_postal_code,
      country: row.customer_country,
    }),
    recipientPickupName: row.recipient_pickup_name,
    products: items.map((i) => ({
      _id: i.id,
      product: populate
        ? (i.product_id ? related.productsById.get(i.product_id) ?? null : null)
        : i.product_id ?? i.product_mongo_id,
      quantity: i.quantity,
      color: i.color,
      variantId: i.variant_id ?? i.variant_mongo_id ?? null,
    })),
    ...(row.total !== null ? { total: row.total } : {}),
    shippingFee: row.shipping_fee,
    insurance: {
      opted: row.insurance_opted,
      declaredValue: row.insurance_declared_value,
      fee: row.insurance_fee,
    },
    promoCode: row.promo_code,
    promoDiscount: row.promo_discount,
    payment: row.payment,
    paymentIntentId: row.payment_intent_id,
    idempotencyKey: row.idempotency_key,
    delivery: row.delivery,
    status: row.status,
    shipping: compact({
      carrier: row.shipping_carrier,
      productCode: row.shipping_product_code,
      productKey: row.shipping_product_key,
      service: row.shipping_service,
      skybillNumber: row.shipping_skybill_number,
      labelBase64: documents ? docOf("label") : null,
      labelGeneratedAt: row.shipping_label_generated_at,
      weightKg: row.shipping_weight_kg,
      relayPoint: row.shipping_relay_point,
      trackingStatus: row.shipping_tracking_status,
      trackingEvents: row.shipping_tracking_events ?? [],
      lastTrackedAt: row.shipping_last_tracked_at,
      podBase64: documents ? docOf("pod") : null,
      shippingError: row.shipping_error,
      cancelledAt: row.shipping_cancelled_at,
    }),
    extraPayments: related.extras
      .filter((e) => e.order_id === row.id)
      .map((e) => ({
        _id: e.id,
        ...compact({
          reason: e.reason,
          amount: e.amount,
          status: e.status,
          stripeSessionId: e.stripe_session_id,
          checkoutUrl: e.checkout_url,
          createdAt: e.created_at,
          paidAt: e.paid_at,
        }),
      })),
    refunds: related.refunds
      .filter((r) => r.order_id === row.id)
      .map((r) => ({
        _id: r.id,
        ...compact({
          amount: r.amount,
          reason: r.reason,
          stripeRefundId: r.stripe_refund_id,
          status: r.status,
          createdAt: r.created_at,
        }),
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Charge les tables enfants et (si populate) les produits, puis assemble les documents. */
async function hydrate(db, rows, { populate = true, documents = true } = {}) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [items, extras, refunds, docs] = await Promise.all([
    db.query("SELECT * FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY order_id, position", [ids]),
    db.query("SELECT * FROM order_extra_payments WHERE order_id = ANY($1::uuid[]) ORDER BY created_at, id", [ids]),
    db.query("SELECT * FROM order_refunds WHERE order_id = ANY($1::uuid[]) ORDER BY created_at, id", [ids]),
    documents
      ? db.query("SELECT order_id, kind, content_base64 FROM order_documents WHERE order_id = ANY($1::uuid[])", [ids])
      : Promise.resolve({ rows: [] }),
  ]).then((results) => results.map((r) => r.rows));

  let productsById = new Map();
  if (populate) {
    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
    productsById = await findProductsByIds(productIds, db);
  }
  const related = { items, extras, refunds, docs, productsById };
  return rows.map((row) => toOrderDoc(row, related, { populate, documents }));
}

// Une transaction (client) ne doit pas exécuter de requêtes en parallèle sur la même
// connexion : on sérialise hydrate() quand db est un client de transaction.
function sequential(db) {
  if (db === poolDb) return db;
  let chain = Promise.resolve();
  return {
    query: (text, params) => {
      const run = chain.then(() => db.query(text, params));
      chain = run.catch(() => {});
      return run;
    },
  };
}

async function findOne(db, whereSql, params, options) {
  const { rows } = await db.query(`SELECT * FROM orders ${whereSql} LIMIT 1`, params);
  const [doc] = await hydrate(sequential(db), rows, options);
  return doc ?? null;
}

/**
 * Commande par id (uuid), produits peuplés. Options : populate (défaut true),
 * documents (labelBase64 / podBase64, défaut true), db (client de transaction).
 * @param {string} id
 * @param {{ db?: any, populate?: boolean, documents?: boolean }} [options]
 * @returns {Promise<any>}
 */
export async function findOrderById(id, { db = poolDb, ...options } = {}) {
  if (!isUuid(id)) return null;
  return findOne(db, "WHERE id = $1", [id], options);
}

/**
 * Commande par uuid ou par ancien ObjectId (mongo_id). Réservé au webhook Stripe : la
 * metadata des sessions créées avant la bascule contient encore l'id Mongo.
 */
export async function findOrderByAnyId(id, options = {}) {
  if (isUuid(id)) return findOrderById(id, options);
  if (isMongoId(id)) return findOne(poolDb, "WHERE mongo_id = $1", [id.toLowerCase()], options);
  return null;
}

export async function findOrderByIdempotencyKey(key, options = {}) {
  if (!key) return null;
  return findOne(poolDb, "WHERE idempotency_key = $1", [key], options);
}

/** Équivalent de Order.findOne({ paymentIntentId }) — seulement id et statut. */
export async function findOrderStatusByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return null;
  const { rows } = await poolDb.query(
    "SELECT id, status FROM orders WHERE payment_intent_id = $1 ORDER BY created_at LIMIT 1",
    [paymentIntentId]
  );
  return rows[0] ? { _id: rows[0].id, status: rows[0].status } : null;
}

/** Équivalent de Order.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(limit).populate(). */
export async function listOrders({ status, limit }) {
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE status = $1";
  }
  params.push(limit);
  const { rows } = await poolDb.query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
    params
  );
  return hydrate(poolDb, rows);
}

/**
 * Commandes d'un compte client (tableau de bord), plus récentes d'abord : équivalent de
 * Order.find({ $or: [{ userId }, { "customer.email": email }] }).sort({ createdAt: -1 }).
 * L'email est comparé tel quel (l'appelant le passe en minuscules, comme avant). Un userId
 * qui n'est pas un uuid est ignoré : la recherche se fait alors par email seul.
 * Les documents (étiquette / preuve de livraison) ne sont pas chargés.
 */
export async function listAccountOrders({ userId, email }, { populate = true } = {}) {
  const params = [];
  const conditions = [];
  if (isUuid(userId)) {
    params.push(userId);
    conditions.push(`user_id = $${params.length}`);
  }
  if (typeof email === "string" && email) {
    params.push(email);
    conditions.push(`customer_email = $${params.length}`);
  }
  if (conditions.length === 0) return [];
  const { rows } = await poolDb.query(
    `SELECT * FROM orders WHERE ${conditions.join(" OR ")} ORDER BY created_at DESC, id DESC`,
    params
  );
  return hydrate(poolDb, rows, { populate, documents: false });
}

/** Propriétaire d'une commande (contrôle d'accès client) : { userId, email } ou null. */
export async function findOrderOwnership(id) {
  if (!isUuid(id)) return null;
  const { rows } = await poolDb.query("SELECT user_id, customer_email FROM orders WHERE id = $1", [id]);
  return rows[0] ? { userId: rows[0].user_id, email: rows[0].customer_email } : null;
}

/**
 * Crée une commande et ses lignes dans la transaction `client`. `products` : lignes
 * { productId (uuid), quantity, color, variantId (uuid | null) }. Renvoie l'id créé.
 */
export async function insertOrder(client, data) {
  const c = data.customer;
  const rp = data.relayPoint ?? null;
  const { rows: [{ id }] } = await client.query(
    `INSERT INTO orders (
       order_number, user_id,
       customer_firstname, customer_lastname, customer_email, customer_phone, customer_company,
       customer_city, customer_address, customer_postal_code, customer_country,
       recipient_pickup_name, total, shipping_fee,
       insurance_opted, insurance_declared_value, insurance_fee,
       promo_code, promo_discount, payment, payment_intent_id, idempotency_key, delivery, status,
       shipping_relay_point
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     RETURNING id`,
    [
      data.orderNumber, data.userId,
      c.firstname, c.lastname, c.email, c.phone, c.company, c.city, c.address, c.postalCode, c.country,
      data.recipientPickupName, data.total, data.shippingFee,
      data.insurance.opted, data.insurance.declaredValue, data.insurance.fee,
      data.promoCode, data.promoDiscount, data.payment, data.paymentIntentId, data.idempotencyKey,
      data.delivery, data.status,
      rp === null ? null : JSON.stringify(rp),
    ]
  );
  for (let i = 0; i < data.products.length; i++) {
    const line = data.products[i];
    await client.query(
      `INSERT INTO order_items (order_id, position, product_id, product_mongo_id, quantity, color, variant_id)
       VALUES ($1, $2, $3, (SELECT mongo_id FROM products WHERE id = $3), $4, $5, $6)`,
      [id, i, line.productId, line.quantity, line.color, line.variantId]
    );
  }
  return id;
}

/** Prochain numéro de commande (séquence). */
export async function nextOrderNumber(client) {
  const { rows: [{ n }] } = await client.query("SELECT nextval('order_number_seq') AS n");
  return n;
}

/** Verrouille la commande pour la durée de la transaction ; renvoie { id, status } ou null. */
export async function lockOrder(client, id) {
  if (!isUuid(id)) return null;
  const { rows } = await client.query("SELECT id, status FROM orders WHERE id = $1 FOR UPDATE", [id]);
  return rows[0] ?? null;
}

/** Lignes d'une commande avec les références internes nécessaires au stock. */
export async function findOrderStockLines(client, orderId) {
  const { rows } = await client.query(
    `SELECT product_id, variant_id, variant_mongo_id, quantity
       FROM order_items WHERE order_id = $1 ORDER BY position`,
    [orderId]
  );
  return rows.map((r) => ({
    productId: r.product_id,
    variantId: r.variant_id,
    variantMongoId: r.variant_mongo_id,
    quantity: r.quantity ?? 0,
  }));
}

export async function setOrderStatus(client, id, status) {
  await client.query("UPDATE orders SET status = $2 WHERE id = $1", [id, status]);
}

const SHIPPING_COLUMNS = {
  carrier: "shipping_carrier",
  productCode: "shipping_product_code",
  productKey: "shipping_product_key",
  service: "shipping_service",
  skybillNumber: "shipping_skybill_number",
  labelGeneratedAt: "shipping_label_generated_at",
  weightKg: "shipping_weight_kg",
  relayPoint: "shipping_relay_point",
  trackingStatus: "shipping_tracking_status",
  trackingEvents: "shipping_tracking_events",
  lastTrackedAt: "shipping_last_tracked_at",
  shippingError: "shipping_error",
  cancelledAt: "shipping_cancelled_at",
};
const JSON_SHIPPING_FIELDS = new Set(["relayPoint", "trackingEvents"]);

/**
 * Met à jour des champs de order.shipping (équivalent de `order.shipping.x = …; save()`).
 * labelBase64 / podBase64 : passer par setOrderDocument().
 */
export async function updateOrderShipping(id, patch, db = poolDb) {
  if (!isUuid(id)) return false;
  const sets = [];
  const params = [id];
  for (const [key, value] of Object.entries(patch)) {
    const column = SHIPPING_COLUMNS[key];
    if (!column) throw new Error(`Champ shipping inconnu : ${key}`);
    params.push(JSON_SHIPPING_FIELDS.has(key) && value !== null && value !== undefined ? JSON.stringify(value) : value ?? null);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return true;
  // RETURNING plutôt que rowCount : le wrapper poolDb ne transmet que `rows`.
  const { rows } = await db.query(`UPDATE orders SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, params);
  return rows.length > 0;
}

/** Enregistre (ou supprime si content est vide) l'étiquette ('label') ou la preuve ('pod'). */
export async function setOrderDocument(id, kind, content, db = poolDb) {
  if (!content) {
    await db.query("DELETE FROM order_documents WHERE order_id = $1 AND kind = $2", [id, kind]);
    return;
  }
  await db.query(
    `INSERT INTO order_documents (order_id, kind, content_base64) VALUES ($1, $2, $3)
     ON CONFLICT (order_id, kind) DO UPDATE SET content_base64 = EXCLUDED.content_base64`,
    [id, kind, content]
  );
}

/**
 * Webhook Stripe checkout.session.completed : marque le paiement complémentaire comme payé
 * (s'il ne l'est pas déjà). orderRef / extraPaymentRef : uuid, ou ancien ObjectId pour les
 * sessions Stripe créées avant la bascule. Renvoie true si une ligne a été modifiée.
 */
export async function markExtraPaymentPaid(orderRef, extraPaymentRef) {
  const orderCol = isUuid(orderRef) ? "o.id" : isMongoId(orderRef) ? "o.mongo_id" : null;
  const extraCol = isUuid(extraPaymentRef) ? "e.id" : isMongoId(extraPaymentRef) ? "e.mongo_id" : null;
  if (!orderCol || !extraCol) return false;
  const { rows } = await poolDb.query(
    `UPDATE order_extra_payments e
        SET status = 'paid', paid_at = now()
       FROM orders o
      WHERE e.order_id = o.id
        AND ${orderCol} = $1::text::${orderCol === "o.id" ? "uuid" : "text"}
        AND ${extraCol} = $2::text::${extraCol === "e.id" ? "uuid" : "text"}
        AND e.status <> 'paid'
      RETURNING e.order_id`,
    [orderRef.toLowerCase(), extraPaymentRef.toLowerCase()]
  );
  if (rows.length === 0) return false;
  // order.save() mettait aussi à jour updatedAt de la commande
  await poolDb.query("UPDATE orders SET updated_at = now() WHERE id = $1", [rows[0].order_id]);
  return true;
}

// ---------------------------------------------------------------------------
// Admin commandes et expédition (lot 2b)
// ---------------------------------------------------------------------------

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Liste blanche des tris : Mongo acceptait n'importe quel champ, le SQL ne doit jamais
// recevoir un nom de colonne venant de la requête. Champ inconnu -> created_at.
const ADMIN_SORT_COLUMNS = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  total: "total",
  orderNumber: "order_number",
  status: "status",
};

/**
 * Liste admin paginée (GET /api/admin/orders) : recherche sur prénom, nom, email, ville et
 * téléphone (sous-chaîne insensible à la casse, comme le $regex /i) ou numéro de commande
 * exact ; filtre statut ; tri ; pagination. Renvoie aussi le nombre de commandes par statut.
 * Les documents base64 (étiquette, preuve de livraison) ne sont pas chargés : la liste ne
 * s'en sert pas, et l'export CSV les aurait tous rapatriés.
 */
export async function listAdminOrders({ search, status, sortField, sortDir, page, limit }) {
  const where = [];
  const params = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    const or = ["customer_firstname", "customer_lastname", "customer_email", "customer_city", "customer_phone"]
      .map((col) => `${col} ILIKE ${p}`);
    const numSearch = parseInt(search, 10);
    if (!Number.isNaN(numSearch)) {
      params.push(numSearch);
      or.push(`order_number = $${params.length}`);
    }
    where.push(`(${or.join(" OR ")})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const column = ADMIN_SORT_COLUMNS[sortField] ?? "created_at";
  const asc = sortDir === "asc";
  // Mongo place les valeurs absentes en premier en tri croissant, en dernier en décroissant.
  const orderSql = `${column} ${asc ? "ASC NULLS FIRST" : "DESC NULLS LAST"}, id ${asc ? "ASC" : "DESC"}`;

  const [{ rows }, { rows: [{ total }] }, { rows: countsByStatus }] = await Promise.all([
    poolDb.query(
      `SELECT * FROM orders ${whereSql} ORDER BY ${orderSql}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    ),
    poolDb.query(`SELECT count(*)::int AS total FROM orders ${whereSql}`, params),
    poolDb.query("SELECT status, count(*)::int AS count FROM orders GROUP BY status"),
  ]);

  return {
    orders: await hydrate(poolDb, rows, { populate: true, documents: false }),
    total,
    countsByStatus,
    totalAll: countsByStatus.reduce((sum, r) => sum + r.count, 0),
  };
}

/**
 * Corrige les coordonnées client et efface l'erreur d'expédition précédente
 * (PATCH /api/admin/orders/[id]/customer). Renvoie true si la commande existe.
 */
export async function updateOrderCustomer(id, c) {
  if (!isUuid(id)) return false;
  const { rows } = await poolDb.query(
    `UPDATE orders SET
       customer_firstname = $2, customer_lastname = $3, customer_email = $4, customer_phone = $5,
       customer_company = $6, customer_address = $7, customer_postal_code = $8, customer_city = $9,
       customer_country = $10, shipping_error = ''
     WHERE id = $1
     RETURNING id`,
    [id, c.firstname, c.lastname, c.email, c.phone, c.company, c.address, c.postalCode, c.city, c.country]
  );
  return rows.length > 0;
}

/**
 * Ajoute un paiement complémentaire (order.extraPayments.push + save). `id` est généré par
 * l'appelant avant la création de la session Stripe, car il figure dans sa metadata.
 */
export async function insertExtraPayment(orderId, e) {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO order_extra_payments (id, order_id, reason, amount, status, stripe_session_id, checkout_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.id, orderId, e.reason, e.amount, e.status, e.stripeSessionId, e.checkoutUrl]
    );
    await client.query("UPDATE orders SET updated_at = now() WHERE id = $1", [orderId]);
  });
}

/** Ajoute un remboursement (order.refunds.push + save). */
export async function insertRefund(orderId, r) {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO order_refunds (order_id, amount, reason, stripe_refund_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, r.amount, r.reason, r.stripeRefundId, r.status]
    );
    await client.query("UPDATE orders SET updated_at = now() WHERE id = $1", [orderId]);
  });
}

/**
 * Étiquette ('label') ou preuve de livraison ('pod') d'une commande, sans charger le reste.
 * null si la commande n'existe pas ; content = null si le document n'a pas été généré.
 */
export async function findOrderDocument(id, kind) {
  if (!isUuid(id)) return null;
  const { rows } = await poolDb.query(
    `SELECT o.order_number, d.content_base64
       FROM orders o LEFT JOIN order_documents d ON d.order_id = o.id AND d.kind = $2
      WHERE o.id = $1`,
    [id, kind]
  );
  if (rows.length === 0) return null;
  return { orderNumber: rows[0].order_number, content: rows[0].content_base64 ?? null };
}

/**
 * Commandes dont le suivi doit être rafraîchi par le cron : étiquette générée et statut
 * non terminal. Forme réduite, suffisante pour refreshOrderTracking().
 */
export async function listOrdersToTrack() {
  const { rows } = await poolDb.query(
    `SELECT id, status, shipping_skybill_number FROM orders
      WHERE status IN ('paid', 'processing', 'shipped')
        AND shipping_skybill_number IS NOT NULL AND shipping_skybill_number <> ''
      ORDER BY created_at, id`
  );
  return rows.map((r) => ({ _id: r.id, status: r.status, shipping: { skybillNumber: r.shipping_skybill_number } }));
}

/** Supprime la commande (lignes, paiements, remboursements, documents en cascade). */
export async function deleteOrder(client, id) {
  await client.query("DELETE FROM orders WHERE id = $1", [id]);
}
