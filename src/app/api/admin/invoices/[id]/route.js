export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Invoice from "@/app/models/Invoice";
import mongoose from "mongoose";

// DELETE - Supprimer une facture (nettoyage de données de test ou d'erreur de facturation ;
// une facture émise pour une vraie vente ne doit normalement jamais être supprimée).
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

    const invoice = await Invoice.findByIdAndDelete(id);

    if (!invoice) {
      return NextResponse.json({ message: "Facture introuvable" }, { status: 404 });
    }

    return NextResponse.json({ message: "Facture supprimée avec succès" });
  } catch (error) {
    console.error("DELETE INVOICE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
