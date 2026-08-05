"use client";

import { useState, useEffect } from "react";
import styles from "./settings-admin.module.css";
import { TOAST_DURATION } from "../_constants";

const BILLING_FIELDS = [
  { key: "companyName", label: "Dénomination sociale", placeholder: "Wybob SAS" },
  { key: "legalForm", label: "Forme juridique", placeholder: "SAS, auto-entrepreneur…" },
  { key: "address", label: "Adresse", placeholder: "12 rue des Fleurs" },
  { key: "postalCode", label: "Code postal", placeholder: "75000" },
  { key: "city", label: "Ville", placeholder: "Paris" },
  { key: "siret", label: "SIRET", placeholder: "123 456 789 00012" },
  { key: "vatNumber", label: "Numéro de TVA intracommunautaire", placeholder: "FR12345678900" },
  { key: "iban", label: "IBAN (optionnel, affiché sur la facture)", placeholder: "FR76 XXXX XXXX XXXX XXXX XXXX XXX" },
];

export default function SettingsAdminPage() {
  const [settings, setSettings] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.success) {
          setSettings(data.settings);
          setBilling(data.settings.billing || {});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBillingChange = (key, value) => {
    setBilling((b) => ({ ...b, [key]: value }));
  };

  const handleSaveBilling = async () => {
    setSavingBilling(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Erreur", "error");
        return;
      }
      setSettings(data.settings);
      setBilling(data.settings.billing || {});
      showToast("Informations de facturation enregistrées");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setSavingBilling(false);
    }
  };

  const handleToggle = async (checked) => {
    setSaving(true);
    setSettings((s) => ({ ...s, maintenanceMode: checked }));
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceMode: checked }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Erreur", "error");
        setSettings((s) => ({ ...s, maintenanceMode: !checked }));
        return;
      }
      setSettings(data.settings);
      showToast(checked ? "Mode maintenance activé" : "Mode maintenance désactivé");
    } catch {
      showToast("Erreur serveur", "error");
      setSettings((s) => ({ ...s, maintenanceMode: !checked }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.topbar}>
        <div>
          <h1 className={styles.topbarTitle}>Réglages</h1>
          <p className={styles.topbarSub}>
            Mode maintenance&nbsp;:&nbsp;
            <span className={settings?.maintenanceMode ? styles.badgeActive : styles.badgeInactive}>
              {settings?.maintenanceMode ? "Activé" : "Désactivé"}
            </span>
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#78716c" }}>Chargement…</p>
      ) : (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Mode maintenance</p>

          <div className={styles.toggleRow}>
            <div>
              <p className={styles.toggleLabel}>Site en maintenance</p>
              <p className={styles.toggleSub}>
                Les visiteurs de wybob.shop voient une page « Maintenance en cours » à la place du site.
                L&apos;admin ainsi que wy-bob.vercel.app restent accessibles.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={!!settings?.maintenanceMode}
                disabled={saving}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      )}

      {!loading && billing && (
        <div className={styles.card} style={{ marginTop: 20 }}>
          <p className={styles.cardTitle}>Informations de facturation</p>
          <p className={styles.toggleSub} style={{ marginBottom: 18 }}>
            Utilisées pour générer automatiquement les factures des commandes payées.
          </p>

          <div className={styles.billingGrid}>
            {BILLING_FIELDS.map((f) => (
              <label key={f.key} className={styles.billingField}>
                <span className={styles.toggleLabel}>{f.label}</span>
                <input
                  type="text"
                  className={styles.billingInput}
                  value={billing[f.key] || ""}
                  placeholder={f.placeholder}
                  onChange={(e) => handleBillingChange(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={styles.toggleRow} style={{ marginTop: 12 }}>
            <div>
              <p className={styles.toggleLabel}>Assujetti à la TVA</p>
              <p className={styles.toggleSub}>
                Si désactivé, les factures afficheront la mention « TVA non applicable, art. 293 B du CGI ».
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={!!billing.vatApplicable}
                onChange={(e) => handleBillingChange("vatApplicable", e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {billing.vatApplicable && (
            <label className={styles.billingField} style={{ maxWidth: 160, marginTop: 12 }}>
              <span className={styles.toggleLabel}>Taux de TVA (%)</span>
              <input
                type="number"
                className={styles.billingInput}
                value={billing.vatRate ?? 20}
                onChange={(e) => handleBillingChange("vatRate", Number(e.target.value))}
              />
            </label>
          )}

          <button
            type="button"
            className={styles.saveButton}
            disabled={savingBilling}
            onClick={handleSaveBilling}
          >
            {savingBilling ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}
