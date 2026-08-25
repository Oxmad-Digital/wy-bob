"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import styles from "./products.module.css";

// @dnd-kit (~30-40 Ko gzip) n'est nécessaire qu'une fois les variantes chargées
// et affichées — évite de le charger au premier rendu de la page.
const VariantsSortableGrid = dynamic(() => import("./VariantsSortableGrid"), { ssr: false });

const CLOUD_NAME = "dnm9txjhm";
const TOAST_DURATION = 3000;

/* ── Modal ajout / édition d'une variante ── */
function VariantModal({ variant, onClose, onSave }) {
  const isEdit = Boolean(variant?._id);
  const [form, setForm] = useState({
    colorName:   variant?.colorName   ?? "",
    colorCode:   variant?.colorCode   ?? "#000000",
    textColor:   variant?.textColor   ?? "#ffffff",
    description: variant?.description ?? "",
    image:       variant?.image       ?? "",
    stock:       variant?.stock       ?? 0,
    editionSize: variant?.editionSize ?? 50,
  });
  const [imageFile,  setImageFile]  = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setError(null);

    if (file.size > 500 * 1024) {
      setError(`Image trop lourde (${(file.size / 1024).toFixed(0)} Ko) — maximum 500 Ko. Compressez l'image avant de l'uploader.`);
      return;
    }

    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!preset) {
      setError("Variable NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET manquante — à ajouter dans Vercel.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",          file);
      fd.append("upload_preset", preset);
      fd.append("folder",        "products");
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) setForm(f => ({ ...f, image: data.secure_url }));
      else setError(`Upload échoué : ${data.error?.message ?? "erreur inconnue"}`);
    } catch {
      setError("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.colorName.trim()) return setError("Le nom de la couleur est requis");
    if (!form.colorCode)        return setError("Le code couleur est requis");
    if (form.stock === "" || Number(form.stock) < 0) return setError("Le stock doit être un nombre positif");
    if (form.editionSize === "" || Number(form.editionSize) <= 0) return setError("La taille de la série doit être un nombre positif");
    onSave({ ...variant, ...form, stock: Number(form.stock), editionSize: Number(form.editionSize) });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEdit ? "Modifier la variante" : "Ajouter une variante"}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>NOM DE LA COULEUR <span className={styles.required}>*</span></label>
            <input
              type="text"
              placeholder="Ex : Bleu"
              value={form.colorName}
              onChange={e => setForm(f => ({ ...f, colorName: e.target.value }))}
              className={styles.fieldInput}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>STOCK DISPONIBLE <span className={styles.required}>*</span></label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                className={styles.fieldInput}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>TAILLE DE LA SÉRIE <span className={styles.required}>*</span></label>
              <input
                type="number"
                min="1"
                value={form.editionSize}
                onChange={e => setForm(f => ({ ...f, editionSize: e.target.value }))}
                className={styles.fieldInput}
              />
              <p className={styles.fieldHint}>Valeur max de la jauge de stock affichée sur la fiche produit</p>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <a
              href="https://imagecolorpicker.com"
              target="_blank"
              rel="noreferrer"
              className={styles.colorPickerLink}
            >
              🎨 Trouver un code couleur (Image Color Picker)
            </a>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>COULEUR DU BOB <span className={styles.required}>*</span></label>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  value={form.colorCode}
                  onChange={e => setForm(f => ({ ...f, colorCode: e.target.value }))}
                  className={styles.colorPickerInput}
                />
                <input
                  type="text"
                  value={form.colorCode}
                  onChange={e => setForm(f => ({ ...f, colorCode: e.target.value }))}
                  className={styles.fieldInput}
                  placeholder="#000000"
                  maxLength={7}
                />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>COULEUR TEXTE BOUTON</label>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  value={form.textColor}
                  onChange={e => setForm(f => ({ ...f, textColor: e.target.value }))}
                  className={styles.colorPickerInput}
                />
                <input
                  type="text"
                  value={form.textColor}
                  onChange={e => setForm(f => ({ ...f, textColor: e.target.value }))}
                  className={styles.fieldInput}
                  placeholder="#ffffff"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>DESCRIPTION DE LA COULEUR</label>
            <textarea
              placeholder="Ex : L'horizon. Inspiré du ciel et de l'océan, un bleu qui évoque la liberté, le calme et l'évasion."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={styles.fieldTextarea}
              rows={3}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>PHOTO DU BOB</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className={styles.fileInput} />
            {form.image && !imageFile && (
              <p className={styles.uploadStatus}>Image actuelle : <a href={form.image} target="_blank" rel="noreferrer">voir</a></p>
            )}
            <p className={styles.uploadStatus}>
              {uploading ? "Upload en cours…" : imageFile ? `${form.image ? "✅ Uploadée" : "En attente…"}` : ""}
            </p>
          </div>

          {/* Aperçu bouton commander */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>APERÇU BOUTON</label>
            <button
              type="button"
              className={styles.previewBtn}
              style={{ backgroundColor: form.colorCode, color: form.textColor }}
            >
              Commander
            </button>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="submit" className={styles.btnSubmit} disabled={uploading}>
              {uploading ? "Upload…" : isEdit ? "Enregistrer" : "Ajouter"}
            </button>
            <button type="button" className={styles.btnCancelModal} onClick={onClose}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Page principale ── */
export default function AdminProductsPage() {
  const [product,       setProduct]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState(null);
  const [confirmModal,  setConfirmModal]  = useState(null);
  const [variantModal,  setVariantModal]  = useState(null);

  const [fields, setFields] = useState({ name: "", price: "", pricePromo: "", weight: "" });

  const showToast = useCallback((msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  const askConfirm = useCallback((message, onConfirm, confirmLabel = "Confirmer") =>
    setConfirmModal({ message, onConfirm, confirmLabel }),
  []);

  const handleVariantEdit = useCallback(
    (variant) => setVariantModal({ variant }),
    []
  );

  useEffect(() => { loadProduct(); }, []);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const res  = await fetch("/api/admin/products");
      const data = await res.json();
      if (data.success && data.product) {
        setProduct(data.product);
        setFields({
          name:       data.product.name,
          price:      String(data.product.price),
          pricePromo: data.product.pricePromo ? String(data.product.pricePromo) : "",
          weight:     String(data.product.weight ?? 100),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveFields = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product._id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       fields.name.trim(),
          price:      Number(fields.price),
          pricePromo: fields.pricePromo ? Number(fields.pricePromo) : null,
          weight:     Number(fields.weight),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProduct(data.product);
        showToast("Produit mis à jour");
      } else {
        showToast("Erreur lors de la sauvegarde", "error");
      }
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async () => {
    if (!product) return;
    const res = await fetch(`/api/admin/products/${product._id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible: !product.visible }),
    });
    const data = await res.json();
    if (data.success) setProduct(data.product);
  };

  const saveVariants = useCallback(async (variants) => {
    if (!product) return;
    const res = await fetch(`/api/admin/products/${product._id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants }),
    });
    const data = await res.json();
    if (data.success) {
      setProduct(data.product);
      return true;
    }
    return false;
  }, [product]);

  const handleVariantSave = async (saved) => {
    if (!product) return;
    let updated;
    if (saved._id) {
      updated = product.variants.map(v => v._id === saved._id ? saved : v);
    } else {
      updated = [...product.variants, saved];
    }
    const ok = await saveVariants(updated);
    if (ok) {
      showToast(saved._id ? "Variante mise à jour" : "Variante ajoutée");
      setVariantModal(null);
    } else {
      showToast("Erreur lors de la sauvegarde", "error");
    }
  };

  const handleVariantDelete = useCallback((variantId, colorName) => {
    askConfirm(
      `Supprimer la variante "${colorName}" ?`,
      async () => {
        const updated = product.variants.filter(v => v._id !== variantId);
        const ok = await saveVariants(updated);
        if (ok) showToast("Variante supprimée");
        else    showToast("Erreur lors de la suppression", "error");
      },
      "Supprimer"
    );
  }, [product, saveVariants, askConfirm, showToast]);

  const handleVariantsReorder = useCallback(async (reordered) => {
    setProduct(prev => ({ ...prev, variants: reordered }));
    const ok = await saveVariants(reordered);
    if (ok) showToast("Ordre des variantes sauvegardé");
    else    showToast("Erreur lors de la sauvegarde", "error");
  }, [saveVariants, showToast]);

  return (
    <div className={styles.page}>

      {/* Modals */}
      {variantModal && (
        <VariantModal
          variant={variantModal.variant}
          onClose={() => setVariantModal(null)}
          onSave={handleVariantSave}
        />
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.message}
        </div>
      )}

      {confirmModal && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmModal(null)}>
          <div className={styles.confirmDialog} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmMsg}>{confirmModal.message}</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirmModal(null)}>Annuler</button>
              <button
                className={styles.confirmOk}
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className={styles.topbar}>
<div className={styles.topbarTitleGroup}>
          <h1 className={styles.topbarTitle}>Produits & Stock</h1>
          <p className={styles.topbarSubtitle}>Gérez votre produit et ses variantes de couleur</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.stateEmpty}>
          <span className={styles.stateIcon}>⏳</span>
          Chargement…
        </div>
      ) : !product ? (
        <div className={styles.stateEmpty}>
          <span className={styles.stateIcon}>📦</span>
          Aucun produit trouvé
        </div>
      ) : (
        <>
          {/* ── Infos générales ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Informations générales</h2>
              <div className={styles.visibleRow}>
                <span className={styles.visibleLabel}>Visible sur le site</span>
                <button
                  className={`${styles.toggleBtn} ${product.visible ? styles.toggleOn : styles.toggleOff}`}
                  onClick={toggleVisible}
                  aria-label={product.visible ? "Masquer" : "Afficher"}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
            </div>

            <div className={styles.fieldsGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>NOM DU PRODUIT</label>
                <input
                  type="text"
                  value={fields.name}
                  onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
                  className={styles.fieldInput}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>STOCK TOTAL</label>
                <input
                  type="text"
                  readOnly
                  value={product.variants.length
                    ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
                    : product.stock}
                  className={`${styles.fieldInput} ${styles.fieldInputReadonly}`}
                />
                {product.variants.length > 0 && (
                  <p className={styles.fieldHint}>Calculé à partir du stock de chaque couleur ci-dessous</p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>PRIX (€)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={fields.price}
                  onChange={e => setFields(f => ({ ...f, price: e.target.value }))}
                  className={styles.fieldInput}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>PRIX PROMO (€) — optionnel</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Laisser vide si aucune promo"
                  value={fields.pricePromo}
                  onChange={e => setFields(f => ({ ...f, pricePromo: e.target.value }))}
                  className={styles.fieldInput}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>POIDS (g)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={fields.weight}
                  onChange={e => setFields(f => ({ ...f, weight: e.target.value }))}
                  className={styles.fieldInput}
                />
                <p className={styles.fieldHint}>Poids du produit emballé, utilisé pour calculer les frais Chronopost</p>
              </div>
            </div>

            {product.variants.length > 0 && (
              <div className={styles.stockBreakdown}>
                {product.variants.map(v => (
                  <span
                    key={v._id}
                    className={`${styles.stockChip} ${
                      v.stock === 0 ? styles.stockChipZero : v.stock <= 3 ? styles.stockChipLow : ""
                    }`}
                  >
                    <span className={styles.stockChipSwatch} style={{ backgroundColor: v.colorCode }} />
                    {v.colorName} · {v.stock ?? 0}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.sectionActions}>
              <button className={styles.btnSave} onClick={saveFields} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </section>

          {/* ── Variantes couleur ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Variantes de couleur</h2>
                <p className={styles.sectionHint}>Glissez pour réordonner · la 1ère variante s'affiche par défaut</p>
              </div>
              <button
                className={styles.btnAdd}
                onClick={() => setVariantModal({ variant: null })}
              >
                + Ajouter une couleur
              </button>
            </div>

            {product.variants.length === 0 ? (
              <p className={styles.emptyVariants}>Aucune variante — ajoutez des couleurs.</p>
            ) : (
              <VariantsSortableGrid
                variants={product.variants}
                onEdit={handleVariantEdit}
                onDelete={handleVariantDelete}
                onReorder={handleVariantsReorder}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
