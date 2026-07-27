"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "../../page.css";
import "../../checkout/success/success.css";

export default function ExtraPaymentSuccessPage() {
  return (
    <div className="container">
      <Navbar />
      <div className="checkoutZone checkout-result">
        <div className="checkout-result-card">
          <div className="checkout-result-icon checkout-result-icon--success">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="checkout-result-title">Paiement reçu</h1>
          <p className="checkout-result-text">
            Merci, votre paiement a bien été enregistré. Votre commande a été mise à jour.
          </p>
          <Link href="/" className="checkout-result-cta checkout-result-cta--primary">Retour à l&apos;accueil</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
