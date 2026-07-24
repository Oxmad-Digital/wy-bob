"use client";

import { useCart } from "@/components/panier-context";
import StripeWrapper from "./StripeWrapper";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSession } from "next-auth/react";
import { computeOrderTotals } from "@/app/lib/pricing";
import { FALLBACK_SHIPPING_FEE } from "@/app/lib/shipping/zones";
import "../page.css";
import "./checkout.css";

export default function CheckoutPage() {
  const { finalTotal } = useCart();
  const { status } = useSession();

  // Montant initial approximatif pour l'amorçage du Payment Element — corrigé dès que
  // CheckoutForm obtient la vraie estimation (poids réel + zone) via elements.update().
  const { total } = computeOrderTotals(finalTotal, FALLBACK_SHIPPING_FEE);

  // Chargement de la session — on attend avant d'afficher le formulaire (pré-remplissage
  // de l'email si connecté), mais la connexion n'est jamais obligatoire pour commander.
  if (status === "loading") {
    return (
      <div className="container">
        <Navbar />
        <div className="checkoutZone">
          <p className="checkout-loading">Chargement...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="container">
      <Navbar />
      <div className="checkoutZone">
        <StripeWrapper total={total} />
      </div>
      <Footer />
    </div>
  );
}