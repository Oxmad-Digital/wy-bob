"use client";

import { useEffect, useState } from "react";
import styles from '../dashboard.module.css';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#F9C464", "#1B1843", "#78716c", "#c4b5a5", "#e7e5e4"];

const STATUS_LABELS = {
  pending:    "En attente",
  processing: "En traitement",
  paid:       "Payée",
  shipped:    "Expédiée",
  delivered:  "Livrée",
  cancelled:  "Annulée",
};

const font = "'DM Sans', sans-serif";

const N = {
  border:      "#ebebea",
  borderLight: "#f2f2f0",
  bg:          "#ffffff",
  bgMuted:     "#f7f7f5",
  text:        "#1B1843",
  muted:       "#9b9b9b",
  mutedLight:  "#c4c4c4",
  radius:      "12px",
  radiusSm:    "8px",
  shadow:      "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:    "0 2px 8px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)",
};

const card = {
  background: N.bg,
  border: `1px solid ${N.border}`,
  borderRadius: N.radius,
  boxShadow: N.shadow,
};

const thStyle = {
  padding: "8px 16px",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: N.muted,
  fontFamily: font,
  borderBottom: `1px solid ${N.border}`,
  background: "#fafaf9",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 16px",
  fontSize: "13px",
  color: N.text,
  fontFamily: font,
  fontWeight: "500",
};

const KPI_DEFS = [
  { key: "clients",      label: "Clients total",  icon: "👥", accent: "#F9C464",  accentBg: "#fffbef" },
  { key: "commandes",    label: "Commandes",       icon: "📦", accent: "#1B1843",  accentBg: "#eef0f8" },
  { key: "ca",           label: "CA période",      icon: "💶", accent: "#10b981",  accentBg: "#f0fdf4" },
  { key: "panier",       label: "Panier moyen",    icon: "🛒", accent: "#8b5cf6",  accentBg: "#faf5ff" },
];

const KPI2_DEFS = [
  { key: "annul",        label: "Taux d'annulation", icon: "↩", accent: "#ef4444", accentBg: "#fff5f5" },
  { key: "fidelite",     label: "Fidélisation",       icon: "♻", accent: "#3b82f6", accentBg: "#eff6ff" },
  { key: "dormants",     label: "Clients dormants",   icon: "💤", accent: "#f59e0b", accentBg: "#fffbf0" },
  { key: "stock",        label: "Valeur du stock",    icon: "🏷", accent: "#6366f1", accentBg: "#eef2ff" },
];

