// Zones de tarification transporteur — Chronopost (offre Shopper Max+, contrat 17895404)
// ne facture pas à la distance en km mais par palier de poids (1 à 30 kg, arrondi au kg
// supérieur) x zone géographique DU PRODUIT utilisé. Deux familles de produits Chronopost
// coexistent :
//  - "classic": Chrono Classic (domicile) + Chronorelais Europe (point relais), réservés à
//    l'Union européenne + quelques pays limitrophes (Suisse, Norvège, Royaume-Uni...) — zones 1 à 4.
//  - "express": Chrono Express, le seul produit qui dessert le reste du monde (~200 pays
//    supplémentaires) — zones 1 à 9, livraison à domicile uniquement (pas de point relais).
// Généré à partir de la grille tarifaire "Shopper Max+" et du zoning international fournis
// par Chronopost (wybob-documents/, contrat 17895404). Tarifs HT, au 01/11/2024, incluant la
// surcharge carburant du mois (21,75 % standard / 41,75 % Express), la sûreté colis (0,82 €)
// et l'éco-participation (0,18 €) déjà intégrées au prix affiché — ces montants évoluent
// mensuellement chez Chronopost et ne sont pas recalculés en temps réel ici : à rafraîchir
// manuellement (nouvelle grille tarifaire Chronopost) plutôt qu'à chaque changement de mois.

export type ShippingMode = "home" | "relay";
export type ShippingProduct = "national" | "classic" | "express";

export interface CountryShipping {
  product: ShippingProduct; // produit Chronopost utilisé pour une livraison à domicile
  zone: number; // zone tarifaire de ce produit (0 = France)
  delayDays: number; // délai Chronopost indicatif, en jours ouvrés
  relay: { zone: number } | null; // point relais dispo pour ce pays (Chrono Relais 13 en France, Chronorelais Europe pour les pays "classic"), zone tarifaire associée
}

