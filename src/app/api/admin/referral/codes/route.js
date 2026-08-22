export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import PromoCode from "@/app/models/PromoCode";
import User from "@/app/models/User";
import Customer from "@/app/models/Customer";

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

    // La fiche CRM (Customer) porte le nom à jour du client ; le champ
    // User.name peut être un pseudo obsolète saisi à l'inscription. On
    // harmonise avec le nom affiché dans /admin/customers.
    const emails = codes.map((c) => c.referrerId?.email).filter(Boolean);
    if (emails.length > 0) {
      const customers = await Customer.find(
        { email: { $in: emails } },
        "email firstname lastname"
      ).lean();
      const customerByEmail = new Map(customers.map((c) => [c.email, c]));

      for (const c of codes) {
        const customer = c.referrerId && customerByEmail.get(c.referrerId.email);
        const fullName = customer
          ? `${customer.firstname || ""} ${customer.lastname || ""}`.trim()
          : "";
        if (fullName) c.referrerId.name = fullName;
      }
    }

    return NextResponse.json({ success: true, codes });
  } catch (error) {
    console.error("ADMIN REFERRAL CODES GET ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
