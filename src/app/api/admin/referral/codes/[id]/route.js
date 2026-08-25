export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import PromoCode from "@/app/models/PromoCode";

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    await connectDB();

    const code = await PromoCode.findOneAndDelete({ _id: id, isReferral: true });
    if (!code) {
      return NextResponse.json({ message: "Code de parrainage introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ADMIN REFERRAL CODE DELETE ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
