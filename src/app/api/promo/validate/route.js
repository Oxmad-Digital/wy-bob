export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import PromoCode from "@/app/models/PromoCode";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export async function POST(request) {
  try {
    await connectDB();

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit({ key: `promo-validate:${ip}`, windowMs: 60 * 1000, maxAttempts: 20 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const { code, cartTotal } = await request.json();

    if (!code) {
      return NextResponse.json({ message: "Code manquant" }, { status: 400 });
    }

    const promo = await PromoCode.findOne({ code: code.toUpperCase().trim() });

    if (!promo) {
      return NextResponse.json({ message: "Code promo invalide" }, { status: 404 });
    }
    if (!promo.active) {
      return NextResponse.json({ message: "Ce code promo est désactivé" }, { status: 400 });
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ message: "Ce code promo a expiré" }, { status: 400 });
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ message: "Ce code promo a atteint sa limite d'utilisation" }, { status: 400 });
    }
    if (cartTotal !== undefined && cartTotal < promo.minOrderAmount) {
      return NextResponse.json(
        { message: `Commande minimum requise : ${promo.minOrderAmount} €` },
        { status: 400 }
      );
    }

    if (promo.isReferral) {
      const session = await auth();
      if (!session) {
        return NextResponse.json(
          { message: "Créez un compte pour utiliser un code de parrainage" },
          { status: 401 }
        );
      }
      if (String(promo.referrerId) === String(session.user.id)) {
        return NextResponse.json(
          { message: "Vous ne pouvez pas utiliser votre propre code de parrainage" },
          { status: 400 }
        );
      }
      const alreadyUsed = promo.usedByUserIds.some(
        (id) => String(id) === String(session.user.id)
      );
      if (alreadyUsed) {
        return NextResponse.json(
          { message: "Vous avez déjà utilisé ce code de parrainage" },
          { status: 400 }
        );
      }
    }

    const effectiveValue = promo.isReferral ? (promo.filleulPercent ?? 0) : promo.value;

    const discount =
      promo.type === "percent"
        ? Math.round(cartTotal * (effectiveValue / 100) * 100) / 100
        : Math.min(effectiveValue, cartTotal);

    return NextResponse.json({
      success: true,
      promo: {
        _id: promo._id,
        code: promo.code,
        type: promo.type,
        value: effectiveValue,
        isReferral: promo.isReferral,
        filleulPercent: promo.filleulPercent,
        parrainPercent: promo.parrainPercent,
      },
      discount,
    });
  } catch (error) {
    console.error("PROMO VALIDATE ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
