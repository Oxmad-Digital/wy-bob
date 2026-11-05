#!/usr/bin/env node
/**
 * Migration MongoDB (wybob) -> PostgreSQL (Neon).
 *
 *   node scripts/migrate-mongo-to-neon.mjs --dry-run      # lit Mongo, transforme, valide ; ne se connecte PAS à Neon
 *   node scripts/migrate-mongo-to-neon.mjs                # migration réelle (une seule transaction)
 *
 * Options :
 *   --dry-run                 aucune connexion ni écriture Neon
 *   --db=<nom>                base Mongo (défaut : celle de l'URI, sinon "wybob")
 *   --env=<fichier>           fichier d'environnement (défaut : .env.local)
 *   --tls-insecure            équivalent de tlsAllowInvalidCertificates (comme src/app/lib/db.ts), à n'utiliser que si nécessaire
 *   --allow-unknown-fields    autorise le mode réel malgré des champs Mongo non mappés (ils ne seraient PAS migrés)
 *
 * Connexion Neon : WebSocket sur le port 443 (@neondatabase/serverless + ws), pas de TCP 5432.
 *
 * Garanties :
 *   - Mongo : lecture seule (find / countDocuments / listCollections uniquement).
 *   - Neon  : une transaction ; ON CONFLICT (mongo_id) DO NOTHING ; uuid existants réutilisés => relançable.
 *   - Le mode réel refuse de démarrer s'il reste une violation de contrainte.
 *   - Les valeurs de MONGODB_URI / DATABASE_URL ne sont jamais affichées (messages d'erreur nettoyés).
 * Voir db/MAPPING.md pour le détail du mapping.
 */

import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Connexion Neon par WebSocket (port 443) au lieu du TCP 5432, bloqué depuis certains réseaux.
// Le Pool expose la même API que pg (connect / query / release) : la logique de transaction
// est inchangée, toutes les requêtes passent par un seul client obtenu via pool.connect().
neonConfig.webSocketConstructor = ws;

// -----------------------------------------------------------------------------
// Arguments & environnement
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const DRY_RUN = flag("dry-run");
const TLS_INSECURE = flag("tls-insecure");
const ALLOW_UNKNOWN = flag("allow-unknown-fields");
const ENV_FILE = opt("env") ?? ".env.local";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8").replace(/^﻿/, "");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnvFile(ENV_FILE);

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL;
const SECRETS = [MONGODB_URI, DATABASE_URL].filter(Boolean);

/** Retire toute trace des URI (et des identifiants d'URL en général) d'un message. */
function sanitize(message) {
  let out = String(message ?? "");
  for (const s of SECRETS) out = out.split(s).join("***");
  return out.replace(/([a-z+]+:\/\/)[^\s/@]+@/gi, "$1***@");
}

function fail(message, code = 1) {
  console.error(`\n❌ ${sanitize(message)}`);
  process.exit(code);
}

if (!MONGODB_URI) fail(`MONGODB_URI absent (fichier ${ENV_FILE} ou environnement).`);
if (!DRY_RUN && !DATABASE_URL) fail(`DATABASE_URL absent (fichier ${ENV_FILE} ou environnement).`);

function dbNameFromUri(uri) {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}
const DB_NAME = opt("db") ?? dbNameFromUri(MONGODB_URI) ?? "wybob";

const COLLECTIONS = [
  "counters", "customers", "galleryphotos", "invoices", "orders", "products",
  "promocodes", "ratelimitattempts", "referralconfigs", "sitesettings", "users",
];

// Ordre d'insertion (dépendances FK). invoice_counters et order_number_seq sont traités à part.
const TABLE_ORDER = [
  "users", "user_addresses", "customers",
  "products", "product_variants",
  "promo_codes", "promo_code_uses",
  "orders", "order_items", "order_extra_payments", "order_refunds", "order_documents",
  "invoices", "invoice_line_items", "invoice_documents",
  "referral_configs", "site_settings", "gallery_photos", "rate_limit_attempts",
];

// Pour le tableau final : table Neon -> libellé source Mongo
const TABLE_SOURCE = {
  users: "users", user_addresses: "users.addresses[]", customers: "customers",
  products: "products", product_variants: "products.variants[]",
  promo_codes: "promocodes", promo_code_uses: "promocodes.usedByUserIds[]",
  orders: "orders", order_items: "orders.products[]", order_extra_payments: "orders.extraPayments[]",
  order_refunds: "orders.refunds[]", order_documents: "orders.shipping.{label,pod}Base64",
  invoices: "invoices", invoice_line_items: "invoices.lineItems[]", invoice_documents: "invoices.pdfBase64",
  referral_configs: "referralconfigs", site_settings: "sitesettings",
  gallery_photos: "galleryphotos", rate_limit_attempts: "ratelimitattempts",
};

// -----------------------------------------------------------------------------
// Champs connus par collection (miroir des modèles Mongoose) — détection des champs non mappés
// 1 = feuille (ou objet libre stocké en jsonb), {…} = objet imbriqué, [{…}] = tableau d'objets
// -----------------------------------------------------------------------------
const K = (keys, nested = {}) => ({
  ...Object.fromEntries(keys.split(/\s+/).filter(Boolean).map((k) => [k, 1])),
  ...nested,
});
const BASE = "_id __v createdAt updatedAt";
const SPECS = {
  users: K(`${BASE} name email password role emailVerified verificationToken verificationTokenExpiry
    resetToken resetTokenExpiry lastLoginIP lastLoginAt failedLoginAttempts accountLockedUntil
    passwordHistory phone newsletter language avatar avatarPublicId`, {
    address: K("street city postalCode country"),
    addresses: [K("_id label fullName street zip city country")],
  }),
  customers: K(`${BASE} firstname lastname email phone city address totalOrders totalSpent lastOrderAt status`),
  products: K(`${BASE} name price pricePromo stock visible weight customsDescriptionEn`, {
    variants: [K("_id colorName colorCode textColor description image stock editionSize")],
  }),
  promocodes: K(`${BASE} code type value minOrderAmount maxUses usedCount active expiresAt isReferral
    referrerId filleulPercent parrainPercent usedByUserIds`),
  orders: K(`${BASE} orderNumber userId recipientPickupName total shippingFee promoCode promoDiscount
    payment paymentIntentId idempotencyKey delivery status`, {
    customer: K("firstname lastname email phone company city address postalCode country"),
    products: [K("_id product quantity color variantId")],
    insurance: K("opted declaredValue fee"),
    shipping: K(`carrier productCode productKey service skybillNumber labelBase64 labelGeneratedAt weightKg
      relayPoint trackingStatus trackingEvents lastTrackedAt podBase64 shippingError cancelledAt`),
    extraPayments: [K("_id reason amount status stripeSessionId checkoutUrl createdAt paidAt")],
    refunds: [K("_id amount reason stripeRefundId status createdAt")],
  }),
  invoices: K(`${BASE} invoiceNumber year sequence order orderNumber subtotalTtc shippingFeeTtc promoDiscount
    vatApplicable vatRate totalHt vatAmount totalTtc pdfBase64 issuedAt`, {
    customer: K("firstname lastname email company address city postalCode country"),
    lineItems: [K("_id name quantity unitPriceTtc totalTtc")],
    sellerSnapshot: K("companyName legalForm address city postalCode siret vatNumber iban"),
  }),
  referralconfigs: K(`${BASE} totalPercent rewardValidityDays active`),
  sitesettings: K(`${BASE} maintenanceMode`, {
    billing: K("companyName legalForm address city postalCode siret vatNumber vatApplicable vatRate iban"),
  }),
  galleryphotos: K(`${BASE} url publicId order alt`),
  ratelimitattempts: K(`${BASE} key`),
  counters: K("_id __v seq"),
};

