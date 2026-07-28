// app/api/admin/orders/[id]/refund/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import mongoose from "mongoose";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import { auth } from "@/auth";
import { sendEmail } from "@/app/lib/mailer";
import { getRefundEmailTemplate } from "@/app/lib/emailTemplates";

// ✅ POST - Rembourse tout ou partie d'une commande payée par carte via Stripe
// (droit de rétractation légal de 14 jours, litige, erreur de commande, etc.)
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

    if (!order.paymentIntentId) {
      return NextResponse.json(
        { message: "Cette commande n'a pas de paiement Stripe associé (paiement hors ligne) — remboursement à effectuer manuellement." },
        { status: 400 }
      );
    }

    const alreadyRefunded = (order.refunds || [])
      .filter((r) => r.status === "succeeded")
      .reduce((sum, r) => sum + r.amount, 0);
    const refundable = Math.round((order.total - alreadyRefunded) * 100) / 100;

    if (numericAmount > refundable) {
      return NextResponse.json(
        { message: `Montant trop élevé — il reste ${refundable.toFixed(2)} € remboursable sur cette commande.` },
        { status: 400 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    const stripeRefund = await stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      amount: Math.round(numericAmount * 100),
    });

    order.refunds.push({
      amount: numericAmount,
      reason: reason?.trim() || "",
      stripeRefundId: stripeRefund.id,
      status: stripeRefund.status === "failed" ? "failed" : "succeeded",
    });
    await order.save();

    const orderNumber = order.orderNumber
      ? String(order.orderNumber).padStart(4, "0")
      : order._id.toString().slice(-8).toUpperCase();

    if (order.customer?.email) {
      const emailHtml = getRefundEmailTemplate({
        firstname: order.customer.firstname || "Client",
        orderNumber,
        amount: numericAmount,
        reason: reason?.trim(),
      });
      try {
        await sendEmail({
          to: order.customer.email,
          subject: `Remboursement — Commande #${orderNumber}`,
          html: emailHtml,
        });
      } catch (emailErr) {
        // Le remboursement est déjà effectif côté Stripe — un échec d'envoi ne doit pas
        // faire échouer la requête, l'admin voit le remboursement dans la liste.
        console.error("EMAIL REFUND ERROR (non bloquant):", emailErr);
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("POST REFUND ERROR:", error);
    const message = error?.type === "StripeInvalidRequestError"
      ? error.message
      : "Erreur serveur";
    return NextResponse.json({ message }, { status: 500 });
  }
}
