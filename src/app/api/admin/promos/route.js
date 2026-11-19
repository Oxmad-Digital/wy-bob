export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPromos, createAdminPromo, PromoCodeConflictError } from "@/app/lib/repos/promos";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const promos = await listPromos();

    return NextResponse.json({ success: true, promos });
  } catch (error) {
    console.error("ADMIN PROMOS GET ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const body = await request.json();
    const { code, type, value, minOrderAmount, maxUses, expiresAt } = body;

    if (!code || !type || value === undefined) {
      return NextResponse.json({ message: "Champs obligatoires manquants" }, { status: 400 });
    }
    if (!["percent", "fixed"].includes(type)) {
      return NextResponse.json({ message: "Type invalide" }, { status: 400 });
    }
    if (type === "percent" && (value <= 0 || value > 100)) {
      return NextResponse.json({ message: "La réduction en % doit être entre 1 et 100" }, { status: 400 });
    }
    if (value < 0) {
      return NextResponse.json({ message: "La valeur doit être positive" }, { status: 400 });
    }

    const promo = await createAdminPromo({
      code: code.toUpperCase().trim(),
      type,
      value,
      minOrderAmount: minOrderAmount || 0,
      maxUses: maxUses || null,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({ success: true, promo }, { status: 201 });
  } catch (error) {
    if (error instanceof PromoCodeConflictError) {
      return NextResponse.json({ message: "Ce code promo existe déjà" }, { status: 409 });
    }
    console.error("ADMIN PROMOS POST ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
