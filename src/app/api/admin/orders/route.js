export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import Product from "@/app/models/Product";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search    = searchParams.get("search") || "";
    const status    = searchParams.get("status") || "";
    const sortField = searchParams.get("sort")   || "createdAt";
    const sortDir   = searchParams.get("order")  || "desc";
    const page      = Math.max(1, parseInt(searchParams.get("page"))  || 1);
    const limit     = Math.min(100, parseInt(searchParams.get("limit")) || 25);

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const numSearch = parseInt(search, 10);
      filter.$or = [
        { "customer.firstname": { $regex: search, $options: "i" } },
        { "customer.lastname":  { $regex: search, $options: "i" } },
        { "customer.email":     { $regex: search, $options: "i" } },
        { "customer.city":      { $regex: search, $options: "i" } },
        { "customer.phone":     { $regex: search, $options: "i" } },
        ...(!isNaN(numSearch) ? [{ orderNumber: numSearch }] : []),
      ];
    }

    const sortObj = { [sortField]: sortDir === "asc" ? 1 : -1 };
    const skip    = (page - 1) * limit;

    const [orders, total, statsAgg, totalAll] = await Promise.all([
      Order.find(filter).populate("products.product").sort(sortObj).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.countDocuments(),
    ]);

    const stats = { total: totalAll, pending: 0, processing: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 };
    statsAgg.forEach(s => { if (s._id in stats) stats[s._id] = s.count; });

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