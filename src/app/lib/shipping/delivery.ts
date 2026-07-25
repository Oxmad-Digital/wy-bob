// Libellé + délai annoncés au client — fonction pure (pas d'accès DB), importable aussi
// bien côté serveur (emails, admin) que côté client (checkout), à l'inverse du frais qui,
// lui, doit toujours être revalidé côté serveur.

import { resolveZone, DELIVERY_ESTIMATES, type ShippingMode } from "./zones";

export function getDeliveryEstimate(params: { country: string; deliveryMethod: ShippingMode }) {
  const zone = resolveZone(params.country);
  return DELIVERY_ESTIMATES[zone][params.deliveryMethod];
}

export function formatDeliveryLabel(params: { country: string; deliveryMethod: ShippingMode }, locale: "fr" | "en" = "fr"): string {
  const { carrier, delay } = getDeliveryEstimate(params);
  return `${carrier} — ${delay[locale]}`;
}
