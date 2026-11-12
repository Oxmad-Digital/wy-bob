// Agrégations des statistiques de visite (table site_visits, voir db/stats.sql).
// Une requête SQL par bloc, toutes filtrées sur created_at (index site_visits_created_at_idx,
// et l'index partiel site_visits_entry_created_at_idx pour la provenance). Aucune ligne
// brute n'est chargée côté serveur.
import { query, queryOne } from "@/app/lib/neon";

// Fuseau des périodes et des graduations : heure de Madagascar (UTC+3, sans heure d'été).
// "Aujourd'hui" commence à minuit à Antananarivo. (Le visitor_hash, lui, reste au jour UTC.)
export const TZ = "Indian/Antananarivo";
const LOCAL_NOW = `(now() AT TIME ZONE '${TZ}')`;

/**
 * Périodes autorisées. Les fragments SQL sont des constantes (jamais construits à partir
 * de la requête HTTP) : `range` est validé contre ces clés avant tout usage.
 *   start      : borne basse du filtre WHERE. Minuit local reconverti en timestamptz :
 *                `created_at >= (minuit local) AT TIME ZONE tz` équivaut à
 *                `created_at AT TIME ZONE tz >= minuit local`, mais reste utilisable par
 *                l'index sur created_at (une expression sur la colonne ne le serait pas).
 *   seriesFrom / seriesTo : bornes (timestamps locaux) de la série du graphique
 *   unit/step  : granularité de la série (heure / jour / mois)
 */
const RANGES = {
  today: {
    start: `date_trunc('day', ${LOCAL_NOW}) AT TIME ZONE '${TZ}'`,
    seriesFrom: `date_trunc('day', ${LOCAL_NOW})`,
    seriesTo: `date_trunc('day', ${LOCAL_NOW}) + interval '23 hours'`, // toute la journée, 0 h → 23 h
    unit: "hour",
    step: "1 hour",
  },
  "30d": {
    start: `(date_trunc('day', ${LOCAL_NOW}) - interval '29 days') AT TIME ZONE '${TZ}'`,
    seriesFrom: `date_trunc('day', ${LOCAL_NOW}) - interval '29 days'`,
    seriesTo: `date_trunc('day', ${LOCAL_NOW})`,
    unit: "day",
    step: "1 day",
  },
  "12m": {
    start: `(date_trunc('month', ${LOCAL_NOW}) - interval '11 months') AT TIME ZONE '${TZ}'`,
    seriesFrom: `date_trunc('month', ${LOCAL_NOW}) - interval '11 months'`,
    seriesTo: `date_trunc('month', ${LOCAL_NOW})`,
    unit: "month",
    step: "1 month",
  },
  all: {
    start: `'-infinity'::timestamptz`,
    seriesFrom: `date_trunc('month', (SELECT min(created_at) FROM site_visits) AT TIME ZONE '${TZ}')`,
    seriesTo: `date_trunc('month', ${LOCAL_NOW})`,
    unit: "month",
    step: "1 month",
  },
};

export const ANALYTICS_RANGES = Object.keys(RANGES);
export const isAnalyticsRange = (v) => typeof v === "string" && Object.hasOwn(RANGES, v);

const TOP_LIMIT = 10;

/** Vues, visiteurs uniques, moyennes par jour et durée moyenne par session. */
async function getSummary(r) {
  // Session = un visiteur sur une journée (le hash change chaque jour UTC, soit 3 h du matin
  // à Antananarivo).
  // Nombre de jours : depuis le début de la période (ou la 1re visite pour "Tout"), au moins 1.
  const row = await queryOne(
    `WITH v AS (
       SELECT visitor_hash, duration_s, created_at
         FROM site_visits
        WHERE created_at >= ${r.start}
     ), s AS (
       SELECT sum(duration_s) AS duration FROM v GROUP BY visitor_hash
     )
     SELECT (SELECT count(*) FROM v)::int                         AS views,
            (SELECT count(*) FROM s)::int                         AS visitors,
            (SELECT round(avg(duration)) FROM s)::int             AS avg_session_s,
            greatest(1, ceil(extract(epoch FROM now() - coalesce(
              nullif(${r.start}, '-infinity'::timestamptz),
              (SELECT min(created_at) FROM v),
              now()
            )) / 86400))::int                                     AS days`
  );

  const views = row?.views ?? 0;
  const visitors = row?.visitors ?? 0;
  const days = row?.days ?? 1;
  return {
    views,
    visitors,
    days,
    avgViewsPerDay: Math.round((views / days) * 10) / 10,
    avgVisitorsPerDay: Math.round((visitors / days) * 10) / 10,
    avgSessionDurationS: row?.avg_session_s ?? 0,
  };
}