// -----------------------------------------------------------------------------
// Rapport
// -----------------------------------------------------------------------------
const report = {};
const R = (col) =>
  (report[col] ??= { read: 0, converted: 0, skipped: [], orphans: [], violations: [], warnings: [], unknown: new Map() });

/** Collecteur d'anomalies pour un document. */
function docCtx(col, mongoId) {
  const r = R(col);
  let bad = false;
  return {
    violation(field, msg) { bad = true; r.violations.push(`${mongoId} › ${field} : ${msg}`); },
    warn(field, msg) { r.warnings.push(`${mongoId} › ${field} : ${msg}`); },
    orphan(field, msg) { r.orphans.push(`${mongoId} › ${field} : ${msg}`); },
    get bad() { return bad; },
  };
}

function collectUnknownFields(col, doc) {
  const r = R(col);
  const walk = (value, spec, path) => {
    if (spec === 1 || value == null) return;
    if (Array.isArray(spec)) {
      if (Array.isArray(value)) value.forEach((v) => walk(v, spec[0], `${path}[]`));
      return;
    }
    if (typeof value !== "object" || value instanceof Date || value?._bsontype) return;
    for (const k of Object.keys(value)) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in spec)) r.unknown.set(p, (r.unknown.get(p) ?? 0) + 1);
      else walk(value[k], spec[k], p);
    }
  };
  walk(doc, SPECS[col], "");
}

// -----------------------------------------------------------------------------
// Conversions
// -----------------------------------------------------------------------------
const isObjectId = (v) => v?._bsontype === "ObjectId" || v?._bsontype === "ObjectID";
const typeName = (v) => (v === null ? "null" : v?._bsontype ?? (Array.isArray(v) ? "array" : v instanceof Date ? "Date" : typeof v));

/** ObjectId | string -> string (hex), sinon null. */
function hex(v) {
  if (v === undefined || v === null) return null;
  if (isObjectId(v)) return v.toHexString();
  return String(v);
}

/** Valeur par défaut Mongoose : appliquée si absent ; si null explicite dans une colonne NOT NULL, signalé. */
function nn(v, def, c, field) {
  if (v === undefined) return def;
  if (v === null) {
    c.warn(field, `null remplacé par la valeur par défaut ${JSON.stringify(def)} (colonne NOT NULL)`);
    return def;
  }
  return v;
}
/** Défaut Mongoose pour une colonne nullable : seulement si le champ est absent. */
const und = (v, def) => (v === undefined ? def : v);

function required(v, c, field) {
  if (v === undefined || v === null || v === "") c.violation(field, "champ obligatoire manquant");
  return v;
}

function text(v, c, field) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || isObjectId(v)) {
    c.warn(field, `valeur ${typeName(v)} convertie en texte`);
    return hex(v);
  }
  c.violation(field, `texte attendu, reçu ${typeName(v)}`);
  return null;
}

function num(v, c, field) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) { c.violation(field, `nombre non fini (${v})`); return null; }
    return v;
  }
  if (v?._bsontype === "Decimal128" || v?._bsontype === "Long" || v?._bsontype === "Int32" || v?._bsontype === "Double") {
    return v.toString();
  }
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    c.warn(field, `nombre stocké en texte ("${v}"), converti`);
    return v.trim();
  }
  c.violation(field, `nombre attendu, reçu ${typeName(v)}`);
  return null;
}

const INT4_MAX = 2147483647;
function int(v, c, field, { big = false } = {}) {
  const n = num(v, c, field);
  if (n === null) return null;
  const x = Number(n);
  if (!Number.isInteger(x)) { c.violation(field, `entier attendu, reçu ${n}`); return null; }
  if (!big && Math.abs(x) > INT4_MAX) { c.violation(field, `entier hors limites integer (${n})`); return null; }
  return x;
}

function bool(v, c, field) {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;
  c.violation(field, `booléen attendu, reçu ${typeName(v)} (${String(v)})`);
  return null;
}

function date(v, c, field) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) { c.violation(field, "date invalide"); return null; }
    return v;
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) { c.warn(field, `date stockée en ${typeof v}, convertie en ${d.toISOString()}`); return d; }
  }
  c.violation(field, `date attendue, reçu ${typeName(v)}`);
  return null;
}

function oneOf(v, allowed, def, c, field) {
  const x = nn(v, def, c, field);
  if (!allowed.includes(x)) c.violation(field, `valeur "${x}" hors enum (${allowed.join(", ")})`);
  return x;
}

/** Valeur arbitraire -> JSON (ObjectId -> hex, Date -> ISO, Decimal128 -> texte, Binary -> base64). */
function plain(v) {
  if (v === undefined || v === null) return v ?? null;
  if (isObjectId(v)) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (v?._bsontype === "Decimal128") return v.toString();
  if (v?._bsontype === "Long") return v.toNumber();
  if (v?._bsontype === "Int32" || v?._bsontype === "Double") return v.valueOf();
  if (v?._bsontype === "Binary") return Buffer.from(v.buffer).toString("base64");
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}
const json = (v) => (v === undefined || v === null ? null : JSON.stringify(plain(v)));

/** createdAt / updatedAt (repli : horodatage de l'ObjectId, signalé). */
function stamps(d, c) {
  let created = date(d.createdAt, c, "createdAt");
  if (!created) {
    created = isObjectId(d._id) ? d._id.getTimestamp() : new Date();
    c.warn("createdAt", `absent : horodatage de l'ObjectId utilisé (${created.toISOString()})`);
  }
  const updated = date(d.updatedAt, c, "updatedAt") ?? created;
  return { created_at: created, updated_at: updated };
}

/** Contrôle d'unicité au sein des données lues (avant que Neon ne le refuse). */
const uniqueSets = new Map();
function unique(c, scope, value, field) {
  if (value === null || value === undefined) return;
  const set = uniqueSets.get(scope) ?? new Map();
  uniqueSets.set(scope, set);
  const key = String(value);
  if (set.has(key)) c.violation(field, `doublon "${key}" (déjà utilisé par ${set.get(key)})`);
  else set.set(key, c.mongoId ?? "?");
}

// -----------------------------------------------------------------------------
// Correspondances mongo_id -> uuid (préchargées depuis Neon en mode réel pour l'idempotence)
// -----------------------------------------------------------------------------
const idMaps = Object.fromEntries(TABLE_ORDER.map((t) => [t, new Map()]));
const existingCounts = {};
function uuidFor(table, mongoId) {
  const map = idMaps[table];
  let id = map.get(mongoId);
  if (!id) { id = randomUUID(); map.set(mongoId, id); }
  return id;
}
// Index des documents sources (pour résoudre les références)
const sourceIds = { users: new Set(), products: new Set(), orders: new Set(), variants: new Map() };

