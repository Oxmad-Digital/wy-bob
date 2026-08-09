export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import PromoCode from "@/app/models/PromoCode";
import User from "@/app/models/User";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const codes = await PromoCode.find({ isReferral: true })
      .populate("referrerId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, codes });
  } catch (error) {
    console.error("ADMIN REFERRAL CODES GET ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