/**
 * Série temporelle continue en heure locale : vues et visiteurs uniques par graduation.
 * Graduations passées sans visite = 0 ; graduations à venir (heures restantes de la
 * journée pour "Aujourd'hui") = null, pour que la courbe s'arrête à l'heure actuelle.
 */
async function getTraffic(r) {
  return query(
    `WITH b AS (
       SELECT generate_series(${r.seriesFrom}, ${r.seriesTo}, interval '${r.step}') AS bucket
     ), agg AS (
       SELECT date_trunc('${r.unit}', created_at AT TIME ZONE '${TZ}') AS bucket,
              count(*)::int                     AS views,
              count(DISTINCT visitor_hash)::int AS visitors
         FROM site_visits
        WHERE created_at >= ${r.start}
        GROUP BY 1
     )
     SELECT to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI') AS bucket,
            CASE WHEN b.bucket > date_trunc('${r.unit}', ${LOCAL_NOW}) THEN NULL
                 ELSE coalesce(agg.views, 0) END    AS views,
            CASE WHEN b.bucket > date_trunc('${r.unit}', ${LOCAL_NOW}) THEN NULL
                 ELSE coalesce(agg.visitors, 0) END AS visitors
       FROM b
       LEFT JOIN agg ON agg.bucket = b.bucket
      ORDER BY b.bucket`
  );
}

async function getTopPages(r) {
  return query(
    `SELECT path,
            count(*)::int                     AS views,
            count(DISTINCT visitor_hash)::int AS visitors
       FROM site_visits
      WHERE created_at >= ${r.start}
      GROUP BY path
      ORDER BY views DESC, path
      LIMIT ${TOP_LIMIT}`
  );
}

/** Provenance : pages d'entrée uniquement. referrer NULL = "Direct" (affiché par l'interface). */
async function getReferrers(r) {
  return query(
    `SELECT referrer,
            count(*)::int AS visits
       FROM site_visits
      WHERE is_entry AND created_at >= ${r.start}
      GROUP BY referrer
      ORDER BY visits DESC, referrer NULLS FIRST
      LIMIT ${TOP_LIMIT}`
  );
}

async function getDevices(r) {
  return query(
    `SELECT device,
            count(*)::int                     AS views,
            count(DISTINCT visitor_hash)::int AS visitors
       FROM site_visits
      WHERE created_at >= ${r.start}
      GROUP BY device
      ORDER BY views DESC`
  );
}

/** Tous les pays (la carte du monde en a besoin). country NULL = inconnu. */
async function getCountries(r) {
  return query(
    `SELECT country,
            count(*)::int                     AS views,
            count(DISTINCT visitor_hash)::int AS visitors
       FROM site_visits
      WHERE created_at >= ${r.start}
      GROUP BY country
      ORDER BY views DESC, country NULLS LAST`
  );
}

/** @param {"today"|"30d"|"12m"|"all"} range (déjà validé par isAnalyticsRange) */
export async function getAnalytics(range) {
  const r = RANGES[range];
  if (!r) throw new Error(`Période inconnue : ${range}`);

  const [summary, traffic, topPages, referrers, devices, countries] = await Promise.all([
    getSummary(r),
    getTraffic(r),
    getTopPages(r),
    getReferrers(r),
    getDevices(r),
    getCountries(r),
  ]);

  return {
    range,
    granularity: r.unit,
    timezone: TZ,
    summary,
    traffic,
    topPages,
    referrers,
    devices,
    countries,
  };
}
