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

// Ordre "naturel" du cycle de vie d'une commande — sert à repérer les retours en arrière
// et à construire le stepper. "cancelled" est volontairement exclu : c'est une sortie de
// cycle, pas une étape, donc elle a son propre bouton plutôt qu'une place dans la séquence.
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

// Les dates Chronopost n'ont pas de format documenté garanti : si Date() n'arrive pas à
// la parser, on affiche la valeur brute plutôt qu'un "Invalid Date".
function formatTrackingDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
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
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);

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

    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${id}/invoice`);
        const data = await res.json();
        if (data.success) setInvoice(data.invoice);
      } catch {}
    })();
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

  const cancelOrder = () => {
    if (!confirm("Annuler cette commande ? Un email sera envoyé au client.")) return;
    updateStatus("cancelled");
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

  const sendRefund = async () => {
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast("Montant invalide", "error"); return; }
    if (!confirm(`Rembourser ${amount.toFixed(2)} € au client ? Cette action est immédiate et irréversible.`)) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: refundReason }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setOrder(data);
      setRefundAmount("");
      setRefundReason("");
      showToast("Remboursement effectué — email envoyé au client");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setRefunding(false);
    }
  };

  const generateInvoice = async () => {
    setInvoiceGenerating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/invoice`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Erreur", "error"); return; }
      setInvoice(data.invoice);
      showToast("Facture générée");
    } catch {
      showToast("Erreur serveur", "error");
    } finally {
      setInvoiceGenerating(false);
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
  const refundedTotal = (order.refunds || [])
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + r.amount, 0);
  const refundable = Math.max(0, Math.round((order.total - refundedTotal) * 100) / 100);
  const sequenceIdx = STATUS_SEQUENCE.indexOf(order.status); // -1 pour "cancelled"
  const trackingEvents = order.shipping?.trackingEvents || [];

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
        <div className="od-stat-strip">
          <div className="od-stat-chip">
            <div className="od-stat-k">Paiement</div>
            <div className="od-stat-v">{PAYMENT_LABELS[order.payment] || order.payment || "—"}</div>
          </div>
          <div className="od-stat-chip">
            <div className="od-stat-k">Articles</div>
            <div className="od-stat-v">{order.products?.length || 0}</div>
          </div>
          <div className="od-stat-chip od-stat-chip-total">
            <div className="od-stat-k">Total</div>
            <div className="od-stat-v">{(order.total || 0).toLocaleString()} €</div>
          </div>
        </div>
      </div>

      {/* ── Statut de la commande ── */}
      <div className="od-stepper-card">
        <div className="od-stepper-head">
          <h2 className="od-card-title" style={{ margin: 0 }}>Statut de la commande</h2>
          {order.status === "cancelled" ? (
            <span className="od-stepper-cancelled-tag">Commande annulée</span>
          ) : (
            <span className="od-stepper-hint">Cliquez sur une étape pour la mettre à jour</span>
          )}
        </div>

        <div className="od-stepper">
          {STATUS_SEQUENCE.map((value, i) => {
            const label     = STATUS_OPTIONS.find((s) => s.value === value)?.label;
            const isDone    = sequenceIdx !== -1 && i < sequenceIdx;
            const isCurrent = sequenceIdx !== -1 && i === sequenceIdx;
            return (
              <button
                key={value}
                type="button"
                disabled={updating || isCurrent}
                onClick={() => {
                  if (isSensitiveTransition(order.status, value) && !confirm(`Passer la commande en "${label}" ? Un email sera envoyé au client.`)) return;
                  updateStatus(value);
                }}
                className={`od-step ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`}
              >
                <span className="od-step-line" />
                <span className="od-step-dot">{isDone ? "✓" : isCurrent ? "●" : i + 1}</span>
                <span className="od-step-label">{label}</span>
                <span className="od-step-sub">{isCurrent ? "Étape actuelle" : ""}</span>
              </button>
            );
          })}
        </div>

        <div className="od-stepper-foot">
          <span className="od-email-note">Un email de notification est envoyé au client à chaque changement.</span>
          {order.status !== "cancelled" && (
            <button type="button" className="od-cancel-link" disabled={updating} onClick={cancelOrder}>
              ✕ Annuler la commande
            </button>
          )}
        </div>
      </div>

      <div className="od-layout">

        <div className="od-main-col">

          {/* ── Client ── */}
          <div className="od-card">
            <div className="od-card-title-row">
              <h2 className="od-card-title">Client</h2>
              <button type="button" className="od-edit-btn" onClick={startEditCustomer}>
                ✎ Corriger
              </button>
            </div>

            <div className="od-client-line">
              <div className="od-client-id">
                <div className="od-avatar">{initials}</div>
                <div className="od-client-name">{fullName}</div>
              </div>
              {c.email && (
                <div className="od-client-item">
                  <span className="od-client-item-label">Email</span>
                  <a href={`mailto:${c.email}`} className="od-client-item-value od-client-email">{c.email}</a>
                </div>
              )}
              {c.phone && (
                <div className="od-client-item">
                  <span className="od-client-item-label">Téléphone</span>
                  <span className="od-client-item-value">{c.phone}</span>
                </div>
              )}
              {(c.address || c.city) && (
                <div className="od-client-item od-client-item-grow">
                  <span className="od-client-item-label">Adresse de livraison</span>
                  <span className="od-client-item-value">
                    {[c.address, [c.postalCode, c.city].filter(Boolean).join(" "), c.country && (COUNTRY_OPTIONS.find(o => o.code === c.country)?.label || c.country)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
              {order.shipping?.relayPoint?.id && (
                <div className="od-client-item od-client-item-grow">
                  <span className="od-client-item-label">Point relais</span>
                  <span className="od-client-item-value">
                    {[order.shipping.relayPoint.name, `${order.shipping.relayPoint.zipCode} ${order.shipping.relayPoint.city}`, order.recipientPickupName && `Retrait par : ${order.recipientPickupName}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Produits ── */}
          {order.products?.length > 0 && (
            <div className="od-card od-products-card">
              <h2 className="od-card-title">Articles commandés</h2>
              <table className="od-products-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="od-num">Prix unit.</th>
                    <th className="od-num">Qté</th>
                    <th className="od-num">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.products.map((item, i) => {
                    const p        = item.product || {};
                    const qty      = item.quantity || 1;
                    const unit     = p.pricePromo ?? p.price ?? 0;
                    const subtotal = unit * qty;
                    return (
                      <tr key={i}>
                        <td>
                          <div className="od-product-cell">
                            {p.image
                              ? <img src={p.image} alt={p.name} className="od-product-img" />
                              : <div className="od-product-no-img">👕</div>
                            }
                            <div>
                              <div className="od-product-name">{p.name || "Produit supprimé"}</div>
                              <div className="od-product-ref">
                                {p._id ? p._id.toString().slice(-8).toUpperCase() : "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="od-num od-prod-price">{unit.toFixed(2)} €</td>
                        <td className="od-num">× {qty}</td>
                        <td className="od-num od-prod-sub">{subtotal.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="od-foot-label">Total commande</td>
                    <td className="od-num od-foot-total">{(order.total || 0).toFixed(2)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Expédition Chronopost ── */}
          <div className="od-card od-ship-card">
            <h2 className="od-card-title">Expédition Chronopost</h2>

            {order.shipping?.shippingError && (
              <div className="od-ship-error">⚠️ {order.shipping.shippingError}</div>
            )}

            {order.shipping?.skybillNumber && (
              <div className="od-tabs">
                <button
                  type="button"
                  className={`od-tab-btn ${!shipFormOpen ? "is-active" : ""}`}
                  onClick={() => setShipFormOpen(false)}
                >
                  Suivi
                </button>
                <button
                  type="button"
                  className={`od-tab-btn ${shipFormOpen ? "is-active" : ""}`}
                  onClick={() => setShipFormOpen(true)}
                >
                  Régénérer l&apos;étiquette
                </button>
              </div>
            )}

            {order.shipping?.skybillNumber && !shipFormOpen && (
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

                {trackingEvents.length > 0 ? (
                  <div className="od-track-timeline">
                    {trackingEvents.map((ev, i) => {
                      const isLast = i === trackingEvents.length - 1;
                      return (
                        <div key={i} className={`od-track-item ${isLast ? "is-current" : "is-done"}`}>
                          <div className="od-track-rail">
                            <div className="od-track-dot" />
                            {i < trackingEvents.length - 1 && <div className="od-track-connector" />}
                          </div>
                          <div className="od-track-body">
                            <div className="od-track-title">{ev.label || ev.code || "Événement"}</div>
                            <div className="od-track-meta">
                              {formatTrackingDate(ev.date)}{ev.site ? ` · ${ev.site}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {order.shipping.lastTrackedAt && (
                      <div className="od-track-refreshed">
                        Actualisé le {new Date(order.shipping.lastTrackedAt).toLocaleString("fr-FR")}
                      </div>
                    )}
                  </div>
                ) : order.shipping.trackingStatus && (
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

        </div>

        <div className="od-side-col">

          {/* ── Résumé ── */}
          <div className="od-card">
            <h2 className="od-card-title">Résumé</h2>
            <div className="od-summary-row">
              <span className="od-summary-label">Statut</span>
              <span className={`ao-status-badge ao-status-${order.status}`}>
                {STATUS_OPTIONS.find(s => s.value === order.status)?.label || order.status}
              </span>
            </div>
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

          {/* ── Facture ── */}
          {["paid", "processing", "shipped", "delivered"].includes(order.status) && (
            <div className="od-card">
              <h2 className="od-card-title">Facture</h2>
              {invoice ? (
                <>
                  <div className="od-summary-row">
                    <span className="od-summary-label">Numéro</span>
                    <span className="od-summary-value">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="od-summary-row">
                    <span className="od-summary-label">Émise le</span>
                    <span className="od-summary-value">
                      {new Date(invoice.issuedAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <a
                    href={`/api/admin/invoices/${invoice._id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="od-ship-download-btn"
                    style={{ marginTop: 10 }}
                  >
                    📄 Télécharger la facture
                  </a>
                </>
              ) : (
                <>
                  <p className="od-status-hint">
                    Aucune facture générée pour cette commande — la génération automatique a peut-être échoué.
                  </p>
                  <button
                    type="button"
                    className="od-ship-generate-btn"
                    disabled={invoiceGenerating}
                    onClick={generateInvoice}
                  >
                    {invoiceGenerating ? "Génération…" : "Générer la facture"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Paiement complémentaire ── */}
          <details className="od-acc">
            <summary>
              Paiement complémentaire
              <span className="od-acc-chevron">▸</span>
            </summary>
            <div className="od-acc-body">
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
          </details>

          {/* ── Remboursement ── */}
          <details className="od-acc">
            <summary>
              Remboursement
              {order.paymentIntentId && refundable > 0 && (
                <span className="od-acc-hint-inline">{refundable.toFixed(2)} € remboursables</span>
              )}
            </summary>
            <div className="od-acc-body">
              {order.paymentIntentId ? (
                <>
                  <p className="od-status-hint">
                    Rembourse le client via Stripe (droit de rétractation, litige, erreur de commande…).
                    {refundedTotal > 0 && ` Déjà remboursé : ${refundedTotal.toFixed(2)} €.`}
                    {" "}Reste remboursable : {refundable.toFixed(2)} €.
                  </p>
                  {refundable > 0 && (
                    <div className="od-customer-form">
                      <div className="od-ship-form-field">
                        <label className="od-ship-form-label">Motif (optionnel)</label>
                        <input
                          className="od-ship-input"
                          placeholder="Ex. Rétractation client"
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                        />
                      </div>
                      <div className="od-ship-form-field">
                        <label className="od-ship-form-label">Montant (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={refundable}
                          className="od-ship-input"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="od-ship-cancel-btn"
                        disabled={refunding}
                        onClick={sendRefund}
                      >
                        {refunding ? "Remboursement…" : "Rembourser"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="od-status-hint">
                  Aucun paiement Stripe associé à cette commande (paiement hors ligne) — remboursement à effectuer manuellement.
                </p>
              )}

              {order.refunds?.length > 0 && (
                <div className="od-extra-payments-list">
                  {order.refunds.slice().reverse().map((r, i) => (
                    <div key={r.stripeRefundId || i} className="od-extra-payment-row">
                      <span className="od-extra-payment-reason">{r.reason || "Remboursement"}</span>
                      <span className="od-extra-payment-amount">{Number(r.amount).toFixed(2)} €</span>
                      <span className={`od-extra-payment-status od-extra-payment-${r.status === "succeeded" ? "paid" : r.status === "failed" ? "cancelled" : "pending"}`}>
                        {r.status === "succeeded" ? "✅ Remboursé" : r.status === "failed" ? "✕ Échoué" : "⏳ En attente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

        </div>
      </div>

    </div>
  );
}
