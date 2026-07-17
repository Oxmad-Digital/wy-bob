// app/api/admin/orders/[id]/shipping/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { generateShipmentForOrder, markShippingError } from "@/app/lib/chronopost/orderShipment";

// ✅ POST - (Re)générer manuellement l'étiquette Chronopost d'une commande, avec
// possibilité de forcer le produit/service/poids (utilisé aussi pour produire les
// jeux de requêtes/réponses/étiquettes exigés par Chronopost pour la validation du compte)
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

    const body = await req.json().catch(() => ({}));
    const overrides = {
      saturday: Boolean(body.saturday),
      businessType: body.businessType === "BtoB" ? "BtoB" : "BtoC",
      productKeyOverride: body.productKeyOverride || undefined,
      weightKgOverride:
        body.weightKgOverride !== undefined && body.weightKgOverride !== ""
          ? Number(body.weightKgOverride)
          : undefined,
    };

    try {
      await generateShipmentForOrder(id, overrides);
    } catch (shippingErr) {
      console.error("CHRONOPOST MANUAL SHIPPING ERROR:", shippingErr);
      await markShippingError(id, shippingErr.message || "Erreur inconnue Chronopost");
      return NextResponse.json(
        { message: shippingErr.message || "Erreur Chronopost" },
        { status: 502 }
      );
    }

    const order = await Order.findById(id);
    return NextResponse.json(order);
  } catch (error) {
    console.error("POST SHIPPING ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
