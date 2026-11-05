import { withTransaction } from "@/app/lib/neon";
import { findOrderById, lockOrder } from "@/app/lib/repos/orders";
import { findInvoiceByOrderId, insertInvoice, nextInvoiceSequence } from "@/app/lib/repos/invoices";
import { getSiteSettings } from "@/app/lib/repos/settings";
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
 *
 * Tout se passe dans une transaction : la commande est verrouillée (deux appels simultanés
 * ne peuvent pas émettre deux factures), le compteur invoice_counters est incrémenté dans
 * la même transaction que l'insertion — si la génération du PDF ou l'insertion échoue, le
 * ROLLBACK annule aussi l'incrément : la numérotation reste continue, sans trou.
 */
export async function createInvoiceForOrder(orderId) {
  return withTransaction(async (client) => {
    const locked = await lockOrder(client, String(orderId));
    if (!locked) throw new Error("Commande introuvable");

    const existing = await findInvoiceByOrderId(locked.id, client);
    if (existing) return existing;

    const order = await findOrderById(locked.id, { db: client, documents: false });
    if (!order) throw new Error("Commande introuvable");

    const settings = await getSiteSettings(client);
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
    const sequence = await nextInvoiceSequence(client, year);
    const invoiceNumber = formatInvoiceNumber(year, sequence);

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

    const invoice = await insertInvoice(client, {
      invoiceNumber,
      year,
      sequence,
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
  });
}
