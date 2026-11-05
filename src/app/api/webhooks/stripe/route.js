// app/api/webhooks/stripe/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { findOrderStatusByPaymentIntent, markExtraPaymentPaid } from "@/app/lib/repos/orders";
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

    const order = await findOrderStatusByPaymentIntent(paymentIntent.id);

    if (!order) {
      // La commande n'existe pas encore (le POST /api/order côté client n'a pas
      // terminé) — on renvoie une erreur pour que Stripe retente automatiquement
      // ce webhook quelques instants plus tard plutôt que de perdre l'événement.
      return NextResponse.json({ error: "Commande non trouvée, nouvelle tentative attendue" }, { status: 404 });
    }

    if (order.status === "pending") {
      await applyOrderStatusChange(order._id, "paid");
    }
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;

    if (checkoutSession.metadata?.type === "extra_payment") {
      // orderId / extraPaymentId : uuid, ou ancien ObjectId pour une session Stripe créée
      // avant la bascule vers PostgreSQL (résolu via mongo_id).
      await markExtraPaymentPaid(
        String(checkoutSession.metadata.orderId ?? ""),
        String(checkoutSession.metadata.extraPaymentId ?? "")
      );
    }
  }

  return NextResponse.json({ received: true });
}
