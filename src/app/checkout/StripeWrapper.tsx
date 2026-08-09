"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "./CheckoutForm";
import { useLanguage } from "@/contexts/LanguageContext";
import "./checkout.css";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export default function StripeWrapper({ total }: { total: number }) {
  const { t } = useLanguage();

  if (!stripeKey) {
    return (
      <p className="checkout-loading">{t.checkout.stripeUnavailable}</p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: Math.round(total * 100),
        currency: "eur",
        paymentMethodTypes: ["card", "amazon_pay"],
      }}
    >
      <CheckoutForm />
    </Elements>
  );
}