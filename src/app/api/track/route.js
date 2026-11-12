export const runtime = "nodejs";

import { after } from "next/server";
import { auth } from "@/auth";
import { query } from "@/app/lib/neon";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";
import {
  MAX_BODY_BYTES,
  MAX_DURATION_S,
  detectDevice,
  getOwnHosts,
  isBot,
  isExcludedPath,
  isTrackingEnabled,
  normalizePath,
  parseCountry,
  parseTrackBody,
  referrerDomain,
  visitorHash,
} from "@/app/lib/stats/track";

// Collecte anonyme des visites (voir db/stats.sql) : aucune IP, aucun user-agent, aucun
// cookie stockés. La réponse est toujours 204 et vide — le visiteur ne voit jamais
// d'erreur, et un robot n'apprend rien. L'écriture en base se fait après la réponse.

const RATE_LIMIT = { windowMs: 10 * 60 * 1000, maxAttempts: 300 };

let warnedMissingSalt = false;

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(req) {
  try {
    if (!isTrackingEnabled()) return noContent();

    const salt = process.env.STATS_SALT;
    if (!salt) {
      if (!warnedMissingSalt) {
        console.warn("[stats] STATS_SALT absent : aucune visite n'est enregistrée.");
        warnedMissingSalt = true;
      }
      return noContent();
    }

    const userAgent = req.headers.get("user-agent") || "";
    if (isBot(userAgent)) return noContent();

    // Corps borné (sendBeacon envoie au plus quelques centaines d'octets).
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return noContent();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return noContent();
    }
    const event = parseTrackBody(json);
    if (!event) return noContent();

    // Admin connecté : jamais compté (le tracker client l'exclut déjà, ceci est la garantie serveur).
    const session = await auth();
    if (session?.user?.role === "admin") return noContent();

    const ip = getClientIp(req);
    const hash = visitorHash(salt, ip, userAgent);

    if (event.type === "view") {
      const path = normalizePath(event.path);
      if (isExcludedPath(path)) return noContent();

      const row = {
        id: event.id,
        hash,
        path,
        referrer: event.isEntry ? referrerDomain(event.referrer, getOwnHosts(req.headers.get("host"))) : null,
        isEntry: event.isEntry,
        country: parseCountry(req.headers.get("x-vercel-ip-country")),
        device: detectDevice(userAgent),
      };

      after(() => recordView(ip, row));
    } else {
      const duration = Math.min(Math.round(event.duration), MAX_DURATION_S);
      if (duration > 0) after(() => recordLeave(ip, event.id, hash, duration));
    }
  } catch (err) {
    console.error("[stats] collecte ignorée :", err?.message);
  }
  return noContent();
}

async function allowed(ip) {
  const { allowed } = await checkRateLimit({ key: `track:${ip}`, ...RATE_LIMIT });
  return allowed;
}

async function recordView(ip, row) {
  try {
    if (!(await allowed(ip))) return;
    await query(
      `INSERT INTO site_visits (id, visitor_hash, path, referrer, is_entry, country, device)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.hash, row.path, row.referrer, row.isEntry, row.country, row.device]
    );
  } catch (err) {
    console.error("[stats] enregistrement de la vue échoué :", err?.message);
  }
}

async function recordLeave(ip, id, hash, duration) {
  try {
    if (!(await allowed(ip))) return;
    // Une seule mise à jour par page vue (duration_s = 0), et uniquement par le même
    // visiteur (même hash) : impossible de modifier la durée d'une autre visite.
    await query(
      `UPDATE site_visits
          SET duration_s = $3
        WHERE id = $1 AND visitor_hash = $2 AND duration_s = 0`,
      [id, hash, duration]
    );
  } catch (err) {
    console.error("[stats] enregistrement de la durée échoué :", err?.message);
  }
}
