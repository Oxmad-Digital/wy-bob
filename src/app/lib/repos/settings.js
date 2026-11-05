// Réglages du site (site_settings) et configuration du parrainage (referral_configs) :
// deux tables à une seule ligne. Formes identiques aux documents Mongoose .lean().
import { query } from "@/app/lib/neon";

const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

function toSiteSettings(row) {
  if (!row) return null;
  return {
    _id: row.id,
    maintenanceMode: row.maintenance_mode,
    billing: {
      companyName: row.billing_company_name,
      legalForm: row.billing_legal_form,
      address: row.billing_address,
      city: row.billing_city,
      postalCode: row.billing_postal_code,
      siret: row.billing_siret,
      vatNumber: row.billing_vat_number,
      vatApplicable: row.billing_vat_applicable,
      vatRate: row.billing_vat_rate,
      iban: row.billing_iban,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReferralConfig(row) {
  if (!row) return null;
  return {
    _id: row.id,
    totalPercent: row.total_percent,
    rewardValidityDays: row.reward_validity_days,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Équivalent de SiteSettings.findOne() : null si la ligne n'existe pas encore. */
export async function getSiteSettings(db = poolDb) {
  const { rows } = await db.query("SELECT * FROM site_settings LIMIT 1");
  return toSiteSettings(rows[0]);
}

/** Équivalent de ReferralConfig.findOne() : null si la ligne n'existe pas encore. */
export async function getReferralConfig(db = poolDb) {
  const { rows } = await db.query("SELECT * FROM referral_configs LIMIT 1");
  return toReferralConfig(rows[0]);
}
