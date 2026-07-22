// app/api/admin/orders/[id]/pod/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { searchPOD } from "@/app/lib/chronopost/tracking";
import { ChronopostError } from "@/app/lib/chronopost/client";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";

// ✅ GET - Récupérer (et mettre en cache) la preuve de livraison Chronopost d'une commande
export async function GET(req, { params }) {
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

    if (order.shipping?.podBase64) {
      // La preuve de livraison existe déjà — s'assure que le statut a bien suivi,
      // au cas où elle aurait été mise en cache avant l'ajout de ce basculement auto.
      if (!["delivered", "cancelled"].includes(order.status)) {
        await applyOrderStatusChange(order._id.toString(), "delivered").catch((err) =>
          console.error("AUTO STATUS DELIVERED ERROR (non bloquant):", err)
        );
      }
      const pdfBuffer = Buffer.from(order.shipping.podBase64, "base64");
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=\"pod-chronopost.pdf\"" },
      });
    }

    if (!order.shipping?.skybillNumber) {
      return NextResponse.json({ message: "Aucune étiquette générée pour cette commande" }, { status: 400 });
    }

    try {
      const pod = await searchPOD(order.shipping.skybillNumber);
      if (!pod.available || !pod.base64) {
        return NextResponse.json({ message: "Preuve de livraison pas encore disponible" }, { status: 404 });
      }
      order.shipping.podBase64 = pod.base64;
      await order.save();

      // Une preuve de livraison disponible est un signal Chronopost non ambigu —
      // on fait suivre le statut automatiquement (email client inclus).
      if (!["delivered", "cancelled"].includes(order.status)) {
        await applyOrderStatusChange(order._id.toString(), "delivered").catch((err) =>
          console.error("AUTO STATUS DELIVERED ERROR (non bloquant):", err)
        );
      }

      const pdfBuffer = Buffer.from(pod.base64, "base64");
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=\"pod-chronopost.pdf\"" },
      });
    } catch (podErr) {
      console.error("CHRONOPOST POD ERROR:", podErr);
      const message = podErr instanceof ChronopostError ? podErr.message : "Preuve de livraison indisponible";
      return NextResponse.json({ message }, { status: 502 });
    }
  } catch (error) {
    console.error("GET POD ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
