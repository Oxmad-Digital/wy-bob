// Accès aux factures : invoices + invoice_line_items + invoice_documents (PDF base64).
// Forme identique aux documents Mongoose (`_id`, `order`, `customer`, `lineItems[]`,
// `sellerSnapshot`, `pdfBase64` quand demandé).
import { query, isUuid } from "@/app/lib/neon";

const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

function toInvoiceDoc(row, lines, pdfBase64) {
  return {
    _id: row.id,
    invoiceNumber: row.invoice_number,
    year: row.year,
    sequence: row.sequence,
    order: row.order_id,
    orderNumber: row.order_number,
    customer: compact({
      firstname: row.customer_firstname,
      lastname: row.customer_lastname,
      email: row.customer_email,
      company: row.customer_company,
      address: row.customer_address,
      city: row.customer_city,
      postalCode: row.customer_postal_code,
      country: row.customer_country,
    }),
    lineItems: lines
      .filter((l) => l.invoice_id === row.id)
      .map((l) => ({
        _id: l.id,
        ...compact({ name: l.name, quantity: l.quantity, unitPriceTtc: l.unit_price_ttc, totalTtc: l.total_ttc }),
      })),
    ...compact({ subtotalTtc: row.subtotal_ttc, shippingFeeTtc: row.shipping_fee_ttc }),
    promoDiscount: row.promo_discount,
    vatApplicable: row.vat_applicable,
    vatRate: row.vat_rate,
    ...compact({ totalHt: row.total_ht, vatAmount: row.vat_amount, totalTtc: row.total_ttc }),
    sellerSnapshot: compact({
      companyName: row.seller_company_name,
      legalForm: row.seller_legal_form,
      address: row.seller_address,
      city: row.seller_city,
      postalCode: row.seller_postal_code,
      siret: row.seller_siret,
      vatNumber: row.seller_vat_number,
      iban: row.seller_iban,
    }),
    ...(pdfBase64 !== undefined ? { pdfBase64 } : {}),
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hydrate(db, rows, { withPdf }) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { rows: lines } = await db.query(
    "SELECT * FROM invoice_line_items WHERE invoice_id = ANY($1::uuid[]) ORDER BY invoice_id, position",
    [ids]
  );
  let pdfs = new Map();
  if (withPdf) {
    const { rows: docs } = await db.query(
      "SELECT invoice_id, content_base64 FROM invoice_documents WHERE invoice_id = ANY($1::uuid[]) AND kind = 'pdf'",
      [ids]
    );
    pdfs = new Map(docs.map((d) => [d.invoice_id, d.content_base64]));
  }
  return rows.map((r) => toInvoiceDoc(r, lines, withPdf ? pdfs.get(r.id) ?? null : undefined));
}

/**
 * Facture d'une commande (Invoice.findOne({ order })), PDF inclus par défaut.
 * withPdf: false équivaut à .select("-pdfBase64").
 */
export async function findInvoiceByOrderId(orderId, db = poolDb, { withPdf = true } = {}) {
  if (!isUuid(orderId)) return null;
  const { rows } = await db.query("SELECT * FROM invoices WHERE order_id = $1", [orderId]);
  const [doc] = await hydrate(db, rows, { withPdf });
  return doc ?? null;
}

/** Numéro de la facture d'une commande, ou null s'il n'y en a pas. */
export async function findInvoiceNumberByOrderId(orderId, db = poolDb) {
  if (!isUuid(orderId)) return null;
  const { rows } = await db.query("SELECT invoice_number FROM invoices WHERE order_id = $1", [orderId]);
  return rows[0]?.invoice_number ?? null;
}

/** PDF et numéro d'une facture (route admin /pdf). */
export async function findInvoicePdf(id) {
  if (!isUuid(id)) return null;
  const row = (await query(
    `SELECT i.invoice_number, d.content_base64
       FROM invoices i LEFT JOIN invoice_documents d ON d.invoice_id = i.id AND d.kind = 'pdf'
      WHERE i.id = $1`,
    [id]
  ))[0];
  return row ? { invoiceNumber: row.invoice_number, pdfBase64: row.content_base64 } : null;
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Liste admin : filtre année + recherche (numéro de facture, prénom, nom, email, numéro de
 * commande), tri par date d'émission décroissante, sans le PDF. Renvoie aussi le total
 * filtré, le nombre total de factures et la somme TTC de toutes les factures.
 */
export async function listInvoices({ search, year, page, limit }) {
  const where = [];
  const params = [];
  if (year) {
    params.push(Number(year));
    where.push(`year = $${params.length}`);
  }
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    const or = [
      `invoice_number ILIKE ${p}`,
      `customer_firstname ILIKE ${p}`,
      `customer_lastname ILIKE ${p}`,
      `customer_email ILIKE ${p}`,
    ];
    const numSearch = parseInt(search, 10);
    if (!Number.isNaN(numSearch)) {
      params.push(numSearch);
      or.push(`order_number = $${params.length}`);
    }
    where.push(`(${or.join(" OR ")})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [{ rows: pageRows }, { rows: [{ total }] }, { rows: [stats] }] = await Promise.all([
    poolDb.query(
      `SELECT * FROM invoices ${whereSql} ORDER BY issued_at DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    ),
    poolDb.query(`SELECT count(*)::int AS total FROM invoices ${whereSql}`, params),
    poolDb.query("SELECT count(*)::int AS total_all, COALESCE(SUM(total_ttc), 0) AS total_amount FROM invoices"),
  ]);

  return {
    invoices: await hydrate(poolDb, pageRows, { withPdf: false }),
    total,
    totalAll: stats.total_all,
    totalAmount: stats.total_amount,
  };
}

