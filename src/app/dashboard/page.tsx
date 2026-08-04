import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import User from "@/app/models/User";
import DashboardOverviewClient from "./components/DashboardOverviewClient";
import "./dashboard.css";

export default async function DashboardOverview() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  await connectDB();

  const allOrders = await Order.find({
    $or: [
      { userId: session.user.id },
      { "customer.email": session.user.email.toLowerCase() },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  const user = await User.findOne({ email: session.user.email }).lean() as any;
  const address = user?.addresses?.[0] || null;

  const totalOrders = allOrders.length;
  const totalSpent = allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const pendingCount = allOrders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  ).length;

  const recentOrders = allOrders.slice(0, 3).map((o: any) => ({
    _id: o._id.toString(),
    status: o.status,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    total: Number(o.total) || 0,
    products: (o.products ?? []).map((p: any) => ({ quantity: p.quantity })),
  }));

  const safeAddress = address ? {
    street: address.street ?? "",
    zip: address.zip ?? "",
    city: address.city ?? "",
    country: address.country ?? "",
  } : null;

  return (
    <DashboardOverviewClient
      totalOrders={totalOrders}
      totalSpent={totalSpent}
      pendingCount={pendingCount}
      recentOrders={recentOrders}
      address={safeAddress}
    />
  );
}
