"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TOAST_DURATION } from "../_constants";
import styles from "./gallery-admin.module.css";

const CLOUD_NAME = "dnm9txjhm";

// @dnd-kit (~30-40 Ko gzip) n'est nécessaire qu'une fois les photos chargées
// et affichées — évite de le charger au premier rendu de la page.
const PhotosSortableGrid = dynamic(() => import("./PhotosSortableGrid"), { ssr: false });

/* ── Page principale ── */
export default function AdminGalleryPage() {
  const [photos,    setPhotos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);
  const [confirm,   setConfirm]   = useState(null);
  const fileRef     = useRef(null);
  const saveTimeout = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  useEffect(() => { loadPhotos(); }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const res  = await fetch("/api/admin/gallery");
      const data = await res.json();
      if (data.success) setPhotos(data.photos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* Sauvegarde de l'ordre (auto après drag, avec debounce) */
  const saveOrder = useCallback(async (ordered) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/admin/gallery", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: ordered.map(p => p._id) }),
        });
        showToast("Ordre sauvegardé");
      } catch {
        showToast("Erreur lors de la sauvegarde", "error");
      } finally {
        setSaving(false);
      }
    }, 600);
  }, []);

  const handlePhotosReorder = useCallback((reordered) => {
    setPhotos(reordered);
    saveOrder(reordered);
  }, [saveOrder]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!preset) {
      showToast("Variable NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET manquante", "error");
      return;
    }

    const tooHeavy = files.filter(f => f.size > 500 * 1024);
    if (tooHeavy.length > 0) {
      const names = tooHeavy.map(f => `${f.name} (${(f.size / 1024).toFixed(0)} Ko)`).join(", ");
      showToast(`Image${tooHeavy.length > 1 ? "s" : ""} trop lourde${tooHeavy.length > 1 ? "s" : ""} — max 500 Ko : ${names}`, "error");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    let added = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file",          file);
        fd.append("upload_preset", preset);
        fd.append("folder",        "galerie");
        const up   = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
        const data = await up.json();
        if (data.secure_url) {
          await fetch("/api/admin/gallery", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: data.secure_url, publicId: data.public_id }),
          });
          added++;
        }
      } catch {
        /* skip failed file */
      }
    }

    if (added > 0) {
      showToast(`${added} photo${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}`);
      await loadPhotos();
    } else {
      showToast("Échec de l'upload", "error");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const askDelete = (photo) => {
    setConfirm({
      message: "Supprimer cette photo de la galerie ?",
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        const res  = await fetch(`/api/admin/gallery/${photo._id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          setPhotos(prev => prev.filter(p => p._id !== photo._id));
          showToast("Photo supprimée");
        } else {
          showToast("Erreur lors de la suppression", "error");
        }
      },
    });
  };

  return (
    <div className={styles.page}>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className={styles.confirmOverlay} onClick={() => setConfirm(null)}>
          <div className={styles.confirmDialog} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmMsg}>{confirm.message}</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>Annuler</button>
              <button
                className={styles.confirmOk}
                onClick={() => { confirm.onConfirm(); setConfirm(null); }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className={styles.topbar}>
<div className={styles.topbarTitleGroup}>
          <h1 className={styles.topbarTitle}>Galerie photo</h1>
          <p className={styles.topbarSubtitle}>Gérez les photos affichées sur le site</p>
        </div>
        {saving && <span className={styles.savingBadge}>Sauvegarde…</span>}
      </div>

      {/* Upload */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Ajouter des photos</h2>
        </div>
        <label className={`${styles.uploadLabel} ${uploading ? styles.uploadLabelDisabled : ""}`}>
          <span className={styles.uploadIcon}>+</span>
          <span>{uploading ? "Upload en cours…" : "Choisir des photos (plusieurs possibles)"}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            disabled={uploading}
            className={styles.hiddenInput}
          />
        </label>
        <p className={styles.uploadHint}>Formats acceptés : JPG, PNG, WebP — upload vers Cloudinary</p>
        <a
          href="https://squoosh.app"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={styles.squooshBtn}
        >
          🗜 Compresser une image
        </a>
      </section>

      {/* Photos grid avec drag-and-drop */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Photos ({photos.length})</h2>
          {photos.length > 1 && (
            <p className={styles.dragHint}>Glissez les photos pour réorganiser</p>
          )}
        </div>

        {loading ? (
          <div className={styles.stateEmpty}>Chargement…</div>
        ) : photos.length === 0 ? (
          <div className={styles.stateEmpty}>Aucune photo — ajoutez-en via le bouton ci-dessus.</div>
        ) : (
          <PhotosSortableGrid
            photos={photos}
            onDelete={askDelete}
            onReorder={handlePhotosReorder}
          />
        )}
      </section>

    </div>
  );
}
