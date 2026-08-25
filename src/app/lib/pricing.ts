// Logique de calcul du total pure (pas d'accès DB) — utilisable côté client et serveur,
// pour garantir que le montant affiché au client et le montant réellement facturé soient identiques.

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param discountedSubtotal sous-total du panier, promo déjà déduite (ex: finalTotal côté panier)
 * @param shippingFee frais de livraison déjà calculé (voir shipping/pricing.ts computeShippingFee)
 * @param insuranceFee supplément assurance colis optionnelle déjà calculé (voir
 *   shipping/insurance.ts computeInsuranceFee), 0 si le client n'a pas souscrit
 */
export function computeOrderTotals(discountedSubtotal: number, shippingFee: number, insuranceFee = 0) {
  const subtotal = Math.max(0, round2(discountedSubtotal));
  const shipping = round2(shippingFee);
  const insurance = round2(insuranceFee);
  const total = round2(subtotal + shipping + insurance);
  return { subtotal, shipping, insurance, total };
}
