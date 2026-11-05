// app/lib/orderStatusChange.js
import { withTransaction } from "@/app/lib/neon";
import { findOrderById, findOrderStockLines, lockOrder, setOrderStatus } from "@/app/lib/repos/orders";
import { applyLineStockDelta } from "@/app/lib/repos/products";
import { sendEmail } from "@/app/lib/mailer";
import { getOrderStatusUpdateEmailTemplate } from "@/app/lib/emailTemplates";
import { generateShipmentForOrder, markShippingError } from "@/app/lib/chronopost/orderShipment";
import { createInvoiceForOrder } from "@/app/lib/invoice/createInvoiceForOrder";
import { STATUS_LABELS } from "@/app/lib/orderStatus";

const STATUS_MESSAGES = {
  pending: "Votre commande est en attente de traitement.",
  paid: "Votre paiement a été reçu. Merci !",
  processing: "Votre commande est en cours de préparation.",
  shipped: "Votre commande a été expédiée ! Elle arrivera bientôt.",
  delivered: "Votre commande a été livrée. Merci pour votre achat !",
  cancelled: "Votre commande a été annulée. Contactez-nous pour plus d'informations.",
};

/**
 * Applique un changement de statut à une commande : persiste le statut, déclenche
 * l'étiquette Chronopost si nécessaire (paid/processing), puis notifie le client par
 * email. Utilisé à la fois par la route admin (changement manuel) et par le webhook
 * Stripe (confirmation automatique de paiement) pour ne pas dupliquer cette logique.
 */
export async function applyOrderStatusChange(orderId, status) {
  // Statut + restitution du stock dans une seule transaction, commande verrouillée : deux
  // annulations simultanées ne peuvent pas restituer le stock deux fois.
  const previousStatus = await withTransaction(async (client) => {
    const locked = await lockOrder(client, String(orderId));
    if (!locked) return null;
    const wasAlreadyCancelled = locked.status === "cancelled";

    await setOrderStatus(client, locked.id, status);

    // Le stock avait été réservé à la création de la commande — on le restitue à
    // l'annulation, une seule fois (pas de double restitution si déjà annulée). Si la
    // ligne référence une variante (couleur), on restitue son stock puis on recalcule
    // le stock total du produit (voir la décrémentation symétrique dans /api/order).
    if (status === "cancelled" && !wasAlreadyCancelled) {
      const lines = await findOrderStockLines(client, locked.id);
      for (const line of lines) {
        await applyLineStockDelta(client, line, line.quantity);
      }
    }
    return locked.status;
  });
  if (previousStatus === null) return null;

  const order = await findOrderById(String(orderId), { populate: false });
  if (!order) return null;
  const previousOrder = { status: previousStatus };

  if (["paid", "processing"].includes(status) && !order.shipping?.skybillNumber) {
    try {
      await generateShipmentForOrder(order._id);
    } catch (shippingErr) {
      console.error("CHRONOPOST SHIPPING ERROR:", shippingErr);
      await markShippingError(order._id, shippingErr.message || "Erreur inconnue Chronopost");
    }
  }

  // La facture ne doit être émise qu'une fois, au premier passage en "paid" — un
  // échec de génération ne doit jamais annuler la confirmation de paiement déjà
  // persistée (même principe que la gestion d'erreur Chronopost ci-dessus).
  if (status === "paid" && previousOrder.status !== "paid") {
    try {
      await createInvoiceForOrder(order._id);
    } catch (invoiceErr) {
      console.error("INVOICE GENERATION ERROR:", invoiceErr);
    }
  }

  const statusInfo = STATUS_LABELS[status];
  const orderNumber = order.orderNumber
    ? String(order.orderNumber).padStart(4, "0")
    : order._id.slice(-8).toUpperCase();

  const clientEmailHtml = getOrderStatusUpdateEmailTemplate({
    firstname: order.customer?.firstname || "Client",
    orderNumber,
    statusInfo,
    statusMessage: STATUS_MESSAGES[status],
    address: order.customer?.address || "",
    city: order.customer?.city || "",
    total: order.total,
  });

  if (order.customer?.email) {
    try {
      await sendEmail({
        to: order.customer.email,
        subject: `${statusInfo.icon} Commande #${orderNumber} - ${statusInfo.label}`,
        html: clientEmailHtml,
      });
    } catch (emailErr) {
      // Un échec d'envoi ne doit jamais annuler le changement de statut déjà persisté.
      console.error("EMAIL STATUS UPDATE ERROR (non bloquant):", emailErr);
    }
  }

  return findOrderById(order._id, { populate: false });
}
