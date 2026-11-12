// app/lib/chronopost/refreshOrderTracking.js
import { trackParcel, searchPOD } from "@/app/lib/chronopost/tracking";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";
import { findOrderById, setOrderDocument, updateOrderShipping } from "@/app/lib/repos/orders";

// Libellés de suivi Chronopost (fr_FR) qui suggèrent une livraison — sert uniquement de
// déclencheur pour vérifier via searchPOD (signal Chronopost non ambigu) avant de
// basculer automatiquement le statut, jamais pour décider seul.
const DELIVERED_HINT = /livr/i;
const DELIVERED_EXCLUDE = /non[\s-]?livr|refus|absent|litige|attente/i;

/**
 * refreshOrderTracking — interroge Chronopost pour une commande donnée et met à jour son
 * suivi + statut si besoin. Partagé entre la route admin (clic manuel) et le cron
 * quotidien pour ne pas dupliquer cette logique.
 *
 * `order` n'a besoin que de `_id`, `status` et `shipping.skybillNumber`. Renvoie la
 * commande relue en base après mise à jour (produits non peuplés, comme Order.findById).
 */
export async function refreshOrderTracking(order) {
  const orderId = String(order._id);
  const skybillNumber = order.shipping.skybillNumber;

  const tracking = await trackParcel(skybillNumber);
  await updateOrderShipping(orderId, {
    trackingStatus: tracking.statusLabel || tracking.statusCode || "",
    // Colonne NOT NULL : Mongo retombait sur le défaut [] quand events était absent.
    trackingEvents: tracking.events ?? [],
    lastTrackedAt: new Date(),
  });

  let currentStatus = order.status;

  // Le premier événement de suivi signifie que le colis a été scanné par le
  // transporteur : la commande a donc quitté la préparation, même si l'admin n'a
  // pas cliqué sur "Expédiée" manuellement.
  if (tracking.events?.length > 0 && ["paid", "processing"].includes(currentStatus)) {
    const shipped = await applyOrderStatusChange(orderId, "shipped");
    if (shipped) currentStatus = shipped.status;
  }

  const label = tracking.statusLabel || "";
  const looksDelivered = DELIVERED_HINT.test(label) && !DELIVERED_EXCLUDE.test(label);

  if (looksDelivered && !["delivered", "cancelled"].includes(currentStatus)) {
    try {
      const pod = await searchPOD(skybillNumber);
      if (pod.available && pod.base64) {
        await setOrderDocument(orderId, "pod", pod.base64);
        await applyOrderStatusChange(orderId, "delivered");
      }
    } catch (podErr) {
      // Vérification best-effort : un échec ici ne doit pas faire échouer le
      // rafraîchissement du suivi, qui a déjà réussi.
      console.error("CHRONOPOST AUTO-POD CHECK ERROR (non bloquant):", podErr);
    }
  }

  // Relecture finale : reflète le suivi, le statut et la preuve de livraison tels qu'ils
  // sont réellement en base, quel que soit le chemin suivi ci-dessus.
  return (await findOrderById(orderId, { populate: false })) ?? order;
}