// Mapping pays ISO2 → produit/zone Chronopost. Doit rester synchronisé avec COUNTRY_OPTIONS
// dans shipping/countries.ts (mêmes pays, y compris les exclusions par précaution — voir
// commentaire en tête de ce fichier-là) et avec POSTAL_CODE_PATTERNS dans
// shipping/postalCode.ts (sous-ensemble : seuls les pays y ayant un format connu).
export const COUNTRY_SHIPPING: Record<string, CountryShipping> = {
  FR: { product: "national", zone: 0, delayDays: 1, relay: { zone: 0 } },
  ZA: { product: "express", zone: 6, delayDays: 2, relay: null },
  AL: { product: "express", zone: 4, delayDays: 2, relay: null },
  DZ: { product: "express", zone: 6, delayDays: 2, relay: null },
  DE: { product: "classic", zone: 1, delayDays: 2, relay: { zone: 1 } },
  AD: { product: "express", zone: 4, delayDays: 1, relay: null },
  AO: { product: "express", zone: 6, delayDays: 7, relay: null },
  AI: { product: "express", zone: 5, delayDays: 3, relay: null },
  AG: { product: "express", zone: 5, delayDays: 3, relay: null },
  AN: { product: "express", zone: 5, delayDays: 3, relay: null },
  SA: { product: "express", zone: 6, delayDays: 4, relay: null },
  AR: { product: "express", zone: 5, delayDays: 2, relay: null },
  AM: { product: "express", zone: 4, delayDays: 2, relay: null },
  AW: { product: "express", zone: 5, delayDays: 3, relay: null },
  AU: { product: "express", zone: 7, delayDays: 3, relay: null },
  AT: { product: "classic", zone: 2, delayDays: 3, relay: { zone: 2 } },
  AZ: { product: "express", zone: 6, delayDays: 2, relay: null },
  BS: { product: "express", zone: 5, delayDays: 2, relay: null },
  BH: { product: "express", zone: 6, delayDays: 2, relay: null },
  BD: { product: "express", zone: 7, delayDays: 3, relay: null },
  BB: { product: "express", zone: 5, delayDays: 3, relay: null },
  BE: { product: "classic", zone: 1, delayDays: 2, relay: { zone: 1 } },
  BZ: { product: "express", zone: 5, delayDays: 2, relay: null },
  BM: { product: "express", zone: 5, delayDays: 3, relay: null },
  BT: { product: "express", zone: 7, delayDays: 5, relay: null },
  BO: { product: "express", zone: 5, delayDays: 4, relay: null },
  BA: { product: "express", zone: 4, delayDays: 2, relay: null },
  BW: { product: "express", zone: 6, delayDays: 3, relay: null },
  BN: { product: "express", zone: 7, delayDays: 3, relay: null },
  BR: { product: "express", zone: 5, delayDays: 2, relay: null },
  BG: { product: "classic", zone: 3, delayDays: 4, relay: { zone: 3 } },
  BF: { product: "express", zone: 6, delayDays: 2, relay: null },
  BI: { product: "express", zone: 6, delayDays: 5, relay: null },
  BJ: { product: "express", zone: 6, delayDays: 4, relay: null },
  KH: { product: "express", zone: 7, delayDays: 3, relay: null },
  CM: { product: "express", zone: 6, delayDays: 3, relay: null },
  CA: { product: "express", zone: 5, delayDays: 2, relay: null },
  CV: { product: "express", zone: 6, delayDays: 4, relay: null },
  CL: { product: "express", zone: 5, delayDays: 2, relay: null },
  CN: { product: "express", zone: 7, delayDays: 3, relay: null },
  CY: { product: "express", zone: 3, delayDays: 3, relay: null },
  CO: { product: "express", zone: 5, delayDays: 2, relay: null },
  KM: { product: "express", zone: 6, delayDays: 4, relay: null },
  CG: { product: "express", zone: 6, delayDays: 3, relay: null },
  KR: { product: "express", zone: 7, delayDays: 2, relay: null },
  CR: { product: "express", zone: 5, delayDays: 3, relay: null },
  HR: { product: "classic", zone: 3, delayDays: 4, relay: { zone: 3 } },
  CU: { product: "express", zone: 5, delayDays: 4, relay: null },
  CI: { product: "express", zone: 6, delayDays: 2, relay: null },
  DK: { product: "classic", zone: 2, delayDays: 3, relay: { zone: 2 } },
  DJ: { product: "express", zone: 6, delayDays: 3, relay: null },
  DM: { product: "express", zone: 5, delayDays: 3, relay: null },
  EG: { product: "express", zone: 6, delayDays: 2, relay: null },
  SV: { product: "express", zone: 5, delayDays: 3, relay: null },
  EC: { product: "express", zone: 5, delayDays: 3, relay: null },
  ER: { product: "express", zone: 6, delayDays: 5, relay: null },
  ES: { product: "classic", zone: 2, delayDays: 2, relay: { zone: 2 } },
  EE: { product: "classic", zone: 3, delayDays: 4, relay: { zone: 3 } },
  ET: { product: "express", zone: 6, delayDays: 5, relay: null },
  FJ: { product: "express", zone: 7, delayDays: 4, relay: null },
  FI: { product: "classic", zone: 2, delayDays: 4, relay: { zone: 2 } },
  GA: { product: "express", zone: 6, delayDays: 3, relay: null },
  GM: { product: "express", zone: 6, delayDays: 4, relay: null },
  GE: { product: "express", zone: 4, delayDays: 3, relay: null },
  GH: { product: "express", zone: 6, delayDays: 3, relay: null },
  GI: { product: "express", zone: 4, delayDays: 2, relay: null },
  GD: { product: "express", zone: 5, delayDays: 3, relay: null },
  GL: { product: "express", zone: 5, delayDays: 5, relay: null },
  GR: { product: "classic", zone: 2, delayDays: 6, relay: { zone: 2 } },
  GP: { product: "express", zone: 8, delayDays: 2, relay: null },
  GU: { product: "express", zone: 7, delayDays: 4, relay: null },
  GT: { product: "express", zone: 5, delayDays: 3, relay: null },
  GS: { product: "express", zone: 4, delayDays: 2, relay: null },
  GN: { product: "express", zone: 6, delayDays: 3, relay: null },
  GQ: { product: "express", zone: 6, delayDays: 4, relay: null },
  GW: { product: "express", zone: 6, delayDays: 6, relay: null },
  GY: { product: "express", zone: 5, delayDays: 3, relay: null },
  GF: { product: "express", zone: 9, delayDays: 2, relay: null },
  HN: { product: "express", zone: 5, delayDays: 3, relay: null },
  HK: { product: "express", zone: 7, delayDays: 2, relay: null },
  HU: { product: "classic", zone: 3, delayDays: 3, relay: { zone: 3 } },
  IN: { product: "express", zone: 7, delayDays: 2, relay: null },
  ID: { product: "express", zone: 7, delayDays: 2, relay: null },
  IQ: { product: "express", zone: 6, delayDays: 5, relay: null },
  IE: { product: "classic", zone: 2, delayDays: 3, relay: { zone: 2 } },
  IS: { product: "express", zone: 4, delayDays: 1, relay: null },
  IL: { product: "express", zone: 6, delayDays: 2, relay: null },
  IT: { product: "classic", zone: 2, delayDays: 2, relay: { zone: 2 } },
  JM: { product: "express", zone: 5, delayDays: 2, relay: null },
  JP: { product: "express", zone: 7, delayDays: 3, relay: null },
  JE: { product: "express", zone: 4, delayDays: 3, relay: null },
  JO: { product: "express", zone: 6, delayDays: 2, relay: null },
  KZ: { product: "express", zone: 7, delayDays: 2, relay: null },
  KE: { product: "express", zone: 6, delayDays: 3, relay: null },
  KG: { product: "express", zone: 7, delayDays: 4, relay: null },
  KW: { product: "express", zone: 6, delayDays: 3, relay: null },
  LA: { product: "express", zone: 7, delayDays: 4, relay: null },
  LS: { product: "express", zone: 6, delayDays: 3, relay: null },
  LV: { product: "classic", zone: 3, delayDays: 4, relay: { zone: 3 } },
  LB: { product: "express", zone: 6, delayDays: 2, relay: null },
  LR: { product: "express", zone: 6, delayDays: 4, relay: null },
  LI: { product: "classic", zone: 4, delayDays: 2, relay: { zone: 4 } },
  LT: { product: "classic", zone: 3, delayDays: 4, relay: { zone: 3 } },
  LU: { product: "classic", zone: 1, delayDays: 2, relay: { zone: 1 } },
  MO: { product: "express", zone: 7, delayDays: 3, relay: null },
  MK: { product: "express", zone: 4, delayDays: 2, relay: null },
  MG: { product: "express", zone: 6, delayDays: 3, relay: null },
  MY: { product: "express", zone: 7, delayDays: 2, relay: null },
  MW: { product: "express", zone: 6, delayDays: 4, relay: null },
  MV: { product: "express", zone: 7, delayDays: 4, relay: null },
  ML: { product: "express", zone: 6, delayDays: 3, relay: null },
  MT: { product: "express", zone: 3, delayDays: 2, relay: null },
  MA: { product: "express", zone: 6, delayDays: 1, relay: null },
  MQ: { product: "express", zone: 8, delayDays: 2, relay: null },
  MR: { product: "express", zone: 6, delayDays: 3, relay: null },
  YT: { product: "express", zone: 9, delayDays: 3, relay: null },
  MX: { product: "express", zone: 5, delayDays: 2, relay: null },
  FM: { product: "express", zone: 7, delayDays: 5, relay: null },
  MD: { product: "express", zone: 4, delayDays: 2, relay: null },
  MN: { product: "express", zone: 7, delayDays: 5, relay: null },
  MS: { product: "express", zone: 5, delayDays: 3, relay: null },
  ME: { product: "express", zone: 4, delayDays: 4, relay: null },
  MZ: { product: "express", zone: 6, delayDays: 4, relay: null },
  MM: { product: "express", zone: 7, delayDays: 3, relay: null },
  NA: { product: "express", zone: 6, delayDays: 3, relay: null },
  NI: { product: "express", zone: 5, delayDays: 3, relay: null },
  NE: { product: "express", zone: 6, delayDays: 3, relay: null },
  NG: { product: "express", zone: 6, delayDays: 2, relay: null },
  NO: { product: "classic", zone: 4, delayDays: 5, relay: { zone: 4 } },
  NC: { product: "express", zone: 9, delayDays: 3, relay: null },
  NZ: { product: "express", zone: 7, delayDays: 4, relay: null },
  NP: { product: "express", zone: 7, delayDays: 4, relay: null },
  OM: { product: "express", zone: 6, delayDays: 2, relay: null },
  UG: { product: "express", zone: 6, delayDays: 3, relay: null },
  UZ: { product: "express", zone: 7, delayDays: 3, relay: null },
  PK: { product: "express", zone: 7, delayDays: 3, relay: null },
  PW: { product: "express", zone: 7, delayDays: 6, relay: null },
  PS: { product: "express", zone: 6, delayDays: 5, relay: null },
  PA: { product: "express", zone: 5, delayDays: 2, relay: null },
  PG: { product: "express", zone: 7, delayDays: 5, relay: null },
  PY: { product: "express", zone: 5, delayDays: 3, relay: null },
  NL: { product: "classic", zone: 1, delayDays: 2, relay: { zone: 1 } },
  PH: { product: "express", zone: 7, delayDays: 2, relay: null },
  PL: { product: "classic", zone: 3, delayDays: 3, relay: { zone: 3 } },
  PF: { product: "express", zone: 9, delayDays: 2, relay: null },
  PR: { product: "express", zone: 5, delayDays: 2, relay: null },
  PT: { product: "classic", zone: 2, delayDays: 2, relay: { zone: 2 } },
  PE: { product: "express", zone: 5, delayDays: 3, relay: null },
  QA: { product: "express", zone: 6, delayDays: 2, relay: null },
  RO: { product: "classic", zone: 3, delayDays: 4, relay: { zone: 3 } },
  GB: { product: "classic", zone: 2, delayDays: 2, relay: { zone: 2 } },
  RW: { product: "express", zone: 6, delayDays: 3, relay: null },
  DO: { product: "express", zone: 5, delayDays: 4, relay: null },
  CZ: { product: "classic", zone: 3, delayDays: 3, relay: { zone: 3 } },
  CD: { product: "express", zone: 6, delayDays: 4, relay: null },
  RE: { product: "express", zone: 8, delayDays: 2, relay: null },
  BL: { product: "express", zone: 8, delayDays: 3, relay: null },
  KN: { product: "express", zone: 5, delayDays: 3, relay: null },
  MI: { product: "express", zone: 8, delayDays: 2, relay: null },
  MF: { product: "express", zone: 8, delayDays: 2, relay: null },
  PM: { product: "express", zone: 9, delayDays: 4, relay: null },
  VC: { product: "express", zone: 5, delayDays: 3, relay: null },
  LC: { product: "express", zone: 5, delayDays: 3, relay: null },
  WS: { product: "express", zone: 7, delayDays: 5, relay: null },
  AS: { product: "express", zone: 7, delayDays: 5, relay: null },
  SM: { product: "express", zone: 4, delayDays: 1, relay: null },
  ST: { product: "express", zone: 6, delayDays: 4, relay: null },
  RS: { product: "express", zone: 4, delayDays: 2, relay: null },
  SC: { product: "express", zone: 6, delayDays: 4, relay: null },
  SL: { product: "express", zone: 6, delayDays: 4, relay: null },
  SG: { product: "express", zone: 7, delayDays: 2, relay: null },
  SK: { product: "classic", zone: 3, delayDays: 3, relay: { zone: 3 } },
  SI: { product: "classic", zone: 3, delayDays: 3, relay: { zone: 3 } },
  LK: { product: "express", zone: 7, delayDays: 3, relay: null },
  CH: { product: "classic", zone: 4, delayDays: 2, relay: { zone: 4 } },
  SR: { product: "express", zone: 5, delayDays: 3, relay: null },
  SE: { product: "classic", zone: 2, delayDays: 3, relay: { zone: 2 } },
  SZ: { product: "express", zone: 6, delayDays: 4, relay: null },
  SN: { product: "express", zone: 6, delayDays: 3, relay: null },
  TJ: { product: "express", zone: 7, delayDays: 3, relay: null },
  TZ: { product: "express", zone: 6, delayDays: 4, relay: null },
  TW: { product: "express", zone: 7, delayDays: 3, relay: null },
  TD: { product: "express", zone: 6, delayDays: 3, relay: null },
  TH: { product: "express", zone: 7, delayDays: 3, relay: null },
  TL: { product: "express", zone: 7, delayDays: 5, relay: null },
  TG: { product: "express", zone: 6, delayDays: 3, relay: null },
  TO: { product: "express", zone: 7, delayDays: 4, relay: null },
  TT: { product: "express", zone: 5, delayDays: 3, relay: null },
  TN: { product: "express", zone: 6, delayDays: 2, relay: null },
  TR: { product: "express", zone: 4, delayDays: 2, relay: null },
  UY: { product: "express", zone: 5, delayDays: 3, relay: null },
  VU: { product: "express", zone: 7, delayDays: 5, relay: null },
  VA: { product: "express", zone: 4, delayDays: 1, relay: null },
  VE: { product: "express", zone: 5, delayDays: 3, relay: null },
  VN: { product: "express", zone: 7, delayDays: 3, relay: null },
  WF: { product: "express", zone: 9, delayDays: 5, relay: null },
  ZM: { product: "express", zone: 6, delayDays: 4, relay: null },
  ZW: { product: "express", zone: 6, delayDays: 3, relay: null },
  AE: { product: "express", zone: 6, delayDays: 2, relay: null },
  US: { product: "express", zone: 5, delayDays: 1, relay: null },
  CX: { product: "express", zone: 7, delayDays: 4, relay: null },
  MU: { product: "express", zone: 6, delayDays: 3, relay: null },
  NF: { product: "express", zone: 7, delayDays: 4, relay: null },
  IC: { product: "express", zone: 4, delayDays: 2, relay: null },
  KY: { product: "express", zone: 5, delayDays: 2, relay: null },
  CC: { product: "express", zone: 7, delayDays: 4, relay: null },
  CK: { product: "express", zone: 7, delayDays: 5, relay: null },
  FO: { product: "express", zone: 4, delayDays: 4, relay: null },
  MP: { product: "express", zone: 9, delayDays: 5, relay: null },
  MH: { product: "express", zone: 7, delayDays: 4, relay: null },
  SB: { product: "express", zone: 7, delayDays: 7, relay: null },
  TC: { product: "express", zone: 5, delayDays: 3, relay: null },
  VI: { product: "express", zone: 5, delayDays: 3, relay: null },
  VG: { product: "express", zone: 5, delayDays: 3, relay: null },
};

