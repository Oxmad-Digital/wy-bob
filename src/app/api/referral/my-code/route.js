export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUuid } from "@/app/lib/neon";
import {
  findPromoByCode,
  findReferralCodeByReferrer,
  createReferralCode,
  updateReferralSplit,
} from "@/app/lib/repos/promos";
import { getReferralConfig } from "@/app/lib/repos/settings";

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `REF-${suffix}`;
}

export async function GET() {
  try {
    const session = await auth();
    // Un id de session qui n'est pas un uuid (ancien jeton non converti) ne peut pas
    // désigner un parrain : même réponse que sans session.
    if (!session || !isUuid(session.user.id)) {
      return NextResponse.json({ message: "Connexion requise" }, { status: 401 });
    }

    const config = await getReferralConfig();
    if (!config?.active) {
      return NextResponse.json({ message: "Le programme de parrainage n'est pas actif" }, { status: 403 });
    }

    let referralCode = await findReferralCodeByReferrer(session.user.id);

    if (!referralCode) {
      let code;
      let attempts = 0;
      do {
        code = generateReferralCode();
        attempts++;
      } while (attempts < 10 && (await findPromoByCode(code)));

      referralCode = await createReferralCode({
        code,
        referrerId: session.user.id,
        totalPercent: config.totalPercent,
      });
    }

    return NextResponse.json({
      success: true,
      referralCode: {
        code: referralCode.code,
        filleulPercent: referralCode.filleulPercent,
        parrainPercent: referralCode.parrainPercent,
        usedCount: referralCode.usedCount,
        totalPercent: config.totalPercent,
      },
    });
  } catch (error) {
    console.error("GET REFERRAL MY-CODE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !isUuid(session.user.id)) {
      return NextResponse.json({ message: "Connexion requise" }, { status: 401 });
    }

    const config = await getReferralConfig();
    if (!config?.active) {
      return NextResponse.json({ message: "Le programme de parrainage n'est pas actif" }, { status: 403 });
    }

    const { filleulPercent } = await req.json();

    if (filleulPercent === undefined || filleulPercent < 0 || filleulPercent > config.totalPercent) {
      return NextResponse.json(
        { message: `La part filleul doit être entre 0 et ${config.totalPercent}` },
        { status: 400 }
      );
    }

    const parrainPercent = config.totalPercent - filleulPercent;

    const referralCode = await updateReferralSplit(session.user.id, { filleulPercent, parrainPercent });

    if (!referralCode) {
      return NextResponse.json({ message: "Code de parrainage introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      referralCode: {
        code: referralCode.code,
        filleulPercent: referralCode.filleulPercent,
        parrainPercent: referralCode.parrainPercent,
        usedCount: referralCode.usedCount,
        totalPercent: config.totalPercent,
      },
    });
  } catch (error) {
    console.error("PATCH REFERRAL MY-CODE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
