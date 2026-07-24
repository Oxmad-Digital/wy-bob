// Agrégation du poids d'une commande — partagée entre la génération d'étiquette
// Chronopost (orderShipment.ts) et le calcul du frais de livraison facturé au client
// (shipping/pricing.ts), pour ne jamais avoir deux logiques de poids qui divergent.

export interface WeighableProductLine {
  product: { weight?: number } | null;
  quantity: number;
}

export function computeTotalWeightKg(products: WeighableProductLine[]): number {
  const grams = products.reduce((sum, line) => sum + (line.product?.weight ?? 100) * (line.quantity || 1), 0);
  return Math.max(0.1, Math.round((grams / 1000) * 100) / 100);
}
