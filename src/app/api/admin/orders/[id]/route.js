// app/api/admin/orders/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import Product from "@/app/models/Product";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";

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

    const order = await Order.findById(id).populate("products.product").lean();

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
      "processing",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatus.includes(status)) {
      return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
    }

    // Applique le changement de statut : persistance + déclenchement Chronopost
    // (paid/processing) + email client. Logique partagée avec le webhook Stripe.
    const freshOrder = await applyOrderStatusChange(id, status);

    if (!freshOrder) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

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

    // Le stock avait été réservé à la création — s'il n'a pas déjà été restitué par une
    // annulation, on le restitue avant de supprimer la commande.
    if (order.status !== "cancelled") {
      await Promise.all(
        order.products.map((line) =>
          Product.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } })
        )
      );
    }

    await Order.findByIdAndDelete(id);

    return NextResponse.json({ message: "Commande supprimée avec succès" });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}