import mongoose from "mongoose";

// Persiste les tentatives (login, register, reset password, promo, commande…) en base
// pour que le rate limiting fonctionne correctement en serverless multi-instances
// (une Map en mémoire est propre à chaque instance et ne protège rien à l'échelle).
const RateLimitAttemptSchema = new mongoose.Schema({
  key: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL généreux — bien plus large que n'importe quelle fenêtre utilisée par les appelants,
// sert uniquement à purger la collection automatiquement.
RateLimitAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export default mongoose.models.RateLimitAttempt ||
  mongoose.model("RateLimitAttempt", RateLimitAttemptSchema);
