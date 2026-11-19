import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listAccountOrders } from "@/app/lib/repos/orders";
import { listInvoicedOrderIds } from "@/app/lib/repos/invoices";
import OrdersListClient from "./OrdersListClient";

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const raw: any[] = await listAccountOrders(
    { userId: session.user.id, email: session.user.email.toLowerCase() },
    { populate: true }
  );

  const invoicedOrderIds: Set<string> = await listInvoicedOrderIds(raw.map((o) => o._id));

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
