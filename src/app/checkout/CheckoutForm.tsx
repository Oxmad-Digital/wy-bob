"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { useCart } from "@/components/panier-context";
import type { RelayPoint } from "./RelayPointPicker";

// Le SDK Google Maps (via RelayPointMap) n'est nécessaire que si l'utilisateur choisit
// la livraison en point relais — évite de le charger sur tout le tunnel de checkout.
const RelayPointPicker = dynamic(() => import("./RelayPointPicker"), { ssr: false });
import CountrySelect from "./CountrySelect";
import { computeOrderTotals } from "@/app/lib/pricing";
import { formatDeliveryLabel } from "@/app/lib/shipping/delivery";
import { isValidPostalCode } from "@/app/lib/shipping/postalCode";
import { COUNTRY_OPTIONS } from "@/app/lib/shipping/countries";
import { useLanguage } from "@/contexts/LanguageContext";
import { cloudinaryThumb } from "@/app/lib/cloudinary";
import "./checkout.css";

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { cartItems, cartTotal, appliedPromo, finalTotal, setAppliedPromo, clearCart } = useCart();
  const { t, locale } = useLanguage();

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

  // Stable pour toute la durée de la page : réutilisée telle quelle à chaque retry
  // (erreur de paiement, double-clic) pour que le serveur puisse reconnaître qu'il
  // s'agit de la même tentative de commande et ne pas en recréer une en double.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // Verrou synchrone : un useState (loading) ne se répercute sur le DOM qu'au re-render
  // suivant, ce qui laisse passer un second clic tiré plus vite que ce re-render.
  const submittingRef = useRef(false);

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
  if (submittingRef.current) return;
  setError(null);

  if (!firstname || !lastname || !email || !city || !address || !postalCode) {
    setError(t.checkout.errors.requiredFields);
    return;
  }
  if (!isValidPostalCode(country, postalCode)) {
    setError(t.checkout.errors.invalidPostalCode);
    return;
  }
  if (shipping === "relais" && !relayPoint) {
    setError(t.checkout.errors.relayPointRequired);
    return;
  }
  if (!cartItems || cartItems.length === 0) {
    setError(t.checkout.errors.emptyCart);
    return;
  }
  if (!stripe || !elements) return;

  submittingRef.current = true;
  setLoading(true);

  try {
    // ✅ 1 — Soumettre les éléments Stripe d'abord
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? t.checkout.errors.payment);
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
      setError(err.error || t.checkout.errors.paymentIntent);
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
        idempotencyKey,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      setError(orderData.message || t.checkout.errors.order);
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
      setError(stripeError.message ?? t.checkout.errors.payment);
      setLoading(false);
      return;
    }

    // Paiement confirmé sans redirection (ex: carte sans 3DS) — la commande existe déjà.
    clearCart();
    router.push("/checkout/success");

  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    setError(t.checkout.errors.server);
  } finally {
    submittingRef.current = false;
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
          {t.checkout.back}
        </button>

        <div className="checkout-left">
          <div className="checkout-section">
            <h3 className="checkout-section-title">{t.checkout.contactTitle}</h3>
            <input type="email" placeholder={t.checkout.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} className="checkout-input" required />
            <input type="tel" placeholder={t.checkout.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} className="checkout-input" />
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">{t.checkout.deliveryTitle}</h3>
            {savedAddresses.length > 0 && (
              <select
                value={selectedAddressIndex}
                onChange={(e) => handleSelectSavedAddress(e.target.value)}
                className="checkout-input"
              >
                <option value="">{t.checkout.useSavedAddress}</option>
                {savedAddresses.map((addr, i) => (
                  <option key={i} value={i}>
                    {addr.label || `${t.checkout.addressFallback} ${i + 1}`} — {addr.street}, {addr.city}
                  </option>
                ))}
              </select>
            )}
            <CountrySelect
              value={country}
              onChange={setCountry}
              options={COUNTRY_OPTIONS.map((c) => ({
                code: c.code,
                label: t.checkout.countries[c.code as keyof typeof t.checkout.countries] ?? c.label,
              }))}
            />
            <div className="checkout-row">
              <input type="text" placeholder={t.checkout.firstnamePlaceholder} value={firstname} onChange={(e) => setFirstname(e.target.value)} className="checkout-input" required />
              <input type="text" placeholder={t.checkout.lastnamePlaceholder} value={lastname} onChange={(e) => setLastname(e.target.value)} className="checkout-input" required />
            </div>
            <input type="text" placeholder={t.checkout.companyPlaceholder} value={company} onChange={(e) => setCompany(e.target.value)} className="checkout-input" />
            <input type="text" placeholder={t.checkout.addressPlaceholder} value={address} onChange={(e) => setAddress(e.target.value)} className="checkout-input" required />
            <div className="checkout-row">
              <input type="text" placeholder={t.checkout.postalCodePlaceholder} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="checkout-input" required />
              <input type="text" placeholder={t.checkout.cityPlaceholder} value={city} onChange={(e) => setCity(e.target.value)} className="checkout-input" required />
            </div>
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">{t.checkout.shippingMethodTitle}</h3>
            <label className="checkout-radio">
              <input type="radio" name="shipping" value="colissimo" checked={shipping === "colissimo"} onChange={() => setShipping("colissimo")} />
              <span>{formatDeliveryLabel({ country, deliveryMethod: "home" }, locale)}</span>
            </label>
            <label className="checkout-radio">
              <input type="radio" name="shipping" value="relais" checked={shipping === "relais"} onChange={() => setShipping("relais")} />
              <span>{formatDeliveryLabel({ country, deliveryMethod: "relay" }, locale)}</span>
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
                  placeholder={t.checkout.pickupNamePlaceholder}
                  value={recipientPickupName}
                  onChange={(e) => setRecipientPickupName(e.target.value)}
                  className="checkout-input"
                />
              </>
            )}
          </div>

          <div className="checkout-section">
            <h3 className="checkout-section-title">{t.checkout.paymentTitle}</h3>
            <PaymentElement />
          </div>

          {error && <p className="checkout-form-error">{error}</p>}

          <button className="checkout-submit" onClick={handleSubmit} disabled={loading || shippingFee === null}>
            {loading ? t.checkout.submitting : t.checkout.submit}
          </button>
        </div>

        <div className="checkout-right">
          {cartItems.length > 0 && (
            <div className="checkout-items">
              {cartItems.map((item: any) => (
                <div key={item._id} className="checkout-item">
                  <div className="checkout-item-image">
                    {item.image && <img src={cloudinaryThumb(item.image, 100)} alt={item.name} />}
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
            <h3 className="checkout-summary-title">{t.checkout.summaryTitle}</h3>
            <div className="checkout-summary-row">
              <span>{t.checkout.subtotal} ({totalQty})</span>
              <span>{cartTotal} €</span>
            </div>
            {appliedPromo && (
              <div className="checkout-summary-row checkout-summary-discount">
                <span>{t.checkout.discount} ({appliedPromo.code})</span>
                <span>−{appliedPromo.discount} €</span>
              </div>
            )}
            <div className="checkout-summary-row">
              <span>{t.checkout.deliveryLabel}</span>
              <span>{shippingFee === null ? "…" : `${livraison} €`}</span>
            </div>
            <div className="checkout-summary-divider" />
            <div className="checkout-summary-row checkout-summary-total">
              <span>{t.checkout.total}</span>
              <span>{total} €</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
