import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import Invoice from "@/app/models/Invoice";
import OrdersListClient from "./OrdersListClient";

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  await connectDB();

  const raw = await Order.find({
    $or: [
      { userId: session.user.id },
      { "customer.email": session.user.email.toLowerCase() },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("products.product", "name image")
    .lean() as any[];

  const invoicedOrderIds = new Set(
    (await Invoice.find({ order: { $in: raw.map((o) => o._id) } }).select("order").lean() as any[])
      .map((inv) => inv.order.toString())
  );

  const orders = raw.map((o) => ({
    _id: o._id.toString(),
    status: o.status,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
    total: Number(o.total) || 0,
    delivery: o.delivery ?? null,
    payment: o.payment ?? null,
    hasInvoice: invoicedOrderIds.has(o._id.toString()),
    products: (o.products ?? []).map((item: any) => ({
      name: item.product?.name ?? null,
      image: item.product?.image ?? null,
      quantity: item.quantity ?? 1,
    })),
    customer: o.customer ? {
      address: o.customer.address ?? undefined,
      city: o.customer.city ?? undefined,
    } : undefined,
  }));

  return <OrdersListClient orders={orders} />;
}
