export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/require-admin";
import { getAdminStatsAggregates } from "@/app/lib/repos/stats";

// Cache in-memory par période, TTL 5 minutes
const statsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request) {
  // Avant toute requête en base (et avant le cache) : la route renvoyait les stats à tout le monde.
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  try {
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

    const {
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
      stockValue,
      totalRevenue,
      periodRevenue,
      prevPeriodRevenue,
      salesEvolution: salesEvolutionRows,
      topProducts,
      ordersByStatus,
      payments,
      topCustomers,
      recentOrders,
    } = await getAdminStatsAggregates({ periodStart, prevPeriodStart, today, thirtyDaysAgo });

    const averageBasket     = ordersCount > 0 ? (totalRevenue / ordersCount).toFixed(2) : 0;
    const cancellationRate  = ordersCount > 0 ? ((cancelledOrders / ordersCount) * 100).toFixed(1) : 0;
    const loyaltyRate       = customersCount > 0 ? ((returningCustomers / customersCount) * 100).toFixed(1) : 0;
    const revenueGrowth     = prevPeriodRevenue > 0
      ? (((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100).toFixed(1)
      : null;

    const evoMap = {};
    salesEvolutionRows.forEach(({ day, revenue, orders }) => {
      evoMap[day] = { revenue, orders };
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

    const statusDistribution = ordersByStatus.map((item) => ({
      name: item.status, value: item.count,
    }));

    const paymentDistribution = payments.map((item) => ({
      name:  item.payment || "cash",
      label: PAYMENT_LABELS[item.payment] || item.payment || "Espèces",
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
      topProducts,
      topCustomers,
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