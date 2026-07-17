// app/api/admin/orders/[id]/label/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";

// ✅ GET - Télécharger l'étiquette PDF Chronopost d'une commande
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

    const order = await Order.findById(id).select("shipping orderNumber");

    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    if (!order.shipping?.labelBase64) {
      return NextResponse.json({ message: "Aucune étiquette générée pour cette commande" }, { status: 404 });
    }

    const pdfBuffer = Buffer.from(order.shipping.labelBase64, "base64");
    const orderNumber = order.orderNumber ? String(order.orderNumber).padStart(4, "0") : id.slice(-8);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiquette-chronopost-${orderNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("GET LABEL ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
