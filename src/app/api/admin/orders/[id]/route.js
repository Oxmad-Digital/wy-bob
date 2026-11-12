// app/api/admin/orders/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUuid, withTransaction } from "@/app/lib/neon";
import { deleteOrder, findOrderById, findOrderStockLines, lockOrder } from "@/app/lib/repos/orders";
import { applyLineStockDelta } from "@/app/lib/repos/products";
import { findInvoiceNumberByOrderId } from "@/app/lib/repos/invoices";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";

// ✅ GET - Récupérer les détails d'une commande
export async function GET(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const order = await findOrderById(id);

    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ✅ PATCH - Mettre à jour le statut
export async function PATCH(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const { status } = await req.json();

    const allowedStatus = [
      "pending",
      "processing",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatus.includes(status)) {
      return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
    }

    // Applique le changement de statut : persistance + déclenchement Chronopost
    // (paid/processing) + email client. Logique partagée avec le webhook Stripe.
    const freshOrder = await applyOrderStatusChange(id, status);

    if (!freshOrder) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    return NextResponse.json(freshOrder);
  } catch (error) {
    console.error("PATCH ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ✅ DELETE - Supprimer une commande
export async function DELETE(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    // Vérifications, restitution du stock et suppression dans une seule transaction,
    // commande verrouillée : une annulation concurrente ne peut pas restituer le stock
    // une seconde fois.
    const result = await withTransaction(async (client) => {
      const order = await lockOrder(client, id);
      if (!order) return { error: "Commande introuvable", status: 404 };

      // ⚠️ Empêcher la suppression de commandes payées ou expédiées
      const protectedStatus = ["paid", "shipped", "delivered"];
      if (protectedStatus.includes(order.status)) {
        return { error: `Impossible de supprimer une commande ${order.status}`, status: 400 };
      }

      // Une facture ne doit pas perdre sa commande (FK RESTRICT). Avec Mongo, la commande
      // était supprimée et la facture restait orpheline ; ici on refuse explicitement.
      const invoiceNumber = await findInvoiceNumberByOrderId(id, client);
      if (invoiceNumber) {
        return {
          error: `Impossible de supprimer une commande facturée (facture ${invoiceNumber})`,
          status: 409,
        };
      }

      // Le stock avait été réservé à la création — s'il n'a pas déjà été restitué par une
      // annulation, on le restitue avant de supprimer la commande. Même logique que
      // l'annulation (variante + recalcul du total produit).
      if (order.status !== "cancelled") {
        const lines = await findOrderStockLines(client, id);
        for (const line of lines) {
          await applyLineStockDelta(client, line, line.quantity);
        }
      }

      await deleteOrder(client, id);
      return { ok: true };
    });

    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: "Commande supprimée avec succès" });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
