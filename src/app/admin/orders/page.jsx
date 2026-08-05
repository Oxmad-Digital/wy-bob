"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import "./orders-admin.css";
import { TOAST_DURATION } from "../_constants";

const PER_PAGE = 20;

function ExportCsvIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M8 13h2" />
      <path d="M14 13h2" />
      <path d="M8 17h2" />
      <path d="M14 17h2" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { value: "pending",    label: "En attente"     },
  { value: "paid",       label: "Payée"          },
  { value: "processing", label: "En préparation" },
  { value: "shipped",    label: "Expédiée"       },
  { value: "delivered",  label: "Livrée"         },
  { value: "cancelled",  label: "Annulée"        },
];

const PAYMENT_LABELS = {
  cash:          "Espèces",
  mobile_money:  "Mobile Money",
  card:          "Carte",
  bank_transfer: "Virement",
};

const DELIVERY_LABELS = {
  standard:  "Standard",
  express:   "Express",
  pickup:    "Retrait",
  colissimo: "Chronopost",
  relais:    "Point relais",
};

const STATUS_FILTERS = [
  { label: "Toutes",      value: ""           },
  { label: "En attente",  value: "pending"    },
  { label: "Préparation", value: "processing" },
  { label: "Expédiées",   value: "shipped"    },
  { label: "Livrées",     value: "delivered"  },
  { label: "Annulées",    value: "cancelled"  },
];

const SORT_OPTIONS = [
  { label: "Total", value: "total" },
];

const TOGGLEABLE_COLUMNS = [
  { key: "contact",  label: "Contact"      },
  { key: "location", label: "Localisation" },
  { key: "payment",  label: "Paiement"     },
  { key: "delivery", label: "Livraison"    },
  { key: "date",     label: "Date"         },
];

const COLUMNS_STORAGE_KEY = "wybob_admin_orders_columns";

function getDefaultVisibleColumns() {
  if (typeof window === "undefined") {
    return { contact: true, location: true, payment: true, delivery: true, date: true };
  }
  const w = window.innerWidth;
  if (w >= 1600) return { contact: true,  location: true, payment: true,  delivery: true,  date: true };
  if (w >= 1280) return { contact: true,  location: true, payment: false, delivery: false, date: true };
  return          { contact: false, location: true, payment: false, delivery: false, date: true };
}

function loadVisibleColumns() {
  const fallback = getDefaultVisibleColumns();
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (saved) return { ...fallback, ...JSON.parse(saved) };
  } catch {}
  return fallback;
}