const rows = Object.fromEntries(TABLE_ORDER.map((t) => [t, []]));

// -----------------------------------------------------------------------------
// Transformations
// -----------------------------------------------------------------------------
function newCtx(col, d) {
  const mongoId = hex(d._id);
  const c = docCtx(col, mongoId);
  c.mongoId = mongoId;
  R(col).read++;
  collectUnknownFields(col, d);
  return [mongoId, c];
}
const done = (col, c) => { if (!c.bad) R(col).converted++; };

function transformUsers(docs) {
  for (const d of docs) sourceIds.users.add(hex(d._id));
  for (const d of docs) {
    const [mid, c] = newCtx("users", d);
    const id = uuidFor("users", mid);

    const name = text(required(d.name, c, "name"), c, "name");
    if (name !== null && ([...name].length < 2 || [...name].length > 50)) {
      c.violation("name", `longueur ${[...name].length} hors [2, 50]`);
    }
    const email = text(required(d.email, c, "email"), c, "email");
    if (email !== null && email !== email.trim().toLowerCase()) {
      c.violation("email", `"${email}" n'est pas en minuscules/sans espaces (CHECK email = lower(btrim(email)))`);
    }
    unique(c, "users.email", email, "email");

    const ph = nn(d.passwordHistory, [], c, "passwordHistory");
    let passwordHistory = [];
    if (!Array.isArray(ph)) c.violation("passwordHistory", `tableau attendu, reçu ${typeName(ph)}`);
    else if (ph.some((x) => typeof x !== "string")) c.violation("passwordHistory", "contient des valeurs non textuelles");
    else passwordHistory = ph;

    const a = d.address ?? {};
    rows.users.push({
      id, mongo_id: mid,
      name,
      email,
      password: text(required(d.password, c, "password"), c, "password"),
      role: oneOf(d.role, ["customer", "admin", "user"], "customer", c, "role"),
      email_verified: bool(nn(d.emailVerified, false, c, "emailVerified"), c, "emailVerified"),
      verification_token: text(d.verificationToken, c, "verificationToken"),
      verification_token_expiry: date(d.verificationTokenExpiry, c, "verificationTokenExpiry"),
      reset_token: text(d.resetToken, c, "resetToken"),
      reset_token_expiry: date(d.resetTokenExpiry, c, "resetTokenExpiry"),
      last_login_ip: text(d.lastLoginIP, c, "lastLoginIP"),
      last_login_at: date(d.lastLoginAt, c, "lastLoginAt"),
      failed_login_attempts: int(nn(d.failedLoginAttempts, 0, c, "failedLoginAttempts"), c, "failedLoginAttempts"),
      account_locked_until: date(d.accountLockedUntil, c, "accountLockedUntil"),
      password_history: passwordHistory,
      phone: text(d.phone, c, "phone"),
      address_street: text(a.street, c, "address.street"),
      address_city: text(a.city, c, "address.city"),
      address_postal_code: text(a.postalCode, c, "address.postalCode"),
      address_country: text(a.country, c, "address.country"),
      newsletter: bool(nn(d.newsletter, false, c, "newsletter"), c, "newsletter"),
      language: text(nn(d.language, "fr", c, "language"), c, "language"),
      avatar: text(d.avatar, c, "avatar"),
      avatar_public_id: text(d.avatarPublicId, c, "avatarPublicId"),
      ...stamps(d, c),
    });

    const addresses = d.addresses ?? [];
    if (!Array.isArray(addresses)) c.violation("addresses", `tableau attendu, reçu ${typeName(addresses)}`);
    else addresses.forEach((ad, i) => {
      const f = (k) => `addresses[${i}].${k}`;
      const amid = hex(ad?._id) ?? `${mid}:addresses:${i}`;
      rows.user_addresses.push({
        id: uuidFor("user_addresses", amid), mongo_id: amid, user_id: id, position: i,
        label: text(nn(ad?.label, "", c, f("label")), c, f("label")),
        full_name: text(nn(ad?.fullName, "", c, f("fullName")), c, f("fullName")),
        street: text(nn(ad?.street, "", c, f("street")), c, f("street")),
        zip: text(nn(ad?.zip, "", c, f("zip")), c, f("zip")),
        city: text(nn(ad?.city, "", c, f("city")), c, f("city")),
        country: text(nn(ad?.country, "", c, f("country")), c, f("country")),
      });
    });
    done("users", c);
  }
}

function transformCustomers(docs) {
  for (const d of docs) {
    const [mid, c] = newCtx("customers", d);
    const email = text(required(d.email, c, "email"), c, "email");
    if (email !== null && email !== email.toLowerCase()) {
      c.violation("email", `"${email}" n'est pas en minuscules (CHECK email = lower(email))`);
    }
    unique(c, "customers.email", email, "email");
    rows.customers.push({
      id: uuidFor("customers", mid), mongo_id: mid,
      firstname: text(required(d.firstname, c, "firstname"), c, "firstname"),
      lastname: text(nn(d.lastname, "", c, "lastname"), c, "lastname"),
      email,
      phone: text(nn(d.phone, "", c, "phone"), c, "phone"),
      city: text(nn(d.city, "", c, "city"), c, "city"),
      address: text(nn(d.address, "", c, "address"), c, "address"),
      total_orders: int(nn(d.totalOrders, 0, c, "totalOrders"), c, "totalOrders"),
      total_spent: num(nn(d.totalSpent, 0, c, "totalSpent"), c, "totalSpent"),
      last_order_at: date(d.lastOrderAt, c, "lastOrderAt"),
      status: oneOf(d.status, ["active", "inactive", "blocked"], "active", c, "status"),
      ...stamps(d, c),
    });
    done("customers", c);
  }
}

