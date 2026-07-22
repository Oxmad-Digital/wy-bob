"use client";

import { useCart } from "@/components/panier-context";
import StripeWrapper from "./StripeWrapper";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSession } from "next-auth/react";
import "../page.css";
import "./checkout.css";

export default function CheckoutPage() {
  const { cartTotal } = useCart();
  const { status } = useSession();

  const TVA_RATE = 0.20;
  const tva = Math.round(cartTotal * TVA_RATE);
  const livraison = 25;
  const total = cartTotal + tva + livraison;

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