// Formatage d'affichage des statistiques de visite (fr-FR).

export const RANGE_OPTIONS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "30d", label: "30 jours" },
  { value: "12m", label: "12 mois" },
  { value: "all", label: "Tout" },
];

export const DEVICE_LABELS = {
  desktop: "Ordinateur",
  mobile: "Mobile",
  tablet: "Tablette",
};

const numberFormat = new Intl.NumberFormat("fr-FR");
const decimalFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const formatNumber = (n) => numberFormat.format(n ?? 0);
export const formatDecimal = (n) => decimalFormat.format(n ?? 0);

export function formatPercent(part, total) {
  if (!total) return "0 %";
  const pct = (part / total) * 100;
  return `${pct < 10 && pct > 0 ? decimalFormat.format(pct) : Math.round(pct)} %`;
}

/** 0 → "0 s", 45 → "45 s", 125 → "2 min 05 s", 3720 → "1 h 02 min". */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min ${String(rest).padStart(2, "0")} s`;
}

let regionNames = null;
try {
  regionNames = new Intl.DisplayNames(["fr"], { type: "region" });
} catch {
  regionNames = null; // navigateur sans Intl.DisplayNames : on affiche le code ISO
}

/** Nom du pays en français à partir du code ISO alpha-2 ; null → "Inconnu". */
export function countryName(code) {
  if (!code) return "Inconnu";
  if (code === "XK") return "Kosovo";
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
}

/** Drapeau emoji à partir du code ISO (lettres régionales Unicode). */
export function countryFlag(code) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const pageLabel = (path) => (path === "/" ? "Accueil" : path);

// bucket : timestamp déjà en heure de Madagascar, "AAAA-MM-JJTHH:MI", renvoyé par l'API.
// On lit l'heure dans la chaîne (jamais via le fuseau du navigateur), et la date est
// construite à midi pour ne pas être décalée d'un jour par le fuseau de l'admin.
function parseBucket(bucket) {
  const [, y, mo, d, h] = bucket.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/) || [];
  return { date: new Date(Number(y), Number(mo) - 1, Number(d), 12), hour: Number(h), year: Number(y) };
}

/**
 * Libellé court de l'axe X selon la granularité (hour | day | month).
 * withYear : ajoute l'année aux mois (période "Tout" sur plusieurs années).
 */
export function bucketTick(bucket, granularity, { withYear = false } = {}) {
  const { date, hour } = parseBucket(bucket);
  if (granularity === "hour") return `${hour} h`;
  if (granularity === "day") return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return date.toLocaleDateString("fr-FR", withYear ? { month: "short", year: "2-digit" } : { month: "short" });
}

/** Les graduations couvrent-elles plusieurs années civiles ? */
export function spansSeveralYears(buckets) {
  if (buckets.length < 2) return false;
  return parseBucket(buckets[0]).year !== parseBucket(buckets[buckets.length - 1]).year;
}

/**
 * Environ `target` graduations réparties régulièrement, en partant de la première.
 * 24 h → 0, 4, 8, 12, 16, 20 h ; 30 jours → tous les 5 jours ; 12 mois → tous les 2 mois.
 */
export function pickTicks(buckets, target) {
  if (buckets.length <= target) return buckets;
  const step = Math.ceil(buckets.length / target);
  return buckets.filter((_, i) => i % step === 0);
}

/** Libellé complet de l'infobulle. */
export function bucketLabel(bucket, granularity) {
  const { date, hour } = parseBucket(bucket);
  if (granularity === "hour") {
    return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, ${hour} h – ${hour + 1} h`;
  }
  if (granularity === "day") {
    return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  const label = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const TRAFFIC_TITLES = {
  hour: "Trafic par heure",
  day: "Trafic quotidien",
  month: "Trafic mensuel",
};
