export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/require-admin";
import { connectDB } from "@/app/lib/db";
import Order    from "@/app/models/Order";
import Customer from "@/app/models/Customer";
import Product  from "@/app/models/Product";

// Cache in-memory par période, TTL 5 minutes
const statsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request) {
  // Avant toute requête en base (et avant le cache) : la route renvoyait les stats à tout le monde.
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const period  = searchParams.get("period") || "7";
    const daysAgo = parseInt(period);

    // Retourne le cache si encore frais
    const cacheKey = `stats:${daysAgo}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - daysAgo);
    periodStart.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - daysAgo);

    const [
      customersCount,
      newCustomers,
      ordersCount,
      periodOrdersCount,
      todayOrders,
      cancelledOrders,
      pendingOrders,
      returningCustomers,
      dormantCustomers,
      lowStockProducts,
      outOfStockProducts,
      stockValueAgg,
      totalRevenueAgg,
      periodRevenueAgg,
      prevPeriodRevenueAgg,
      salesEvolutionAgg,
      topProductsAgg,
      ordersByStatusAgg,
      paymentAgg,
      topCustomersAgg,
      recentOrders,
    ] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ createdAt: { $gte: periodStart } }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: periodStart } }),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ status: "cancelled" }),
      Order.countDocuments({ status: "pending" }),
      Customer.countDocuments({ totalOrders: { $gt: 1 } }),
      Customer.countDocuments({ lastOrderAt: { $ne: null, $lt: thirtyDaysAgo }, status: "active" }),
      Product.countDocuments({ stock: { $gt: 0, $lte: 3 } }),
      Product.countDocuments({ stock: 0 }),
      Product.aggregate([{ $group: { _id: null, total: { $sum: { $multiply: ["$stock", "$price"] } } } }]),

      Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: periodStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: prevPeriodStart, $lt: periodStart } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),

      Order.aggregate([
        { $match: { createdAt: { $gte: periodStart } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            revenue: { $sum: "$total" },
            orders:  { $sum: 1 },
          },
        },
        { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      ]),

      Order.aggregate([
        { $unwind: "$products" },
        { $group: { _id: "$products.product", totalQuantity: { $sum: "$products.quantity" } } },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $project: { name: "$p.name", quantity: "$totalQuantity" } },
      ]),

      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $group: { _id: { $ifNull: ["$payment", "cash"] }, count: { $sum: 1 } } },
      ]),

      Order.aggregate([
        {
          $group: {
            _id: "$customer.email",
            firstname:   { $first: "$customer.firstname" },
            lastname:    { $first: "$customer.lastname" },
            totalSpent:  { $sum: "$total" },
            totalOrders: { $sum: 1 },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, firstname: 1, lastname: 1, totalSpent: 1, totalOrders: 1 } },
      ]),

      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("customer.firstname customer.lastname total status createdAt")
        .lean(),
    ]);

    const stockValue        = stockValueAgg[0]?.total         || 0;
    const totalRevenue      = totalRevenueAgg[0]?.total      || 0;
    const periodRevenue     = periodRevenueAgg[0]?.total     || 0;
    const prevPeriodRevenue = prevPeriodRevenueAgg[0]?.total || 0;
    const averageBasket     = ordersCount > 0 ? (totalRevenue / ordersCount).toFixed(2) : 0;
    const cancellationRate  = ordersCount > 0 ? ((cancelledOrders / ordersCount) * 100).toFixed(1) : 0;
    const loyaltyRate       = customersCount > 0 ? ((returningCustomers / customersCount) * 100).toFixed(1) : 0;
    const revenueGrowth     = prevPeriodRevenue > 0
      ? (((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100).toFixed(1)
      : null;

    const evoMap = {};
    salesEvolutionAgg.forEach(({ _id, revenue, orders }) => {
      const key = `${_id.y}-${String(_id.m).padStart(2, "0")}-${String(_id.d).padStart(2, "0")}`;
      evoMap[key] = { revenue, orders };
    });
    const salesEvolution = [];
    for (let i = daysAgo - 1; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      salesEvolution.push({
        date:    day.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        revenue: evoMap[key]?.revenue || 0,
        orders:  evoMap[key]?.orders  || 0,
      });
    }

    const PAYMENT_LABELS = {
      cash:          "Espèces",
      mobile_money:  "Mobile Money",
      card:          "Carte",
      bank_transfer: "Virement",
    };

    const statusDistribution = ordersByStatusAgg.map((item) => ({
      name: item._id, value: item.count,
    }));

    const paymentDistribution = paymentAgg.map((item) => ({
      name:  item._id || "cash",
      label: PAYMENT_LABELS[item._id] || item._id || "Espèces",
      value: item.count,
    }));

    const responseData = {
      success: true,
      stats: {
        customersCount,
        newCustomers,
        ordersCount,
        periodOrders:     periodOrdersCount,
        totalRevenue:     totalRevenue.toFixed(2),
        periodRevenue:    periodRevenue.toFixed(2),
        prevPeriodRevenue: prevPeriodRevenue.toFixed(2),
        revenueGrowth,
        averageBasket,
        todayOrders,
        lowStockProducts,
        outOfStockProducts,
        pendingOrders,
        cancelledOrders,
        cancellationRate,
        returningCustomers,
        loyaltyRate,
        dormantCustomers,
        stockValue,
        neverSoldProducts: 0,
      },
      salesEvolution,
      topProducts:        topProductsAgg,
      topCustomers:       topCustomersAgg,
      recentOrders,
      statusDistribution,
      paymentDistribution,
    };

    statsCache.set(cacheKey, { data: responseData, ts: Date.now() });
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur stats", error: error.message },
      { status: 500 }
    );
  }
}