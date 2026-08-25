// Assurance colis optionnelle Chronopost — cf. grille tarifaire "Shopper Max+" (Options) :
// "0,9 % de la valeur assurée avec un minimum de facturation de 5 € HT/colis". La
// responsabilité contractuelle Chronopost (250 €/colis) est incluse gratuitement sur TOUS
// les envois sans démarche du client — cette option ne fait qu'étendre la couverture
// jusqu'à la valeur déclarée en cas de perte ou d'avarie.
//
// Plafond fixé à 5 000 € : c'est le chiffre communiqué par Chronopost dans l'offre initiale
// (mail du contact commercial), à préférer aux 20 000 € HT indiqués sur la grille tarifaire
// générique du contrat tant que ce plafond n'est pas confirmé par écrit pour ce compte.

export const FREE_COVERAGE_EUR = 250;
export const MAX_INSURED_VALUE_EUR = 5000;
const INSURANCE_RATE = 0.009; // 0,9 %
const MIN_INSURANCE_FEE_EUR = 5;

// Valeur réellement assurable pour une commande donnée (plafonnée au maximum du contrat).
export function computeInsurableValue(cartValue: number): number {
  return Math.min(Math.max(cartValue, 0), MAX_INSURED_VALUE_EUR);
}

export function computeInsuranceFee(cartValue: number): number {
  const insured = computeInsurableValue(cartValue);
  if (insured <= 0) return 0;
  return Math.round(Math.max(MIN_INSURANCE_FEE_EUR, insured * INSURANCE_RATE) * 100) / 100;
}
