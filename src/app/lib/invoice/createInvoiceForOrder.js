import Order from "@/app/models/Order";
import Invoice from "@/app/models/Invoice";
import Counter from "@/app/models/Counter";
import SiteSettings from "@/app/models/SiteSettings";
import { renderInvoicePdfBuffer } from "@/app/lib/invoice/generateInvoicePdf.jsx";
import { computeInvoiceAmounts, formatInvoiceNumber } from "@/app/lib/invoice/invoicePricing";

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Génère (une seule fois) la facture d'une commande payée. Idempotent : si une
 * facture existe déjà pour cette commande, elle est simplement retournée — évite
 * de consommer un numéro de séquence en cas de double appel (webhook Stripe rejoué,
 * changement de statut manuel après un webhook déjà passé, etc.).
 */
export async function createInvoiceForOrder(orderId) {
  const existing = await Invoice.findOne({ order: orderId });
  if (existing) return existing;

  const order = await Order.findById(orderId).populate("products.product");
  if (!order) throw new Error("Commande introuvable");

  const settings = await SiteSettings.findOne();
  const billing = settings?.billing || {};

  const lineItems = order.products
    .filter((line) => line.product)
    .map((line) => ({
      name: line.product.name,
      quantity: line.quantity,
      unitPriceTtc: line.product.price,
      totalTtc: round2(line.product.price * line.quantity),
    }));

  const shippingFeeTtc = order.shippingFee || 0;
  const promoDiscount = order.promoDiscount || 0;
  const vatApplicable = !!billing.vatApplicable;
  const vatRate = vatApplicable ? billing.vatRate ?? 20 : 0;

  const { subtotalTtc, totalHt, vatAmount, totalTtc } = computeInvoiceAmounts({
    totalTtc: order.total,
    shippingFeeTtc,
    promoDiscount,
    vatApplicable,
    vatRate,
  });

  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const invoiceNumber = formatInvoiceNumber(year, counter.seq);

  const invoiceData = {
    invoiceNumber,
    issuedAt: new Date(),
    orderNumber: order.orderNumber,
    seller: {
      companyName: billing.companyName || "",
      legalForm: billing.legalForm || "",
      address: billing.address || "",
      city: billing.city || "",
      postalCode: billing.postalCode || "",
      siret: billing.siret || "",
      vatNumber: billing.vatNumber || "",
      iban: billing.iban || "",
    },
    customer: {
      firstname: order.customer?.firstname || "",
      lastname: order.customer?.lastname || "",
      company: order.customer?.company || "",
      address: order.customer?.address || "",
      city: order.customer?.city || "",
      postalCode: order.customer?.postalCode || "",
      country: order.customer?.country || "",
    },
    lineItems,
    subtotalTtc,
    shippingFeeTtc,
    promoDiscount,
    vatApplicable,
    vatRate,
    totalHt,
    vatAmount,
    totalTtc,
  };

  const pdfBuffer = await renderInvoicePdfBuffer(invoiceData);

  const invoice = await Invoice.create({
    invoiceNumber,
    year,
    sequence: counter.seq,
    order: order._id,
    orderNumber: order.orderNumber,
    customer: invoiceData.customer,
    lineItems,
    subtotalTtc,
    shippingFeeTtc,
    promoDiscount,
    vatApplicable,
    vatRate,
    totalHt,
    vatAmount,
    totalTtc,
    sellerSnapshot: invoiceData.seller,
    pdfBase64: pdfBuffer.toString("base64"),
    issuedAt: invoiceData.issuedAt,
  });

  return invoice;
}
