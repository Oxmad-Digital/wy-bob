"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

type Order = {
  _id: string;
  status: string;
  createdAt: string;
  total: number;
  products?: { quantity?: number }[];
};

type Address = {
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
} | null;

type Props = {
  totalOrders: number;
  totalSpent: number;
  pendingCount: number;
  recentOrders: Order[];
  address: Address;
};

export default function DashboardOverviewClient({
  totalOrders,
  totalSpent,
  pendingCount,
  recentOrders,
  address,
}: Props) {
  const { t, locale } = useLanguage();
  const o = t.dashboard.overview;
  const statuses = t.dashboard.orders.statuses;

  const STATUS_BADGE: Record<string, string> = {
    pending:    "db-badge db-badge-pending",
    processing: "db-badge db-badge-processing",
    paid:       "db-badge db-badge-paid",
    shipped:    "db-badge db-badge-shipped",
    delivered:  "db-badge db-badge-delivered",
    cancelled:  "db-badge db-badge-cancelled",
  };

  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  return (
    <div>
      <h1 className="db-page-title">{o.title}</h1>

      <div className="db-kpis">
        <div className="db-kpi-card">
          <span className="db-kpi-label">{o.kpiOrders}</span>
          <span className="db-kpi-value">{totalOrders}</span>
          <span className="db-kpi-sub">{o.kpiTotalSub}</span>
        </div>
        <div className="db-kpi-card">
          <span className="db-kpi-label">{o.kpiTotal}</span>
          <span className="db-kpi-value">{totalSpent.toLocaleString(dateLocale)} €</span>
          <span className="db-kpi-sub">{o.kpiAllOrders}</span>
        </div>
        <div className="db-kpi-card">
          <span className="db-kpi-label">{o.kpiActive}</span>
          <span className="db-kpi-value">{pendingCount}</span>
          <span className="db-kpi-sub">
            {pendingCount <= 1 ? o.activeOrder : o.activeOrders}
          </span>
        </div>
      </div>

      <div className="db-wrapper">

        {/* Recent orders */}
        <div className="db-card db-summary-card">
          <div className="db-summary-header">
            <p className="db-section-title" style={{ margin: 0 }}>{o.recentOrders}</p>
            {totalOrders > 0 && (
              <Link href="/dashboard/orders" className="db-summary-link">{o.seeAll}</Link>
            )}
          </div>

          {recentOrders.length === 0 ? (
            <div className="db-summary-empty">
              <p>{o.noOrders}</p>
              <Link href="/" className="db-add-address" style={{ marginTop: 12 }}>
                {o.discover}
              </Link>
            </div>
          ) : (
            <div className="db-recent-orders">
              {recentOrders.map((order) => {
                const badgeClass = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
                const statusLabel = statuses[order.status as keyof typeof statuses] ?? order.status;
                const articleCount = order.products?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
                return (
                  <div key={order._id} className="db-recent-order-row">
                    <span className="db-order-num">
                      #{order._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="db-recent-order-date">
                      {new Date(order.createdAt).toLocaleDateString(dateLocale)}
                    </span>
                    <span className="db-recent-order-items">
                      {articleCount} {articleCount > 1 ? o.articles : o.article}
                    </span>
                    <span className={badgeClass}>{statusLabel}</span>
                    <span className="db-recent-order-total">
                      {Number(order.total).toLocaleString(dateLocale)} €
                    </span>
                  </div>
                );
              })}
              {totalOrders > 3 && (
                <Link href="/dashboard/orders" className="db-summary-more">
                  + {totalOrders - 3} {o.moreOrders}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Address */}
        <div className="db-card db-summary-card">
          <div className="db-summary-header">
            <p className="db-section-title" style={{ margin: 0 }}>{o.myAddress}</p>
            <Link href="/dashboard/addresses" className="db-summary-link">{o.manage}</Link>
          </div>

          {!address?.street ? (
            <div className="db-summary-empty">
              <p>{o.noAddress}</p>
              <Link href="/dashboard/addresses" className="db-add-address" style={{ marginTop: 12 }}>
                {o.addAddress}
              </Link>
            </div>
          ) : (
            <div className="db-summary-addresses">
              <div className="db-summary-address-chip">
                <span className="db-summary-address-label">{o.delivery}</span>
                <span className="db-summary-address-text">
                  {address.street}, {address.zip} {address.city}
                  {address.country ? `, ${address.country}` : ""}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
