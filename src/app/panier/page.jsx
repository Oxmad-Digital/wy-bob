"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { useCart } from '@/components/panier-context'
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import "../page.css";
import "./panier.css";

export default function Panier() {
  const { cartItems, removeFromCart, increaseQty, decreaseQty, cartTotal, appliedPromo, setAppliedPromo, finalTotal } = useCart();
  const { t } = useLanguage();
  const router = useRouter();
  const rightRef = useRef(null);
  const [leftHeight, setLeftHeight] = useState(null);

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  useEffect(() => {
    if (!rightRef.current) return;
    const observer = new ResizeObserver(() => {
      if (rightRef.current) {
        setLeftHeight(rightRef.current.offsetHeight);
      }
    });
    observer.observe(rightRef.current);
    return () => observer.disconnect();
  }, []);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoError("");
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), cartTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.message || t.cart.promoInvalid);
        setAppliedPromo(null);
        return;
      }
      setAppliedPromo({ code: data.promo.code, type: data.promo.type, value: data.promo.value, discount: data.discount });
      setPromoInput("");
    } catch {
      setPromoError(t.cart.promoError);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError("");
  };

  if (cartItems.length === 0) {
    return (
      <div className="container">
        <Navbar />
        <div className="cart-empty">
          <p>{t.cart.empty}</p>
          <Link href="/">{t.cart.backToShop}</Link>
        </div>
        <Footer />
      </div>
    );
  }


  return (
    <div className="container">
      <Navbar />
      <div className="cart-page panierZone">

        <div className="cart-wrapper">

          <button className="panierRetour" onClick={() => router.back()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t.cart.back}
          </button>

          {/* GAUCHE */}
          <div
            className="cart-left"
            style={leftHeight ? { height: leftHeight } : {}}
          >
            <div className="cart-scroll-inner">
              <h2 className="cart-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {t.cart.title}
              </h2>

              <ul className="cart-list">
                {cartItems.map((item) => (
                  <li key={item._id} className="cart-item">

                    <div className="cart-item-image">
                      {item.image ? (
                        <img src={item.image} alt={item.name} />
                      ) : null}
                    </div>

                    <div className="cart-item-info">
                      <strong>{item.name}</strong>
                      <p>{t.cart.itemSubtitle}</p>
                      {item.color && <p>{t.cart.colorLabel} {item.color}</p>}
                      <div className="qty-controls">
                        <button onClick={() => decreaseQty(item._id)} aria-label={t.cart.decreaseQty}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => increaseQty(item._id)} aria-label={t.cart.increaseQty}>+</button>
                      </div>
                    </div>

                    <div className="cart-item-right">
                      <span className="cart-item-price">{item.price}€</span>
                      <button
                        className="cart-remove"
                        onClick={() => removeFromCart(item._id)}
                        aria-label={t.cart.removeFromCart}
                      >
                        🗑 {t.cart.remove}
                      </button>
                    </div>

                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* DROITE */}
          <div className="cart-right" ref={rightRef}>

            <div className="cart-promo">
              <h3 className="cart-section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                {t.cart.promoTitle}
              </h3>

              {appliedPromo ? (
                <div className="promo-applied">
                  <span className="promo-applied-code">{appliedPromo.code}</span>
                  <span className="promo-applied-discount">
                    -{appliedPromo.type === "percent" ? `${appliedPromo.value}%` : `${appliedPromo.value}€`}
                  </span>
                  <button className="promo-remove-btn" onClick={handleRemovePromo} aria-label={t.cart.promoRemove}>✕</button>
                </div>
              ) : (
                <>
                  <div className="promo-input-row">
                    <input
                      type="text"
                      placeholder={t.cart.promoPlaceholder}
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                    />
                    <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()}>
                      {promoLoading ? t.cart.promoApplying : t.cart.promoApply}
                    </button>
                  </div>
                  {promoError && <p className="promo-error">{promoError}</p>}
                </>
              )}
            </div>

            <div className="cart-summary">
              <h3 className="cart-section-title">{t.cart.summaryTitle}</h3>
              <div className="summary-row">
                <span>{t.cart.subtotal} ({cartItems.length})</span>
                <span>{cartTotal}€</span>
              </div>
              {appliedPromo && (
                <div className="summary-row summary-discount">
                  <span>{t.cart.discount} ({appliedPromo.code})</span>
                  <span>−{appliedPromo.discount}€</span>
                </div>
              )}
              <hr className="summary-divider" />
              <div className="summary-row summary-total">
                <span>{t.cart.total}</span>
                <span>{finalTotal}€</span>
              </div>
              <button
                className="checkout-btn"
                onClick={() => router.push("/checkout")}
              >
                {t.cart.checkout}
              </button>
            </div>

          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}
