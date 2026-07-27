"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "../../page.css";
import "../../checkout/success/success.css";

export default function ExtraPaymentCancelPage() {
  return (
    <div className="container">
      <Navbar />
      <div className="checkoutZone checkout-result">
        <div className="checkout-result-card">
          <div className="checkout-result-icon checkout-result-icon--failed">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="checkout-result-title">Paiement annulé</h1>
          <p className="checkout-result-text">
            Le paiement n&apos;a pas été finalisé. Vous pouvez réessayer en utilisant le lien reçu par email.
          </p>
          <Link href="/" className="checkout-result-cta checkout-result-cta--primary">Retour à l&apos;accueil</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
