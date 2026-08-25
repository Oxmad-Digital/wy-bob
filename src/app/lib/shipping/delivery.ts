// Libellé + délai annoncés au client — fonction pure (pas d'accès DB), importable aussi
// bien côté serveur (emails, admin) que côté client (checkout), à l'inverse du frais qui,
// lui, doit toujours être revalidé côté serveur.

import { resolveCountryShipping, type ShippingMode } from "./zones";

export function getDeliveryEstimate(params: { country: string; deliveryMethod: ShippingMode }) {
  const info = resolveCountryShipping(params.country);

  if (params.deliveryMethod === "relay") {
    if (!info.relay) {
      // Ne devrait pas être atteint : le checkout masque l'option point relais pour les
      // pays sans Chronorelais (cf. isRelayEligible dans zones.ts). Filet de sécurité.
      return {
        carrier: "Chronopost",
        delay: { fr: "point relais indisponible pour ce pays", en: "relay pickup unavailable for this country" },
      };
    }
    if (info.product === "national") {
      return {
        carrier: "Chronopost Relais 13",
        delay: { fr: "retrait en point relais dès le lendemain 13h", en: "pickup at relay point from the next day at 1pm" },
      };
    }
    return {
      carrier: "Chronorelais Europe",
      delay: {
        fr: `retrait en point relais en environ ${info.delayDays} jour${info.delayDays > 1 ? "s" : ""} ouvré${info.delayDays > 1 ? "s" : ""}`,
        en: `pickup at relay point in about ${info.delayDays} business day${info.delayDays > 1 ? "s" : ""}`,
      },
    };
  }

  if (info.product === "national") {
    return {
      carrier: "Chronopost Chrono 13",
      delay: { fr: "livraison en 24h (J+1 avant 13h)", en: "delivery within 24h (next day by 1pm)" },
    };
  }

  const carrier = info.product === "classic" ? "Chronopost Classic" : "Chronopost Express";
  return {
    carrier,
    delay: {
      fr: `livraison en environ ${info.delayDays} jour${info.delayDays > 1 ? "s" : ""} ouvré${info.delayDays > 1 ? "s" : ""}`,
      en: `delivery in about ${info.delayDays} business day${info.delayDays > 1 ? "s" : ""}`,
    },
  };
}

export function formatDeliveryLabel(params: { country: string; deliveryMethod: ShippingMode }, locale: "fr" | "en" = "fr"): string {
  const { carrier, delay } = getDeliveryEstimate(params);
  return `${carrier} — ${delay[locale]}`;
}