export default function AdminOrdersPage() {
  const [orders, setOrders]                   = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [updatingId, setUpdatingId]           = useState(null);
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter]       = useState("");
  const [sort, setSort]                       = useState("createdAt");
  const [sortDir, setSortDir]                 = useState("desc");
  const [page, setPage]                       = useState(1);
  const [pagination, setPagination]           = useState({ total: 0, totalPages: 1 });
  const [stats, setStats]                     = useState(null);
  const [exporting, setExporting]             = useState(false);
  const [toast, setToast]                     = useState(null);
  const [confirmModal, setConfirmModal]       = useState(null);
  const [sortOpen, setSortOpen]               = useState(false);
  const [statusOpen, setStatusOpen]           = useState(false);
  const [columnsOpen, setColumnsOpen]         = useState(false);
  const [visibleColumns, setVisibleColumns]   = useState(loadVisibleColumns);
  const sortRef = useRef(null);
  const statusRef = useRef(null);
  const columnsRef = useRef(null);

  const toggleColumn = (key) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const askConfirm = (message, onConfirm, confirmLabel = "Confirmer") =>
    setConfirmModal({ message, onConfirm, confirmLabel });

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setDebouncedSearch(search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetchOrders(); }, [debouncedSearch, statusFilter, sort, sortDir, page]);

  useEffect(() => {
    const close = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
      if (columnsRef.current && !columnsRef.current.contains(e.target)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, order: sortDir, page, limit: PER_PAGE });
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter)    params.append("status", statusFilter);

      const res  = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
        setPagination(data.pagination);
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur lors du changement de statut", "error"); return; }
      setOrders(prev => prev.map(o => o._id === data._id ? data : o));
      showToast("Statut mis à jour");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteOrder = (id) => {
    askConfirm(
      "Supprimer cette commande définitivement ?",
      async () => {
        try {
          const res  = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (res.ok) {
            setOrders(prev => prev.filter(o => o._id !== id));
            showToast("Commande supprimée");
          } else {
            showToast(data.message || "Impossible de supprimer", "error");
          }
        } catch {
          showToast("Erreur serveur", "error");
        }
      },
      "Supprimer"
    );
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ sort, order: sortDir, limit: 9999 });
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter)    params.append("status", statusFilter);

      const res  = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      if (!data.orders) return;

      const headers = ["N° Commande","Prénom","Nom","Email","Téléphone","Adresse","Ville","Total (€)","Paiement","Livraison","Statut","Date"];
      const rows = data.orders.map(o => {
        const c = o.customer || {};
        return [
          o.orderNumber ? String(o.orderNumber).padStart(4, "0") : "",
          c.firstname || "", c.lastname || "", c.email || "",
          c.phone || "", c.address || "", c.city || "",
          o.total || 0,
          PAYMENT_LABELS[o.payment] || o.payment || "",
          DELIVERY_LABELS[o.delivery] || o.delivery || "",
          STATUS_OPTIONS.find(s => s.value === o.status)?.label || o.status || "",
          o.createdAt ? new Date(o.createdAt).toLocaleDateString("fr-FR") : "",
        ].join(";");
      });

      const csv  = [headers.join(";"), ...rows].join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `commandes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ap-page">

      {toast && (
        <div className={`ap-toast ${toast.type === "error" ? "ap-toast-error" : "ap-toast-success"}`}>
          {toast.message}
        </div>
      )}

      {confirmModal && (
        <div className="ap-confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className="ap-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="ap-confirm-msg">{confirmModal.message}</p>
            <div className="ap-confirm-actions">
              <button className="ap-confirm-cancel" onClick={() => setConfirmModal(null)}>Annuler</button>
              <button className="ap-confirm-ok" onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}>
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="ap-header">
        <div className="ap-topbar-title-group">
          <h1 className="ap-topbar-title">Commandes</h1>
          <p className="ap-topbar-subtitle">Suivez et gérez toutes les commandes</p>
        </div>
        <button className="ac-btn-export" onClick={exportCSV} disabled={exporting}>
          {exporting ? "Export…" : (<>Export CSV <ExportCsvIcon /></>)}
        </button>

        {/* Toolbar */}
        <div className="ap-toolbar">
        <input
          type="text"
          placeholder="Rechercher par nom, email, ville, n° commande…"
          value={search}
          onChange={e => { setSearch(e.target.value); if (page !== 1) setPage(1); }}
          className="ap-search-input"
        />

        <div className="ap-divider" />

        <div className="ap-status-wrap" ref={statusRef}>
          <button className="ap-sort-trigger" onClick={() => setStatusOpen(o => !o)}>
            {STATUS_FILTERS.find(f => f.value === statusFilter)?.label}
            <span className={`ap-sort-trigger-arrow ${statusOpen ? "open" : ""}`} aria-hidden="true">▼</span>
          </button>
          {statusOpen && (
            <ul className="ap-sort-dropdown">
              {STATUS_FILTERS.map(f => (
                <li
                  key={f.value}
                  className={`ap-sort-option ${statusFilter === f.value ? "selected" : ""}`}
                  onClick={() => { setStatusFilter(f.value); setPage(1); setStatusOpen(false); }}
                >
                  {f.label}
                  {statusFilter === f.value && <span className="ap-sort-check" aria-hidden="true">✓</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ap-divider" />

        <div className="ap-sort-wrap" ref={sortRef}>
          <button className="ap-sort-trigger" onClick={() => setSortOpen(o => !o)}>
            {SORT_OPTIONS.find(o => o.value === sort)?.label || "Trier"}
            <span className={`ap-sort-trigger-arrow ${sortOpen ? "open" : ""}`} aria-hidden="true">▼</span>
          </button>
          {sortOpen && (
            <ul className="ap-sort-dropdown">
              {SORT_OPTIONS.map(o => (
                <li
                  key={o.value}
                  className={`ap-sort-option ${sort === o.value ? "selected" : ""}`}
                  onClick={() => { setSort(o.value); setPage(1); setSortOpen(false); }}
                >
                  {o.label}
                  {sort === o.value && <span className="ap-sort-check" aria-hidden="true">✓</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} className="ap-sort-btn" aria-label={sortDir === "asc" ? "Trier par ordre décroissant" : "Trier par ordre croissant"}>
          {sortDir === "asc" ? "↑" : "↓"}
        </button>

        <div className="ap-divider" />

        <div className="ap-columns-wrap" ref={columnsRef}>
          <button className="ap-sort-trigger" onClick={() => setColumnsOpen(o => !o)}>
            Colonnes
            <span className={`ap-sort-trigger-arrow ${columnsOpen ? "open" : ""}`} aria-hidden="true">▼</span>
          </button>
          {columnsOpen && (
            <ul className="ap-sort-dropdown ap-columns-dropdown">
              {TOGGLEABLE_COLUMNS.map(col => (
                <li
                  key={col.key}
                  className="ap-column-option"
                  onClick={() => toggleColumn(col.key)}
                >
                  <span className={`ap-column-checkbox ${visibleColumns[col.key] ? "checked" : ""}`} aria-hidden="true">
                    {visibleColumns[col.key] && "✓"}
                  </span>
                  {col.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {stats && (
          <>
            <div className="ap-divider" />
            <div className="ap-stats-inline">
              <div className="ap-stat-chip">
                <span className="ap-stat-chip-value">{stats.total}</span>
                <span className="ap-stat-chip-label">Total</span>
              </div>
              <div className="ap-stat-sep" />
              <div className="ap-stat-chip warn">
                <span className="ap-stat-chip-value">{stats.pending}</span>
                <span className="ap-stat-chip-label">En attente</span>
              </div>
              <div className="ap-stat-sep" />
              <div className="ap-stat-chip ok">
                <span className="ap-stat-chip-value">{stats.delivered}</span>
                <span className="ap-stat-chip-label">Livrées</span>
              </div>
              <div className="ap-stat-sep" />
              <div className="ap-stat-chip danger">
                <span className="ap-stat-chip-value">{stats.cancelled}</span>
                <span className="ap-stat-chip-label">Annulées</span>
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Table */}
      <div className="ap-table-wrap">
        {loading ? (
          <div className="ap-state"><span className="ap-state-icon">⏳</span>Chargement…</div>
        ) : orders.length === 0 ? (
          <div className="ap-state"><span className="ap-state-icon">📭</span>Aucune commande trouvée</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Client</th>
                {visibleColumns.contact  && <th>Contact</th>}
                {visibleColumns.location && <th>Localisation</th>}
                <th>Total</th>
                {visibleColumns.payment  && <th>Paiement</th>}
                {visibleColumns.delivery && <th>Livraison</th>}
                <th>Statut</th>
                {visibleColumns.date     && <th>Date</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const c        = o.customer || {};
                const fullName = [c.firstname, c.lastname].filter(Boolean).join(" ") || c.name || "—";
                const initials = ((c.firstname?.[0] || "") + (c.lastname?.[0] || "")).toUpperCase() || "?";

                return (
                  <tr key={o._id}>
                    <td>
                      <span className="ao-order-number">
                        #{o.orderNumber ? String(o.orderNumber).padStart(4, "0") : "—"}
                      </span>
                    </td>
                    <td>
                      <div className="ao-client-cell">
                        <div className="ao-avatar">{initials}</div>
                        <span className="ao-client-name">{fullName}</span>
                      </div>
                    </td>
                    {visibleColumns.contact && (
                      <td>
                        <div className="ao-contact">
                          {c.email && <a href={`mailto:${c.email}`} className="ao-email">{c.email}</a>}
                          {c.phone && <span className="ao-phone">{c.phone}</span>}
                        </div>
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td>
                        <div className="ao-location">
                          {c.city    && <span className="ao-city">{c.city}</span>}
                          {c.address && <span className="ao-address">{c.address}</span>}
                        </div>
                      </td>
                    )}
                    <td>
                      <span className="ao-total">{(o.total || 0).toLocaleString()} €</span>
                    </td>
                    {visibleColumns.payment && (
                      <td>
                        <span className={`ao-payment ao-payment-${o.payment}`}>
                          {PAYMENT_LABELS[o.payment] || o.payment || "—"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.delivery && (
                      <td>
                        <span className="ao-delivery">
                          {DELIVERY_LABELS[o.delivery] || o.delivery || "—"}
                        </span>
                      </td>
                    )}
                    <td>
                      <select
                        value={o.status}
                        disabled={updatingId === o._id}
                        onChange={e => updateStatus(o._id, e.target.value)}
                        className={`ao-status-select ao-status-${o.status}`}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    {visibleColumns.date && (
                      <td>
                        <span className="ap-date">
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString("fr-FR") : "—"}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="ap-actions">
                        <Link href={`/admin/orders/${o._id}`} className="ap-btn-view" aria-label="Voir le détail de la commande">↗</Link>
                        <button className="ap-btn-delete" onClick={() => deleteOrder(o._id)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="ap-pagination">
          <button className="ap-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Préc.
          </button>
          <span className="ap-page-info">
            Page {page} / {pagination.totalPages}
            <span className="ap-page-total"> — {pagination.total} commandes</span>
          </span>
          <button className="ap-page-btn" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
            Suiv. →
          </button>
        </div>
      )}
    </div>
  );
}