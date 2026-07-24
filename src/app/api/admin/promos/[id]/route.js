export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import PromoCode from "@/app/models/PromoCode";

export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { active, code, type, value, minOrderAmount, maxUses, expiresAt } = body;

    const update = {};
    if (active !== undefined) update.active = active;
    if (code !== undefined) update.code = code.toUpperCase().trim();
    if (type !== undefined) {
      if (!["percent", "fixed"].includes(type)) {
        return NextResponse.json({ message: "Type invalide" }, { status: 400 });
      }
      update.type = type;
    }
    if (value !== undefined) {
      const effectiveType = type !== undefined ? type : (await PromoCode.findById(params.id))?.type;
      if (effectiveType === "percent" && (value <= 0 || value > 100)) {
        return NextResponse.json({ message: "La réduction en % doit être entre 1 et 100" }, { status: 400 });
      }
      if (value < 0) {
        return NextResponse.json({ message: "La valeur doit être positive" }, { status: 400 });
      }
      update.value = value;
    }
    if (minOrderAmount !== undefined) update.minOrderAmount = minOrderAmount || 0;
    if (maxUses !== undefined) update.maxUses = maxUses || null;
    if (expiresAt !== undefined) update.expiresAt = expiresAt || null;

    const promo = await PromoCode.findByIdAndUpdate(
      params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!promo) {
      return NextResponse.json({ message: "Code promo introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true, promo });
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json({ message: "Ce code promo existe déjà" }, { status: 409 });
    }
    console.error("ADMIN PROMOS PATCH ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const promo = await PromoCode.findByIdAndDelete(params.id);

    if (!promo) {
      return NextResponse.json({ message: "Code promo introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ADMIN PROMOS DELETE ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