// Filet de sécurité si le pays n'est pas dans COUNTRY_SHIPPING (ne devrait pas arriver : le
// checkout ne propose que les pays de COUNTRY_OPTIONS, qui couvre exactement les mêmes clés).
const FALLBACK_COUNTRY_SHIPPING: CountryShipping = { product: "express", zone: 9, delayDays: 10, relay: null };

export function resolveCountryShipping(country: string): CountryShipping {
  return COUNTRY_SHIPPING[(country || "").toUpperCase()] ?? FALLBACK_COUNTRY_SHIPPING;
}

// Un pays a un point relais Chronopost si COUNTRY_SHIPPING[...].relay n'est pas null —
// sert à masquer l'option "point relais" au checkout pour les ~200 pays desservis uniquement
// en Chrono Express (livraison à domicile).
export function isRelayEligible(country: string): boolean {
  return resolveCountryShipping(country).relay !== null;
}

// --- Grilles tarifaires (prix HT tout compris, en €, par kg entier de 1 à 30) ---

// France — Chrono 13 (domicile) / Chrono Relais 13 (point relais, limité à 20 kg : au-delà,
// computeShippingFee retombe sur le tarif domicile).
export const NATIONAL_RATES = {
  home: [null, 10.9, 11.34, 11.77, 12.21, 12.65, 13.09, 13.53, 13.97, 14.4, 14.84, 15.43, 16.01, 16.6, 17.18, 17.76, 18.35, 18.93, 19.52, 20.1, 20.69, 21.28, 21.88, 22.48, 23.07, 23.67, 24.27, 24.86, 25.46, 26.06, 26.65],
  relay: [null, 7.49, 7.87, 8.24, 8.62, 9.0, 9.38, 9.75, 10.13, 10.51, 10.89, 11.42, 11.96, 12.49, 13.03, 13.56, 14.1, 14.64, 15.17, 15.71, 16.24, null, null, null, null, null, null, null, null, null, null],
};