function transformProducts(docs) {
  for (const d of docs) {
    const [mid, c] = newCtx("products", d);
    sourceIds.products.add(mid);
    const id = uuidFor("products", mid);
    const variants = nn(d.variants, [], c, "variants");
    const stock = int(nn(d.stock, 0, c, "stock"), c, "stock");

    rows.products.push({
      id, mongo_id: mid,
      name: text(required(d.name, c, "name"), c, "name"),
      price: num(nn(d.price, 85, c, "price"), c, "price"),
      price_promo: num(und(d.pricePromo, null), c, "pricePromo"),
      stock,
      visible: bool(nn(d.visible, true, c, "visible"), c, "visible"),
      weight: num(nn(d.weight, 100, c, "weight"), c, "weight"),
      customs_description_en: text(nn(d.customsDescriptionEn, "", c, "customsDescriptionEn"), c, "customsDescriptionEn"),
      ...stamps(d, c),
    });

    if (!Array.isArray(variants)) {
      c.violation("variants", `tableau attendu, reçu ${typeName(variants)}`);
    } else {
      let sum = 0;
      variants.forEach((v, i) => {
        const f = (k) => `variants[${i}].${k}`;
        const vmid = hex(v?._id);
        if (!vmid) c.warn(f("_id"), "variante sans _id : identifiant synthétique, non référençable par les commandes");
        const key = vmid ?? `${mid}:variants:${i}`;
        sourceIds.variants.set(key, mid);
        const vstock = int(nn(v?.stock, 0, c, f("stock")), c, f("stock"));
        sum += vstock ?? 0;
        rows.product_variants.push({
          id: uuidFor("product_variants", key), mongo_id: key, product_id: id, position: i,
          color_name: text(required(v?.colorName, c, f("colorName")), c, f("colorName")),
          color_code: text(required(v?.colorCode, c, f("colorCode")), c, f("colorCode")),
          text_color: text(nn(v?.textColor, "#ffffff", c, f("textColor")), c, f("textColor")),
          description: text(nn(v?.description, "", c, f("description")), c, f("description")),
          image: text(nn(v?.image, "", c, f("image")), c, f("image")),
          stock: vstock,
          edition_size: int(nn(v?.editionSize, 50, c, f("editionSize")), c, f("editionSize")),
        });
      });
      if (variants.length > 0 && stock !== null && stock !== sum) {
        c.warn("stock", `stock global ${stock} ≠ somme des variantes ${sum} (valeur migrée telle quelle)`);
      }
    }
    done("products", c);
  }
}

function transformPromoCodes(docs) {
  for (const d of docs) {
    const [mid, c] = newCtx("promocodes", d);
    const id = uuidFor("promo_codes", mid);
    const code = text(required(d.code, c, "code"), c, "code");
    if (code !== null && code !== code.trim().toUpperCase()) {
      c.violation("code", `"${code}" n'est pas en majuscules/sans espaces (CHECK code = upper(btrim(code)))`);
    }
    unique(c, "promo_codes.code", code, "code");

    const value = num(required(d.value, c, "value"), c, "value");
    if (value !== null && Number(value) < 0) c.violation("value", `valeur négative (${value})`);

    let referrerId = null;
    const refRaw = hex(d.referrerId);
    if (refRaw) {
      if (sourceIds.users.has(refRaw)) referrerId = idMaps.users.get(refRaw);
      else c.orphan("referrerId", `utilisateur ${refRaw} inexistant -> referrer_id NULL (valeur non conservée en base, notée ici)`);
    }

    rows.promo_codes.push({
      id, mongo_id: mid,
      code,
      type: oneOf(d.type, ["percent", "fixed"], undefined, c, "type"),
      value,
      min_order_amount: num(nn(d.minOrderAmount, 0, c, "minOrderAmount"), c, "minOrderAmount"),
      max_uses: int(und(d.maxUses, null), c, "maxUses"),
      used_count: int(nn(d.usedCount, 0, c, "usedCount"), c, "usedCount"),
      active: bool(nn(d.active, true, c, "active"), c, "active"),
      expires_at: date(d.expiresAt, c, "expiresAt"),
      is_referral: bool(nn(d.isReferral, false, c, "isReferral"), c, "isReferral"),
      referrer_id: referrerId,
      filleul_percent: num(und(d.filleulPercent, null), c, "filleulPercent"),
      parrain_percent: num(und(d.parrainPercent, null), c, "parrainPercent"),
      ...stamps(d, c),
    });

    const used = nn(d.usedByUserIds, [], c, "usedByUserIds");
    if (!Array.isArray(used)) c.violation("usedByUserIds", `tableau attendu, reçu ${typeName(used)}`);
    else used.forEach((u, i) => {
      const raw = hex(u);
      let userId = null;
      if (raw === null) c.warn(`usedByUserIds[${i}]`, "valeur null (ajoutée par $push sans utilisateur)");
      else if (sourceIds.users.has(raw)) userId = idMaps.users.get(raw);
      else c.orphan(`usedByUserIds[${i}]`, `utilisateur ${raw} inexistant -> user_id NULL, user_mongo_id conservé`);
      const umid = `${mid}:${i}`;
      rows.promo_code_uses.push({
        id: uuidFor("promo_code_uses", umid), mongo_id: umid, promo_code_id: id, position: i,
        user_id: userId, user_mongo_id: raw,
      });
    });
    done("promocodes", c);
  }
}

