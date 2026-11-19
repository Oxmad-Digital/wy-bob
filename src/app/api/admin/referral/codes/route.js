export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listReferralCodesWithReferrer } from "@/app/lib/repos/promos";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    // La fiche CRM (Customer) porte le nom à jour du client ; le champ
    // User.name peut être un pseudo obsolète saisi à l'inscription. Le repo
    // harmonise avec le nom affiché dans /admin/customers.
    const codes = await listReferralCodesWithReferrer();

    return NextResponse.json({ success: true, codes });
  } catch (error) {
    console.error("ADMIN REFERRAL CODES GET ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
