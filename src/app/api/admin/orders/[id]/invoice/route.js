export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import Invoice from "@/app/models/Invoice";
import { createInvoiceForOrder } from "@/app/lib/invoice/createInvoiceForOrder";
import mongoose from "mongoose";

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

    const invoice = await Invoice.findOne({ order: id }).select("-pdfBase64");

    return NextResponse.json({ success: true, invoice: invoice || null });
  } catch (error) {
    console.error("GET ORDER INVOICE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// Génération manuelle de secours — utilisée depuis le détail commande admin quand la
// génération automatique (déclenchée au passage en "paid") a échoué. createInvoiceForOrder
// est idempotent : rappeler cette route sur une commande déjà facturée renvoie la facture existante.
export async function POST(req, { params }) {
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

    const order = await Order.findById(id).select("status");
    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    if (!["paid", "processing", "shipped", "delivered"].includes(order.status)) {
      return NextResponse.json({ message: "La commande n'a pas encore été payée" }, { status: 400 });
    }

    const invoice = await createInvoiceForOrder(id);

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error("MANUAL INVOICE GENERATION ERROR:", error);
    return NextResponse.json({ message: error.message || "Erreur serveur" }, { status: 500 });
  }
}
