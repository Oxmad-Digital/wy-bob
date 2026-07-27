// app/api/admin/orders/[id]/extra-payment/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import mongoose from "mongoose";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import { sendEmail } from "@/app/lib/mailer";
import { getExtraPaymentEmailTemplate } from "@/app/lib/emailTemplates";

// ✅ POST - Génère un lien de paiement Stripe à montant libre (ex. frais de
// réexpédition suite à une correction d'adresse) et l'envoie par email au client.
export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ message: "Paiement non disponible" }, { status: 503 });
    }

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const { amount, reason } = await req.json();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ message: "Montant invalide" }, { status: 400 });
    }

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }
    if (!order.customer?.email) {
      return NextResponse.json({ message: "Ce client n'a pas d'adresse email" }, { status: 400 });
    }

    const orderNumber = order.orderNumber
      ? String(order.orderNumber).padStart(4, "0")
      : order._id.toString().slice(-8).toUpperCase();

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    const extraPaymentId = new mongoose.Types.ObjectId();
    const label = reason?.trim() || `Complément commande #${orderNumber}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: order.customer.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: label },
            unit_amount: Math.round(numericAmount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/paiement-complementaire/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/paiement-complementaire/annule`,
      metadata: {
        type: "extra_payment",
        orderId: order._id.toString(),
        extraPaymentId: extraPaymentId.toString(),
      },
    });

    order.extraPayments.push({
      _id: extraPaymentId,
      reason: label,
      amount: numericAmount,
      status: "pending",
      stripeSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    });
    await order.save();

    const emailHtml = getExtraPaymentEmailTemplate({
      firstname: order.customer.firstname || "Client",
      orderNumber,
      reason: label,
      amount: numericAmount,
      paymentUrl: checkoutSession.url,
    });

    try {
      await sendEmail({
        to: order.customer.email,
        subject: `Paiement complémentaire — Commande #${orderNumber}`,
        html: emailHtml,
      });
    } catch (emailErr) {
      // Le lien de paiement existe déjà côté Stripe et est enregistré sur la commande —
      // un échec d'envoi ne doit pas faire perdre le lien, l'admin peut le renvoyer.
      console.error("EMAIL EXTRA PAYMENT ERROR (non bloquant):", emailErr);
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("POST EXTRA PAYMENT ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
