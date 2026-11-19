// Réglages du site (site_settings) et configuration du parrainage (referral_configs) :
// deux tables à une seule ligne. Formes identiques aux documents Mongoose .lean().
import { query, queryOne } from "@/app/lib/neon";

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

/** Mode maintenance seul (utilisé par le proxy) : false si la ligne n'existe pas encore. */
export async function getMaintenanceMode() {
  const row = await queryOne("SELECT maintenance_mode FROM site_settings LIMIT 1");
  return row?.maintenance_mode ?? false;
}

/**
 * Équivalent de SiteSettings.findOne() ?? SiteSettings.create({}) : crée la ligne unique
 * avec ses valeurs par défaut si elle n'existe pas. L'index unique "singleton" empêche
 * deux créations simultanées de produire deux lignes (ON CONFLICT DO NOTHING).
 */
export async function getOrCreateSiteSettings() {
  const existing = await getSiteSettings();
  if (existing) return existing;
  await query("INSERT INTO site_settings DEFAULT VALUES ON CONFLICT DO NOTHING");
  return getSiteSettings();
}

/** Valeur refusée par updateSiteSettings (la route répond 400 avec ce message). */
export class SiteSettingsValidationError extends Error {}

// Champs de facturation modifiables : clé envoyée par l'admin -> [colonne, type].
// Les clés inconnues sont ignorées, comme le faisait Mongoose (schéma strict).
const BILLING_COLUMNS = {
  companyName: ["billing_company_name", "text"],
  legalForm: ["billing_legal_form", "text"],
  address: ["billing_address", "text"],
  city: ["billing_city", "text"],
  postalCode: ["billing_postal_code", "text"],
  siret: ["billing_siret", "text"],
  vatNumber: ["billing_vat_number", "text"],
  vatApplicable: ["billing_vat_applicable", "boolean"],
  vatRate: ["billing_vat_rate", "number"],
  iban: ["billing_iban", "text"],
};

// Conversions alignées sur le cast de Mongoose : on accepte ce que Mongo acceptait
// ("20" -> 20, "true" -> true, null -> ""), on refuse ce qu'il aurait refusé.
function castValue(key, type, value) {
  if (type === "text") {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  } else if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
  } else if (type === "number") {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  throw new SiteSettingsValidationError(`Valeur invalide pour « ${key} »`);
}

/**
 * Équivalent de findOneAndUpdate({}, { $set }, { upsert: true, new: true }) : met à jour le
 * mode maintenance et/ou les champs de facturation fournis, crée la ligne si besoin, et
 * renvoie les réglages à jour.
 */
export async function updateSiteSettings({ maintenanceMode, billing } = {}) {
  const sets = [];
  const params = [];
  const set = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (maintenanceMode !== undefined) {
    set("maintenance_mode", castValue("maintenanceMode", "boolean", maintenanceMode));
  }
  if (billing !== undefined && billing !== null) {
    if (typeof billing !== "object" || Array.isArray(billing)) {
      throw new SiteSettingsValidationError("Valeur invalide pour « billing »");
    }
    for (const [key, value] of Object.entries(billing)) {
      const entry = BILLING_COLUMNS[key];
      if (!entry) continue;
      const [column, type] = entry;
      set(column, castValue(key, type, value));
    }
  }

  await query("INSERT INTO site_settings DEFAULT VALUES ON CONFLICT DO NOTHING");
  if (sets.length === 0) return getSiteSettings();

  const row = await queryOne(`UPDATE site_settings SET ${sets.join(", ")} RETURNING *`, params);
  return toSiteSettings(row);
}

/** Équivalent de ReferralConfig.findOne() : null si la ligne n'existe pas encore. */
export async function getReferralConfig(db = poolDb) {
  const { rows } = await db.query("SELECT * FROM referral_configs LIMIT 1");
  return toReferralConfig(rows[0]);
}
