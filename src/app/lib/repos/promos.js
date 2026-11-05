// Accès aux codes promo (promo_codes + promo_code_uses). Lot 2a : lecture pour le calcul de
// prix et la validation, consommation à la création de commande. Complété au lot 4 (admin).
// Forme identique aux documents Mongoose : `_id`, `referrerId`, `usedByUserIds[]`…
import { query, isUuid } from "@/app/lib/neon";

const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

const PROMO_SELECT = `
  SELECT p.*,
         COALESCE(
           (SELECT array_agg(COALESCE(u.user_id::text, u.user_mongo_id) ORDER BY u.position)
              FROM promo_code_uses u WHERE u.promo_code_id = p.id),
           '{}'
         ) AS used_by_user_ids
    FROM promo_codes p`;

export function toPromo(row) {
  if (!row) return null;
  return {
    _id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    minOrderAmount: row.min_order_amount,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    active: row.active,
    expiresAt: row.expires_at,
    isReferral: row.is_referral,
    referrerId: row.referrer_id,
    filleulPercent: row.filleul_percent,
    parrainPercent: row.parrain_percent,
    // Valeurs nulles conservées : $push Mongo pouvait en ajouter. `null` ne correspond à
    // aucun utilisateur dans les comparaisons String(id) === String(userId).
    usedByUserIds: row.used_by_user_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Code promo par code (normalisé en majuscules, sans espaces), actif ou non. */
export async function findPromoByCode(code, db = poolDb) {
  const normalized = String(code ?? "").toUpperCase().trim();
  if (!normalized) return null;
  const { rows } = await db.query(`${PROMO_SELECT} WHERE p.code = $1`, [normalized]);
  return toPromo(rows[0]);
}

/** Équivalent de PromoCode.findOne({ code, active: true }). */
export async function findActivePromoByCode(code, db = poolDb) {
  const promo = await findPromoByCode(code, db);
  return promo && promo.active ? promo : null;
}

/** Équivalent de PromoCode.exists({ code }). */
export async function promoCodeExists(client, code) {
  const { rows } = await client.query("SELECT 1 FROM promo_codes WHERE code = $1", [code]);
  return rows.length > 0;
}

/**
 * Consomme un code promo dans la transaction `client` : usedCount + 1 et, pour un code de
 * parrainage, ajout de l'utilisateur à usedByUserIds (équivalent de $inc + $push).
 * Un id utilisateur qui n'est pas un uuid (session encore émise par l'ancien système) est
 * conservé dans user_mongo_id, comme lors de la migration.
 */
export async function consumePromo(client, promoId, { recordUserId, userId }) {
  await client.query("UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1", [promoId]);
  if (!recordUserId) return;
  const validUuid = isUuid(userId);
  await client.query(
    `INSERT INTO promo_code_uses (promo_code_id, position, user_id, user_mongo_id)
     SELECT $1, COALESCE(MAX(position) + 1, 0), $2::uuid, $3
       FROM promo_code_uses WHERE promo_code_id = $1`,
    [promoId, validUuid ? userId : null, validUuid ? null : userId ?? null]
  );
}

/** Équivalent de PromoCode.create({...}) pour une récompense de parrainage (lot 2a). */
export async function createPromo(client, { code, type, value, maxUses = null, active = true, expiresAt = null }) {
  const { rows } = await client.query(
    `INSERT INTO promo_codes (code, type, value, max_uses, active, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [String(code).toUpperCase().trim(), type, value, maxUses, active, expiresAt]
  );
  return rows[0].id;
}
