"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import "./customers.css";
import { TOAST_DURATION } from "../_constants";

const PER_PAGE = 25;

const TOGGLEABLE_COLUMNS = [
  { key: "contact",   label: "Contact"           },
  { key: "city",      label: "Ville"             },
  { key: "lastOrder", label: "Dernière commande" },
  { key: "orders",    label: "Commandes"         },
  { key: "spent",     label: "Total dépensé"     },
  { key: "status",    label: "Statut"            },
];

const COLUMNS_STORAGE_KEY = "wybob_admin_customers_columns";

function getDefaultVisibleColumns() {
  if (typeof window === "undefined") {
    return { contact: true, city: true, lastOrder: true, orders: true, spent: true, status: true };
  }
  const w = window.innerWidth;
  if (w >= 1600) return { contact: true,  city: true,  lastOrder: true,  orders: true, spent: true,  status: true };
  if (w >= 1280) return { contact: true,  city: false, lastOrder: true,  orders: true, spent: true,  status: false };
  return          { contact: false, city: false, lastOrder: false, orders: true, spent: true,  status: false };
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

export default function CustomersPage() {
  const [customers, setCustomers]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [sort, setSort]                     = useState("createdAt");
  const [sortDir, setSortDir]               = useState("desc");
  const [page, setPage]                     = useState(1);
  const [pagination, setPagination]         = useState({ total: 0, totalPages: 1 });
  const [syncing, setSyncing]               = useState(false);
  const [exporting, setExporting]           = useState(false);
  const [toast, setToast]                   = useState(null);
  const [confirmModal, setConfirmModal]     = useState(null);
  const [columnsOpen, setColumnsOpen]       = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
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

  // Debounce search → reset page
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reload whenever any filter/sort/page param changes
  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, sort, sortDir, page]);

  useEffect(() => {
    const close = (e) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("sort", sort);
      params.append("order", sortDir);
      params.append("page", page);
      params.append("limit", PER_PAGE);

      const res  = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sort === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSort(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("sort", sort);
      params.append("order", sortDir);
      params.append("limit", "9999");

      const res  = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      if (!data.success) return;

      const headers = [
        "Prénom", "Nom", "Email", "Téléphone", "Ville",
        "Commandes", "Total dépensé (Ar)", "Dernière commande", "Statut", "Inscrit le",
      ];
      const rows = data.customers.map(c => [
        c.firstname, c.lastname, c.email, c.phone || "", c.city || "",
        c.totalOrders, c.totalSpent || 0,
        c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("fr-FR") : "",
        c.status === "active" ? "Actif" : "Bloqué",
        new Date(c.createdAt).toLocaleDateString("fr-FR"),
      ].join(";"));

      const csv  = [headers.join(";"), ...rows].join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const syncFromOrders = () => {
    askConfirm(
      "Synchroniser les clients depuis les commandes existantes ?",
      async () => {
        setSyncing(true);
        try {
          const res  = await fetch("/api/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sync" }),
          });
          const data = await res.json();
          if (data.success) { showToast(data.message || "Synchronisation terminée"); loadCustomers(); }
          else showToast("Erreur lors de la synchronisation", "error");
        } catch { showToast("Erreur lors de la synchronisation", "error"); }
        finally { setSyncing(false); }
      },
      "Synchroniser"
    );
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "blocked" : "active";
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCustomers(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
        showToast(newStatus === "blocked" ? "Client bloqué" : "Client débloqué");
      }
    } catch { showToast("Erreur lors de la mise à jour", "error"); }
  };

  const deleteCustomer = (id, name) => {
    askConfirm(
      `Supprimer le client "${name}" définitivement ?`,
      async () => {
        try {
          const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
          if (res.ok) {
            setCustomers(prev => prev.filter(c => c._id !== id));
            showToast("Client supprimé");
          } else showToast("Erreur lors de la suppression", "error");
        } catch { showToast("Erreur lors de la suppression", "error"); }
      },
      "Supprimer"
    );
  };

  const formatLastOrder = (date) => {
    if (!date) return null;
    const days = Math.floor((Date.now() - new Date(date)) / 86_400_000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7)  return `Il y a ${days}j`;
    if (days < 30) return `Il y a ${Math.floor(days / 7)}sem`;
    if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const SortIcon = ({ field }) =>
    sort === field
      ? <span className="ac-sort-icon ac-sort-active">{sortDir === "desc" ? " ↓" : " ↑"}</span>
      : <span className="ac-sort-icon ac-sort-idle"> ⇅</span>;

  const STATUS_FILTERS = [
    { label: "Tous",    value: "all"     },
    { label: "Actifs",  value: "active"  },
    { label: "Bloqués", value: "blocked" },
  ];

  // Page numbers with ellipsis
  const pageNumbers = (() => {
    const total = pagination.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, page, page - 1, page + 1].filter(p => p >= 1 && p <= total));
    return [...set].sort((a, b) => a - b).reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);
  })();

  return (
    <div className="ap-page">

      {/* Toast */}
      {toast && (
        <div className={`ap-toast ${toast.type === "error" ? "ap-toast-error" : "ap-toast-success"}`}>
          {toast.message}
        </div>
      )}

      {/* Modale de confirmation */}
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

      {/* Topbar */}
      <div className="ap-topbar">
<div className="ap-topbar-title-group">
          <h1 className="ap-topbar-title">Clients</h1>
          <p className="ap-topbar-subtitle">Gérez vos clients et leur historique d'achats</p>
        </div>
        <button className="ac-btn-export" onClick={exportCSV} disabled={exporting}>
          {exporting ? "Export…" : "↓ Export CSV"}
        </button>
        <button className="ap-btn-add" onClick={syncFromOrders} disabled={syncing}>
          {syncing ? "Synchronisation…" : "Sync commandes"}
        </button>
      </div>

      {/* Toolbar */}
      <div className="ap-toolbar">
        <input
          type="text"
          placeholder="Rechercher par nom, email, téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ap-search-input"
        />
        <div className="ap-divider" />
        <div className="ap-filters">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilter(f.value)}
              className={`ap-filter-btn ${statusFilter === f.value ? "active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
        <div className="ap-divider" />
        <div className="ap-stats-inline">
          <div className="ap-stat-chip">
            <span className="ap-stat-chip-value">{pagination.total}</span>
            <span className="ap-stat-chip-label">Résultats</span>
          </div>
          <div className="ap-stat-sep" />
          <div className="ap-stat-chip">
            <span className="ap-stat-chip-value">{pagination.totalPages}</span>
            <span className="ap-stat-chip-label">Pages</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ap-table-wrap">
        {loading ? (
          <div className="ap-state"><span className="ap-state-icon">⏳</span>Chargement…</div>
        ) : customers.length === 0 ? (
          <div className="ap-state">
            <span className="ap-state-icon">📭</span>
            Aucun client trouvé
            <button className="ac-sync-empty" onClick={syncFromOrders} disabled={syncing}>
              Importer depuis les commandes
            </button>
          </div>
        ) : (
          <>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Client</th>
                  {visibleColumns.contact   && <th>Contact</th>}
                  {visibleColumns.city      && <th>Ville</th>}
                  {visibleColumns.lastOrder && (
                    <th className="ac-th-sort" onClick={() => handleSort("lastOrderAt")}>
                      Dernière commande<SortIcon field="lastOrderAt" />
                    </th>
                  )}
                  {visibleColumns.orders && (
                    <th className="ac-th-sort" onClick={() => handleSort("totalOrders")}>
                      Commandes<SortIcon field="totalOrders" />
                    </th>
                  )}
                  {visibleColumns.spent && (
                    <th className="ac-th-sort" onClick={() => handleSort("totalSpent")}>
                      Total dépensé<SortIcon field="totalSpent" />
                    </th>
                  )}
                  {visibleColumns.status && <th>Statut</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer._id}>
                    <td>
                      <div className="ac-customer-cell">
                        <div className="ac-avatar">
                          {customer.firstname?.charAt(0)}{customer.lastname?.charAt(0)}
                        </div>
                        <div>
                          <div className="ac-customer-name-row">
                            <span className="ac-customer-name">
                              {customer.firstname} {customer.lastname}
                            </span>
                            {customer.role === "admin" && (
                              <span className="ac-admin-badge">ADMIN</span>
                            )}
                          </div>
                          <span className="ac-customer-date">
                            Inscrit le {new Date(customer.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    </td>
                    {visibleColumns.contact && (
                      <td>
                        <div className="ac-contact">
                          <a href={`mailto:${customer.email}`} className="ac-email-link">{customer.email}</a>
                          {customer.phone && <span>{customer.phone}</span>}
                        </div>
                      </td>
                    )}
                    {visibleColumns.city && (
                      <td className="ac-city">
                        {customer.city || <span className="ac-empty">—</span>}
                      </td>
                    )}
                    {visibleColumns.lastOrder && (
                      <td>
                        {customer.lastOrderAt ? (
                          <span
                            className="ac-last-order"
                            title={new Date(customer.lastOrderAt).toLocaleDateString("fr-FR")}
                          >
                            {formatLastOrder(customer.lastOrderAt)}
                          </span>
                        ) : (
                          <span className="ac-empty">—</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.orders && (
                      <td>
                        <span className="ac-orders-badge">{customer.totalOrders}</span>
                      </td>
                    )}
                    {visibleColumns.spent && (
                      <td>
                        <span className="ac-total-spent">
                          {(customer.totalSpent || 0).toLocaleString()} €
                        </span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td>
                        <span className={`ap-badge ${customer.status === "active" ? "ap-badge-ok" : "ap-badge-out"}`}>
                          {customer.status === "active" ? "Actif" : "Bloqué"}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="ap-actions">
                        <Link href={`/admin/customers/${customer._id}`} className="ap-btn-view" aria-label="Voir le profil du client">↗</Link>
                        <button
                          className={customer.status === "active" ? "ap-btn-edit" : "ac-btn-unblock"}
                          onClick={() => toggleStatus(customer._id, customer.status)}
                        >
                          {customer.status === "active" ? "Bloquer" : "Débloquer"}
                        </button>
                        <button
                          className="ap-btn-delete"
                          onClick={() => deleteCustomer(customer._id, `${customer.firstname} ${customer.lastname}`)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="ac-pagination">
                <button className="ac-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  ← Préc.
                </button>
                <div className="ac-page-numbers">
                  {pageNumbers.map((item, i) =>
                    item === "…" ? (
                      <span key={`el-${i}`} className="ac-page-ellipsis">…</span>
                    ) : (
                      <button
                        key={item}
                        className={`ac-page-num ${item === page ? "active" : ""}`}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
                <button className="ac-page-btn" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                  Suiv. →
                </button>
                <span className="ac-page-info">
                  {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, pagination.total)} / {pagination.total}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}