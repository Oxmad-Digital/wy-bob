// app/api/admin/orders/[id]/customer/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { isValidPostalCode } from "@/app/lib/shipping/postalCode";
import { COUNTRY_OPTIONS } from "@/app/lib/shipping/countries";

const VALID_COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map((c) => c.code));

// ✅ PATCH - Corriger manuellement les coordonnées client d'une commande (faute de frappe
// sur l'adresse, code postal incohérent avec le pays, etc.). Utile quand la commande est
// déjà payée : plutôt que rembourser/refaire commander le client pour une simple erreur de
// saisie, l'admin corrige ici puis régénère l'étiquette Chronopost depuis la page commande.
export async function PATCH(req, { params }) {
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
    const firstname = (body.firstname || "").trim();
    const lastname = (body.lastname || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const company = (body.company || "").trim();
    const address = (body.address || "").trim();
    const postalCode = (body.postalCode || "").trim();
    const city = (body.city || "").trim();
    const country = (body.country || "").trim().toUpperCase();

    if (!firstname || !lastname || !email || !address || !postalCode || !city || !country) {
      return NextResponse.json({ message: "Veuillez remplir tous les champs obligatoires" }, { status: 400 });
    }

    if (!VALID_COUNTRY_CODES.has(country)) {
      return NextResponse.json({ message: "Pays non reconnu" }, { status: 400 });
    }

    if (!isValidPostalCode(country, postalCode)) {
      return NextResponse.json(
        { message: "Le code postal ne correspond pas au format attendu pour ce pays" },
        { status: 400 }
      );
    }

    const order = await Order.findByIdAndUpdate(
      id,
      {
        "customer.firstname": firstname,
        "customer.lastname": lastname,
        "customer.email": email,
        "customer.phone": phone,
        "customer.company": company,
        "customer.address": address,
        "customer.postalCode": postalCode,
        "customer.city": city,
        "customer.country": country,
      },
      { new: true }
    ).populate("products.product");

    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("PATCH ORDER CUSTOMER ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