let maxOrderNumber = 0;
function transformOrders(docs) {
  for (const d of docs) sourceIds.orders.add(hex(d._id));
  for (const d of docs) {
    const [mid, c] = newCtx("orders", d);
    const id = uuidFor("orders", mid);
    const ts = stamps(d, c);

    const orderNumber = int(und(d.orderNumber, null), c, "orderNumber", { big: true });
    unique(c, "orders.order_number", orderNumber, "orderNumber");
    if (orderNumber !== null) maxOrderNumber = Math.max(maxOrderNumber, orderNumber);
    const idempotencyKey = text(und(d.idempotencyKey, null), c, "idempotencyKey");
    unique(c, "orders.idempotency_key", idempotencyKey, "idempotencyKey");

    // userId : String sans ref
    const userRaw = d.userId === undefined || d.userId === null || d.userId === "" ? null : hex(d.userId);
    let userId = null;
    if (userRaw !== null) {
      if (sourceIds.users.has(userRaw)) userId = idMaps.users.get(userRaw);
      else c.orphan("userId", `utilisateur "${userRaw}" inexistant -> user_id NULL, user_mongo_id conservé`);
    }

    const cu = d.customer ?? {};
    const ins = d.insurance ?? {};
    const s = d.shipping ?? {};
    const sf = (k) => `shipping.${k}`;

    const events = nn(s.trackingEvents, [], c, sf("trackingEvents"));
    if (!Array.isArray(events)) c.violation(sf("trackingEvents"), `tableau attendu, reçu ${typeName(events)}`);

    rows.orders.push({
      id, mongo_id: mid,
      order_number: orderNumber,
      user_id: userId,
      user_mongo_id: userRaw,
      customer_firstname: text(cu.firstname, c, "customer.firstname"),
      customer_lastname: text(cu.lastname, c, "customer.lastname"),
      customer_email: text(cu.email, c, "customer.email"),
      customer_phone: text(cu.phone, c, "customer.phone"),
      customer_company: text(cu.company, c, "customer.company"),
      customer_city: text(cu.city, c, "customer.city"),
      customer_address: text(cu.address, c, "customer.address"),
      customer_postal_code: text(cu.postalCode, c, "customer.postalCode"),
      customer_country: text(cu.country, c, "customer.country"),
      recipient_pickup_name: text(nn(d.recipientPickupName, "", c, "recipientPickupName"), c, "recipientPickupName"),
      total: num(d.total, c, "total"),
      shipping_fee: num(nn(d.shippingFee, 0, c, "shippingFee"), c, "shippingFee"),
      insurance_opted: bool(nn(ins.opted, false, c, "insurance.opted"), c, "insurance.opted"),
      insurance_declared_value: num(nn(ins.declaredValue, 0, c, "insurance.declaredValue"), c, "insurance.declaredValue"),
      insurance_fee: num(nn(ins.fee, 0, c, "insurance.fee"), c, "insurance.fee"),
      promo_code: text(und(d.promoCode, null), c, "promoCode"),
      promo_discount: num(nn(d.promoDiscount, 0, c, "promoDiscount"), c, "promoDiscount"),
      payment: oneOf(d.payment, ["cash", "mobile_money", "card", "bank_transfer"], "cash", c, "payment"),
      payment_intent_id: text(und(d.paymentIntentId, null), c, "paymentIntentId"),
      idempotency_key: idempotencyKey,
      delivery: oneOf(d.delivery, ["standard", "express", "pickup", "colissimo", "relais"], "colissimo", c, "delivery"),
      status: oneOf(d.status, ["pending", "paid", "processing", "shipped", "delivered", "cancelled"], "pending", c, "status"),
      shipping_carrier: text(und(s.carrier, "chronopost"), c, sf("carrier")),
      shipping_product_code: text(s.productCode, c, sf("productCode")),
      shipping_product_key: text(s.productKey, c, sf("productKey")),
      shipping_service: text(s.service, c, sf("service")),
      shipping_skybill_number: text(s.skybillNumber, c, sf("skybillNumber")),
      shipping_label_generated_at: date(s.labelGeneratedAt, c, sf("labelGeneratedAt")),
      shipping_weight_kg: num(s.weightKg, c, sf("weightKg")),
      shipping_relay_point: json(s.relayPoint),
      shipping_tracking_status: text(s.trackingStatus, c, sf("trackingStatus")),
      shipping_tracking_events: Array.isArray(events) ? json(events) : "[]",
      shipping_last_tracked_at: date(s.lastTrackedAt, c, sf("lastTrackedAt")),
      shipping_error: text(s.shippingError, c, sf("shippingError")),
      shipping_cancelled_at: date(s.cancelledAt, c, sf("cancelledAt")),
      ...ts,
    });

    // products[] -> order_items
    const items = nn(d.products, [], c, "products");
    if (!Array.isArray(items)) c.violation("products", `tableau attendu, reçu ${typeName(items)}`);
    else items.forEach((it, i) => {
      const f = (k) => `products[${i}].${k}`;
      const imid = hex(it?._id) ?? `${mid}:products:${i}`;
      const productRaw = hex(it?.product);
      let productId = null;
      if (!productRaw) c.violation(f("product"), "référence produit manquante (product_mongo_id NOT NULL)");
      else if (sourceIds.products.has(productRaw)) productId = idMaps.products.get(productRaw);
      else c.orphan(f("product"), `produit ${productRaw} inexistant -> product_id NULL, product_mongo_id conservé`);

      const variantRaw = hex(it?.variantId);
      let variantId = null;
      if (variantRaw) {
        if (sourceIds.variants.has(variantRaw)) {
          variantId = idMaps.product_variants.get(variantRaw);
          const owner = sourceIds.variants.get(variantRaw);
          if (productRaw && owner !== productRaw) {
            c.warn(f("variantId"), `la variante ${variantRaw} appartient au produit ${owner}, pas à ${productRaw}`);
          }
        } else {
          c.orphan(f("variantId"), `variante ${variantRaw} inexistante -> variant_id NULL, variant_mongo_id conservé`);
        }
      }
      rows.order_items.push({
        id: uuidFor("order_items", imid), mongo_id: imid, order_id: id, position: i,
        product_id: productId, product_mongo_id: productRaw,
        quantity: int(it?.quantity, c, f("quantity")),
        color: text(und(it?.color, null), c, f("color")),
        variant_id: variantId, variant_mongo_id: variantRaw,
      });
    });

    // extraPayments[]
    const extras = nn(d.extraPayments, [], c, "extraPayments");
    if (!Array.isArray(extras)) c.violation("extraPayments", `tableau attendu, reçu ${typeName(extras)}`);
    else extras.forEach((ep, i) => {
      const f = (k) => `extraPayments[${i}].${k}`;
      let emid = hex(ep?._id);
      if (!emid) {
        emid = `${mid}:extraPayments:${i}`;
        c.warn(f("_id"), "sans _id : identifiant synthétique (un webhook Stripe sur ce paiement ne le retrouvera pas)");
      }
      let created = date(ep?.createdAt, c, f("createdAt"));
      if (!created) { created = ts.created_at; c.warn(f("createdAt"), "absent : date de la commande utilisée"); }
      rows.order_extra_payments.push({
        id: uuidFor("order_extra_payments", emid), mongo_id: emid, order_id: id,
        reason: text(ep?.reason, c, f("reason")),
        amount: num(ep?.amount, c, f("amount")),
        status: oneOf(ep?.status, ["pending", "paid", "cancelled"], "pending", c, f("status")),
        stripe_session_id: text(ep?.stripeSessionId, c, f("stripeSessionId")),
        checkout_url: text(ep?.checkoutUrl, c, f("checkoutUrl")),
        created_at: created,
        paid_at: date(ep?.paidAt, c, f("paidAt")),
      });
    });

    // refunds[]
    const refunds = nn(d.refunds, [], c, "refunds");
    if (!Array.isArray(refunds)) c.violation("refunds", `tableau attendu, reçu ${typeName(refunds)}`);
    else refunds.forEach((rf, i) => {
      const f = (k) => `refunds[${i}].${k}`;
      const rmid = hex(rf?._id) ?? `${mid}:refunds:${i}`;
      let created = date(rf?.createdAt, c, f("createdAt"));
      if (!created) { created = ts.created_at; c.warn(f("createdAt"), "absent : date de la commande utilisée"); }
      rows.order_refunds.push({
        id: uuidFor("order_refunds", rmid), mongo_id: rmid, order_id: id,
        amount: num(rf?.amount, c, f("amount")),
        reason: text(rf?.reason, c, f("reason")),
        stripe_refund_id: text(rf?.stripeRefundId, c, f("stripeRefundId")),
        status: oneOf(rf?.status, ["succeeded", "pending", "failed"], "succeeded", c, f("status")),
        created_at: created,
      });
    });

    // shipping.labelBase64 / podBase64 -> order_documents
    const orderRow = rows.orders[rows.orders.length - 1];
    for (const [kind, field, at] of [
      ["label", "labelBase64", orderRow.shipping_label_generated_at ?? ts.created_at],
      ["pod", "podBase64", orderRow.shipping_last_tracked_at ?? ts.updated_at],
    ]) {
      const content = text(s[field], c, sf(field));
      if (content === null) continue;
      if (content === "") { c.warn(sf(field), "chaîne vide : aucun document créé"); continue; }
      const dmid = `${mid}:${kind}`;
      rows.order_documents.push({
        id: uuidFor("order_documents", dmid), mongo_id: dmid, order_id: id, kind,
        content_base64: content, created_at: at, updated_at: at,
      });
    }
    done("orders", c);
  }
}

