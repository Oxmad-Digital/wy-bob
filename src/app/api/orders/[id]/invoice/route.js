export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import Invoice from "@/app/models/Invoice";
import mongoose from "mongoose";

// Pendant client de /api/admin/invoices/[id]/pdf : même PDF stocké en base, mais
// l'accès est vérifié par propriété de la commande plutôt que par rôle admin.
export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const order = await Order.findById(id).select("userId customer.email");
    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    const ownsOrder =
      order.userId === session.user.id ||
      order.customer?.email?.toLowerCase() === session.user.email.toLowerCase();
    if (!ownsOrder) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const invoice = await Invoice.findOne({ order: id }).select("pdfBase64 invoiceNumber");
    if (!invoice) {
      return NextResponse.json({ message: "Facture introuvable" }, { status: 404 });
    }

    const pdfBuffer = Buffer.from(invoice.pdfBase64, "base64");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("GET CUSTOMER INVOICE PDF ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
