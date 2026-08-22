export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import SiteSettings from "@/app/models/SiteSettings";

async function getSettings() {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({ maintenanceMode: false });
  }
  return settings;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();
    const settings = await getSettings();

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { maintenanceMode, billing } = body;

    const update = {};
    if (maintenanceMode !== undefined) update.maintenanceMode = maintenanceMode;
    if (billing !== undefined) {
      for (const [key, value] of Object.entries(billing)) {
        update[`billing.${key}`] = value;
      }
    }

    const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