const maxInvoiceSeqByYear = new Map();
function transformInvoices(docs) {
  for (const d of docs) {
    const [mid, c] = newCtx("invoices", d);
    const id = uuidFor("invoices", mid);
    const ts = stamps(d, c);

    const invoiceNumber = text(required(d.invoiceNumber, c, "invoiceNumber"), c, "invoiceNumber");
    unique(c, "invoices.invoice_number", invoiceNumber, "invoiceNumber");
    const year = int(required(d.year, c, "year"), c, "year");
    const sequence = int(required(d.sequence, c, "sequence"), c, "sequence");
    if (year !== null && sequence !== null) {
      unique(c, "invoices.year_sequence", `${year}/${sequence}`, "year+sequence");
      maxInvoiceSeqByYear.set(year, Math.max(maxInvoiceSeqByYear.get(year) ?? 0, sequence));
    }

    const orderRaw = hex(d.order);
    let orderId = null;
    if (!orderRaw) c.violation("order", "référence commande manquante (order_id NOT NULL)");
    else if (!sourceIds.orders.has(orderRaw)) c.violation("order", `commande ${orderRaw} inexistante (order_id NOT NULL : impossible d'insérer)`);
    else orderId = idMaps.orders.get(orderRaw);
    unique(c, "invoices.order_id", orderRaw, "order");

    const cu = d.customer ?? {};
    const se = d.sellerSnapshot ?? {};
    let issued = date(d.issuedAt, c, "issuedAt");
    if (!issued) { issued = ts.created_at; c.warn("issuedAt", "absent : createdAt utilisé"); }

    rows.invoices.push({
      id, mongo_id: mid,
      invoice_number: invoiceNumber, year, sequence,
      order_id: orderId,
      order_number: int(und(d.orderNumber, null), c, "orderNumber", { big: true }),
      customer_firstname: text(cu.firstname, c, "customer.firstname"),
      customer_lastname: text(cu.lastname, c, "customer.lastname"),
      customer_email: text(cu.email, c, "customer.email"),
      customer_company: text(cu.company, c, "customer.company"),
      customer_address: text(cu.address, c, "customer.address"),
      customer_city: text(cu.city, c, "customer.city"),
      customer_postal_code: text(cu.postalCode, c, "customer.postalCode"),
      customer_country: text(cu.country, c, "customer.country"),
      subtotal_ttc: num(d.subtotalTtc, c, "subtotalTtc"),
      shipping_fee_ttc: num(d.shippingFeeTtc, c, "shippingFeeTtc"),
      promo_discount: num(nn(d.promoDiscount, 0, c, "promoDiscount"), c, "promoDiscount"),
      vat_applicable: bool(nn(d.vatApplicable, false, c, "vatApplicable"), c, "vatApplicable"),
      vat_rate: num(nn(d.vatRate, 0, c, "vatRate"), c, "vatRate"),
      total_ht: num(d.totalHt, c, "totalHt"),
      vat_amount: num(d.vatAmount, c, "vatAmount"),
      total_ttc: num(d.totalTtc, c, "totalTtc"),
      seller_company_name: text(se.companyName, c, "sellerSnapshot.companyName"),
      seller_legal_form: text(se.legalForm, c, "sellerSnapshot.legalForm"),
      seller_address: text(se.address, c, "sellerSnapshot.address"),
      seller_city: text(se.city, c, "sellerSnapshot.city"),
      seller_postal_code: text(se.postalCode, c, "sellerSnapshot.postalCode"),
      seller_siret: text(se.siret, c, "sellerSnapshot.siret"),
      seller_vat_number: text(se.vatNumber, c, "sellerSnapshot.vatNumber"),
      seller_iban: text(se.iban, c, "sellerSnapshot.iban"),
      issued_at: issued,
      ...ts,
    });

    const lines = nn(d.lineItems, [], c, "lineItems");
    if (!Array.isArray(lines)) c.violation("lineItems", `tableau attendu, reçu ${typeName(lines)}`);
    else lines.forEach((li, i) => {
      const f = (k) => `lineItems[${i}].${k}`;
      const lmid = hex(li?._id) ?? `${mid}:lineItems:${i}`;
      rows.invoice_line_items.push({
        id: uuidFor("invoice_line_items", lmid), mongo_id: lmid, invoice_id: id, position: i,
        name: text(li?.name, c, f("name")),
        quantity: int(li?.quantity, c, f("quantity")),
        unit_price_ttc: num(li?.unitPriceTtc, c, f("unitPriceTtc")),
        total_ttc: num(li?.totalTtc, c, f("totalTtc")),
      });
    });

    const pdf = text(d.pdfBase64, c, "pdfBase64");
    if (pdf === null || pdf === "") {
      c.warn("pdfBase64", "absent ou vide : aucun document PDF créé");
    } else {
      const dmid = `${mid}:pdf`;
      rows.invoice_documents.push({
        id: uuidFor("invoice_documents", dmid), mongo_id: dmid, invoice_id: id, kind: "pdf",
        content_base64: pdf, created_at: ts.created_at, updated_at: ts.created_at,
      });
    }
    done("invoices", c);
  }
}

function transformSingleton(col, docs, build) {
  if (docs.length > 1) {
    R(col).violations.push(`${docs.length} documents trouvés : la table cible n'accepte qu'une seule ligne (index singleton)`);
  }
  for (const d of docs) {
    const [mid, c] = newCtx(col, d);
    build(d, mid, c);
    done(col, c);
  }
}

function transformReferralConfigs(docs) {
  transformSingleton("referralconfigs", docs, (d, mid, c) => {
    const total = num(nn(d.totalPercent, 10, c, "totalPercent"), c, "totalPercent");
    if (total !== null && (Number(total) < 1 || Number(total) > 100)) c.violation("totalPercent", `${total} hors [1, 100]`);
    rows.referral_configs.push({
      id: uuidFor("referral_configs", mid), mongo_id: mid,
      total_percent: total,
      reward_validity_days: int(nn(d.rewardValidityDays, 30, c, "rewardValidityDays"), c, "rewardValidityDays"),
      active: bool(nn(d.active, true, c, "active"), c, "active"),
      ...stamps(d, c),
    });
  });
}

function transformSiteSettings(docs) {
  transformSingleton("sitesettings", docs, (d, mid, c) => {
    const b = d.billing ?? {};
    const bt = (k) => text(nn(b[k], "", c, `billing.${k}`), c, `billing.${k}`);
    rows.site_settings.push({
      id: uuidFor("site_settings", mid), mongo_id: mid,
      maintenance_mode: bool(nn(d.maintenanceMode, false, c, "maintenanceMode"), c, "maintenanceMode"),
      billing_company_name: bt("companyName"),
      billing_legal_form: bt("legalForm"),
      billing_address: bt("address"),
      billing_city: bt("city"),
      billing_postal_code: bt("postalCode"),
      billing_siret: bt("siret"),
      billing_vat_number: bt("vatNumber"),
      billing_vat_applicable: bool(nn(b.vatApplicable, false, c, "billing.vatApplicable"), c, "billing.vatApplicable"),
      billing_vat_rate: num(nn(b.vatRate, 20, c, "billing.vatRate"), c, "billing.vatRate"),
      billing_iban: bt("iban"),
      ...stamps(d, c),
    });
  });
}

function transformGallery(docs) {
  for (const d of docs) {
    const [mid, c] = newCtx("galleryphotos", d);
    rows.gallery_photos.push({
      id: uuidFor("gallery_photos", mid), mongo_id: mid,
      url: text(required(d.url, c, "url"), c, "url"),
      public_id: text(und(d.publicId, null), c, "publicId"),
      sort_order: int(nn(d.order, 0, c, "order"), c, "order"),
      alt: text(und(d.alt, null), c, "alt"),
      ...stamps(d, c),
    });
    done("galleryphotos", c);
  }
}

