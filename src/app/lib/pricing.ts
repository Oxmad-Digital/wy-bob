// Logique de calcul du total pure (pas d'accès DB) — utilisable côté client et serveur,
// pour garantir que le montant affiché au client et le montant réellement facturé soient identiques.

export const SHIPPING_FEE = 25;
export const TVA_RATE = 0.20;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param discountedSubtotal sous-total du panier, promo déjà déduite (ex: finalTotal côté panier)
 */
export function computeOrderTotals(discountedSubtotal: number) {
  const subtotal = Math.max(0, round2(discountedSubtotal));
  const tva = round2(subtotal * TVA_RATE);
  const shipping = SHIPPING_FEE;
  const total = round2(subtotal + tva + shipping);
  return { subtotal, tva, shipping, total };
}
