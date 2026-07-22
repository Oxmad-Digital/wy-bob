"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { useCart } from "@/components/panier-context";
import RelayPointPicker, { type RelayPoint } from "./RelayPointPicker";
import "./checkout.css";

// Codes pays ISO2 — requis par l'API Chronopost (domicile FR vs international,
// recherche de points relais). Le pays déterminait auparavant un simple texte libre.
const COUNTRY_OPTIONS = [
  { code: "MG", label: "Madagascar" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "US", label: "États-Unis" },
];

export default function CheckoutForm({ total }: { total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { data: session } = useSession();
  const { cartItems, cartTotal, appliedPromo, finalTotal, setAppliedPromo } = useCart();

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("MG");
  const [shipping, setShipping] = useState("colissimo");
  const [relayPoint, setRelayPoint] = useState<RelayPoint | null>(null);
  const [recipientPickupName, setRecipientPickupName] = useState("");
  const [loading, setLoading] = useState(false);

  const TVA_RATE = 0.20;
  const livraison = 25;
  const totalQty = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.quantity, 0),
    [cartItems]
  );
  const tva = useMemo(
    () => Math.round(finalTotal * TVA_RATE),
    [finalTotal]
  );

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!firstname || !lastname || !email || !city || !address) {
    alert("Veuillez remplir tous les champs obligatoires");
    return;
  }
  if (shipping === "relais" && !relayPoint) {
    alert("Veuillez sélectionner un point relais");
    return;
  }
  if (!cartItems || cartItems.length === 0) {
    alert("Votre panier est vide");
    return;
  }
  if (!stripe || !elements) return;

  setLoading(true);

  try {
    // ✅ 1 — Soumettre les éléments Stripe d'abord
    const { error: submitError } = await elements.submit();
    if (submitError) {
      alert(submitError.message);
      setLoading(false);
      return;
    }

    // 2 — Créer le payment intent (montant calculé côté serveur via les IDs produits)
    const res = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartItems: cartItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
        promoCode: appliedPromo?.code ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Erreur lors de la création du paiement");
      setLoading(false);
      return;
    }
    const { clientSecret, paymentIntentId } = await res.json();

    // 3 — Confirmer le paiement
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
      redirect: "if_required",
    });

    if (stripeError) {
      alert(stripeError.message);
      return;
    }

    // 4 — Créer la commande, reliée au PaymentIntent (le webhook Stripe s'en sert pour
    // confirmer le paiement côté serveur et déclencher automatiquement l'étiquette Chronopost)
    const orderRes = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: { firstname, lastname, email, phone, company, city, address, postalCode, country },
        cartItems,
        total: finalTotal,
        payment: "card",
        paymentIntentId,
        delivery: shipping,
        relayPoint: shipping === "relais" ? relayPoint : null,
        recipientPickupName: shipping === "relais" ? (recipientPickupName || `${firstname} ${lastname}`) : "",
        promoCode: appliedPromo?.code ?? null,
        promoDiscount: appliedPromo?.discount ?? 0,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      alert(orderData.message || "Erreur lors de la commande");
      return;
    }

    setAppliedPromo(null);
    alert("✅ Commande confirmée !");
    localStorage.removeItem("cart");
    router.push("/");

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    alert("Erreur serveur");
  } finally {
    setLoading(false);
  }
};
  return (
    <>
      <button className="checkout-back" onClick={() => router.back()}>
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Retour
      </button>

      <div className="checkout-wrapper">

        <div className="checkout-left">
          <div className="checkout-section">
            <h3 className="checkout-section-title">Contact</h3>
            <input type="email" placeholder="Tom.exemple@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="checkout-input" required />
            <input type="tel" placeholder="Téléphone (ex: 034 00 000 00)" value={phone} onChange={(e) => setPhone(e.target.value)} className="checkout-input" />
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">Livraison</h3>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="checkout-input">
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <div className="checkout-row">
              <input type="text" placeholder="Prénom" value={firstname} onChange={(e) => setFirstname(e.target.value)} className="checkout-input" required />
              <input type="text" placeholder="Nom" value={lastname} onChange={(e) => setLastname(e.target.value)} className="checkout-input" required />
            </div>
            <input type="text" placeholder="Entreprise (optionnel)" value={company} onChange={(e) => setCompany(e.target.value)} className="checkout-input" />
            <input type="text" placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} className="checkout-input" required />
            <div className="checkout-row">
              <input type="text" placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="checkout-input" />
              <input type="text" placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} className="checkout-input" required />
            </div>
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">Mode d'expédition</h3>
            <label className="checkout-radio">
              <input type="radio" name="shipping" value="colissimo" checked={shipping === "colissimo"} onChange={() => setShipping("colissimo")} />
              <span>Colissimo - Signature International 2 à 8 jours</span>
            </label>
            <label className="checkout-radio">
              <input type="radio" name="shipping" value="relais" checked={shipping === "relais"} onChange={() => setShipping("relais")} />
              <span>Livraison en point relais Colissimo 2 à 4 jours</span>
            </label>

            {shipping === "relais" && (
              <>
                <RelayPointPicker
                  address={address}
                  zipCode={postalCode}
                  city={city}
                  country={country}
                  value={relayPoint}
                  onChange={setRelayPoint}
                />
                <input
                  type="text"
                  placeholder="Personne habilitée à retirer le colis (optionnel)"
                  value={recipientPickupName}
                  onChange={(e) => setRecipientPickupName(e.target.value)}
                  className="checkout-input"
                />
              </>
            )}
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">Paiement</h3>
            <PaymentElement />
          </div>

          <button className="checkout-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Envoi..." : "Vérifier la commande"}
          </button>
        </div>

        <div className="checkout-right">
          {cartItems.length > 0 && (
            <div className="checkout-items">
              {cartItems.map((item: any) => (
                <div key={item._id} className="checkout-item">
                  <div className="checkout-item-image">
                    {item.image && <img src={item.image} alt={item.name} />}
                  </div>
                  <div className="checkout-item-info">
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span className="checkout-item-price">{item.promoPrice ?? item.price} €</span>
                </div>
              ))}
            </div>
          )}

          <div className="checkout-summary">
            <h3 className="checkout-summary-title">Résumé de la commande</h3>
            <div className="checkout-summary-row">
              <span>Sous-total ({totalQty})</span>
              <span>{cartTotal} €</span>
            </div>
            {appliedPromo && (
              <div className="checkout-summary-row checkout-summary-discount">
                <span>Réduction ({appliedPromo.code})</span>
                <span>−{appliedPromo.discount} €</span>
              </div>
            )}
            <div className="checkout-summary-row">
              <span>TVA (20%)</span>
              <span>{tva} €</span>
            </div>
            <div className="checkout-summary-row">
              <span>Livraison</span>
              <span>{livraison} €</span>
            </div>
            <div className="checkout-summary-divider" />
            <div className="checkout-summary-row checkout-summary-total">
              <span>Total</span>
              <span>{total} €</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
