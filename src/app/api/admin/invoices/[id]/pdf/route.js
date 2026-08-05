export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Invoice from "@/app/models/Invoice";
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

    const invoice = await Invoice.findById(id).select("pdfBase64 invoiceNumber");
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
    console.error("GET INVOICE PDF ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
