import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listAccountOrders } from "@/app/lib/repos/orders";
import { findFirstAddressByEmail } from "@/app/lib/repos/users";
import DashboardOverviewClient from "./components/DashboardOverviewClient";
import "./dashboard.css";

export default async function DashboardOverview() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const allOrders: any[] = await listAccountOrders(
    { userId: session.user.id, email: session.user.email.toLowerCase() },
    { populate: false }
  );

  const address = await findFirstAddressByEmail(session.user.email);

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