export default function DashboardStats() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(false);
  const [period, setPeriod] = useState("7");

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/stats?period=${period}`)
      .then(async (res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [period]);

  if (error) return (
    <div style={{ padding: "12px 16px", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: N.radiusSm, color: "#b91c1c", fontSize: "13px", fontFamily: font }}>
      Erreur lors du chargement des statistiques
    </div>
  );

  if (!data) return (
    <div style={{ padding: "60px 0", textAlign: "center", color: N.muted, fontSize: "13px", fontFamily: font }}>
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
      Chargement des statistiques…
    </div>
  );

  const { stats, salesEvolution, topProducts, topCustomers, recentOrders, paymentDistribution } = data;
  const growth = stats.revenueGrowth !== null ? parseFloat(stats.revenueGrowth) : null;

  const kpi1Values = [
    {
      ...KPI_DEFS[0],
      value: stats.customersCount ?? 0,
      sub: `+${stats.newCustomers ?? 0} nouveaux`,
    },
    {
      ...KPI_DEFS[1],
      value: stats.ordersCount ?? 0,
      sub: `${stats.periodOrders ?? 0} sur la période`,
    },
    {
      ...KPI_DEFS[2],
      value: `${parseFloat(stats.periodRevenue || 0).toLocaleString("fr-FR")} €`,
      trend: growth,
      sub: `Total : ${parseFloat(stats.totalRevenue || 0).toLocaleString("fr-FR")} €`,
    },
    {
      ...KPI_DEFS[3],
      value: `${parseFloat(stats.averageBasket || 0).toLocaleString("fr-FR")} €`,
      sub: `${stats.todayOrders ?? 0} cmd aujourd'hui`,
    },
  ];

  const kpi2Values = [
    { ...KPI2_DEFS[0], value: `${stats.cancellationRate ?? 0}%`,  sub: `${stats.cancelledOrders ?? 0} commandes annulées` },
    { ...KPI2_DEFS[1], value: `${stats.loyaltyRate ?? 0}%`,        sub: `${stats.returningCustomers ?? 0} clients récurrents` },
    { ...KPI2_DEFS[2], value: stats.dormantCustomers ?? 0,          sub: "sans achat depuis 30 j" },
    { ...KPI2_DEFS[3], value: `${(stats.stockValue ?? 0).toLocaleString("fr-FR")} €`, sub: "stock × prix catalogue" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: font }}>

      {/* ── Header row ── */}
      <div className={styles.headerRow}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: "600", color: N.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>
            Vue d'ensemble
          </div>
          <div style={{ fontSize: "13px", color: N.muted }}>
            Métriques sur la période sélectionnée
          </div>
        </div>
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </div>

      {/* ── KPI Row 1 ── */}
      <div className={styles.kpiGrid}>
        {kpi1Values.map(({ key, ...kpi }) => (
          <KPICard key={key} {...kpi} large />
        ))}
      </div>

      {/* ── KPI Row 2 ── */}
      <div className={styles.kpiGrid}>
        {kpi2Values.map(({ key, ...kpi }) => (
          <KPICard key={key} {...kpi} />
        ))}
      </div>

      {/* ── Alertes ── */}
      {stats.outOfStockProducts > 0 && (
        <a href="/admin/products" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 18px", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: N.radiusSm, cursor: "pointer" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", flexShrink: 0, animation: "pulse 1.4s ease-in-out infinite" }} />
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#b91c1c", fontFamily: font }}>
              {stats.outOfStockProducts} produit{stats.outOfStockProducts > 1 ? "s" : ""} en rupture de stock
            </span>
            <span style={{ fontSize: "12px", color: "#ef4444", marginLeft: "auto", fontFamily: font }}>Gérer →</span>
          </div>
        </a>
      )}
      {(stats.lowStockProducts > 0 || stats.pendingOrders > 0 || stats.neverSoldProducts > 0) && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {stats.lowStockProducts  > 0 && <Alert type="warning" message={`${stats.lowStockProducts} produit(s) en stock faible (≤ 3)`} />}
          {stats.pendingOrders     > 0 && <Alert type="info"    message={`${stats.pendingOrders} commande(s) en attente de traitement`} />}
          {stats.neverSoldProducts > 0 && <Alert type="neutral" message={`${stats.neverSoldProducts} produit(s) jamais vendus`} />}
        </div>
      )}

      {/* ── Charts : évolution + modes de paiement ── */}
      <div className={styles.chartsGrid}>

        <div style={{ ...card, padding: "18px 22px" }}>
          <SectionHeader label="Évolution des ventes" />
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={salesEvolution} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F9C464" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#F9C464" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1B1843" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#1B1843" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={N.borderLight} vertical={false} />
              <XAxis dataKey="date" fontSize={10} tick={{ fill: N.muted, fontFamily: font }} tickLine={false} axisLine={false} />
              <YAxis fontSize={10} tick={{ fill: N.muted, fontFamily: font }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: N.bg, border: `1px solid ${N.border}`, borderRadius: "8px", fontSize: "12px", fontFamily: font, boxShadow: N.shadowMd }}
                cursor={{ stroke: N.border, strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#F9C464" strokeWidth={2} fill="url(#gradRevenue)" name="CA (€)" dot={false} />
              <Area type="monotone" dataKey="orders"  stroke="#1B1843"  strokeWidth={2} fill="url(#gradOrders)"  name="Commandes" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
            <Legend color="#F9C464" label="CA (€)" />
            <Legend color="#1B1843"  label="Commandes" />
          </div>
        </div>

        <div style={{ ...card, padding: "18px 22px" }}>
          <SectionHeader label="Modes de paiement" />
          {paymentDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    cx="50%" cy="50%"
                    outerRadius={52} innerRadius={28}
                    dataKey="value" paddingAngle={3} nameKey="label"
                    strokeWidth={0}
                  >
                    {paymentDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: N.bg, border: `1px solid ${N.border}`, borderRadius: "8px", fontSize: "12px", fontFamily: font, boxShadow: N.shadowMd }}
                    formatter={(v, _, props) => [v, props.payload.label || props.payload.name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "8px" }}>
                {paymentDistribution.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: N.text, fontWeight: "500" }}>{item.label}</span>
                    </div>
                    <span style={{ color: N.muted, fontWeight: "600" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: "40px 0", textAlign: "center", color: N.muted, fontSize: "12px" }}>Aucune donnée</div>
          )}
        </div>

      </div>

      {/* ── Dernières commandes + Top clients ── */}
      <div className={styles.tablesGrid}>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${N.border}` }}>
            <SectionHeader label="Dernières commandes" noMargin />
            <a href="/admin/orders" style={{ fontSize: "11px", color: "#F9C464", fontWeight: "600", textDecoration: "none", fontFamily: font }}>Voir tout →</a>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Montant</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle} className={styles.dateCol}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order, i) => (
                <tr key={order._id || i} style={{ borderTop: `1px solid ${N.borderLight}` }}>
                  <td style={tdStyle}>{order.customer.firstname} {order.customer.lastname}</td>
                  <td style={{ ...tdStyle, fontWeight: "700", whiteSpace: "nowrap" }}>{parseFloat(order.total).toLocaleString("fr-FR")} €</td>
                  <td style={tdStyle}><StatusBadge status={order.status} /></td>
                  <td style={{ ...tdStyle, color: N.muted, fontSize: "11px", whiteSpace: "nowrap" }} className={styles.dateCol}>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${N.border}` }}>
            <SectionHeader label="Top 5 clients" noMargin />
            <a href="/admin/customers" style={{ fontSize: "11px", color: "#F9C464", fontWeight: "600", textDecoration: "none", fontFamily: font }}>Voir tout →</a>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["#", "Client", "Cmd", "Total"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {topCustomers.length === 0 ? (
                <tr><td colSpan={4} style={{ ...tdStyle, color: N.muted, textAlign: "center", padding: "24px" }}>Aucune donnée</td></tr>
              ) : topCustomers.map((c, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${N.borderLight}` }}>
                  <td style={{ ...tdStyle, color: N.mutedLight, fontSize: "11px", width: "28px", paddingRight: 0 }}>#{i + 1}</td>
                  <td style={{ ...tdStyle, paddingLeft: "8px" }}>{c.firstname} {c.lastname}</td>
                  <td style={{ ...tdStyle, color: N.muted, textAlign: "center" }}>{c.totalOrders}</td>
                  <td style={{ ...tdStyle, fontWeight: "700", whiteSpace: "nowrap" }}>{parseFloat(c.totalSpent).toLocaleString("fr-FR")} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

/* ── Sous-composants ── */

function PeriodSelector({ period, setPeriod }) {
  return (
    <div style={{ display: "inline-flex", gap: "2px", background: N.bgMuted, borderRadius: "8px", padding: "3px", border: `1px solid ${N.border}` }}>
      {[
        { label: "Auj.",  value: "1"   },
        { label: "7 j.",  value: "7"   },
        { label: "30 j.", value: "30"  },
        { label: "Année", value: "365" },
      ].map((p) => (
        <button key={p.value} onClick={() => setPeriod(p.value)} style={{
          padding: "5px 14px", borderRadius: "6px", border: "none",
          background: period === p.value ? N.bg    : "transparent",
          color:      period === p.value ? N.text  : N.muted,
          fontWeight: period === p.value ? "600"   : "400",
          boxShadow:  period === p.value ? N.shadow : "none",
          cursor: "pointer", fontSize: "12px", fontFamily: font,
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function KPICard({ label, value, sub, trend, accentColor, accentBg, icon, large }) {
  return (
    <div style={{ ...card, padding: large ? "16px 20px" : "13px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: large ? "12px" : "10px" }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "8px",
          background: accentBg || "#f5f5f4",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "15px", flexShrink: 0,
        }}>
          {icon}
        </div>
        {trend !== undefined && trend !== null && <TrendChip value={trend} />}
      </div>
      <div style={{ fontSize: large ? "22px" : "18px", fontWeight: "700", color: N.text, lineHeight: 1.1, marginBottom: "4px", fontFamily: font }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", fontWeight: "600", color: N.text, fontFamily: font, marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontSize: "11px", color: N.muted, fontFamily: font }}>
        {sub}
      </div>
    </div>
  );
}

function SectionHeader({ label, noMargin }) {
  return (
    <div style={{ fontSize: "12px", fontWeight: "700", color: N.text, fontFamily: font, letterSpacing: "-0.01em", marginBottom: noMargin ? 0 : "14px" }}>
      {label}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: N.muted, fontFamily: font }}>
      <span style={{ width: "20px", height: "2px", background: color, borderRadius: "2px", flexShrink: 0 }} />
      {label}
    </div>
  );
}

function TrendChip({ value }) {
  const up = value >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "2px",
      padding: "2px 7px",
      background: up ? "#f0fdf4" : "#fff5f5",
      color: up ? "#166534" : "#b91c1c",
      borderRadius: "6px", fontSize: "11px", fontWeight: "600", fontFamily: font,
    }}>
      {up ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

function Alert({ type, message }) {
  const s = {
    warning: { bg: "#fffbf0", border: "#eddcb0", text: "#7c5200", dot: "#f59e0b" },
    info:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a5f", dot: "#3b82f6" },
    neutral: { bg: N.bgMuted, border: N.border,   text: N.muted,   dot: "#c4b5a5" },
  }[type] || {};
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "9px 14px",
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "8px", color: s.text,
      fontSize: "12px", fontWeight: "500", fontFamily: font, flex: 1,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {message}
    </div>
  );
}

function StatusBadge({ status }) {
  const c = {
    pending:    { bg: "#fffbf0", text: "#7c5200",  border: "#eddcb0" },
    processing: { bg: "#faf5ff", text: "#5b21b6",  border: "#ddd6fe" },
    paid:       { bg: "#f0fdf4", text: "#166534",  border: "#bbf7d0" },
    shipped:    { bg: "#ecfeff", text: "#155e75",  border: "#a5f3fc" },
    delivered:  { bg: "#f0fdf4", text: "#166534",  border: "#bbf7d0" },
    cancelled:  { bg: "#fff5f5", text: "#b91c1c",  border: "#fecaca" },
  }[status] || { bg: N.bgMuted, text: N.muted, border: N.border };
  return (
    <span style={{
      padding: "2px 9px",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: "6px", fontSize: "11px", fontWeight: "600",
      fontFamily: font, display: "inline-block", letterSpacing: "0.01em",
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
