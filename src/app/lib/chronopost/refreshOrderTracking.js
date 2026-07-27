// app/lib/chronopost/refreshOrderTracking.js
import { trackParcel, searchPOD } from "@/app/lib/chronopost/tracking";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";

// Libellés de suivi Chronopost (fr_FR) qui suggèrent une livraison — sert uniquement de
// déclencheur pour vérifier via searchPOD (signal Chronopost non ambigu) avant de
// basculer automatiquement le statut, jamais pour décider seul.
const DELIVERED_HINT = /livr/i;
const DELIVERED_EXCLUDE = /non[\s-]?livr|refus|absent|litige|attente/i;

/**
 * refreshOrderTracking — interroge Chronopost pour une commande donnée (déjà chargée,
 * avec skybillNumber) et met à jour son suivi + statut si besoin. Partagé entre la route
 * admin (clic manuel) et le cron quotidien pour ne pas dupliquer cette logique.
 */
export async function refreshOrderTracking(order) {
  let resultOrder = order;

  const tracking = await trackParcel(order.shipping.skybillNumber);
  order.shipping.trackingStatus = tracking.statusLabel || tracking.statusCode || "";
  order.shipping.trackingEvents = tracking.events;
  order.shipping.lastTrackedAt = new Date();
  await order.save();

  let currentStatus = order.status;

  // Le premier événement de suivi signifie que le colis a été scanné par le
  // transporteur : la commande a donc quitté la préparation, même si l'admin n'a
  // pas cliqué sur "Expédiée" manuellement.
  if (tracking.events?.length > 0 && ["paid", "processing"].includes(currentStatus)) {
    resultOrder = (await applyOrderStatusChange(order._id.toString(), "shipped")) || order;
    currentStatus = resultOrder.status;
  }

  const label = tracking.statusLabel || "";
  const looksDelivered = DELIVERED_HINT.test(label) && !DELIVERED_EXCLUDE.test(label);

  if (looksDelivered && !["delivered", "cancelled"].includes(currentStatus)) {
    try {
      const pod = await searchPOD(order.shipping.skybillNumber);
      if (pod.available && pod.base64) {
        order.shipping.podBase64 = pod.base64;
        await order.save();
        resultOrder = (await applyOrderStatusChange(order._id.toString(), "delivered")) || order;
      }
    } catch (podErr) {
      // Vérification best-effort : un échec ici ne doit pas faire échouer le
      // rafraîchissement du suivi, qui a déjà réussi.
      console.error("CHRONOPOST AUTO-POD CHECK ERROR (non bloquant):", podErr);
    }
  }

  return resultOrder;
}
