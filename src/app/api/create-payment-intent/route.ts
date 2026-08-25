import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Product from "@/app/models/Product";
import { computeOrderTotals } from "@/app/lib/pricing";
import { resolvePromoDiscount } from "@/app/lib/promo";
import { computeTotalWeightKg } from "@/app/lib/shipping/weight";
import { computeShippingFee } from "@/app/lib/shipping/pricing";
import { computeInsuranceFee } from "@/app/lib/shipping/insurance";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Paiement non disponible" }, { status: 503 });
  }

  try {
    await connectDB();
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({ key: `create-payment-intent:${ip}`, windowMs: 60 * 1000, maxAttempts: 15 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const { cartItems, promoCode, country, deliveryMethod, insuranceOpted, idempotencyKey } = await req.json();

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Panier vide" }, { status: 400 });
    }

    // Recalculate total strictly server-side — never trust client-supplied prices
    let subtotal = 0;
    const productLines = [];
    for (const item of cartItems) {
      if (!item.productId) {
        return NextResponse.json({ error: "Panier obsolète, veuillez le vider et réajouter vos articles" }, { status: 400 });
      }
      const product = await Product.findById(item.productId).select("price weight");
      if (!product) {
        return NextResponse.json({ error: `Produit introuvable: ${item.productId}` }, { status: 404 });
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      subtotal += product.price * qty;
      productLines.push({ product: { weight: product.weight }, quantity: qty });
    }

    if (subtotal <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    const session = await auth();
    const { discount } = await resolvePromoDiscount(promoCode, subtotal, session?.user?.id ?? null);
    const weightKg = computeTotalWeightKg(productLines);
    const method = deliveryMethod === "relay" ? "relay" : "home";
    const shippingFee = computeShippingFee({ country, weightKg, deliveryMethod: method });
    const discountedSubtotal = subtotal - discount;
    const insuranceFee = insuranceOpted ? computeInsuranceFee(discountedSubtotal) : 0;
    const { total } = computeOrderTotals(discountedSubtotal, shippingFee, insuranceFee);
    const totalCents = Math.round(total * 100);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    // Réutilise le même PaymentIntent (donc la même tentative d'autorisation bancaire) tant
    // que la tentative de checkout et le montant n'ont pas changé, pour éviter qu'un retry
    // après échec (double-clic, décliné puis réessayé) ne génère une nouvelle autorisation
    // sur la carte — enchaîner plusieurs autorisations distinctes est le genre de pattern
    // que les systèmes anti-fraude bancaires bloquent.
    const stripeIdempotencyKey =
      typeof idempotencyKey === "string" && idempotencyKey
        ? `${idempotencyKey}:${totalCents}`
        : undefined;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency: "eur",
        payment_method_types: ["card", "amazon_pay"],
      },
      stripeIdempotencyKey ? { idempotencyKey: stripeIdempotencyKey } : undefined
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