/** Supprime une facture (et son PDF, en cascade). Renvoie true si elle existait. */
export async function deleteInvoice(id) {
  if (!isUuid(id)) return false;
  const rows = await query("DELETE FROM invoices WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}

/**
 * Prochaine séquence de facture pour `year`, dans la transaction `client` : le verrou de
 * ligne sérialise les émissions concurrentes et un ROLLBACK annule l'incrément, d'où une
 * numérotation continue sans trou.
 */
export async function nextInvoiceSequence(client, year) {
  const { rows: [{ seq }] } = await client.query(
    `INSERT INTO invoice_counters (year, seq) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET seq = invoice_counters.seq + 1
     RETURNING seq`,
    [year]
  );
  return seq;
}

/** Insère la facture, ses lignes et son PDF dans la transaction `client`. Renvoie le document. */
export async function insertInvoice(client, inv) {
  const c = inv.customer ?? {};
  const s = inv.sellerSnapshot ?? {};
  const { rows: [row] } = await client.query(
    `INSERT INTO invoices (
       invoice_number, year, sequence, order_id, order_number,
       customer_firstname, customer_lastname, customer_email, customer_company,
       customer_address, customer_city, customer_postal_code, customer_country,
       subtotal_ttc, shipping_fee_ttc, promo_discount, vat_applicable, vat_rate,
       total_ht, vat_amount, total_ttc,
       seller_company_name, seller_legal_form, seller_address, seller_city, seller_postal_code,
       seller_siret, seller_vat_number, seller_iban, issued_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
     RETURNING *`,
    [
      inv.invoiceNumber, inv.year, inv.sequence, inv.order, inv.orderNumber ?? null,
      c.firstname ?? null, c.lastname ?? null, c.email ?? null, c.company ?? null,
      c.address ?? null, c.city ?? null, c.postalCode ?? null, c.country ?? null,
      inv.subtotalTtc, inv.shippingFeeTtc, inv.promoDiscount ?? 0, inv.vatApplicable ?? false, inv.vatRate ?? 0,
      inv.totalHt, inv.vatAmount, inv.totalTtc,
      s.companyName ?? null, s.legalForm ?? null, s.address ?? null, s.city ?? null, s.postalCode ?? null,
      s.siret ?? null, s.vatNumber ?? null, s.iban ?? null, inv.issuedAt,
    ]
  );
  for (let i = 0; i < inv.lineItems.length; i++) {
    const l = inv.lineItems[i];
    await client.query(
      `INSERT INTO invoice_line_items (invoice_id, position, name, quantity, unit_price_ttc, total_ttc)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [row.id, i, l.name ?? null, l.quantity ?? null, l.unitPriceTtc ?? null, l.totalTtc ?? null]
    );
  }
  await client.query(
    "INSERT INTO invoice_documents (invoice_id, kind, content_base64) VALUES ($1, 'pdf', $2)",
    [row.id, inv.pdfBase64]
  );
  const [doc] = await hydrate(client, [row], { withPdf: true });
  return doc;
}
