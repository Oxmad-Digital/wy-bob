export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUuid } from "@/app/lib/neon";
import { findInvoicePdf } from "@/app/lib/repos/invoices";

export async function GET(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const invoice = await findInvoicePdf(id);
    if (!invoice || !invoice.pdfBase64) {
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
