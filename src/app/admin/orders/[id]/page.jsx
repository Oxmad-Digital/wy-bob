"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import "./order-detail.css";
import { TOAST_DURATION } from "../../_constants";
import { FR_PRODUCTS, INTL_PRODUCTS } from "@/app/lib/chronopost/constants";
import { COUNTRY_OPTIONS } from "@/app/lib/shipping/countries";

const EMPTY_CUSTOMER_FORM = {
  firstname: "", lastname: "", email: "", phone: "", company: "",
  address: "", postalCode: "", city: "", country: "FR",
};

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
  card:          "Carte bancaire",
  bank_transfer: "Virement bancaire",
};

// Ordre "naturel" du cycle de vie d'une commande — sert à repérer les retours en arrière.
// "cancelled" est volontairement exclu : c'est une sortie de cycle, pas une étape.
const STATUS_SEQUENCE = ["pending", "paid", "processing", "shipped", "delivered"];

function isSensitiveTransition(from, to) {
  if (to === "cancelled" || from === "cancelled") return true;
  const fromIdx = STATUS_SEQUENCE.indexOf(from);
  const toIdx   = STATUS_SEQUENCE.indexOf(to);
  return fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx;
}

function describeShipping(shipping) {
  const key = shipping?.productKey;
  if (!key) return { product: "—", service: "—" };

  if (key in FR_PRODUCTS) {
    const product = FR_PRODUCTS[key];
    const service = String(shipping.service) === "6" ? "Livraison samedi" : "Standard";
    return { product: product.label, service };
  }

  if (key in INTL_PRODUCTS) {
    const product = INTL_PRODUCTS[key];
    let service = String(shipping.service ?? "—");
    if ("service" in product) {
      service = "Standard";
    } else if ("serviceLight" in product) {
      if (String(shipping.service) === String(product.serviceLight)) service = "Léger (≤3kg)";
      else if (String(shipping.service) === String(product.serviceHeavy)) service = "Lourd (>3kg)";
    }
    return { product: product.label, service };
  }

  return { product: key, service: String(shipping.service ?? "—") };
}

