// app/api/admin/orders/[id]/shipping/cancel/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { cancelShipment } from "@/app/lib/chronopost/cancel";
import { ChronopostError } from "@/app/lib/chronopost/client";

// ✅ POST - Annuler l'étiquette Chronopost d'une commande
// ⚠️ Non testable avec le compte de test Chronopost (cf. cahier des charges transmis
// par la cliente) — à vérifier une fois le compte de production activé.
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
    if (order.shipping?.cancelledAt) {
      return NextResponse.json({ message: "Étiquette déjà annulée" }, { status: 400 });
    }

    try {
      const result = await cancelShipment(order.shipping.skybillNumber);
      if (!result.cancelled) {
        return NextResponse.json({ message: result.message }, { status: 502 });
      }
      order.shipping.cancelledAt = new Date();
      await order.save();
    } catch (cancelErr) {
      console.error("CHRONOPOST CANCEL ERROR:", cancelErr);
      const message = cancelErr instanceof ChronopostError ? cancelErr.message : "Annulation Chronopost indisponible";
      return NextResponse.json({ message }, { status: 502 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("POST CANCEL SHIPPING ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
