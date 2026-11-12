// app/api/admin/orders/[id]/shipping/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUuid } from "@/app/lib/neon";
import { findOrderById } from "@/app/lib/repos/orders";
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

    const { id } = await params;

    if (!isUuid(id)) {
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

    return NextResponse.json(await findOrderById(id, { populate: false }));
  } catch (error) {
    console.error("POST SHIPPING ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