function transformRateLimits(docs) {
  for (const d of docs) {
    const [mid, c] = newCtx("ratelimitattempts", d);
    rows.rate_limit_attempts.push({
      id: uuidFor("rate_limit_attempts", mid), mongo_id: mid,
      key: text(required(d.key, c, "key"), c, "key"),
      created_at: stamps(d, c).created_at,
    });
    done("ratelimitattempts", c);
  }
}

// Compteurs -> plan pour order_number_seq / invoice_counters
const counterPlan = { orderSeq: null, orderNote: null, invoices: [] };
function transformCounters(docs) {
  let orderCounter = null;
  const invoiceCounters = new Map();
  for (const d of docs) {
    const r = R("counters");
    r.read++;
    collectUnknownFields("counters", d);
    const key = typeof d._id === "string" ? d._id : hex(d._id);
    const c = docCtx("counters", key);
    const seq = int(nn(d.seq, 0, c, "seq"), c, "seq", { big: true });
    if (key === "orderNumber") {
      orderCounter = seq;
    } else if (/^invoice-\d{4}$/.test(key)) {
      invoiceCounters.set(Number(key.slice(8)), { mongo_id: key, seq });
    } else {
      r.skipped.push(`${key} : _id ne correspond ni à "orderNumber" ni à "invoice-<année>"`);
      continue;
    }
    if (!c.bad) r.converted++;
  }

  // orderNumber -> séquence
  const r = R("counters");
  if (orderCounter === null && maxOrderNumber > 0) {
    r.warnings.push(`orderNumber : aucun compteur mais des commandes numérotées jusqu'à ${maxOrderNumber} -> la séquence part de ce numéro`);
  } else if (orderCounter !== null && maxOrderNumber > orderCounter) {
    r.warnings.push(`orderNumber : compteur ${orderCounter} < plus grand numéro de commande ${maxOrderNumber} -> la séquence part de ${maxOrderNumber}`);
  }
  const orderTarget = Math.max(orderCounter ?? 0, maxOrderNumber);
  if (orderTarget > 0) {
    counterPlan.orderSeq = orderTarget;
    counterPlan.orderNote = `setval('order_number_seq', ${orderTarget}, true) -> prochaine commande n° ${orderTarget + 1}`;
  } else {
    counterPlan.orderNote = "valeur 0 : setval ignoré (la séquence démarrera à 1)";
  }

  // invoice-<année> -> invoice_counters
  const years = new Set([...invoiceCounters.keys(), ...maxInvoiceSeqByYear.keys()]);
  for (const year of [...years].sort()) {
    const counter = invoiceCounters.get(year);
    const maxSeq = maxInvoiceSeqByYear.get(year) ?? 0;
    const counterSeq = counter?.seq ?? null;
    if (counterSeq === null) {
      r.warnings.push(`invoice-${year} : aucun compteur mais des factures jusqu'à la séquence ${maxSeq} -> compteur créé à ${maxSeq}`);
    } else if (maxSeq > counterSeq) {
      r.warnings.push(`invoice-${year} : compteur ${counterSeq} < plus grande séquence de facture ${maxSeq} -> compteur positionné à ${maxSeq}`);
    }
    counterPlan.invoices.push({ year, mongo_id: counter?.mongo_id ?? null, seq: Math.max(counterSeq ?? 0, maxSeq) });
  }
}

// -----------------------------------------------------------------------------
// Affichage du rapport
// -----------------------------------------------------------------------------
function printReport() {
  console.log(`\n=== Rapport de transformation (${DRY_RUN ? "DRY-RUN" : "RÉEL"}) — base Mongo "${DB_NAME}" ===\n`);
  console.table(COLLECTIONS.map((col) => {
    const r = R(col);
    return {
      collection: col, lus: r.read, convertis: r.converted, ignorés: r.skipped.length,
      orphelines: r.orphans.length, violations: r.violations.length,
      "champs non mappés": r.unknown.size, avertissements: r.warnings.length,
    };
  }));

  for (const col of COLLECTIONS) {
    const r = R(col);
    const sections = [
      ["❌ Violations de contraintes", r.violations],
      ["⏭️  Ignorés", r.skipped],
      ["🔗 Références orphelines", r.orphans],
      ["⚠️  Champs non mappés (NON migrés)", [...r.unknown].map(([p, n]) => `${p} (${n} occurrence${n > 1 ? "s" : ""})`)],
      ["ℹ️  Avertissements", r.warnings],
    ].filter(([, list]) => list.length > 0);
    if (sections.length === 0) continue;
    console.log(`\n── ${col}`);
    for (const [title, list] of sections) {
      console.log(`  ${title} :`);
      for (const line of list) console.log(`    - ${line}`);
    }
  }

  console.log("\n=== Lignes à insérer par table ===\n");
  console.table(TABLE_ORDER.map((t) => ({
    table: t, source: TABLE_SOURCE[t], lignes: rows[t].length,
    ...(DRY_RUN ? {} : { "déjà présentes (mongo_id)": existingCounts[t] ?? 0 }),
  })));

  console.log("=== Compteurs ===");
  console.log(`  order_number_seq : ${counterPlan.orderNote}`);
  if (counterPlan.invoices.length === 0) console.log("  invoice_counters : rien à initialiser");
  for (const ic of counterPlan.invoices) {
    console.log(`  invoice_counters : année ${ic.year} -> seq ${ic.seq} (prochaine facture n° ${ic.seq + 1})${ic.mongo_id ? "" : " [sans document counters]"}`);
  }
}

// -----------------------------------------------------------------------------
// Écriture Neon
// -----------------------------------------------------------------------------
const qi = (name) => `"${name.replace(/"/g, '""')}"`;

async function insertRows(client, table, list) {
  let inserted = 0;
  for (const row of list) {
    const cols = Object.keys(row);
    const sql =
      `INSERT INTO ${qi(table)} (${cols.map(qi).join(", ")}) ` +
      `VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ` +
      `ON CONFLICT (mongo_id) DO NOTHING`;
    try {
      const res = await client.query(sql, cols.map((k) => row[k]));
      inserted += res.rowCount;
    } catch (err) {
      throw new Error(`${table} (mongo_id ${row.mongo_id}) : ${err.message}${err.detail ? ` — ${err.detail}` : ""}`);
    }
  }
  return inserted;
}

async function preloadExisting(client) {
  for (const t of TABLE_ORDER) {
    const { rows: found } = await client.query(`SELECT mongo_id, id::text AS id FROM ${qi(t)} WHERE mongo_id IS NOT NULL`);
    for (const r of found) idMaps[t].set(r.mongo_id, r.id);
    existingCounts[t] = found.length;
  }
}

