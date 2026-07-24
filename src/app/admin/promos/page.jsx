"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "./promos-admin.module.css";
import { TOAST_DURATION } from "../_constants";
import styles from "./promos-admin.module.css";

export default function PromosPage() {
  const [promos, setPromos]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [toast, setToast]                 = useState(null);
  const [confirmModal, setConfirmModal]   = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    code: "",
    type: "percent",
    value: "",
    minOrderAmount: "",
    maxUses: "",
    expiresAt: "",
  });
  const [formError, setFormError] = useState("");
  const [creating, setCreating]   = useState(false);

  const closeFormModal = () => {
    setShowCreateModal(false);
    setEditingId(null);
    setFormError("");
    setForm({ code: "", type: "percent", value: "", minOrderAmount: "", maxUses: "", expiresAt: "" });
  };

  const openEditModal = (promo) => {
    setEditingId(promo._id);
    setForm({
      code: promo.code,
      type: promo.type,
      value: String(promo.value),
      minOrderAmount: promo.minOrderAmount ? String(promo.minOrderAmount) : "",
      maxUses: promo.maxUses !== null && promo.maxUses !== undefined ? String(promo.maxUses) : "",
      expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : "",
    });
    setFormError("");
    setShowCreateModal(true);
  };

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const askConfirm = (message, onConfirm, confirmLabel = "Confirmer") =>
    setConfirmModal({ message, onConfirm, confirmLabel });

  const loadPromos = async () => {
    try {
      setLoading(true);
      const res  = await fetch("/api/admin/promos");
      const data = await res.json();
      if (data.success) setPromos(data.promos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPromos(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.code || !form.value) {
      setFormError("Le code et la valeur sont obligatoires.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
      };

      const res = await fetch(
        editingId ? `/api/admin/promos/${editingId}` : "/api/admin/promos",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || (editingId ? "Erreur lors de la modification" : "Erreur lors de la création"));
        return;
      }
      showToast(editingId ? "Code promo modifié avec succès !" : "Code promo créé avec succès !");
      closeFormModal();
      loadPromos();
    } catch (err) {
      setFormError("Erreur serveur");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (promo) => {
    try {
      const res = await fetch(`/api/admin/promos/${promo._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !promo.active }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      showToast(data.promo.active ? "Code activé" : "Code désactivé");
      loadPromos();
    } catch {
      showToast("Erreur serveur", "error");
    }
  };

  const handleDelete = (promo) => {
    askConfirm(
      `Supprimer le code « ${promo.code} » ? Cette action est irréversible.`,
      async () => {
        try {
          const res = await fetch(`/api/admin/promos/${promo._id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
          showToast("Code supprimé");
          loadPromos();
        } catch {
          showToast("Erreur serveur", "error");
        }
      },
      "Supprimer"
    );
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const isExpired = (d) => d && new Date(d) < new Date();

  return (
    <div className={styles.page}>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast--${toast.type}`]}`}>
          {toast.message}
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} ${styles.modalCompact}`}>
            <p className={styles.modalMsg}>{confirmModal.message}</p>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmModal(null)}>Annuler</button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div
          className={styles.overlay}
          onClick={(e) => { if (e.target === e.currentTarget) closeFormModal(); }}
        >
          <div className={styles.modal}>

            {/* Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </div>
              <div className={styles.modalHeaderText}>
                <h3 className={styles.modalTitle}>{editingId ? "Modifier le code promo" : "Nouveau code promo"}</h3>
                <p className={styles.modalSubtitle}>
                  {editingId ? "Mettez à jour les paramètres du code" : "Créez un code de réduction personnalisé"}
                </p>
              </div>
              <button
                className={styles.modalClose}
                onClick={closeFormModal}
                aria-label="Fermer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className={styles.modalBody}>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGrid}>

                  <div className={styles.formRowFull}>
                    <label className={styles.label}>Code *</label>
                    <input
                      className={styles.input}
                      placeholder="ex : SUMMER20"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.label}>Type *</label>
                    <select
                      className={styles.input}
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="percent">Pourcentage (%)</option>
                      <option value="fixed">Montant fixe (€)</option>
                    </select>
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.label}>
                      Valeur * {form.type === "percent" ? "(1–100)" : "(€)"}
                    </label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      max={form.type === "percent" ? 100 : undefined}
                      step="0.01"
                      placeholder={form.type === "percent" ? "20" : "10"}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.label}>Min. commande (€)</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={form.minOrderAmount}
                      onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.label}>Limite d'utilisation</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      placeholder="Illimitée"
                      value={form.maxUses}
                      onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.label}>Date d'expiration</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    />
                  </div>

                  {formError && <p className={styles.formError}>{formError}</p>}

                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={closeFormModal}
                  >
                    Annuler
                  </button>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={creating}>
                    {creating
                      ? (editingId ? "Modification…" : "Création…")
                      : (editingId ? "Enregistrer" : "Créer le code")}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* Topbar */}
      <div className={styles.topbar}>
<div>
          <h1 className={styles.topbarTitle}>Codes promo</h1>
          <p className={styles.topbarSub}>{promos.length} code{promos.length !== 1 ? "s" : ""} au total</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)} style={{ marginLeft: "auto" }}>
          + Nouveau code
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.empty}>Chargement…</div>
      ) : promos.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <p>Aucun code promo pour l'instant.</p>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)}>
            Créer le premier code
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Réduction</th>
                <th>Min. commande</th>
                <th>Utilisations</th>
                <th>Expiration</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const expired = isExpired(p.expiresAt);
                return (
                  <tr key={p._id}>
                    <td><span className={styles.codeBadge}>{p.code}</span></td>
                    <td className={styles.valueCell}>
                      {p.type === "percent" ? `${p.value} %` : `${p.value} €`}
                    </td>
                    <td>{p.minOrderAmount > 0 ? `${p.minOrderAmount} €` : "—"}</td>
                    <td>
                      {p.usedCount}
                      {p.maxUses !== null ? ` / ${p.maxUses}` : " / ∞"}
                    </td>
                    <td className={expired ? styles.expired : ""}>
                      {p.expiresAt ? formatDate(p.expiresAt) : "—"}
                      {expired && " (expiré)"}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${p.active && !expired ? styles.badgeActive : styles.badgeInactive}`}>
                        {p.active && !expired ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className={styles.actions}>
                      <button
                        className={`${styles.actionBtn} ${styles.actionEdit}`}
                        onClick={() => openEditModal(p)}
                        title="Modifier"
                      >
                        Modifier
                      </button>
                      <button
                        className={`${styles.actionBtn} ${p.active ? styles.actionDeactivate : styles.actionActivate}`}
                        onClick={() => handleToggle(p)}
                        title={p.active ? "Désactiver" : "Activer"}
                      >
                        {p.active ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionDelete}`}
                        onClick={() => handleDelete(p)}
                        title="Supprimer"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
