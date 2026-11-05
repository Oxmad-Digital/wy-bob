export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listInvoices } from "@/app/lib/repos/invoices";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const year   = searchParams.get("year") || "";
    const page   = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit  = Math.min(100, parseInt(searchParams.get("limit")) || 25);

    // Recherche : sous-chaîne insensible à la casse (ILIKE) sur le numéro de facture, le
    // prénom, le nom et l'email, ou numéro de commande exact — comme l'ancien $regex.
    const { invoices, total, totalAll, totalAmount } = await listInvoices({ search, year, page, limit });

    return NextResponse.json({
      invoices,
      pagination: { total, totalPages: Math.ceil(total / limit), page, limit },
      stats: { total: totalAll, totalAmount: totalAmount || 0 },
    });
  } catch (error) {
    console.error("ADMIN INVOICES ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
