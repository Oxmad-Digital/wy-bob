"use client";

import { useLanguage } from "@/contexts/LanguageContext";

type Product = { name?: string | null; image?: string | null; quantity?: number };
type Order = {
  _id: string;
  status: string;
  createdAt: string;
  total: number;
  delivery?: string;
  payment?: string;
  products?: Product[];
  customer?: { address?: string; city?: string };
};

const STEP_KEYS = ["pending", "paid", "processing", "shipped", "delivered"] as const;

export default function OrdersListClient({ orders }: { orders: Order[] }) {
  const { t, locale } = useLanguage();
  const o = t.dashboard.orders;
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  const STATUS_BADGE: Record<string, string> = {
    pending:    "db-badge db-badge-pending",
    processing: "db-badge db-badge-processing",
    paid:       "db-badge db-badge-paid",
    shipped:    "db-badge db-badge-shipped",
    delivered:  "db-badge db-badge-delivered",
    cancelled:  "db-badge db-badge-cancelled",
  };

  return (
    <div>
      <h1 className="db-page-title">{o.title}</h1>
      <div className="db-wrapper">

        {orders.length === 0 ? (
          <div className="db-card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <p style={{ fontSize: 14, color: "#888", margin: 0 }}>{o.noOrders}</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const cancelled = order.status === "cancelled";
              const currentIdx = STEP_KEYS.indexOf(order.status as typeof STEP_KEYS[number]);
              const articleCount = order.products?.reduce(
                (s, p) => s + (Number(p.quantity) || 1), 0
              ) ?? 0;

              const timelineLabels = [
                o.timeline.pending,
                o.timeline.paid,
                o.timeline.processing,
                o.timeline.shipped,
                o.timeline.delivered,
              ];

              return (
                <div key={order._id} className="order-card">

                  <div className="order-card-header">
                    <div>
                      <span className="order-card-id">
                        #{order._id.slice(-8).toUpperCase()}
                      </span>
                      <span className="order-card-date">
                        {new Date(order.createdAt).toLocaleDateString(dateLocale, {
                          day: "2-digit", month: "long", year: "numeric",
                        })}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1B1843" }}>
                        {Number(order.total).toLocaleString(dateLocale)} €
                      </span>
                      <span className={STATUS_BADGE[order.status] ?? "db-badge db-badge-pending"}>
                        {o.statuses[order.status as keyof typeof o.statuses] ?? order.status}
                      </span>
                    </div>
                  </div>

                  <div className="order-card-body">

                    {cancelled ? (
                      <div className="order-cancelled-banner">{o.cancelled}</div>
                    ) : (
                      <div className="order-timeline">
                        {STEP_KEYS.map((key, i) => {
                          const done   = currentIdx >= i;
                          const active = currentIdx === i;
                          return (
                            <div key={key} className="timeline-step">
                              <div
                                className={`timeline-dot ${done ? "" : "timeline-dot-inactive"}`}
                                style={done ? { background: active ? "#F9C464" : "#1B1843" } : {}}
                              >
                                {done ? "✓" : ""}
                              </div>
                              {i < STEP_KEYS.length - 1 && (
                                <div
                                  className="timeline-line"
                                  style={{ background: currentIdx > i ? "#1B1843" : "#e5e7eb" }}
                                />
                              )}
                              <span
                                className="timeline-label"
                                style={{
                                  color: done ? "#1B1843" : "#aaa",
                                  fontWeight: active ? 600 : 400,
                                }}
                              >
                                {timelineLabels[i]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {order.products && order.products.length > 0 && (
                      <div className="order-products">
                        {order.products.map((p, i) => (
                          <div key={i} className="order-product">
                            {p.image
                              ? <img src={p.image} alt={p.name ?? ""} className="order-product-image" />
                              : <div className="order-product-image order-product-image-empty" />
                            }
                            <span className="order-product-name">{p.name ?? o.productRemoved}</span>
                            <span className="order-product-qty">× {p.quantity ?? 1}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "#555", marginTop: 14 }}>
                      <span>
                        <strong>{o.delivery}</strong>{" "}
                        {order.delivery
                          ? (o.deliveryMethods[order.delivery as keyof typeof o.deliveryMethods] ?? order.delivery)
                          : "—"}
                      </span>
                      <span>
                        <strong>{o.payment}</strong>{" "}
                        {order.payment
                          ? (o.paymentMethods[order.payment as keyof typeof o.paymentMethods] ?? order.payment)
                          : "—"}
                      </span>
                      <span>
                        <strong>{o.articles}</strong> {articleCount}
                      </span>
                    </div>

                    {order.customer?.address && (
                      <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
                        <strong>{o.address}</strong>{" "}
                        {order.customer.address}, {order.customer.city}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