// Chrono Classic (domicile), zones 1 à 4 — pays "classic" uniquement.
export const CLASSIC_RATES: Record<number, (number | null)[]> = {
  1: [null, 10.76, 12.36, 13.95, 15.55, 17.14, 18.74, 20.33, 21.93, 23.52, 25.12, 26.71, 28.31, 29.9, 31.5, 33.09, 34.69, 36.28, 37.88, 39.47, 41.07, 42.66, 44.26, 45.85, 47.45, 49.04, 50.64, 52.23, 53.83, 55.42, 57.02],
  2: [null, 11.3, 13.14, 14.98, 16.82, 18.65, 20.49, 22.33, 24.17, 26.01, 27.85, 29.68, 31.52, 33.36, 35.2, 37.04, 38.88, 40.71, 42.55, 44.39, 46.23, 48.07, 49.91, 51.75, 53.58, 55.42, 57.26, 59.1, 60.94, 62.78, 64.61],
  3: [null, 13.59, 15.65, 17.7, 19.76, 21.82, 23.88, 25.93, 27.99, 30.05, 32.11, 34.16, 36.22, 38.28, 40.34, 42.4, 44.45, 46.51, 48.57, 50.63, 52.68, 54.74, 56.8, 58.86, 60.91, 62.97, 65.03, 67.09, 69.14, 71.2, 73.26],
  4: [null, 12.37, 14.36, 16.34, 18.33, 20.31, 22.29, 24.28, 26.26, 28.25, 30.23, 32.22, 34.2, 36.19, 38.17, 40.15, 42.14, 44.12, 46.11, 48.09, 50.08, 52.06, 54.05, 56.03, 58.02, 60.0, 61.98, 63.97, 65.95, 67.94, 69.92],
};

