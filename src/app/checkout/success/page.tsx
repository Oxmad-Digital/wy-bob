"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "../../page.css";

export default function CheckoutSuccessPage() {
  return (
    <div className="container">
      <Navbar />
      <div className="checkoutZone" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "16px", textAlign: "center" }}>
        <h1>Paiement reçu</h1>
        <p>Votre paiement a bien été validé. Vous recevrez un email de confirmation sous peu.</p>
        <Link href="/">Retour à l'accueil</Link>
      </div>
      <Footer />
    </div>
  );
}
