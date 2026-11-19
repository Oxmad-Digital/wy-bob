export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateReferralConfig, updateReferralConfig } from "@/app/lib/repos/settings";
import { getReferralStats } from "@/app/lib/repos/promos";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const config = await getOrCreateReferralConfig();
    const { totalReferralCodes, totalConversions } = await getReferralStats();

    return NextResponse.json({ success: true, config, stats: { totalReferralCodes, totalConversions } });
  } catch (error) {
    console.error("ADMIN REFERRAL CONFIG GET ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const body = await req.json();
    const { totalPercent, rewardValidityDays, active } = body;

    const update = {};
    if (totalPercent !== undefined) {
      if (totalPercent < 1 || totalPercent > 100) {
        return NextResponse.json({ message: "Le pourcentage doit être entre 1 et 100" }, { status: 400 });
      }
      update.totalPercent = totalPercent;
    }
    if (rewardValidityDays !== undefined) update.rewardValidityDays = rewardValidityDays;
    if (active !== undefined) update.active = active;

    const config = await updateReferralConfig(update);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("ADMIN REFERRAL CONFIG PATCH ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