// Chronorelais Europe (point relais), zones 1 à 4 — mêmes zones que Chrono Classic,
// limité à 20 kg (au-delà, computeShippingFee retombe sur le tarif Chrono Classic domicile).
export const RELAIS_EUROPE_RATES: Record<number, (number | null)[]> = {
  1: [null, 10.01, 11.54, 13.08, 14.61, 16.15, 17.74, 19.34, 20.93, 22.53, 24.12, 25.72, 27.31, 28.91, 30.5, 32.09, 33.69, 35.28, 36.88, 38.47, 40.07, null, null, null, null, null, null, null, null, null, null],
  2: [null, 10.53, 12.29, 14.04, 15.79, 17.55, 19.38, 21.22, 23.06, 24.9, 26.74, 28.58, 30.41, 32.25, 34.09, 35.93, 37.77, 39.61, 41.45, 43.28, 45.12, null, null, null, null, null, null, null, null, null, null],
  3: [null, 12.82, 14.81, 16.79, 18.78, 20.76, 22.82, 24.88, 26.93, 28.99, 31.05, 33.11, 35.16, 37.22, 39.28, 41.34, 43.39, 45.45, 47.51, 49.57, 51.62, null, null, null, null, null, null, null, null, null, null],
  4: [null, 11.6, 13.5, 15.4, 17.3, 19.2, 21.19, 23.17, 25.16, 27.14, 29.12, 31.11, 33.09, 35.08, 37.06, 39.05, 41.03, 43.02, 45.0, 46.98, 48.97, null, null, null, null, null, null, null, null, null, null],
};

