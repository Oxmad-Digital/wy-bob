import mongoose from "mongoose";
// Le schéma référence "Product" (ref, plus bas) : sans cet import, populate("products.product")
// plante en MissingSchemaError si aucun autre module n'a déjà enregistré ce modèle dans
// l'exécution en cours (dépend de l'ordre de chargement au cold start Vercel).
import "@/app/models/Product";

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: Number, unique: true, sparse: true },
    userId: { type: String, default: null },
    customer: {
      firstname: String,
      lastname: String,
      email: String,
      phone: String,
      company: String,
      city: String,
      address: String,
      postalCode: String,
      country: String,
    },
    recipientPickupName: { type: String, default: "" }, // personne habilitée à retirer le colis (livraison en point relais)
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: Number,
      },
    ],
    total: Number,
    shippingFee: { type: Number, default: 0 },
    promoCode: { type: String, default: null },
    promoDiscount: { type: Number, default: 0 },
    payment: {
      type: String,
      enum: ["cash", "mobile_money", "card", "bank_transfer"],
      default: "cash",
    },
    paymentIntentId: { type: String, default: null, index: true },
    idempotencyKey: { type: String, default: null, unique: true, sparse: true },
    delivery: {
  type: String,
  enum: ['standard', 'express', 'pickup', 'colissimo', 'relais'],
  default: 'colissimo',
},
    status: {
      type: String,
      enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    shipping: {
      carrier: { type: String, default: "chronopost" },
      productCode: String,
      productKey: String,
      service: String,
      skybillNumber: String,
      labelBase64: String,
      labelGeneratedAt: Date,
      weightKg: Number,
      relayPoint: {
        id: String,
        name: String,
        address1: String,
        zipCode: String,
        city: String,
        country: String,
        latitude: Number,
        longitude: Number,
      },
      trackingStatus: String,
      trackingEvents: { type: [mongoose.Schema.Types.Mixed], default: [] },
      lastTrackedAt: Date,
      podBase64: String,
      shippingError: String,
      cancelledAt: Date,
    },
    extraPayments: {
      type: [
        {
          reason: String,
          amount: Number,
          status: { type: String, enum: ["pending", "paid", "cancelled"], default: "pending" },
          stripeSessionId: String,
          checkoutUrl: String,
          createdAt: { type: Date, default: Date.now },
          paidAt: Date,
        },
      ],
      default: [],
    },
    refunds: {
      type: [
        {
          amount: Number,
          reason: String,
          stripeRefundId: String,
          status: { type: String, enum: ["succeeded", "pending", "failed"], default: "succeeded" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);