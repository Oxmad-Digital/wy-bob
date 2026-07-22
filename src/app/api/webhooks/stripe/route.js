// app/api/webhooks/stripe/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { applyOrderStatusChange } from "@/app/lib/orderStatusChange";

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook Stripe non configuré" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
  });

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("STRIPE WEBHOOK SIGNATURE ERROR:", err.message);
    return NextResponse.json({ error: `Signature invalide: ${err.message}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    await connectDB();
    const order = await Order.findOne({ paymentIntentId: paymentIntent.id });

    if (!order) {
      // La commande n'existe pas encore (le POST /api/order côté client n'a pas
      // terminé) — on renvoie une erreur pour que Stripe retente automatiquement
      // ce webhook quelques instants plus tard plutôt que de perdre l'événement.
      return NextResponse.json({ error: "Commande non trouvée, nouvelle tentative attendue" }, { status: 404 });
    }

    if (order.status === "pending" || order.status === "confirmed") {
      await applyOrderStatusChange(order._id.toString(), "paid");
    }
  }

  return NextResponse.json({ received: true });
}
