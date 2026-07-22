"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "./CheckoutForm";
import "./checkout.css";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export default function StripeWrapper({ total }: { total: number }) {
  if (!stripeKey) {
    return (
      <p className="checkout-loading">Le paiement en ligne sera disponible prochainement.</p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ mode: "payment", amount: Math.round(total * 100), currency: "eur" }}>
      <CheckoutForm />
    </Elements>
  );
}