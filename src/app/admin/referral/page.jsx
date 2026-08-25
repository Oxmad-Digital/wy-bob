"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./referral-admin.module.css";
import { TOAST_DURATION } from "../_constants";

export default function ReferralAdminPage() {
  const [config, setConfig]   = useState(null);
  const [stats, setStats]     = useState({ totalReferralCodes: 0, totalConversions: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);

  const [referralCodes, setReferralCodes]       = useState([]);
  const [loadingCodes, setLoadingCodes]         = useState(true);
  const [showInfoModal, setShowInfoModal]       = useState(false);
  const [confirmModal, setConfirmModal]         = useState(null);
  const [deletingId, setDeletingId]             = useState(null);

  const [form, setForm] = useState({
    totalPercent: 10,
    rewardValidityDays: 30,
    active: false,
  });

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/admin/referral/config");
        const data = await res.json();
        if (data.success) {
          setConfig(data.config);
          setStats(data.stats);
          setForm({
            totalPercent: data.config.totalPercent,
            rewardValidityDays: data.config.rewardValidityDays,
            active: data.config.active,
          });
        }
      } finally {
        setLoading(false);
      }
    })();

    (async () => {
      try {
        const res  = await fetch("/api/admin/referral/codes");
        const data = await res.json();
        if (data.success) setReferralCodes(data.codes);
      } finally {
        setLoadingCodes(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/referral/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPercent: Number(form.totalPercent),
          rewardValidityDays: Number(form.rewardValidityDays),
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setConfig(data.config);
      showToast("Configuration enregistrée !");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const handleDelete = (c) => {
    setConfirmModal({
      message: c.referrerId
        ? `Supprimer le code "${c.code}" (${c.referrerId.name || c.referrerId.email}) ?`
        : `Supprimer le code "${c.code}" ? L'utilisateur associé n'existe plus.`,
      onConfirm: async () => {
        setDeletingId(c._id);
        try {
          const res  = await fetch(`/api/admin/referral/codes/${c._id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
          setReferralCodes((prev) => prev.filter((r) => r._id !== c._id));
          showToast("Code supprimé");
        } catch {
          showToast("Erreur serveur", "error");
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.message}
        </div>
      )}

      {confirmModal && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmModal(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmMsg}>{confirmModal.message}</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirmModal(null)}>Annuler</button>
              <button
                className={styles.confirmOk}
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.topbar}>
<div>
          <h1 className={styles.topbarTitle}>Parrainage</h1>
          <p className={styles.topbarSub}>
            Programme actif&nbsp;:&nbsp;
            <span className={config?.active ? styles.badgeActive : styles.badgeInactive}>
              {config?.active ? "Oui" : "Non"}
            </span>
          </p>
        </div>
        <button className={styles.infoBtn} onClick={() => setShowInfoModal(true)} style={{ marginLeft: "auto" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Comment ça fonctionne
        </button>
      </div>

      {/* Info modal */}
      {showInfoModal && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setShowInfoModal(false); }}>
          <div className={styles.infoModal}>
            <div className={styles.infoModalHeader}>
              <div className={styles.infoModalIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 className={styles.infoModalTitle}>Comment ça fonctionne</h3>
              <button className={styles.infoModalClose} onClick={() => setShowInfoModal(false)} aria-label="Fermer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className={styles.infoModalBody}>
              <div className={styles.infoStep}>
                <div className={styles.infoStepNum}>1</div>
                <div>
                  <p className={styles.infoStepTitle}>Code unique par client</p>
                  <p className={styles.infoStepText}>Chaque client connecté dispose d'un code de parrainage unique généré automatiquement à sa première visite.</p>
                </div>
              </div>
              <div className={styles.infoStep}>
                <div className={styles.infoStepNum}>2</div>
                <div>
                  <p className={styles.infoStepTitle}>Répartition au choix</p>
                  <p className={styles.infoStepText}>Le parrain choisit de garder tout le pourcentage pour lui (récompense différée) ou d'en offrir une partie à son filleul (réduction immédiate au checkout).</p>
                </div>
              </div>
              <div className={styles.infoStep}>
                <div className={styles.infoStepNum}>3</div>
                <div>
                  <p className={styles.infoStepTitle}>Récompense automatique</p>
                  <p className={styles.infoStepText}>Quand un filleul commande avec le code, le parrain reçoit automatiquement un bon de réduction à usage unique par email.</p>
                </div>
              </div>
              <div className={styles.infoStep}>
                <div className={styles.infoStepNum}>4</div>
                <div>
                  <p className={styles.infoStepTitle}>Enveloppe totale</p>
                  <p className={styles.infoStepText}>L'enveloppe totale définit le plafond accordé — ex : {form.totalPercent}% signifie que parrain + filleul ne peuvent pas dépasser {form.totalPercent}% au total.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#78716c" }}>Chargement…</p>
      ) : (
        <>
          <div className={styles.grid}>
            {/* Stats */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Statistiques</p>
              <div className={styles.statRow}>
                <div className={styles.statItem}>
                  <p className={styles.statValue}>{stats.totalReferralCodes}</p>
                  <p className={styles.statLabel}>Parrains actifs</p>
                </div>
                <div className={styles.statItem}>
                  <p className={styles.statValue}>{stats.totalConversions}</p>
                  <p className={styles.statLabel}>Filleuls convertis</p>
                </div>
              </div>
            </div>

            {/* Config */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Configuration</p>

              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Programme actif</p>
                  <p className={styles.toggleSub}>Les clients peuvent accéder à leur code de parrainage</p>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <div className={styles.formGroup} style={{ marginTop: 16 }}>
                <label className={styles.label}>
                  Enveloppe totale <span className={styles.labelHint}>(% à distribuer entre parrain et filleul)</span>
                </label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  max="100"
                  value={form.totalPercent}
                  onChange={(e) => setForm({ ...form, totalPercent: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Validité récompense parrain <span className={styles.labelHint}>(jours)</span>
                </label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={form.rewardValidityDays}
                  onChange={(e) => setForm({ ...form, rewardValidityDays: e.target.value })}
                />
              </div>

              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>

          {/* Codes de parrainage */}
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Codes de parrainage</h2>
            <p className={styles.sectionSub}>{referralCodes.length} code{referralCodes.length !== 1 ? "s" : ""} généré{referralCodes.length !== 1 ? "s" : ""} par les utilisateurs</p>
          </div>

          {loadingCodes ? (
            <p style={{ color: "#78716c", fontSize: 13.5 }}>Chargement des codes…</p>
          ) : referralCodes.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Aucun code de parrainage généré pour l'instant.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>% Parrain</th>
                    <th>% Filleul</th>
                    <th>Utilisations</th>
                    <th>Créé le</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {referralCodes.map((c) => (
                    <tr key={c._id}>
                      <td><span className={styles.codeBadge}>{c.code}</span></td>
                      <td className={styles.userName}>
                        {c.referrerId?.name ?? (
                          <span className={styles.orphanBadge} title="L'utilisateur associé à ce code a été supprimé">
                            Utilisateur supprimé
                          </span>
                        )}
                      </td>
                      <td className={styles.userEmail}>{c.referrerId?.email ?? <span className={styles.noUser}>—</span>}</td>
                      <td className={styles.pctCell}>{c.parrainPercent ?? 0}%</td>
                      <td className={styles.pctCell}>{c.filleulPercent ?? 0}%</td>
                      <td>{c.usedCount}</td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c._id}
                          aria-label="Supprimer le code"
                        >
                          {deletingId === c._id ? "…" : "Supprimer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
