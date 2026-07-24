// Calcul du frais de livraison — fonction pure (pas d'accès DB), utilisable partout
// où poids total + pays + mode de livraison sont déjà connus.

import { resolveZone, RATE_TABLE, FALLBACK_SHIPPING_FEE, type ShippingMode } from "./zones";

export function computeShippingFee(params: {
  country: string;
  weightKg: number;
  deliveryMethod: ShippingMode;
}): number {
  const zone = resolveZone(params.country);
  const brackets = RATE_TABLE[zone]?.[params.deliveryMethod];
  if (!brackets || brackets.length === 0) return FALLBACK_SHIPPING_FEE;

  const match = brackets.find((b) => params.weightKg <= b.maxKg) ?? brackets[brackets.length - 1];
  return match.price;
}
