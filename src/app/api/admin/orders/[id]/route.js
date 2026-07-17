// app/api/admin/orders/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { sendEmail } from "@/app/lib/mailer";
import { getOrderStatusUpdateEmailTemplate } from "@/app/lib/emailTemplates";
import { generateShipmentForOrder, markShippingError } from "@/app/lib/chronopost/orderShipment";

// ✅ GET - Récupérer les détails d'une commande

// ✅ AJOUTER CETTE FONCTION GET
export async function GET(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const order = await Order.findById(id).populate("products.product");

    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ✅ PATCH - Mettre à jour le statut (votre code existant)
export async function PATCH(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const { status } = await req.json();

    const allowedStatus = [
      "pending",
      "confirmed",
      "processing",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatus.includes(status)) {
      return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    /* ======================
       📦 ÉTIQUETTE CHRONOPOST
       Générée automatiquement au passage en "payée"/"en préparation" si elle n'existe
       pas déjà. Un échec (ex: pas de point relais choisi) ne bloque jamais le
       changement de statut — il est journalisé dans shipping.shippingError et un
       bouton "Régénérer" reste disponible dans l'admin.
    ====================== */
    if (["paid", "processing"].includes(status) && !order.shipping?.skybillNumber) {
      try {
        await generateShipmentForOrder(order._id.toString());
      } catch (shippingErr) {
        console.error("CHRONOPOST SHIPPING ERROR:", shippingErr);
        await markShippingError(order._id.toString(), shippingErr.message || "Erreur inconnue Chronopost");
      }
    }

    /* ======================
       📧 EMAIL AU CLIENT
    ====================== */
    const statusLabels = {
      pending: { label: "En attente", icon: "⏳", color: "#f59e0b" },
      confirmed: { label: "Confirmée", icon: "✔️", color: "#3b82f6" },
      processing: { label: "En préparation", icon: "📦", color: "#8b5cf6" },
      paid: { label: "Payée", icon: "💰", color: "#10b981" },
      shipped: { label: "Expédiée", icon: "🚚", color: "#06b6d4" },
      delivered: { label: "Livrée", icon: "✅", color: "#22c55e" },
      cancelled: { label: "Annulée", icon: "❌", color: "#ef4444" },
    };

    const statusInfo = statusLabels[status];
    const orderNumber = order.orderNumber
      ? String(order.orderNumber).padStart(4, "0")
      : order._id.toString().slice(-8).toUpperCase();

    const statusMessages = {
      pending: "Votre commande est en attente de traitement.",
      confirmed: "Bonne nouvelle ! Votre commande a été confirmée.",
      processing: "Votre commande est en cours de préparation.",
      paid: "Votre paiement a été reçu. Merci !",
      shipped: "Votre commande a été expédiée ! Elle arrivera bientôt.",
      delivered: "Votre commande a été livrée. Merci pour votre achat !",
      cancelled: "Votre commande a été annulée. Contactez-nous pour plus d'informations.",
    };

    const clientEmailHtml = getOrderStatusUpdateEmailTemplate({
      firstname: order.customer?.firstname || "Client",
      orderNumber,
      statusInfo,
      statusMessage: statusMessages[status],
      address: order.customer?.address || "",
      city: order.customer?.city || "",
      total: order.total,
    });

    if (order.customer?.email) {
      await sendEmail({
        to: order.customer.email,
        subject: `${statusInfo.icon} Commande #${orderNumber} - ${statusInfo.label}`,
        html: clientEmailHtml,
      });
    }

    const freshOrder = await Order.findById(order._id);
    return NextResponse.json(freshOrder);
  } catch (error) {
    console.error("PATCH ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ✅ DELETE - Supprimer une commande
export async function DELETE(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    // ⚠️ Empêcher la suppression de commandes payées ou expédiées
    const protectedStatus = ["paid", "shipped", "delivered"];
    if (protectedStatus.includes(order.status)) {
      return NextResponse.json(
        { message: `Impossible de supprimer une commande ${order.status}` },
        { status: 400 }
      );
    }

    await Order.findByIdAndDelete(id);

    return NextResponse.json({ message: "Commande supprimée avec succès" });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}