// Liste des pays livrables (ISO2 + libellé FR) — partagée entre le sélecteur pays du
// checkout (CheckoutForm.tsx) et le formulaire de correction d'adresse de l'admin
// (admin/orders/[id]/page.jsx), pour n'avoir qu'un seul endroit à maintenir.
//
// Volontairement restreint à l'Europe (UE + hors UE géographiquement européen comme la
// Suisse ou le Royaume-Uni) : sans confirmation de la couverture réelle du contrat
// Chronopost à l'international, mieux vaut éviter les destinations lointaines qui
// risqueraient de ne pas être livrables. Cette liste doit rester synchronisée avec
// ZONE_BY_COUNTRY dans shipping/zones.ts et POSTAL_CODE_PATTERNS dans shipping/postalCode.ts
// (mêmes pays).
export const COUNTRY_OPTIONS = [
  { code: "AL", label: "Albanie" },
  { code: "DE", label: "Allemagne" },
  { code: "AD", label: "Andorre" },
  { code: "AT", label: "Autriche" },
  { code: "BE", label: "Belgique" },
  { code: "BA", label: "Bosnie-Herzégovine" },
  { code: "BG", label: "Bulgarie" },
  { code: "CY", label: "Chypre" },
  { code: "HR", label: "Croatie" },
  { code: "DK", label: "Danemark" },
  { code: "ES", label: "Espagne" },
  { code: "EE", label: "Estonie" },
  { code: "FI", label: "Finlande" },
  { code: "FR", label: "France" },
  { code: "GR", label: "Grèce" },
  { code: "HU", label: "Hongrie" },
  { code: "IE", label: "Irlande" },
  { code: "IS", label: "Islande" },
  { code: "IT", label: "Italie" },
  { code: "LV", label: "Lettonie" },
  { code: "LI", label: "Liechtenstein" },
  { code: "LT", label: "Lituanie" },
  { code: "LU", label: "Luxembourg" },
  { code: "MK", label: "Macédoine du Nord" },
  { code: "MT", label: "Malte" },
  { code: "MC", label: "Monaco" },
  { code: "ME", label: "Monténégro" },
  { code: "NO", label: "Norvège" },
  { code: "NL", label: "Pays-Bas" },
  { code: "PL", label: "Pologne" },
  { code: "PT", label: "Portugal" },
  { code: "CZ", label: "République tchèque" },
  { code: "RO", label: "Roumanie" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "SM", label: "Saint-Marin" },
  { code: "RS", label: "Serbie" },
  { code: "SK", label: "Slovaquie" },
  { code: "SI", label: "Slovénie" },
  { code: "SE", label: "Suède" },
  { code: "CH", label: "Suisse" },
  { code: "UA", label: "Ukraine" },
  { code: "VA", label: "Vatican" },
];
