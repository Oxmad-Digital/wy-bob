"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import "./customer-detail.css";
import { TOAST_DURATION } from "../../_constants";

const ORDER_STATUS = {
  pending:    { label: "En attente",  cls: "s-pending"    },
  processing: { label: "En cours",    cls: "s-processing" },
  paid:       { label: "Payée",       cls: "s-paid"       },
  shipped:    { label: "Expédiée",    cls: "s-shipped"    },
  delivered:  { label: "Livrée",      cls: "s-delivered"  },
  cancelled:  { label: "Annulée",     cls: "s-cancelled"  },
};

export default function CustomerDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();

  const [customer, setCustomer]         = useState(null);
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editing, setEditing]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [toast, setToast]               = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const [form, setForm] = useState({
    firstname: "", lastname: "", email: "",
    phone: "", city: "", address: "", notes: "",
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const askConfirm = (message, onConfirm, confirmLabel = "Confirmer") =>
    setConfirmModal({ message, onConfirm, confirmLabel });

  useEffect(() => { loadCustomer(); }, [id]);

  const loadCustomer = async () => {
    try {
      const res  = await fetch(`/api/customers/${id}`);
      const data = await res.json();
      if (data.success) {
        setCustomer(data.customer);
        setOrders(data.orders || []);
        setForm({
          firstname: data.customer.firstname || "",
          lastname:  data.customer.lastname  || "",
          email:     data.customer.email     || "",
          phone:     data.customer.phone     || "",
          city:      data.customer.city      || "",
          address:   data.customer.address   || "",
          notes:     data.customer.notes     || "",
        });
      }
    } catch (err) {
      console.error(err);
      showToast("Erreur lors du chargement", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res  = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { setCustomer(data.customer); setEditing(false); showToast("Client mis à jour"); }
      else showToast("Erreur de sauvegarde", "error");
    } catch { showToast("Erreur de sauvegarde", "error"); }
    finally { setSaving(false); }
  };

  const toggleStatus = () => {
    const newStatus = customer.status === "active" ? "blocked" : "active";
    askConfirm(
      `Voulez-vous vraiment ${newStatus === "blocked" ? "bloquer" : "débloquer"} ${customer.firstname} ${customer.lastname} ?`,
      async () => {
        const res  = await fetch(`/api/customers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = await res.json();
        if (data.success) { setCustomer(data.customer); showToast(newStatus === "blocked" ? "Client bloqué" : "Client débloqué"); }
      },
      newStatus === "blocked" ? "Bloquer" : "Débloquer"
    );
  };

  const handleDelete = () => {
    if (orders.length > 0) {
      askConfirm(
        `Ce client a ${orders.length} commande(s). Il sera anonymisé conformément au RGPD plutôt que supprimé définitivement.`,
        () => confirmDelete("anonymize"),
        "Anonymiser"
      );
    } else {
      askConfirm(
        `Supprimer définitivement ${customer.firstname} ${customer.lastname} ? Cette action est irréversible.`,
        () => confirmDelete("delete"),
        "Supprimer"
      );
    }
  };

  const confirmDelete = async (action) => {
    try {
      const res  = await fetch(`/api/customers/${id}?action=${action}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { showToast("Action effectuée"); setTimeout(() => router.push("/admin/customers"), 1500); }
      else showToast("Erreur lors de la suppression", "error");
    } catch { showToast("Erreur lors de la suppression", "error"); }
  };

  const handleResendEmail = async (orderId) => {
    setSendingEmail(orderId);
    try {
      const res  = await fetch(`/api/orders/${orderId}/resend-email`, { method: "POST" });
      const data = await res.json();
      if (data.success) showToast("Email de facture renvoyé");
      else showToast("Erreur : " + data.message, "error");
    } catch { showToast("Impossible de contacter le serveur", "error"); }
    finally { setSendingEmail(null); }
  };

  const formatLastOrder = (date) => {
    if (!date) return null;
    const days = Math.floor((Date.now() - new Date(date)) / 86_400_000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7)   return `Il y a ${days}j`;
    if (days < 30)  return `Il y a ${Math.floor(days / 7)} sem`;
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const field = (key, label, type = "text") => (
    <div className="acd-field">
      <label className="acd-field-label">{label}</label>
      <input
        type={type}
        className="acd-field-input"
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  if (loading) return (
    <div className="acd-page">
      <div className="acd-state">Chargement…</div>
    </div>
  );
  if (!customer) return (
    <div className="acd-page">
      <div className="acd-state">Client non trouvé</div>
    </div>
  );

  const isAnonymized = customer.status === "deleted";
  const initials     = `${customer.firstname?.charAt(0) || ""}${customer.lastname?.charAt(0) || ""}`;

  return (
    <div className="acd-page">

      {/* Toast */}
      {toast && (
        <div className={`acd-toast ${toast.type === "error" ? "acd-toast-error" : "acd-toast-ok"}`}>
          {toast.message}
        </div>
      )}

      {/* Modale de confirmation */}
      {confirmModal && (
        <div className="acd-overlay" onClick={() => setConfirmModal(null)}>
          <div className="acd-dialog" onClick={e => e.stopPropagation()}>
            <p className="acd-dialog-msg">{confirmModal.message}</p>
            <div className="acd-dialog-actions">
              <button className="acd-btn-cancel" onClick={() => setConfirmModal(null)}>Annuler</button>
              <button className="acd-btn-confirm" onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}>
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="acd-topbar">
        <Link href="/admin/customers" className="acd-back-btn">← Clients</Link>

        <div className="acd-profile">
          <div className="acd-avatar">{initials}</div>
          <div className="acd-profile-info">
            <div className="acd-name-row">
              <span className="acd-fullname">{customer.firstname} {customer.lastname}</span>
              <span className={`acd-status-badge ${customer.status === "active" ? "ok" : customer.status === "blocked" ? "blocked" : "anon"}`}>
                {customer.status === "active" ? "Actif" : customer.status === "blocked" ? "Bloqué" : "Anonymisé"}
              </span>
            </div>
            <a href={`mailto:${customer.email}`} className="acd-email-sub">{customer.email}</a>
          </div>
        </div>

        {!isAnonymized && (
          <div className="acd-header-btns">
            {editing ? (
              <>
                <button className="acd-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button className="acd-btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
              </>
            ) : (
              <>
                <button className="acd-btn-ghost" onClick={() => setEditing(true)}>Modifier</button>
                <button
                  className={customer.status === "active" ? "acd-btn-warn" : "acd-btn-success"}
                  onClick={toggleStatus}
                >
                  {customer.status === "active" ? "Bloquer" : "Débloquer"}
                </button>
                <button className="acd-btn-danger" onClick={handleDelete}>Supprimer</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Grille info + stats */}
      <div className="acd-grid">

        {/* Informations */}
        <div className="acd-card">
          <h2 className="acd-card-title">Informations</h2>
          {editing ? (
            <div className="acd-form">
              <div className="acd-form-row">
                {field("firstname", "Prénom")}
                {field("lastname",  "Nom")}
              </div>
              {field("email",   "Email",     "email")}
              {field("phone",   "Téléphone", "tel")}
              {field("city",    "Ville")}
              {field("address", "Adresse")}
              <div className="acd-field">
                <label className="acd-field-label">Notes admin</label>
                <textarea
                  className="acd-field-input acd-textarea"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <dl className="acd-info-list">
              <div className="acd-info-row">
                <dt>Email</dt>
                <dd><a href={`mailto:${customer.email}`} className="acd-link">{customer.email}</a></dd>
              </div>
              {customer.phone && (
                <div className="acd-info-row">
                  <dt>Téléphone</dt>
                  <dd>{customer.phone}</dd>
                </div>
              )}
              {customer.city && (
                <div className="acd-info-row">
                  <dt>Ville</dt>
                  <dd>{customer.city}</dd>
                </div>
              )}
              {customer.address && (
                <div className="acd-info-row">
                  <dt>Adresse</dt>
                  <dd>{customer.address}</dd>
                </div>
              )}
              <div className="acd-info-row">
                <dt>Inscrit le</dt>
                <dd>{new Date(customer.createdAt).toLocaleDateString("fr-FR")}</dd>
              </div>
              {customer.notes && (
                <div className="acd-info-row acd-info-notes">
                  <dt>Notes</dt>
                  <dd>{customer.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Statistiques */}
        <div className="acd-card">
          <h2 className="acd-card-title">Statistiques</h2>
          <div className="acd-stats">
            <div className="acd-stat">
              <span className="acd-stat-val">{customer.totalOrders || 0}</span>
              <span className="acd-stat-lbl">Commandes</span>
            </div>
            <div className="acd-stat acd-stat--green">
              <span className="acd-stat-val">{(customer.totalSpent || 0).toLocaleString()} €</span>
              <span className="acd-stat-lbl">Total dépensé</span>
            </div>
            {customer.lastOrderAt && (
              <div className="acd-stat">
                <span
                  className="acd-stat-val acd-stat-val--sm"
                  title={new Date(customer.lastOrderAt).toLocaleDateString("fr-FR")}
                >
                  {formatLastOrder(customer.lastOrderAt)}
                </span>
                <span className="acd-stat-lbl">Dernière commande</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historique des commandes */}
      <div className="acd-card acd-card--full">
        <h2 className="acd-card-title">
          Historique des commandes
          {orders.length > 0 && <span className="acd-count">{orders.length}</span>}
        </h2>
        {orders.length === 0 ? (
          <div className="acd-empty">Aucune commande enregistrée</div>
        ) : (
          <div className="acd-table-wrap">
            <table className="acd-table">
              <thead>
                <tr>
                  <th>N° commande</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const s = ORDER_STATUS[order.status] || { label: order.status, cls: "s-pending" };
                  return (
                    <tr key={order._id}>
                      <td><span className="acd-order-id">#{order._id.slice(-8).toUpperCase()}</span></td>
                      <td>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</td>
                      <td><span className="acd-order-total">{(order.total || 0).toLocaleString()} €</span></td>
                      <td><span className={`acd-order-badge ${s.cls}`}>{s.label}</span></td>
                      <td>
                        <div className="acd-actions">
                          <Link href={`/admin/orders/${order._id}`} className="acd-btn-view" aria-label="Voir le détail de la commande">↗</Link>
                          <button
                            className="acd-btn-ghost acd-btn-sm"
                            onClick={() => handleResendEmail(order._id)}
                            disabled={sendingEmail === order._id}
                            title="Renvoyer la facture par email"
                          >
                            {sendingEmail === order._id ? "Envoi…" : "Email"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}