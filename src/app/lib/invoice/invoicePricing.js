function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatInvoiceNumber(year, sequence) {
  return `FACT-${year}-${String(sequence).padStart(4, "0")}`;
}

// Le sous-total avant remise est dérivé du total réellement encaissé (totalTtc)
// plutôt que recalculé depuis le prix courant des produits, qui a pu changer depuis
// la commande — totalTtc reste la seule source de vérité sur ce qui a été payé.
// Les prix produits étant TTC (affichage B2C), le HT est obtenu par division inverse.
export function computeInvoiceAmounts({ totalTtc, shippingFeeTtc = 0, promoDiscount = 0, vatApplicable = false, vatRate = 20 }) {
  const subtotalTtc = round2(totalTtc - shippingFeeTtc + promoDiscount);
  const totalHt = vatApplicable ? round2(totalTtc / (1 + vatRate / 100)) : totalTtc;
  const vatAmount = vatApplicable ? round2(totalTtc - totalHt) : 0;

  return { subtotalTtc, totalHt, vatAmount, totalTtc };
}
