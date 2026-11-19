export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findOrderOwnership } from "@/app/lib/repos/orders";
import { findInvoiceByOrderId } from "@/app/lib/repos/invoices";

// Pendant client de /api/admin/invoices/[id]/pdf : même PDF stocké en base, mais
// l'accès est vérifié par propriété de la commande plutôt que par rôle admin.
export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    // Id mal formé ou commande inexistante : 404 (findOrderOwnership renvoie null).
    const order = await findOrderOwnership(id);
    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    const ownsOrder =
      (order.userId !== null && order.userId === session.user.id) ||
      order.email?.toLowerCase() === session.user.email.toLowerCase();
    if (!ownsOrder) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const invoice = await findInvoiceByOrderId(id);
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
