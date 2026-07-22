// Résolution en lecture seule d'un code promo pour le calcul de prix — n'incrémente
// jamais usedCount ni ne crée de récompense de parrainage (ça reste la responsabilité
// de /api/order, qui ne s'exécute qu'une fois la commande réellement créée).

import PromoCode from "@/app/models/PromoCode";
import { round2 } from "./pricing";

export async function resolvePromoDiscount(
  promoCode: string | null | undefined,
  subtotal: number,
  userId: string | null | undefined
): Promise<{ discount: number; validatedCode: string | null; promo: any }> {
  if (!promoCode) return { discount: 0, validatedCode: null, promo: null };

  const promo = await PromoCode.findOne({ code: promoCode.toUpperCase().trim(), active: true });
  if (!promo) return { discount: 0, validatedCode: null, promo: null };

  const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
  const isMaxedOut = promo.maxUses !== null && promo.usedCount >= promo.maxUses;
  if (isExpired || isMaxedOut) return { discount: 0, validatedCode: null, promo: null };

  if (promo.isReferral) {
    const selfReferral = userId && String(promo.referrerId) === String(userId);
    const alreadyUsed = userId && promo.usedByUserIds.some((id: any) => String(id) === String(userId));
    if (!userId || selfReferral || alreadyUsed) {
      return { discount: 0, validatedCode: null, promo: null };
    }
    const effectivePercent = promo.filleulPercent ?? 0;
    return { discount: round2(subtotal * (effectivePercent / 100)), validatedCode: promo.code, promo };
  }

  const discount = promo.type === "percent"
    ? round2(subtotal * (promo.value / 100))
    : Math.min(promo.value, subtotal);
  return { discount, validatedCode: promo.code, promo };
}
