import { query, queryOne } from "@/app/lib/neon";

export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Rétention des tentatives : bien plus large que n'importe quelle fenêtre utilisée par les
// appelants. Remplace l'index TTL Mongo (24 h), qui n'existe pas en PostgreSQL.
const RETENTION = "1 day";
const PURGE_PROBABILITY = 0.05;

// Rate limiting persistant (PostgreSQL) — contrairement à une Map locale, fonctionne
// correctement sur Vercel où chaque invocation serverless peut atterrir sur une instance
// différente.
export async function checkRateLimit({ key, windowMs, maxAttempts }) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // Purge opportuniste (≈ 1 appel sur 20) des tentatives expirées, via l'index sur created_at.
  if (Math.random() < PURGE_PROBABILITY) {
    await query(`DELETE FROM rate_limit_attempts WHERE created_at < now() - interval '${RETENTION}'`).catch(
      (err) => console.error("[rateLimit] purge échouée :", err?.message)
    );
  }

  const { count, oldest } = await queryOne(
    `SELECT count(*)::int AS count, min(created_at) AS oldest
       FROM rate_limit_attempts
      WHERE key = $1 AND created_at >= $2`,
    [key, windowStart]
  );

  if (count >= maxAttempts) {
    const retryAfter = oldest
      ? Math.max(1, Math.ceil((oldest.getTime() + windowMs - now.getTime()) / 1000))
      : Math.ceil(windowMs / 1000);
    return { allowed: false, retryAfter };
  }

  await query("INSERT INTO rate_limit_attempts (key, created_at) VALUES ($1, $2)", [key, now]);
  return { allowed: true };
}
