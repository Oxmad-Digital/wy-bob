export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAdminOrders } from "@/app/lib/repos/orders";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search    = searchParams.get("search") || "";
    const status    = searchParams.get("status") || "";
    const sortField = searchParams.get("sort")   || "createdAt";
    const sortDir   = searchParams.get("order")  || "desc";
    const page      = Math.max(1, parseInt(searchParams.get("page"))  || 1);
    // Plancher à 1 : une limite négative passait avec Mongo mais fait échouer un LIMIT SQL.
    const limit     = Math.max(1, Math.min(100, parseInt(searchParams.get("limit")) || 25));

    const { orders, total, countsByStatus, totalAll } = await listAdminOrders({
      search, status, sortField, sortDir, page, limit,
    });

    const stats = { total: totalAll, pending: 0, processing: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 };
    countsByStatus.forEach(s => { if (s.status in stats) stats[s.status] = s.count; });

    return NextResponse.json({
      orders,
      pagination: { total, totalPages: Math.ceil(total / limit), page, limit },
      stats,
    });
  } catch (error) {
    console.error("ADMIN ORDERS ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
