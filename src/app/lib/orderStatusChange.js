// app/lib/orderStatusChange.js
import Order from "@/app/models/Order";
import { sendEmail } from "@/app/lib/mailer";
import { getOrderStatusUpdateEmailTemplate } from "@/app/lib/emailTemplates";
import { generateShipmentForOrder, markShippingError } from "@/app/lib/chronopost/orderShipment";

export const STATUS_LABELS = {
  pending: { label: "En attente", icon: "⏳", color: "#f59e0b" },
  confirmed: { label: "Confirmée", icon: "✔️", color: "#3b82f6" },
  paid: { label: "Payée", icon: "💰", color: "#10b981" },
  processing: { label: "En préparation", icon: "📦", color: "#8b5cf6" },
  shipped: { label: "Expédiée", icon: "🚚", color: "#06b6d4" },
  delivered: { label: "Livrée", icon: "✅", color: "#22c55e" },
  cancelled: { label: "Annulée", icon: "❌", color: "#ef4444" },
};

const STATUS_MESSAGES = {
  pending: "Votre commande est en attente de traitement.",
  confirmed: "Bonne nouvelle ! Votre commande a été confirmée.",
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
  const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
  if (!order) return null;

  if (["paid", "processing"].includes(status) && !order.shipping?.skybillNumber) {
    try {
      await generateShipmentForOrder(order._id.toString());
    } catch (shippingErr) {
      console.error("CHRONOPOST SHIPPING ERROR:", shippingErr);
      await markShippingError(order._id.toString(), shippingErr.message || "Erreur inconnue Chronopost");
    }
  }

  const statusInfo = STATUS_LABELS[status];
  const orderNumber = order.orderNumber
    ? String(order.orderNumber).padStart(4, "0")
    : order._id.toString().slice(-8).toUpperCase();

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

  return Order.findById(order._id);
}
