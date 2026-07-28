import { connectDB } from "@/app/lib/db";
import RateLimitAttempt from "@/app/models/RateLimitAttempt";

export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Rate limiting persistant (MongoDB) — contrairement à une Map locale, fonctionne
// correctement sur Vercel où chaque invocation serverless peut atterrir sur une instance
// différente.
export async function checkRateLimit({ key, windowMs, maxAttempts }) {
  await connectDB();

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const count = await RateLimitAttempt.countDocuments({
    key,
    createdAt: { $gte: windowStart },
  });

  if (count >= maxAttempts) {
    const oldest = await RateLimitAttempt.findOne({ key, createdAt: { $gte: windowStart } })
      .sort({ createdAt: 1 })
      .lean();
    const retryAfter = oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + windowMs - now.getTime()) / 1000))
      : Math.ceil(windowMs / 1000);
    return { allowed: false, retryAfter };
  }

  await RateLimitAttempt.create({ key, createdAt: now });
  return { allowed: true };
}
