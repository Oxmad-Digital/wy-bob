"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/components/panier-context";
import { useLanguage } from "@/contexts/LanguageContext";
import "../../page.css";
import "../checkout.css";
import "./success.css";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const { t } = useLanguage();
  // Absent (arrivée directe depuis CheckoutForm après confirmPayment sans redirection) ou
  // "succeeded" (retour d'un moyen de paiement redirigé type Bancontact/MB Way) = paiement OK.
  const redirectStatus = searchParams.get("redirect_status");
  const failed = redirectStatus === "failed" || redirectStatus === "canceled";
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (!failed && !cleared) {
      clearCart();
      setCleared(true);
    }
  }, [failed, cleared, clearCart]);

  return (
    <div className="container">
      <Navbar />
      <div className="checkoutZone checkout-result">
        <div className="checkout-result-card">
          {failed ? (
            <>
              <div className="checkout-result-icon checkout-result-icon--failed">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="checkout-result-title">{t.checkout.success.failedTitle}</h1>
              <p className="checkout-result-text">{t.checkout.success.failedText}</p>
              <Link href="/checkout" className="checkout-result-cta checkout-result-cta--primary">{t.checkout.success.retry}</Link>
            </>
          ) : (
            <>
              <div className="checkout-result-icon checkout-result-icon--success">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="checkout-result-title">{t.checkout.success.successTitle}</h1>
              <p className="checkout-result-text">{t.checkout.success.successText}</p>
              <Link href="/" className="checkout-result-cta checkout-result-cta--primary">{t.checkout.success.backHome}</Link>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
