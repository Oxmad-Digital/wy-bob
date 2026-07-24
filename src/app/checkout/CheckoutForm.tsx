"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { useCart } from "@/components/panier-context";
import RelayPointPicker, { type RelayPoint } from "./RelayPointPicker";
import { computeOrderTotals } from "@/app/lib/pricing";
import { formatDeliveryLabel } from "@/app/lib/shipping/delivery";
import "./checkout.css";

// Codes pays ISO2 — requis par l'API Chronopost (domicile FR vs international,
// recherche de points relais). Le pays déterminait auparavant un simple texte libre.
//
// Volontairement restreint à l'Europe (UE + hors UE géographiquement européen comme la
// Suisse ou le Royaume-Uni) : sans confirmation de la couverture réelle du contrat
// Chronopost à l'international, mieux vaut éviter les destinations lointaines qui
// risqueraient de ne pas être livrables. Cette liste doit rester synchronisée avec
// ZONE_BY_COUNTRY dans shipping/zones.ts (mêmes pays, mêmes zones FR/EU_PROCHE/EUROPE_LARGE).
const COUNTRY_OPTIONS = [
  { code: "AL", label: "Albanie" },
  { code: "DE", label: "Allemagne" },
  { code: "AD", label: "Andorre" },
  { code: "AT", label: "Autriche" },
  { code: "BE", label: "Belgique" },
  { code: "BA", label: "Bosnie-Herzégovine" },
  { code: "BG", label: "Bulgarie" },
  { code: "CY", label: "Chypre" },
  { code: "HR", label: "Croatie" },
  { code: "DK", label: "Danemark" },
  { code: "ES", label: "Espagne" },
  { code: "EE", label: "Estonie" },
  { code: "FI", label: "Finlande" },
  { code: "FR", label: "France" },
  { code: "GR", label: "Grèce" },
  { code: "HU", label: "Hongrie" },
  { code: "IE", label: "Irlande" },
  { code: "IS", label: "Islande" },
  { code: "IT", label: "Italie" },
  { code: "LV", label: "Lettonie" },
  { code: "LI", label: "Liechtenstein" },
  { code: "LT", label: "Lituanie" },
  { code: "LU", label: "Luxembourg" },
  { code: "MK", label: "Macédoine du Nord" },
  { code: "MT", label: "Malte" },
  { code: "MC", label: "Monaco" },
  { code: "ME", label: "Monténégro" },
  { code: "NO", label: "Norvège" },
  { code: "NL", label: "Pays-Bas" },
  { code: "PL", label: "Pologne" },
  { code: "PT", label: "Portugal" },
  { code: "CZ", label: "République tchèque" },
  { code: "RO", label: "Roumanie" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "SM", label: "Saint-Marin" },
  { code: "RS", label: "Serbie" },
  { code: "SK", label: "Slovaquie" },
  { code: "SI", label: "Slovénie" },
  { code: "SE", label: "Suède" },
  { code: "CH", label: "Suisse" },
  { code: "UA", label: "Ukraine" },
  { code: "VA", label: "Vatican" },
];

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { cartItems, cartTotal, appliedPromo, finalTotal, setAppliedPromo, clearCart } = useCart();

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");
  const [shipping, setShipping] = useState("colissimo");
  const [relayPoint, setRelayPoint] = useState<RelayPoint | null>(null);
  const [recipientPickupName, setRecipientPickupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/addresses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSavedAddresses(data?.addresses ?? []))
      .catch(() => {});
  }, [status]);

  const handleSelectSavedAddress = (indexStr: string) => {
    setSelectedAddressIndex(indexStr);
    if (indexStr === "") return;

    const addr = savedAddresses[Number(indexStr)];
    if (!addr) return;

    const [first, ...rest] = (addr.fullName ?? "").trim().split(" ");
    setFirstname(first ?? "");
    setLastname(rest.join(" "));
    setAddress(addr.street ?? "");
    setPostalCode(addr.zip ?? "");
    setCity(addr.city ?? "");

    const match = COUNTRY_OPTIONS.find(
      (c) => c.label.toLowerCase() === (addr.country ?? "").toLowerCase()
    );
    if (match) setCountry(match.code);
  };

  const totalQty = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.quantity, 0),
    [cartItems]
  );

  const deliveryMethod = shipping === "relais" ? "relay" : "home";
  // null tant qu'aucune estimation n'est encore arrivée (état initial / cas d'erreur réseau) —
  // sert à la fois d'indicateur de chargement et de garde-fou avant soumission.
  const [shippingFee, setShippingFee] = useState<number | null>(null);

  // Estimation live du frais de livraison (poids réel du panier + zone du pays choisi) —
  // recalculée à chaque changement de panier, de pays ou de mode d'expédition. Purement
  // informatif : le montant définitif est toujours recalculé côté serveur au paiement.
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) return;
    let cancelled = false;
    fetch("/api/shipping/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartItems: cartItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
        country,
        deliveryMethod,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setShippingFee(data.shippingFee);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cartItems, country, deliveryMethod]);

  const { shipping: livraison, total } = useMemo(
    () => computeOrderTotals(finalTotal, shippingFee ?? 0),
    [finalTotal, shippingFee]
  );

  // Synchronise le montant du Payment Element (cartes, Apple/Google Pay) avec l'estimation
  // dès qu'elle change, pour ne jamais afficher/facturer un montant obsolète.
  useEffect(() => {
    if (!elements || shippingFee === null) return;
    elements.update({ amount: Math.round(total * 100) });
  }, [elements, total, shippingFee]);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (!firstname || !lastname || !email || !city || !address) {
    setError("Veuillez remplir tous les champs obligatoires");
    return;
  }
  if (shipping === "relais" && !relayPoint) {
    setError("Veuillez sélectionner un point relais");
    return;
  }
  if (!cartItems || cartItems.length === 0) {
    setError("Votre panier est vide");
    return;
  }
  if (!stripe || !elements) return;

  setLoading(true);

  try {
    // ✅ 1 — Soumettre les éléments Stripe d'abord
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Erreur de paiement");
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
        country,
        deliveryMethod,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Erreur lors de la création du paiement");
      setLoading(false);
      return;
    }
    const { clientSecret, paymentIntentId } = await res.json();

    // 3 — Créer la commande AVANT de confirmer le paiement. Certains moyens de paiement
    // (Bancontact, MB Way, Amazon Pay, EPS...) redirigent immédiatement le navigateur hors
    // de cette page : le code après confirmPayment() ne s'exécuterait alors jamais, et la
    // commande ne serait donc jamais créée malgré un paiement réussi. La commande est créée
    // "pending" ; le webhook Stripe la fait passer à "paid" (et déclenche Chronopost) une
    // fois le paiement confirmé, quel que soit le chemin emprunté.
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
      setError(orderData.message || "Erreur lors de la commande");
      setLoading(false);
      return;
    }

    // 4 — Confirmer le paiement. Pour les moyens de paiement qui redirigent (Bancontact,
    // MB Way, Amazon Pay, EPS...), le navigateur quitte cette page ici : le code qui suit
    // ne s'exécute jamais côté client, et c'est la page /checkout/success (via le
    // paramètre redirect_status renvoyé par Stripe) qui vide le panier dans ce cas.
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Erreur de paiement");
      setLoading(false);
      return;
    }

    // Paiement confirmé sans redirection (ex: carte sans 3DS) — la commande existe déjà.
    clearCart();
    router.push("/checkout/success");

  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    setError("Erreur serveur");
  } finally {
    setLoading(false);
  }
};
  return (
    <>
      <div className="checkout-wrapper">

        <button className="checkout-back" onClick={() => router.back()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour
        </button>

        <div className="checkout-left">
          <div className="checkout-section">
            <h3 className="checkout-section-title">Contact</h3>
            <input type="email" placeholder="Tom.exemple@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="checkout-input" required />
            <input type="tel" placeholder="Téléphone (ex: 034 00 000 00)" value={phone} onChange={(e) => setPhone(e.target.value)} className="checkout-input" />
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">Livraison</h3>
            {savedAddresses.length > 0 && (
              <select
                value={selectedAddressIndex}
                onChange={(e) => handleSelectSavedAddress(e.target.value)}
                className="checkout-input"
              >
                <option value="">Utiliser une adresse enregistrée…</option>
                {savedAddresses.map((addr, i) => (
                  <option key={i} value={i}>
                    {addr.label || `Adresse ${i + 1}`} — {addr.street}, {addr.city}
                  </option>
                ))}
              </select>
            )}
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
              <span>{formatDeliveryLabel({ country, deliveryMethod: "home" })}</span>
            </label>
            <label className="checkout-radio">
              <input type="radio" name="shipping" value="relais" checked={shipping === "relais"} onChange={() => setShipping("relais")} />
              <span>{formatDeliveryLabel({ country, deliveryMethod: "relay" })}</span>
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

          {error && <p className="checkout-form-error">{error}</p>}

          <button className="checkout-submit" onClick={handleSubmit} disabled={loading || shippingFee === null}>
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
              <span>Livraison</span>
              <span>{shippingFee === null ? "…" : `${livraison} €`}</span>
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
