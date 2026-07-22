"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/components/panier-context";
import "../../page.css";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
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
      <div className="checkoutZone" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "16px", textAlign: "center" }}>
        {failed ? (
          <>
            <h1>Paiement non abouti</h1>
            <p>Le paiement a été annulé ou refusé. Votre commande n'a pas été validée.</p>
            <Link href="/checkout">Réessayer</Link>
          </>
        ) : (
          <>
            <h1>Paiement reçu</h1>
            <p>Votre paiement a bien été validé. Vous recevrez un email de confirmation sous peu.</p>
            <Link href="/">Retour à l'accueil</Link>
          </>
        )}
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
