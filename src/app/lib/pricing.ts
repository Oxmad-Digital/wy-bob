// Logique de calcul du total pure (pas d'accès DB) — utilisable côté client et serveur,
// pour garantir que le montant affiché au client et le montant réellement facturé soient identiques.

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param discountedSubtotal sous-total du panier, promo déjà déduite (ex: finalTotal côté panier)
 * @param shippingFee frais de livraison déjà calculé (voir shipping/pricing.ts computeShippingFee)
 */
export function computeOrderTotals(discountedSubtotal: number, shippingFee: number) {
  const subtotal = Math.max(0, round2(discountedSubtotal));
  const shipping = round2(shippingFee);
  const total = round2(subtotal + shipping);
  return { subtotal, shipping, total };
}
