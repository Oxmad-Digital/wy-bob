import { NextResponse } from "next/server";
import Stripe from "stripe";
import { connectDB } from "@/app/lib/db";
import Product from "@/app/models/Product";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Paiement non disponible" }, { status: 503 });
  }

  try {
    const { cartItems } = await req.json();

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Panier vide" }, { status: 400 });
    }

    await connectDB();

    // Recalculate total strictly server-side — never trust client-supplied prices
    let totalCents = 0;
    for (const item of cartItems) {
      const product = await Product.findById(item.productId).select("price");
      if (!product) {
        return NextResponse.json({ error: `Produit introuvable: ${item.productId}` }, { status: 404 });
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      totalCents += Math.round(product.price * 100) * qty;
    }

    if (totalCents <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "eur",
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
