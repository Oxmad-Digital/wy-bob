export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteReferralCode } from "@/app/lib/repos/promos";

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    const deleted = await deleteReferralCode(id);
    if (!deleted) {
      return NextResponse.json({ message: "Code de parrainage introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ADMIN REFERRAL CODE DELETE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
