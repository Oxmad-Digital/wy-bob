// app/api/admin/orders/[id]/track/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { trackParcel, searchPOD } from "@/app/lib/chronopost/tracking";
import { ChronopostError } from "@/app/lib/chronopost/client";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";

// Libellés de suivi Chronopost (fr_FR) qui suggèrent une livraison — sert uniquement de
// déclencheur pour vérifier via searchPOD (signal Chronopost non ambigu) avant de
// basculer automatiquement le statut, jamais pour décider seul.
const DELIVERED_HINT = /livr/i;
const DELIVERED_EXCLUDE = /non[\s-]?livr|refus|absent|litige|attente/i;

// ✅ POST - Actualiser le suivi Chronopost d'une commande
export async function POST(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }
    if (!order.shipping?.skybillNumber) {
      return NextResponse.json({ message: "Aucune étiquette générée pour cette commande" }, { status: 400 });
    }

    let resultOrder = order;

    try {
      const tracking = await trackParcel(order.shipping.skybillNumber);
      order.shipping.trackingStatus = tracking.statusLabel || tracking.statusCode || "";
      order.shipping.trackingEvents = tracking.events;
      order.shipping.lastTrackedAt = new Date();
      await order.save();

      let currentStatus = order.status;

      // Le premier événement de suivi signifie que le colis a été scanné par le
      // transporteur : la commande a donc quitté la préparation, même si l'admin n'a
      // pas cliqué sur "Expédiée" manuellement.
      if (tracking.events?.length > 0 && ["paid", "processing"].includes(currentStatus)) {
        resultOrder = (await applyOrderStatusChange(order._id.toString(), "shipped")) || order;
        currentStatus = resultOrder.status;
      }

      const label = tracking.statusLabel || "";
      const looksDelivered = DELIVERED_HINT.test(label) && !DELIVERED_EXCLUDE.test(label);

      if (looksDelivered && !["delivered", "cancelled"].includes(currentStatus)) {
        try {
          const pod = await searchPOD(order.shipping.skybillNumber);
          if (pod.available && pod.base64) {
            order.shipping.podBase64 = pod.base64;
            await order.save();
            resultOrder = (await applyOrderStatusChange(order._id.toString(), "delivered")) || order;
          }
        } catch (podErr) {
          // Vérification best-effort : un échec ici ne doit pas faire échouer le
          // rafraîchissement du suivi, qui a déjà réussi.
          console.error("CHRONOPOST AUTO-POD CHECK ERROR (non bloquant):", podErr);
        }
      }
    } catch (trackErr) {
      console.error("CHRONOPOST TRACK ERROR:", trackErr);
      const message = trackErr instanceof ChronopostError ? trackErr.message : "Suivi Chronopost indisponible";
      return NextResponse.json({ message }, { status: 502 });
    }

    return NextResponse.json(resultOrder);
  } catch (error) {
    console.error("POST TRACK ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
