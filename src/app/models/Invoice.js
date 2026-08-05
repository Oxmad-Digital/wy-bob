import mongoose from "mongoose";

// Une facture est un instantané figé au moment de l'émission : elle ne doit jamais
// être modifiée rétroactivement (obligation légale), même si la commande ou les
// réglages de facturation changent ensuite — voir createInvoiceForOrder.js.
const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    year: { type: Number, required: true },
    sequence: { type: Number, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    orderNumber: { type: Number, default: null },
    customer: {
      firstname: String,
      lastname: String,
      email: String,
      company: String,
      address: String,
      city: String,
      postalCode: String,
      country: String,
    },
    lineItems: [
      {
        name: String,
        quantity: Number,
        unitPriceTtc: Number,
        totalTtc: Number,
      },
    ],
    subtotalTtc: Number,
    shippingFeeTtc: Number,
    promoDiscount: { type: Number, default: 0 },
    vatApplicable: { type: Boolean, default: false },
    vatRate: { type: Number, default: 0 },
    totalHt: Number,
    vatAmount: Number,
    totalTtc: Number,
    sellerSnapshot: {
      companyName: String,
      legalForm: String,
      address: String,
      city: String,
      postalCode: String,
      siret: String,
      vatNumber: String,
      iban: String,
    },
    pdfBase64: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
