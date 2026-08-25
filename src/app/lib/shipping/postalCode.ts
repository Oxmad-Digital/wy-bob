// Formats de code postal par pays ISO2 — sert à bloquer côté formulaire les codes postaux
// syntaxiquement incohérents avec le pays sélectionné (ex: code français saisi avec pays
// Allemagne), avant même l'appel à l'API de livraison. Ne couvre volontairement que
// l'Europe (COUNTRY_OPTIONS dans shipping/countries.ts liste ~230 pays depuis l'ouverture
// à l'international Chrono Express — isValidPostalCode retombe sur "pas de blocage" pour
// tout pays absent d'ici, cf. plus bas).
//
// Ce contrôle ne vérifie que le FORMAT (nombre de chiffres/lettres, ponctuation) : il ne
// garantit pas que le code postal existe réellement pour ce pays (ex: "33000" est un format
// valide en Allemagne comme en France, même si "33000" n'est pas forcément desservi).
export const POSTAL_CODE_PATTERNS: Record<string, RegExp> = {
  AL: /^\d{4}$/,
  DE: /^\d{5}$/,
  AD: /^AD\d{3}$/i,
  AT: /^\d{4}$/,
  BE: /^\d{4}$/,
  BA: /^\d{5}$/,
  BG: /^\d{4}$/,
  CY: /^\d{4}$/,
  HR: /^\d{5}$/,
  DK: /^\d{4}$/,
  ES: /^\d{5}$/,
  EE: /^\d{5}$/,
  FI: /^\d{5}$/,
  FR: /^\d{5}$/,
  GR: /^\d{3}\s?\d{2}$/,
  HU: /^\d{4}$/,
  IE: /^[A-Za-z]\d{2}\s?[A-Za-z0-9]{4}$/,
  IS: /^\d{3}$/,
  IT: /^\d{5}$/,
  LV: /^(LV-)?\d{4}$/i,
  LI: /^\d{4}$/,
  LT: /^(LT-)?\d{5}$/i,
  LU: /^\d{4}$/,
  MK: /^\d{4}$/,
  MT: /^[A-Za-z]{3}\s?\d{4}$/,
  MC: /^980\d{2}$/,
  ME: /^\d{5}$/,
  NO: /^\d{4}$/,
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  PL: /^\d{2}-\d{3}$/,
  PT: /^\d{4}-\d{3}$/,
  CZ: /^\d{3}\s?\d{2}$/,
  RO: /^\d{6}$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  SM: /^4789\d$/,
  RS: /^\d{5,6}$/,
  SK: /^\d{3}\s?\d{2}$/,
  SI: /^\d{4}$/,
  SE: /^\d{3}\s?\d{2}$/,
  CH: /^\d{4}$/,
  UA: /^\d{5}$/,
  VA: /^00120$/,
};

export function isValidPostalCode(country: string, postalCode: string): boolean {
  const pattern = POSTAL_CODE_PATTERNS[(country || "").toUpperCase()];
  if (!pattern) return true; // pays non couvert : pas de blocage
  return pattern.test((postalCode || "").trim());
}
