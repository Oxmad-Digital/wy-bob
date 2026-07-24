import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Product from "@/app/models/Product";
import { computeTotalWeightKg } from "@/app/lib/shipping/weight";
import { computeShippingFee } from "@/app/lib/shipping/pricing";
import { resolveZone } from "@/app/lib/shipping/zones";

// Estimation live du frais de livraison pour l'affichage au checkout. Le montant
// définitif est toujours recalculé côté serveur au moment du paiement/de la commande
// (create-payment-intent, order) — cet endpoint ne fait qu'informer l'utilisateur avant
// paiement, il n'a aucune valeur d'engagement contractuel côté serveur.
export async function POST(req: Request) {
  try {
    const { cartItems, country, deliveryMethod } = await req.json();

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Panier vide" }, { status: 400 });
    }

    await connectDB();

    const productLines = [];
    for (const item of cartItems) {
      if (!item.productId) continue;
      const product = await Product.findById(item.productId).select("weight");
      if (!product) continue;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      productLines.push({ product: { weight: product.weight }, quantity: qty });
    }

    if (productLines.length === 0) {
      return NextResponse.json({ error: "Aucun produit valide dans le panier" }, { status: 400 });
    }

    const weightKg = computeTotalWeightKg(productLines);
    const method = deliveryMethod === "relay" ? "relay" : "home";
    const shippingFee = computeShippingFee({ country, weightKg, deliveryMethod: method });

    return NextResponse.json({ shippingFee, weightKg, zone: resolveZone(country) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