async function writeNeon(client) {
  const inserted = {};
  await client.query("BEGIN");
  try {
    for (const t of TABLE_ORDER) {
      inserted[t] = await insertRows(client, t, rows[t]);
      console.log(`  ${t.padEnd(22)} ${String(inserted[t]).padStart(4)} insérée(s) / ${rows[t].length} attendue(s)`);
    }

    // Compteurs — jamais à la baisse
    if (counterPlan.orderSeq !== null) {
      await client.query(
        `SELECT setval('order_number_seq',
           GREATEST($1::bigint, (SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM order_number_seq)),
           true)`,
        [counterPlan.orderSeq]
      );
    }
    for (const ic of counterPlan.invoices) {
      await client.query(
        `INSERT INTO invoice_counters (year, mongo_id, seq) VALUES ($1, $2, $3)
         ON CONFLICT (year) DO UPDATE
           SET seq = GREATEST(invoice_counters.seq, EXCLUDED.seq),
               mongo_id = COALESCE(invoice_counters.mongo_id, EXCLUDED.mongo_id)`,
        [ic.year, ic.mongo_id, ic.seq]
      );
    }

    // Vérification avant COMMIT : chaque mongo_id attendu doit être présent
    const missing = [];
    for (const t of TABLE_ORDER) {
      const ids = rows[t].map((r) => r.mongo_id);
      if (ids.length === 0) continue;
      const { rows: [{ n }] } = await client.query(
        `SELECT count(*)::int AS n FROM ${qi(t)} WHERE mongo_id = ANY($1::text[])`, [ids]
      );
      if (n !== ids.length) missing.push(`${t} : ${n}/${ids.length}`);
    }
    if (missing.length > 0) throw new Error(`lignes manquantes après insertion -> ${missing.join(", ")}`);

    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

async function printComparison(client, mongoCounts) {
  const table = [];
  for (const t of TABLE_ORDER) {
    const { rows: [r] } = await client.query(
      `SELECT count(*) FILTER (WHERE mongo_id IS NOT NULL)::int AS migrated, count(*)::int AS total FROM ${qi(t)}`
    );
    const src = TABLE_SOURCE[t];
    const expected = COLLECTIONS.includes(src) ? mongoCounts[src] : rows[t].length;
    table.push({
      source: src, "Mongo (docs / sous-docs)": expected, table: t,
      "Neon (migrées)": r.migrated, "Neon (total)": r.total, ok: r.migrated === expected ? "✅" : "❌",
    });
  }
  console.log("\n=== Comparaison Mongo / Neon ===\n");
  console.table(table);

  const { rows: [seq] } = await client.query("SELECT last_value::text, is_called FROM order_number_seq");
  const { rows: ic } = await client.query("SELECT year, seq, mongo_id FROM invoice_counters ORDER BY year");
  console.log(`order_number_seq : last_value = ${seq.last_value}, is_called = ${seq.is_called} (Mongo counters.orderNumber -> ${counterPlan.orderSeq ?? 0})`);
  for (const r of ic) console.log(`invoice_counters : ${r.year} -> seq ${r.seq} (${r.mongo_id ?? "sans mongo_id"})`);
  return table.every((r) => r.ok === "✅");
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  console.log(`Mode : ${DRY_RUN ? "DRY-RUN (aucune connexion à Neon)" : "MIGRATION RÉELLE"}`);
  console.log(`Base Mongo : "${DB_NAME}" (lecture seule)`);

  const mongo = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    ...(TLS_INSECURE ? { tls: true, tlsAllowInvalidCertificates: true } : {}),
  });
  let pool = null;
  let pgClient = null;

  try {
    await mongo.connect();
    const db = mongo.db(DB_NAME);

    // Collections présentes vs attendues
    const present = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    const missingCols = COLLECTIONS.filter((c) => !present.includes(c));
    const extraCols = present.filter((c) => !COLLECTIONS.includes(c) && !c.startsWith("system."));
    if (missingCols.length) console.log(`⚠️  Collections absentes (traitées comme vides) : ${missingCols.join(", ")}`);
    if (extraCols.length) console.log(`⚠️  Collections NON migrées (hors périmètre) : ${extraCols.join(", ")}`);

    // Lecture (find uniquement)
    const data = {};
    const mongoCounts = {};
    for (const col of COLLECTIONS) {
      data[col] = await db.collection(col).find({}).toArray();
      mongoCounts[col] = await db.collection(col).countDocuments({});
      if (mongoCounts[col] !== data[col].length) {
        console.log(`⚠️  ${col} : countDocuments=${mongoCounts[col]} ≠ documents lus=${data[col].length} (écritures concurrentes ?)`);
      }
    }

    // Mode réel : connexion Neon + préchargement des uuid existants (idempotence)
    if (!DRY_RUN) {
      // max: 1 — un seul client dédié : BEGIN … COMMIT et toutes les requêtes passent par lui.
      pool = new Pool({ connectionString: DATABASE_URL, max: 1, connectionTimeoutMillis: 20000 });
      pool.on("error", (err) => console.error(`⚠️  Erreur du pool Neon : ${sanitize(err?.message)}`));
      pgClient = await pool.connect();
      await preloadExisting(pgClient);
    }

    // Transformation (ordre des dépendances)
    transformUsers(data.users);
    transformCustomers(data.customers);
    transformProducts(data.products);
    transformPromoCodes(data.promocodes);
    transformOrders(data.orders);
    transformInvoices(data.invoices);
    transformReferralConfigs(data.referralconfigs);
    transformSiteSettings(data.sitesettings);
    transformGallery(data.galleryphotos);
    transformRateLimits(data.ratelimitattempts);
    transformCounters(data.counters);

    printReport();

    const totalViolations = COLLECTIONS.reduce((s, c) => s + R(c).violations.length, 0);
    const totalUnknown = COLLECTIONS.reduce((s, c) => s + R(c).unknown.size, 0);

    if (DRY_RUN) {
      console.log(
        `\nDry-run terminé : ${totalViolations} violation(s), ${totalUnknown} champ(s) non mappé(s). Rien n'a été écrit.` +
        (totalViolations || totalUnknown ? "\nLe mode réel refusera de démarrer tant que ces points ne sont pas réglés." : "")
      );
      process.exitCode = totalViolations || totalUnknown ? 2 : 0;
      return;
    }

    if (totalViolations > 0) fail(`${totalViolations} violation(s) de contraintes : migration annulée, rien n'a été écrit.`, 2);
    if (totalUnknown > 0 && !ALLOW_UNKNOWN) {
      fail(`${totalUnknown} champ(s) Mongo non mappé(s) ne seraient pas migrés. Corrigez le mapping ou relancez avec --allow-unknown-fields.`, 2);
    }

    console.log("\n=== Insertion dans Neon (transaction) ===\n");
    await writeNeon(pgClient);
    console.log("\n✅ COMMIT effectué.");

    const ok = await printComparison(pgClient, mongoCounts);
    if (!ok) {
      console.log("\n❌ Des écarts subsistent entre Mongo et Neon (voir le tableau).");
      process.exitCode = 1;
    } else {
      console.log("\n✅ Tous les comptes correspondent.");
    }
  } finally {
    await mongo.close().catch(() => {});
    if (pgClient) pgClient.release();
    if (pool) await pool.end().catch(() => {});
  }
}

main().catch((err) => fail(err?.stack ?? err));