export default function AdminOrderDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast]       = useState(null);
  const [shipGenerating, setShipGenerating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [shipFormOpen, setShipFormOpen] = useState(true);
  const [shipOverrides, setShipOverrides] = useState({
    saturday: false,
    businessType: "BtoC",
    productKeyOverride: "",
    weightKgOverride: "",
  });
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [extraAmount, setExtraAmount] = useState("");
  const [extraReason, setExtraReason] = useState("");
  const [sendingExtraPayment, setSendingExtraPayment] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (!res.ok) { router.push("/admin/orders"); return; }
        const data = await res.json();
        setOrder(data);
        if (data.shipping?.skybillNumber) setShipFormOpen(false);
      } catch {
        router.push("/admin/orders");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router]);

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const res  = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setOrder(data);
      showToast("Statut mis à jour — email envoyé au client");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setUpdating(false);
    }
  };

  const generateShipment = async () => {
    setShipGenerating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipOverrides),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur Chronopost", "error"); return; }
      setOrder(data);
      showToast("Étiquette générée");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setShipGenerating(false);
    }
  };

  const startEditCustomer = () => {
    const c = order.customer || {};
    setCustomerForm({
      firstname: c.firstname || "",
      lastname: c.lastname || "",
      email: c.email || "",
      phone: c.phone || "",
      company: c.company || "",
      address: c.address || "",
      postalCode: c.postalCode || "",
      city: c.city || "",
      country: c.country || "FR",
    });
    setEditingCustomer(true);
  };

  const saveCustomer = async () => {
    setSavingCustomer(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setOrder(data);
      setEditingCustomer(false);
      showToast("Coordonnées mises à jour — pensez à régénérer l'étiquette si besoin");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  const refreshTracking = async () => {
    setTracking(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/track`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur de suivi", "error"); return; }
      setOrder(data);
      showToast("Suivi actualisé");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setTracking(false);
    }
  };

  const sendExtraPayment = async () => {
    const amount = Number(extraAmount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast("Montant invalide", "error"); return; }
    setSendingExtraPayment(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/extra-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: extraReason }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setOrder(data);
      setExtraAmount("");
      setExtraReason("");
      showToast("Lien de paiement envoyé au client");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setSendingExtraPayment(false);
    }
  };

  const cancelShipmentAction = async () => {
    if (!confirm("Annuler cette étiquette Chronopost ? Cette action n'est pas testable avec le compte de test.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipping/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur d'annulation", "error"); return; }
      setOrder(data);
      showToast("Étiquette annulée");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="od-page">
        <div className="od-loading">Chargement…</div>
      </div>
    );
  }

  if (!order) return null;

  const c           = order.customer || {};
  const fullName    = [c.firstname, c.lastname].filter(Boolean).join(" ") || "—";
  const initials    = ((c.firstname?.[0] || "") + (c.lastname?.[0] || "")).toUpperCase() || "?";
  const orderNumber = order.orderNumber
    ? String(order.orderNumber).padStart(4, "0")
    : order._id.toString().slice(-8).toUpperCase();
  const shipInfo = describeShipping(order.shipping);

  return (
    <div className="od-page">

      {toast && (
        <div className={`ap-toast ${toast.type === "error" ? "ap-toast-error" : "ap-toast-success"}`}>
          {toast.message}
        </div>
      )}

      {editingCustomer && (
        <div className="od-modal-overlay" onClick={() => !savingCustomer && setEditingCustomer(false)}>
          <div className="od-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="od-card-title">Corriger les coordonnées</h2>
            <p className="od-status-hint">
              Corrige ici une faute de saisie (adresse, code postal, pays…) qui bloquerait la
              génération de l&apos;étiquette Chronopost, puis régénère l&apos;étiquette ci-dessous.
            </p>
            <div className="od-customer-form">
              <div className="od-customer-form-row">
                <div className="od-ship-form-field">
                  <label className="od-ship-form-label">Prénom</label>
                  <input className="od-ship-input" value={customerForm.firstname} onChange={(e) => setCustomerForm(f => ({ ...f, firstname: e.target.value }))} />
                </div>
                <div className="od-ship-form-field">
                  <label className="od-ship-form-label">Nom</label>
                  <input className="od-ship-input" value={customerForm.lastname} onChange={(e) => setCustomerForm(f => ({ ...f, lastname: e.target.value }))} />
                </div>
              </div>
              <div className="od-customer-form-row">
                <div className="od-ship-form-field">
                  <label className="od-ship-form-label">Email</label>
                  <input type="email" className="od-ship-input" value={customerForm.email} onChange={(e) => setCustomerForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="od-ship-form-field">
                  <label className="od-ship-form-label">Téléphone</label>
                  <input className="od-ship-input" value={customerForm.phone} onChange={(e) => setCustomerForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="od-ship-form-field">
                <label className="od-ship-form-label">Entreprise (optionnel)</label>
                <input className="od-ship-input" value={customerForm.company} onChange={(e) => setCustomerForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="od-ship-form-field">
                <label className="od-ship-form-label">Adresse</label>
                <input className="od-ship-input" value={customerForm.address} onChange={(e) => setCustomerForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="od-customer-form-row">
                <div className="od-ship-form-field">
                  <label className="od-ship-form-label">Code postal</label>
                  <input className="od-ship-input" value={customerForm.postalCode} onChange={(e) => setCustomerForm(f => ({ ...f, postalCode: e.target.value }))} />
                </div>
                <div className="od-ship-form-field">
                  <label className="od-ship-form-label">Ville</label>
                  <input className="od-ship-input" value={customerForm.city} onChange={(e) => setCustomerForm(f => ({ ...f, city: e.target.value }))} />
                </div>
              </div>
              <div className="od-ship-form-field">
                <label className="od-ship-form-label">Pays</label>
                <select className="od-ship-select" value={customerForm.country} onChange={(e) => setCustomerForm(f => ({ ...f, country: e.target.value }))}>
                  {COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="od-customer-form-actions">
                <button type="button" className="od-ship-generate-btn" disabled={savingCustomer} onClick={saveCustomer}>
                  {savingCustomer ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button type="button" className="od-ship-toggle-btn od-customer-cancel-btn" disabled={savingCustomer} onClick={() => setEditingCustomer(false)}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="od-topbar">
        <Link href="/admin/orders" className="od-back-btn">← Commandes</Link>
        <div className="od-topbar-center">
          <h1 className="od-title">Commande <span className="od-ref">#{orderNumber}</span></h1>
          {order.createdAt && (
            <span className="od-date-top">
              {new Date(order.createdAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
            </span>
          )}
        </div>
        <span className={`ao-status-badge ao-status-${order.status}`}>
          {STATUS_OPTIONS.find(s => s.value === order.status)?.label || order.status}
        </span>
      </div>

      <div className="od-grid">

        {/* ── Client ── */}
        <div className="od-card">
          <div className="od-card-title-row">
            <h2 className="od-card-title">Client</h2>
            <button type="button" className="od-edit-btn" onClick={startEditCustomer}>
              ✎ Corriger
            </button>
          </div>

          <div className="od-client-row">
            <div className="od-avatar">{initials}</div>
            <div>
              <div className="od-client-name">{fullName}</div>
              {c.email && (
                <a href={`mailto:${c.email}`} className="od-client-email">{c.email}</a>
              )}
              {c.phone && <div className="od-client-phone">{c.phone}</div>}
            </div>
          </div>
          {(c.address || c.city) && (
            <div className="od-address-block">
              <div className="od-address-label">Adresse de livraison</div>
              {c.address && <div className="od-address-line">{c.address}</div>}
              {c.city    && <div className="od-address-city">{[c.postalCode, c.city].filter(Boolean).join(" ")}</div>}
              {c.country && <div className="od-address-line">{COUNTRY_OPTIONS.find(o => o.code === c.country)?.label || c.country}</div>}
            </div>
          )}
          {order.shipping?.relayPoint?.id && (
            <div className="od-address-block">
              <div className="od-address-label">Point relais</div>
              <div className="od-address-line">{order.shipping.relayPoint.name}</div>
              <div className="od-address-city">{order.shipping.relayPoint.zipCode} {order.shipping.relayPoint.city}</div>
              {order.recipientPickupName && (
                <div className="od-client-phone">Retrait par : {order.recipientPickupName}</div>
              )}
            </div>
          )}
        </div>

        {/* ── Résumé ── */}
        <div className="od-card">
          <h2 className="od-card-title">Résumé</h2>
          <div className="od-summary-row">
            <span className="od-summary-label">Paiement</span>
            <span className={`ao-payment ao-payment-${order.payment}`}>
              {PAYMENT_LABELS[order.payment] || order.payment || "—"}
            </span>
          </div>
          <div className="od-summary-row">
            <span className="od-summary-label">Articles</span>
            <span className="od-summary-value">{order.products?.length || 0}</span>
          </div>
          <div className="od-summary-row od-summary-total">
            <span className="od-summary-label">Total</span>
            <span className="od-total-value">{(order.total || 0).toLocaleString()} €</span>
          </div>
        </div>

        {/* ── Changer le statut ── */}
        <div className="od-card">
          <h2 className="od-card-title">Changer le statut</h2>
          <p className="od-status-hint">Un email est envoyé automatiquement au client.</p>
          <div className="od-status-grid">
            {STATUS_OPTIONS.map(s => {
              const isCurrent = order.status === s.value;
              const sensitive = !isCurrent && isSensitiveTransition(order.status, s.value);
              const muted = sensitive && s.value !== "cancelled";
              return (
                <button
                  key={s.value}
                  disabled={updating || isCurrent}
                  onClick={() => {
                    if (sensitive && !confirm(`Passer la commande en "${s.label}" ? Un email sera envoyé au client.`)) return;
                    updateStatus(s.value);
                  }}
                  className={`od-status-btn ao-status-${s.value} ${isCurrent ? "od-status-current" : ""} ${muted ? "od-status-muted" : ""}`}
                >
                  {s.label}
                  {isCurrent && <span className="od-status-check" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Paiement complémentaire ── */}
        <div className="od-card">
          <h2 className="od-card-title">Paiement complémentaire</h2>
          <p className="od-status-hint">
            Génère un lien de paiement Stripe à montant libre (ex. frais de réexpédition
            suite à une correction d&apos;adresse) et l&apos;envoie par email au client.
          </p>
          <div className="od-customer-form">
            <div className="od-ship-form-field">
              <label className="od-ship-form-label">Motif</label>
              <input
                className="od-ship-input"
                placeholder="Ex. Frais de réexpédition"
                value={extraReason}
                onChange={(e) => setExtraReason(e.target.value)}
              />
            </div>
            <div className="od-ship-form-field">
              <label className="od-ship-form-label">Montant (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="od-ship-input"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="od-ship-generate-btn"
              disabled={sendingExtraPayment}
              onClick={sendExtraPayment}
            >
              {sendingExtraPayment ? "Envoi…" : "Envoyer le lien de paiement"}
            </button>
          </div>

          {order.extraPayments?.length > 0 && (
            <div className="od-extra-payments-list">
              {order.extraPayments.slice().reverse().map((ep) => (
                <div key={ep._id} className="od-extra-payment-row">
                  <span className="od-extra-payment-reason">{ep.reason || "Paiement complémentaire"}</span>
                  <span className="od-extra-payment-amount">{Number(ep.amount).toFixed(2)} €</span>
                  <span className={`od-extra-payment-status od-extra-payment-${ep.status}`}>
                    {ep.status === "paid" ? "✅ Payé" : ep.status === "cancelled" ? "✕ Annulé" : "⏳ En attente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Expédition Chronopost ── */}
      <div className="od-card od-ship-card">
        <h2 className="od-card-title">Expédition Chronopost</h2>

        {order.shipping?.shippingError && (
          <div className="od-ship-error">⚠️ {order.shipping.shippingError}</div>
        )}

        {order.shipping?.skybillNumber && (
          <>
            <div className="od-ship-summary">
              <div className="od-ship-field">
                <div className="od-ship-field-label">N° de suivi</div>
                <div className="od-ship-field-value">{order.shipping.skybillNumber}</div>
              </div>
              <div className="od-ship-field">
                <div className="od-ship-field-label">Produit</div>
                <div className="od-ship-field-value od-ship-field-value-plain">{shipInfo.product}</div>
                <div className="od-ship-field-sub">{order.shipping.productKey}</div>
              </div>
              <div className="od-ship-field">
                <div className="od-ship-field-label">Service</div>
                <div className="od-ship-field-value od-ship-field-value-plain">{shipInfo.service}</div>
                <div className="od-ship-field-sub">{order.shipping.service ?? "—"}</div>
              </div>
              <div className="od-ship-field">
                <div className="od-ship-field-label">Poids</div>
                <div className="od-ship-field-value">{order.shipping.weightKg ?? "—"} kg</div>
              </div>
            </div>
            <div className="od-ship-actions-row">
              <a
                href={`/api/admin/orders/${id}/label`}
                target="_blank"
                rel="noopener noreferrer"
                className="od-ship-download-btn"
              >
                📄 Télécharger l&apos;étiquette
              </a>
              <button type="button" className="od-ship-track-btn" onClick={refreshTracking} disabled={tracking}>
                {tracking ? "Actualisation…" : "🔄 Actualiser le suivi"}
              </button>
              <a
                href={`/api/admin/orders/${id}/pod`}
                target="_blank"
                rel="noopener noreferrer"
                className="od-ship-track-btn"
              >
                🧾 Preuve de livraison
              </a>
              {!order.shipping.cancelledAt && (
                <button type="button" className="od-ship-cancel-btn" onClick={cancelShipmentAction} disabled={cancelling}>
                  {cancelling ? "Annulation…" : "✕ Annuler l'étiquette"}
                </button>
              )}
            </div>

            {order.shipping.cancelledAt ? (
              <p className="od-ship-cancelled-hint">
                Étiquette annulée le {new Date(order.shipping.cancelledAt).toLocaleString("fr-FR")}
              </p>
            ) : (
              <p className="od-ship-cancel-warning">
                ⚠️ L&apos;annulation n&apos;est pas testable avec le compte de test Chronopost.
              </p>
            )}

            {order.shipping.trackingStatus && (
              <div className="od-ship-tracking">
                <div className="od-ship-field-label">Statut de suivi</div>
                <div className="od-ship-field-value">{order.shipping.trackingStatus}</div>
                {order.shipping.lastTrackedAt && (
                  <div className="od-ship-tracking-date">
                    Actualisé le {new Date(order.shipping.lastTrackedAt).toLocaleString("fr-FR")}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {order.shipping?.skybillNumber && (
          <button
            type="button"
            className="od-ship-toggle-btn"
            onClick={() => setShipFormOpen(o => !o)}
          >
            {shipFormOpen ? "▾ Masquer les options de régénération" : "▸ Modifier / régénérer l'étiquette"}
          </button>
        )}

        {(!order.shipping?.skybillNumber || shipFormOpen) && (
        <div className="od-ship-form">
          <div className="od-ship-form-field">
            <label className="od-ship-form-label">Forcer le produit</label>
            <select
              className="od-ship-select"
              value={shipOverrides.productKeyOverride}
              onChange={(e) => setShipOverrides(o => ({ ...o, productKeyOverride: e.target.value }))}
            >
              <option value="">Automatique</option>
              <optgroup label="France">
                {Object.entries(FR_PRODUCTS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="International">
                {Object.entries(INTL_PRODUCTS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="od-ship-form-field">
            <label className="od-ship-form-label">Type destinataire (intl.)</label>
            <select
              className="od-ship-select"
              value={shipOverrides.businessType}
              onChange={(e) => setShipOverrides(o => ({ ...o, businessType: e.target.value }))}
            >
              <option value="BtoC">Particulier (BtoC)</option>
              <option value="BtoB">Entreprise (BtoB)</option>
            </select>
          </div>

          <div className="od-ship-form-field">
            <label className="od-ship-form-label">Poids (kg)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Auto"
              className="od-ship-input"
              value={shipOverrides.weightKgOverride}
              onChange={(e) => setShipOverrides(o => ({ ...o, weightKgOverride: e.target.value }))}
            />
          </div>

          <div className="od-ship-form-field">
            <label className="od-ship-checkbox">
              <input
                type="checkbox"
                checked={shipOverrides.saturday}
                onChange={(e) => setShipOverrides(o => ({ ...o, saturday: e.target.checked }))}
              />
              Livraison le samedi
            </label>
          </div>

          <button
            className="od-ship-generate-btn"
            disabled={shipGenerating}
            onClick={generateShipment}
          >
            {shipGenerating ? "Génération…" : order.shipping?.skybillNumber ? "Régénérer l'étiquette" : "Générer l'étiquette"}
          </button>
        </div>
        )}
      </div>

      {/* ── Produits ── */}
      {order.products?.length > 0 && (
        <div className="od-card od-products-card">
          <h2 className="od-card-title">Articles commandés</h2>
          <table className="od-products-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Quantité</th>
              </tr>
            </thead>
            <tbody>
              {order.products.map((item, i) => {
                const p = item.product || {};
                return (
                  <tr key={i}>
                    <td>
                      <div className="od-product-cell">
                        {p.image
                          ? <img src={p.image} alt={p.name} className="od-product-img" />
                          : <div className="od-product-no-img">👕</div>
                        }
                        <span className="od-product-name">{p.name || "Produit supprimé"}</span>
                      </div>
                    </td>
                    <td className="od-product-ref">
                      {p._id ? p._id.toString().slice(-8).toUpperCase() : "—"}
                    </td>
                    <td className="od-product-qty">× {item.quantity || 1}</td>
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