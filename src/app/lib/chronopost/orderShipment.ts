import { withTransaction } from "@/app/lib/neon";
import { findOrderById, setOrderDocument, updateOrderShipping } from "@/app/lib/repos/orders";
import { createShipment } from "./shipping";
import { ChronopostError } from "./client";
import type { BusinessType, DeliveryMethod, ShipmentParty } from "./types";
import { computeTotalWeightKg } from "@/app/lib/shipping/weight";
import { countryLabel } from "@/app/lib/shipping/countries";

interface GenerateOverrides {
  saturday?: boolean;
  businessType?: BusinessType;
  productKeyOverride?: string;
  weightKgOverride?: number;
}

interface PopulatedProductLine {
  product: { name?: string; price?: number; weight?: number; customsDescriptionEn?: string } | null;
  quantity: number;
}

function pickContent1(products: PopulatedProductLine[]): string {
  let best: { desc: string; qty: number; price: number } | null = null;
  for (const line of products) {
    const p = line.product;
    if (!p) continue;
    const desc = p.customsDescriptionEn || p.name || "";
    const qty = line.quantity || 0;
    const price = p.price || 0;
    if (!best || qty > best.qty || (qty === best.qty && price > best.price)) {
      best = { desc, qty, price };
    }
  }
  return (best?.desc || "").slice(0, 45);
}

/**
 * Génère (ou régénère) l'étiquette Chronopost d'une commande et persiste le résultat
 * sur order.shipping. Utilisé à la fois par le déclenchement automatique (passage au
 * statut paid/processing) et par le bouton de régénération manuelle dans l'admin.
 */
export async function generateShipmentForOrder(orderId: string, overrides: GenerateOverrides = {}) {
  const order = await findOrderById(orderId, { documents: false });
  if (!order) throw new ChronopostError("Commande introuvable");

  const country = (order.customer?.country || "FR").toUpperCase();
  const deliveryMethod: DeliveryMethod = order.delivery === "relais" ? "relay" : "home";
  const weightKg = overrides.weightKgOverride ?? computeTotalWeightKg(order.products);
  const isInternational = country !== "FR";

  if (deliveryMethod === "relay" && !order.shipping?.relayPoint?.id) {
    throw new ChronopostError(
      "Aucun point relais sélectionné sur cette commande — impossible de générer l'étiquette"
    );
  }

  const recipient: ShipmentParty =
    deliveryMethod === "relay"
      ? {
          name: order.shipping.relayPoint.name || "",
          address1: order.shipping.relayPoint.address1 || "",
          address2: order.shipping.relayPoint.address2 || "",
          zipCode: order.shipping.relayPoint.zipCode || "",
          city: order.shipping.relayPoint.city || "",
          country: order.shipping.relayPoint.country || country,
          countryName: countryLabel(order.shipping.relayPoint.country || country),
          contactName: `${order.customer?.firstname || ""} ${order.customer?.lastname || ""}`.trim(),
          phone: order.customer?.phone,
          email: order.customer?.email,
        }
      : {
          name:
            order.customer?.company ||
            `${order.customer?.firstname || ""} ${order.customer?.lastname || ""}`.trim(),
          contactName: `${order.customer?.firstname || ""} ${order.customer?.lastname || ""}`.trim(),
          address1: order.customer?.address || "",
          zipCode: order.customer?.postalCode || "",
          city: order.customer?.city || "",
          country,
          countryName: countryLabel(country),
          phone: order.customer?.phone,
          email: order.customer?.email,
        };

  const result = await createShipment(
    {
      recipient,
      recipientPickupName: order.recipientPickupName,
      recipientRef: order.orderNumber ? String(order.orderNumber) : String(order._id),
      weightKg,
      relayId: order.shipping?.relayPoint?.id,
      deliveryMethod,
      saturday: overrides.saturday,
      businessType: overrides.businessType,
      productKeyOverride: overrides.productKeyOverride,
      content1: isInternational ? pickContent1(order.products) : undefined,
      insuredValue: order.insurance?.opted ? order.insurance.declaredValue : undefined,
    },
    {
      country,
      totalWeightKg: weightKg,
      orderRef: order.orderNumber ? `commande-${order.orderNumber}` : String(order._id),
    }
  );

  // Étiquette et champs shipping enregistrés ensemble (même transaction).
  await withTransaction(async (client) => {
    await updateOrderShipping(
      order._id,
      {
        carrier: "chronopost",
        productCode: result.productCode,
        productKey: result.productKey,
        service: result.service,
        skybillNumber: result.skybillNumber,
        labelGeneratedAt: new Date(),
        weightKg,
        shippingError: "",
      },
      client
    );
    await setOrderDocument(order._id, "label", result.labelBase64, client);
  });

  return result;
}

export async function markShippingError(orderId: string, message: string) {
  await updateOrderShipping(orderId, { shippingError: message });
}
