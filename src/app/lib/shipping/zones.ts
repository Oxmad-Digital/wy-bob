// Zones de tarification transporteur — un transporteur (Chronopost) ne facture pas
// à la distance en km mais par palier de poids × zone géographique. Ce fichier est la
// seule chose à éditer pour aligner les tarifs facturés au client sur le coût réel.

export type ShippingZone = "FR" | "EU_PROCHE" | "EUROPE_LARGE" | "INTERNATIONAL";
export type ShippingMode = "home" | "relay";

// Mapping pays ISO2 → zone. COUNTRY_OPTIONS (CheckoutForm.tsx) est volontairement restreint
// à l'Europe (UE + hors UE géographique) pour éviter de proposer des destinations dont la
// desserte Chronopost réelle n'est pas confirmée — cette table couvre exactement les mêmes
// pays, à tenir synchronisée avec CheckoutForm.tsx si la liste évolue. Le palier
// "INTERNATIONAL" reste défini comme filet de sécurité pur (ex: ancienne adresse enregistrée
// hors Europe avant ce changement), mais n'est plus atteignable depuis le sélecteur du site.
export const ZONE_BY_COUNTRY: Record<string, ShippingZone> = {
  FR: "FR",

  // Union européenne
  AT: "EU_PROCHE",
  BE: "EU_PROCHE",
  BG: "EU_PROCHE",
  HR: "EU_PROCHE",
  CY: "EU_PROCHE",
  CZ: "EU_PROCHE",
  DK: "EU_PROCHE",
  EE: "EU_PROCHE",
  FI: "EU_PROCHE",
  DE: "EU_PROCHE",
  GR: "EU_PROCHE",
  HU: "EU_PROCHE",
  IE: "EU_PROCHE",
  IT: "EU_PROCHE",
  LV: "EU_PROCHE",
  LT: "EU_PROCHE",
  LU: "EU_PROCHE",
  MT: "EU_PROCHE",
  NL: "EU_PROCHE",
  PL: "EU_PROCHE",
  PT: "EU_PROCHE",
  RO: "EU_PROCHE",
  SK: "EU_PROCHE",
  SI: "EU_PROCHE",
  ES: "EU_PROCHE",
  SE: "EU_PROCHE",

  // Reste de l'Europe géographique (hors UE)
  AD: "EUROPE_LARGE",
  AL: "EUROPE_LARGE",
  BA: "EUROPE_LARGE",
  CH: "EUROPE_LARGE",
  GB: "EUROPE_LARGE",
  IS: "EUROPE_LARGE",
  LI: "EUROPE_LARGE",
  MK: "EUROPE_LARGE",
  MC: "EUROPE_LARGE",
  ME: "EUROPE_LARGE",
  NO: "EUROPE_LARGE",
  SM: "EUROPE_LARGE",
  RS: "EUROPE_LARGE",
  UA: "EUROPE_LARGE",
  VA: "EUROPE_LARGE",
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

export interface DeliveryEstimate {
  carrier: string; // nom du produit Chronopost réellement utilisé (voir chronopost/constants.ts)
  delay: { fr: string; en: string };
}

// Délais Chronopost par zone/mode. Le délai France (Chrono 13 / Chrono Relais 13 : J+1
// avant 13h) est une caractéristique publique du produit, fiable telle quelle. Les délais
// international (Chrono Classic / Chronorelais Europe) varient selon la destination exacte
// et le niveau de service du contrat — TODO(chronopost-contrat-17895404): à confirmer/affiner
// avec les délais réels annoncés par Chronopost pour ces zones avant mise en production.
export const DELIVERY_ESTIMATES: Record<ShippingZone, Record<ShippingMode, DeliveryEstimate>> = {
  FR: {
    home: { carrier: "Chronopost Chrono 13", delay: { fr: "livraison en 24h (J+1 avant 13h)", en: "delivery within 24h (next day by 1pm)" } },
    relay: { carrier: "Chronopost Relais 13", delay: { fr: "retrait en point relais sous 24 à 48h", en: "pickup at relay point within 24 to 48h" } },
  },
  EU_PROCHE: {
    home: { carrier: "Chronopost Classic", delay: { fr: "livraison en 2 à 4 jours ouvrés", en: "delivery in 2 to 4 business days" } },
    relay: { carrier: "Chronorelais Europe", delay: { fr: "retrait en point relais en 2 à 4 jours ouvrés", en: "pickup at relay point in 2 to 4 business days" } },
  },
  EUROPE_LARGE: {
    home: { carrier: "Chronopost Classic", delay: { fr: "livraison en 3 à 6 jours ouvrés", en: "delivery in 3 to 6 business days" } },
    relay: { carrier: "Chronorelais Europe", delay: { fr: "retrait en point relais en 3 à 6 jours ouvrés", en: "pickup at relay point in 3 to 6 business days" } },
  },
  INTERNATIONAL: {
    home: { carrier: "Chronopost Classic", delay: { fr: "livraison en 5 à 10 jours ouvrés", en: "delivery in 5 to 10 business days" } },
    relay: { carrier: "Chronorelais Europe", delay: { fr: "retrait en point relais en 5 à 10 jours ouvrés", en: "pickup at relay point in 5 to 10 business days" } },
  },
};
