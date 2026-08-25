// Source unique des statuts de commande possibles (valeurs = Order.status en base).
// Importable côté client comme côté serveur : aucune dépendance Mongoose/mailer ici.
export const STATUS_LABELS = {
  pending: { label: "En attente", icon: "⏳", color: "#f59e0b" },
  paid: { label: "Payée", icon: "💰", color: "#10b981" },
  processing: { label: "En préparation", icon: "📦", color: "#8b5cf6" },
  shipped: { label: "Expédiée", icon: "🚚", color: "#06b6d4" },
  delivered: { label: "Livrée", icon: "✅", color: "#22c55e" },
  cancelled: { label: "Annulée", icon: "❌", color: "#ef4444" },
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, info]) => ({
  value,
  label: info.label,
}));
