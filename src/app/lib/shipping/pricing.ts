// Calcul du frais de livraison — fonction pure (pas d'accès DB), utilisable partout
// où poids total + pays + mode de livraison sont déjà connus.

import {
  resolveCountryShipping,
  NATIONAL_RATES,
  CLASSIC_RATES,
  RELAIS_EUROPE_RATES,
  EXPRESS_RATES,
  FALLBACK_SHIPPING_FEE,
  type ShippingMode,
} from "./zones";

// Chronopost facture par kg entier (arrondi au supérieur), de 1 à 30 kg.
function kgIndex(weightKg: number): number {
  return Math.min(30, Math.max(1, Math.ceil(weightKg)));
}

export function computeShippingFee(params: {
  country: string;
  weightKg: number;
  deliveryMethod: ShippingMode;
}): number {
  const info = resolveCountryShipping(params.country);
  const idx = kgIndex(params.weightKg);

  if (info.product === "national") {
    const table = params.deliveryMethod === "relay" ? NATIONAL_RATES.relay : NATIONAL_RATES.home;
    return table[idx] ?? NATIONAL_RATES.home[idx] ?? FALLBACK_SHIPPING_FEE;
  }

  // Point relais Chronorelais Europe : uniquement dispo pour les pays "classic", et
  // limité à 20 kg côté grille tarifaire (au-delà, RELAIS_EUROPE_RATES[zone][idx] est
  // null et on retombe sur le tarif domicile du même produit/zone ci-dessous).
  if (params.deliveryMethod === "relay" && info.relay) {
    const price = RELAIS_EUROPE_RATES[info.relay.zone]?.[idx];
    if (price != null) return price;
  }

  const homeTable = info.product === "classic" ? CLASSIC_RATES[info.zone] : EXPRESS_RATES[info.zone];
  return homeTable?.[idx] ?? FALLBACK_SHIPPING_FEE;
}
