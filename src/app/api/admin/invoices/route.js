export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Invoice from "@/app/models/Invoice";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const year   = searchParams.get("year") || "";
    const page   = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit  = Math.min(100, parseInt(searchParams.get("limit")) || 25);

    const filter = {};
    if (year) filter.year = Number(year);
    if (search) {
      const numSearch = parseInt(search, 10);
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "customer.firstname": { $regex: search, $options: "i" } },
        { "customer.lastname": { $regex: search, $options: "i" } },
        { "customer.email": { $regex: search, $options: "i" } },
        ...(!isNaN(numSearch) ? [{ orderNumber: numSearch }] : []),
      ];
    }

    const skip = (page - 1) * limit;

    const [invoices, total, totalAll, sumAgg] = await Promise.all([
      Invoice.find(filter).select("-pdfBase64").sort({ issuedAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
      Invoice.countDocuments(),
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: "$totalTtc" } } }]),
    ]);

    return NextResponse.json({
      invoices,
      pagination: { total, totalPages: Math.ceil(total / limit), page, limit },
      stats: { total: totalAll, totalAmount: sumAgg[0]?.total || 0 },
    });
  } catch (error) {
    console.error("ADMIN INVOICES ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
