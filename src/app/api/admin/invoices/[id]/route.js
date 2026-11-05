export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUuid } from "@/app/lib/neon";
import { deleteInvoice } from "@/app/lib/repos/invoices";

// DELETE - Supprimer une facture (nettoyage de données de test ou d'erreur de facturation ;
// une facture émise pour une vraie vente ne doit normalement jamais être supprimée).
export async function DELETE(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const deleted = await deleteInvoice(id);

    if (!deleted) {
      return NextResponse.json({ message: "Facture introuvable" }, { status: 404 });
    }

    return NextResponse.json({ message: "Facture supprimée avec succès" });
  } catch (error) {
    console.error("DELETE INVOICE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
