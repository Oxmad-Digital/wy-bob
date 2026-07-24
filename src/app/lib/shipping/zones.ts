// Zones de tarification transporteur — un transporteur (Chronopost) ne facture pas
// à la distance en km mais par palier de poids × zone géographique. Ce fichier est la
// seule chose à éditer pour aligner les tarifs facturés au client sur le coût réel.

export type ShippingZone = "FR" | "EU_PROCHE" | "EUROPE_LARGE" | "INTERNATIONAL";
export type ShippingMode = "home" | "relay";

// Mapping pays ISO2 → zone (mêmes pays que COUNTRY_OPTIONS dans CheckoutForm.tsx).
// Fallback "INTERNATIONAL" (palier le plus prudent) pour tout pays non listé ici,
// par exemple un futur ajout à COUNTRY_OPTIONS oublié dans cette table.
export const ZONE_BY_COUNTRY: Record<string, ShippingZone> = {
  FR: "FR",
  BE: "EU_PROCHE",
  DE: "EU_PROCHE",
  ES: "EU_PROCHE",
  IT: "EU_PROCHE",
  CH: "EUROPE_LARGE",
  GB: "EUROPE_LARGE",
  MG: "INTERNATIONAL",
  US: "INTERNATIONAL",
};

export function resolveZone(country: string): ShippingZone {
  return ZONE_BY_COUNTRY[(country || "").toUpperCase()] ?? "INTERNATIONAL";
}

export interface RateBracket {
  maxKg: number; // borne haute incluse ; Infinity = palier ouvert (poids au-delà)
  price: number;
}

// TODO(chronopost-contrat-17895404): valeurs placeholder — à remplacer par la grille
// tarifaire réelle du contrat Chronopost avant mise en production. La structure
// (paliers de poids par zone/mode) n'a pas besoin de changer, seuls les montants doivent
// être ajustés une fois la grille du contrat en main.
export const RATE_TABLE: Record<ShippingZone, Record<ShippingMode, RateBracket[]>> = {
  FR: {
    home: [
      { maxKg: 0.5, price: 5.9 },
      { maxKg: 1, price: 6.9 },
      { maxKg: 2, price: 7.9 },
      { maxKg: 3, price: 8.9 },
      { maxKg: 5, price: 10.9 },
      { maxKg: Infinity, price: 13.9 },
    ],
    relay: [
      { maxKg: 0.5, price: 4.9 },
      { maxKg: 1, price: 5.9 },
      { maxKg: 2, price: 6.9 },
      { maxKg: 3, price: 7.9 },
      { maxKg: 5, price: 9.9 },
      { maxKg: Infinity, price: 12.9 },
    ],
  },
  EU_PROCHE: {
    home: [
      { maxKg: 0.5, price: 9.9 },
      { maxKg: 1, price: 11.9 },
      { maxKg: 2, price: 14.9 },
      { maxKg: 3, price: 17.9 },
      { maxKg: 5, price: 22.9 },
      { maxKg: Infinity, price: 28.9 },
    ],
    relay: [
      { maxKg: 0.5, price: 7.9 },
      { maxKg: 1, price: 9.9 },
      { maxKg: 2, price: 12.9 },
      { maxKg: 3, price: 15.9 },
      { maxKg: 5, price: 19.9 },
      { maxKg: Infinity, price: 24.9 },
    ],
  },
  EUROPE_LARGE: {
    home: [
      { maxKg: 0.5, price: 13.9 },
      { maxKg: 1, price: 16.9 },
      { maxKg: 2, price: 20.9 },
      { maxKg: 3, price: 24.9 },
      { maxKg: 5, price: 31.9 },
      { maxKg: Infinity, price: 39.9 },
    ],
    relay: [
      { maxKg: 0.5, price: 11.9 },
      { maxKg: 1, price: 14.9 },
      { maxKg: 2, price: 18.9 },
      { maxKg: 3, price: 22.9 },
      { maxKg: 5, price: 28.9 },
      { maxKg: Infinity, price: 35.9 },
    ],
  },
  INTERNATIONAL: {
    home: [
      { maxKg: 0.5, price: 24.9 },
      { maxKg: 1, price: 29.9 },
      { maxKg: 2, price: 36.9 },
      { maxKg: 3, price: 44.9 },
      { maxKg: 5, price: 56.9 },
      { maxKg: Infinity, price: 69.9 },
    ],
    relay: [
      { maxKg: 0.5, price: 20.9 },
      { maxKg: 1, price: 25.9 },
      { maxKg: 2, price: 31.9 },
      { maxKg: 3, price: 38.9 },
      { maxKg: 5, price: 48.9 },
      { maxKg: Infinity, price: 59.9 },
    ],
  },
};

// Filet de sécurité si la résolution zone/palier échoue (ne devrait jamais arriver
// avec le fallback de resolveZone, mais évite de bloquer une commande le cas échéant).
export const FALLBACK_SHIPPING_FEE = 10;
