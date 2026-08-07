"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "./referral.module.css";

interface ReferralCode {
  code: string;
  filleulPercent: number;
  parrainPercent: number;
  usedCount: number;
  totalPercent: number;
}

export default function ReferralPage() {
  const { data: session } = useSession();
  const [referral, setReferral]   = useState<ReferralCode | null>(null);
  const [loading, setLoading]     = useState(true);
  const [inactive, setInactive]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [copied, setCopied]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: string } | null>(null);
  const [shareAll, setShareAll]   = useState(false);
  const [sliderVal, setSliderVal] = useState(0);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadCode = useCallback(async () => {
    try {
      const res  = await fetch("/api/referral/my-code");
      if (res.status === 403) { setInactive(true); return; }
      const data = await res.json();
      if (data.success) {
        setReferral(data.referralCode);
        setSliderVal(data.referralCode.filleulPercent);
        setShareAll(data.referralCode.filleulPercent > 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCode(); }, [loadCode]);

  const handleCopy = () => {
    if (!referral) return;
    navigator.clipboard.writeText(referral.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSplit = async () => {
    if (!referral) return;
    setSaving(true);
    try {
      const res = await fetch("/api/referral/my-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filleulPercent: shareAll ? sliderVal : 0 }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setReferral(data.referralCode);
      setSliderVal(data.referralCode.filleulPercent);
      showToast("Répartition enregistrée !");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Chargement…</div>;
  }

  if (inactive) {
    return (
      <div className={styles.inactive}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <p>Le programme de parrainage n'est pas encore actif.</p>
        <p className={styles.inactiveSub}>Revenez bientôt !</p>
      </div>
    );
  }

  const filleulVal = shareAll ? sliderVal : 0;
  const parrainVal = referral ? referral.totalPercent - filleulVal : 0;

  return (
    <div className={styles.page}>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      <h1 className={styles.title}>Parrainage</h1>

      {/* Code block */}
      <div className={styles.codeCard}>
        <p className={styles.codeLabel}>Votre code de parrainage</p>
        <div className={styles.codeRow}>
          <span className={styles.code}>{referral?.code}</span>
          <button className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ""}`} onClick={handleCopy}>
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copié !
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copier
              </>
            )}
          </button>
        </div>
        <p className={styles.codeUsed}>
          {referral?.usedCount ?? 0} filleul{(referral?.usedCount ?? 0) !== 1 ? "s" : ""} converti{(referral?.usedCount ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Split config */}
      <div className={styles.splitCard}>
        <p className={styles.splitTitle}>Répartition de la réduction</p>
        <p className={styles.splitSub}>
          Enveloppe totale : <strong>{referral?.totalPercent}%</strong>. Choisissez comment la distribuer.
        </p>

        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${!shareAll ? styles.toggleBtnActive : ""}`}
            onClick={() => setShareAll(false)}
          >
            <span className={styles.toggleBtnPercent}>{referral?.totalPercent}%</span>
            <span className={styles.toggleBtnLabel}>Tout pour moi</span>
            <span className={styles.toggleBtnHint}>Le filleul ne reçoit rien</span>
          </button>
          <button
            className={`${styles.toggleBtn} ${shareAll ? styles.toggleBtnActive : ""}`}
            onClick={() => { setShareAll(true); if (sliderVal === 0) setSliderVal(Math.floor((referral?.totalPercent ?? 10) / 2)); }}
          >
            <span className={styles.toggleBtnPercent}>{referral?.totalPercent}%</span>
            <span className={styles.toggleBtnLabel}>Partager avec le filleul</span>
            <span className={styles.toggleBtnHint}>Le filleul reçoit une réduction</span>
          </button>
        </div>

        {shareAll && referral && (
          <div className={styles.sliderSection}>
            <div className={styles.sliderLabels}>
              <div className={styles.sliderParty}>
                <span className={styles.sliderPartyName}>Filleul reçoit</span>
                <span className={styles.sliderPartyVal}>{sliderVal}%</span>
              </div>
              <div className={`${styles.sliderParty} ${styles.sliderPartyRight}`}>
                <span className={styles.sliderPartyName}>Je reçois</span>
                <span className={styles.sliderPartyVal}>{referral.totalPercent - sliderVal}%</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max={referral.totalPercent - 1}
              value={sliderVal}
              onChange={(e) => setSliderVal(Number(e.target.value))}
              className={styles.slider}
            />
          </div>
        )}

        <button className={styles.saveBtn} onClick={handleSaveSplit} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer la répartition"}
        </button>
      </div>

      {/* How it works */}
      <div className={styles.howCard}>
        <p className={styles.howTitle}>Comment ça marche ?</p>
        <ol className={styles.howList}>
          <li>Partagez votre code avec vos proches</li>
          <li>Ils l'utilisent au moment du paiement</li>
          {shareAll
            ? <li>Votre filleul reçoit <strong>{filleulVal}%</strong> de réduction, et vous recevez un bon de <strong>{parrainVal}%</strong> par email</li>
            : <li>Vous recevez un bon de <strong>{referral?.totalPercent}%</strong> par email dès qu'une commande est validée</li>
          }
          <li>Utilisez votre bon sur votre prochaine commande</li>
        </ol>
      </div>

    </div>
  );
}
