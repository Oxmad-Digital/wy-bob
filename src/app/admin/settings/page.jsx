"use client";

import { useState, useEffect } from "react";
import styles from "./settings-admin.module.css";
import { TOAST_DURATION } from "../_constants";

export default function SettingsAdminPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        if (data.success) setSettings(data.settings);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    </div>
  );
}
