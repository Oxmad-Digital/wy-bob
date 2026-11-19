export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrCreateSiteSettings,
  updateSiteSettings,
  SiteSettingsValidationError,
} from "@/app/lib/repos/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const settings = await getOrCreateSiteSettings();

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("GET SETTINGS ERROR:", error);
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
    const { maintenanceMode, billing } = body;

    const settings = await updateSiteSettings({ maintenanceMode, billing });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    if (error instanceof SiteSettingsValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("PATCH SETTINGS ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
