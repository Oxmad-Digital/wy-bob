// Helpers purs de la collecte de statistiques (sans accès base) : validation du corps,
// détection robots / appareil, réduction du référent au nom de domaine, hash anonyme.
// Aucune donnée personnelle n'en sort : ni IP ni user-agent ne sont renvoyés.
import { createHash } from "node:crypto";
import { isUuid } from "@/app/lib/neon";

export const MAX_DURATION_S = 1800;
const MAX_PATH_LENGTH = 300;
const MAX_REFERRER_LENGTH = 2048;
export const MAX_BODY_BYTES = 4096;

const VIEW_KEYS = ["type", "id", "path", "referrer", "is_entry"];
const LEAVE_KEYS = ["type", "id", "duration"];

// Chemins jamais comptés (aussi filtrés côté client).
const EXCLUDED_PATH_RE = /^\/(admin|api|auth)(\/|$)/i;

// Robots, outils de mesure, clients HTTP et navigateurs automatisés.
const BOT_UA_RE =
  /bot|crawl|spider|slurp|archiver|facebookexternalhit|embedly|quora link preview|whatsapp|telegram|discord|skype|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|httpclient|http-client|java\/|go-http|okhttp|node-fetch|axios|undici|scrapy|phantomjs|selenium|puppeteer|playwright|postman|insomnia/i;

/** Clés exactement égales (ordre indifférent) : refuse les champs inconnus. */
function hasExactKeys(obj, keys) {
  const objKeys = Object.keys(obj);
  return objKeys.length === keys.length && keys.every((k) => Object.hasOwn(obj, k));
}

/**
 * Valide strictement le corps envoyé par le tracker.
 * @returns {null | { type: "view", id: string, path: string, referrer: string|null, isEntry: boolean }
 *                | { type: "leave", id: string, duration: number }}
 */
export function parseTrackBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!isUuid(body.id)) return null;

  if (body.type === "view") {
    if (!hasExactKeys(body, VIEW_KEYS)) return null;
    const { path, referrer, is_entry } = body;

    if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) return null;
    if (path[0] !== "/" || path.startsWith("//")) return null;
    if (/[?#\s\u0000-\u001f\u007f\\]/.test(path)) return null; // ni query string, ni fragment, ni caractères de contrôle

    if (referrer !== null && (typeof referrer !== "string" || referrer.length > MAX_REFERRER_LENGTH)) return null;
    if (typeof is_entry !== "boolean") return null;

    return { type: "view", id: body.id.toLowerCase(), path, referrer, isEntry: is_entry };
  }

  if (body.type === "leave") {
    if (!hasExactKeys(body, LEAVE_KEYS)) return null;
    const { duration } = body;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) return null;
    return { type: "leave", id: body.id.toLowerCase(), duration };
  }

  return null;
}

/** Chemin normalisé : sans slash final (sauf "/"). */
export function normalizePath(path) {
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

export function isExcludedPath(path) {
  return EXCLUDED_PATH_RE.test(path);
}

export function isBot(userAgent) {
  if (!userAgent || userAgent.length < 20) return true;
  return BOT_UA_RE.test(userAgent);
}

/** desktop | mobile | tablet, déduit du user-agent (iPadOS récent se déclare "Macintosh" → desktop). */
export function detectDevice(userAgent) {
  const ua = userAgent || "";
  if (/ipad|tablet|kindle|silk|playbook|nexus (7|9|10)|sm-t\d/i.test(ua)) return "tablet";
  if (/android/i.test(ua) && !/mobile/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|bb10|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Code pays ISO alpha-2 de l'en-tête Vercel, ou null. */
export function parseCountry(header) {
  const code = (header || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

const stripWww = (host) => host.replace(/^www\./, "");

/**
 * Réduit un référent au nom de domaine ("https://www.google.com/search?q=…" → "google.com").
 * null si vide, invalide, non http(s), ou si c'est le propre domaine du site ("Direct").
 * @param {string|null} referrer
 * @param {string[]} ownHosts noms d'hôte du site (sans "www.")
 */
export function referrerDomain(referrer, ownHosts) {
  if (!referrer) return null;
  let url;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = stripWww(url.hostname.toLowerCase());
  if (!host || host.length > 253) return null;
  if (ownHosts.includes(host)) return null;
  return host;
}

/** Noms d'hôte considérés comme "le site" : NEXT_PUBLIC_APP_URL + l'hôte de la requête. */
export function getOwnHosts(requestHost) {
  const hosts = new Set();
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) hosts.add(stripWww(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname));
  } catch {
    // URL mal formée : on se contente de l'hôte de la requête.
  }
  if (requestHost) hosts.add(stripWww(requestHost.split(":")[0].toLowerCase()));
  return [...hosts];
}

/** sha256(sel + jour UTC + IP + user-agent) en hexadécimal : change chaque jour, non réversible. */
export function visitorHash(salt, ip, userAgent, now = new Date()) {
  const day = now.toISOString().slice(0, 10); // AAAA-MM-JJ en UTC
  return createHash("sha256").update(`${salt}|${day}|${ip}|${userAgent}`).digest("hex");
}

/** Collecte active : en production Vercel, ou si STATS_ENABLED=true (tests locaux). */
export function isTrackingEnabled() {
  return process.env.VERCEL_ENV === "production" || process.env.STATS_ENABLED === "true";
}