// Chrono Express (domicile uniquement), zones 1 à 9 — tous les pays hors Union
// européenne/Europe proche.
export const EXPRESS_RATES: Record<number, (number | null)[]> = {
  1: [null, 15.88, 19.85, 23.25, 26.66, 30.06, 33.74, 37.43, 41.12, 44.8, 48.49, 52.17, 55.86, 59.54, 63.23, 66.91, 70.6, 74.28, 77.97, 81.66, 85.34, 89.03, 92.71, 96.4, 100.08, 103.77, 107.45, 111.14, 114.83, 118.51, 122.2],
  2: [null, 19.85, 25.38, 30.2, 35.02, 39.84, 44.94, 50.05, 55.15, 60.25, 65.35, 70.74, 76.13, 81.51, 86.9, 92.29, 97.67, 103.06, 108.45, 113.83, 119.22, 126.59, 133.96, 141.33, 148.7, 156.07, 163.45, 170.82, 178.19, 185.56, 192.93],
  3: [null, 23.25, 30.63, 37.15, 43.67, 50.19, 56.99, 63.8, 70.6, 77.4, 84.21, 92.43, 100.65, 108.87, 117.09, 125.31, 133.54, 141.76, 149.98, 158.2, 166.42, 174.64, 182.87, 191.09, 199.31, 207.53, 215.75, 223.97, 232.19, 240.42, 248.64],
  4: [null, 33.6, 41.68, 49.05, 56.42, 63.8, 71.45, 79.1, 86.76, 94.41, 102.07, 111.71, 121.35, 130.98, 140.62, 150.26, 159.9, 169.54, 179.18, 188.82, 198.46, 208.38, 218.3, 228.23, 238.15, 248.07, 257.99, 267.92, 277.84, 287.76, 297.68],
  5: [null, 41.12, 50.61, 59.12, 67.62, 76.13, 84.92, 93.7, 102.49, 111.28, 120.07, 130.84, 141.62, 152.39, 163.16, 173.94, 184.71, 195.48, 206.25, 217.03, 227.8, 239.14, 250.48, 261.82, 273.16, 284.5, 295.84, 307.18, 318.52, 329.86, 341.2],
  6: [null, 44.52, 55.29, 65.5, 75.7, 85.91, 96.11, 106.32, 116.53, 126.73, 136.94, 148.28, 159.62, 170.96, 182.3, 193.64, 204.98, 216.32, 227.66, 239.0, 250.34, 263.1, 275.85, 288.61, 301.37, 314.13, 326.88, 339.64, 352.4, 365.16, 377.91],
  7: [null, 43.81, 54.44, 64.65, 74.85, 85.06, 95.26, 105.47, 115.68, 125.88, 136.09, 147.43, 158.77, 170.11, 181.45, 192.79, 204.13, 215.47, 226.81, 238.15, 249.49, 262.81, 276.14, 289.46, 302.79, 316.11, 329.43, 342.76, 356.08, 369.41, 382.73],
  8: [null, 33.18, 39.41, 45.93, 52.46, 58.98, 65.5, 72.02, 78.54, 85.06, 91.58, 98.38, 105.19, 111.99, 118.79, 125.6, 132.4, 139.21, 146.01, 152.81, 159.62, 166.71, 173.79, 180.88, 187.97, 195.06, 202.14, 209.23, 216.32, 223.41, 230.49],
  9: [null, 60.82, 74.43, 86.9, 99.37, 111.85, 123.76, 135.66, 147.57, 159.48, 171.38, 184.42, 197.47, 210.51, 223.55, 236.59, 249.63, 262.67, 275.71, 288.75, 301.79, 316.25, 330.71, 345.17, 359.63, 374.09, 388.54, 403.0, 417.46, 431.92, 446.38],
};

// Filet de sécurité si la résolution produit/zone/palier échoue malgré tout (ne devrait
// jamais arriver avec les fallbacks ci-dessus, mais évite de bloquer une commande).
export const FALLBACK_SHIPPING_FEE = 10;
