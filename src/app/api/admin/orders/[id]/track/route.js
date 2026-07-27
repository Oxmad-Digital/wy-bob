// app/api/admin/orders/[id]/track/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { ChronopostError } from "@/app/lib/chronopost/client";
import { refreshOrderTracking } from "@/app/lib/chronopost/refreshOrderTracking";

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
      resultOrder = await refreshOrderTracking(order);
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
