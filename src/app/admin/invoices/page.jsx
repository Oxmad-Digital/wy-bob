"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "./invoices-admin.css";

const PER_PAGE = 20;

const YEAR_OPTIONS = Array.from({ length: 2030 - 2026 + 1 }, (_, i) => 2026 + i);

export default function AdminInvoicesPage() {
  const [invoices, setInvoices]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [year, setYear]                       = useState("");
  const [page, setPage]                       = useState(1);
  const [pagination, setPagination]           = useState({ total: 0, totalPages: 1 });
  const [stats, setStats]                     = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setDebouncedSearch(search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetchInvoices(); }, [debouncedSearch, year, page]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PER_PAGE });
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (year) params.append("year", year);

      const res  = await fetch(`/api/admin/invoices?${params}`);
      const data = await res.json();
      if (data.invoices) {
        setInvoices(data.invoices);
        setPagination(data.pagination);
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ap-page">

      {/* Topbar */}
      <div className="ap-topbar">
        <div className="ap-topbar-title-group">
          <h1 className="ap-topbar-title">Factures</h1>
          <p className="ap-topbar-subtitle">Factures générées automatiquement pour les commandes payées</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="ap-toolbar">
        <input
          type="text"
          placeholder="Rechercher par n° facture, client, n° commande…"
          value={search}
          onChange={e => { setSearch(e.target.value); if (page !== 1) setPage(1); }}
          className="ap-search-input"
        />

        <div className="ap-divider" />

        <select
          className="ap-year-select"
          value={year}
          onChange={e => { setYear(e.target.value); setPage(1); }}
        >
          <option value="">Toutes les années</option>
          {YEAR_OPTIONS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {stats && (
          <>
            <div className="ap-divider" />
            <div className="ap-stats-inline">
              <div className="ap-stat-chip">
                <span className="ap-stat-chip-value">{stats.total}</span>
                <span className="ap-stat-chip-label">Factures</span>
              </div>
              <div className="ap-stat-sep" />
              <div className="ap-stat-chip">
                <span className="ap-stat-chip-value">{(stats.totalAmount || 0).toLocaleString("fr-FR")} €</span>
                <span className="ap-stat-chip-label">Total TTC</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="ap-table-wrap">
        {loading ? (
          <div className="ap-state"><span className="ap-state-icon">⏳</span>Chargement…</div>
        ) : invoices.length === 0 ? (
          <div className="ap-state"><span className="ap-state-icon">📭</span>Aucune facture trouvée</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Commande</th>
                <th>Total TTC</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const c = inv.customer || {};
                const fullName = [c.firstname, c.lastname].filter(Boolean).join(" ") || "—";

                return (
                  <tr key={inv._id}>
                    <td><span className="ai-number">{inv.invoiceNumber}</span></td>
                    <td>
                      <div className="ai-client">
                        <span className="ai-client-name">{fullName}</span>
                        {c.email && <span className="ai-client-email">{c.email}</span>}
                      </div>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${inv.order}`} className="ai-order-link">
                        #{inv.orderNumber ? String(inv.orderNumber).padStart(4, "0") : "—"}
                      </Link>
                    </td>
                    <td><span className="ai-total">{(inv.totalTtc || 0).toLocaleString("fr-FR")} €</span></td>
                    <td><span className="ap-date">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString("fr-FR") : "—"}</span></td>
                    <td>
                      <a
                        href={`/api/admin/invoices/${inv._id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ai-btn-download"
                      >
                        Télécharger
                        <svg className="ai-download-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v12" />
                          <path d="M7 10l5 5 5-5" />
                          <path d="M5 21h14" />
                        </svg>
                      </a>
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
            <span className="ap-page-total"> — {pagination.total} factures</span>
          </span>
          <button className="ap-page-btn" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
            Suiv. →
          </button>
        </div>
      )}
    </div>
  );
}
