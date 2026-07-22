"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";

/* ===========================
   TYPES
   =========================== */
interface PanierItem {
  _id: string;
  productId: string;
  name: string;
  price: number;
  promoPrice?: number;
  image?: string;
  color?: string;
  quantity: number;
}

interface AppliedPromo {
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number;
}

interface PanierContextType {
  cartItems: PanierItem[];
  addToCart: (product: Omit<PanierItem, 'quantity'>, qty?: number) => void;
  increaseQty: (id: string) => void;
  decreaseQty: (id: string) => void;
  removeFromCart: (id: string) => void;
  cartTotal: number;
  appliedPromo: AppliedPromo | null;
  setAppliedPromo: (promo: AppliedPromo | null) => void;
  finalTotal: number;
}

/* ===========================
   CONTEXT
   =========================== */
const PanierContext = createContext<PanierContextType | undefined>(undefined);

/* ===========================
   PROVIDER
   =========================== */
export function CartProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [cartItems, setCartItems] = useState<PanierItem[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);

  const storageKey = session?.user?.id
    ? `wybob-cart-${session.user.id}`
    : "wybob-cart-guest";

  /* 🔄 Charger/réinitialiser le panier quand l'utilisateur change */
  useEffect(() => {
    if (status === "loading") return;
    const userId = session?.user?.id ?? "guest";
    if (userId === loadedForUser) return;

    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem(storageKey);
      setCartItems(savedCart ? JSON.parse(savedCart) : []);
    } else {
      setCartItems([]);
    }
    setAppliedPromo(null);
    setLoadedForUser(userId);
  }, [status, session?.user?.id]);

  /* 💾 Sauvegarde auto */
  useEffect(() => {
    if (typeof window !== 'undefined' && loadedForUser !== null) {
      localStorage.setItem(storageKey, JSON.stringify(cartItems));
    }
  }, [cartItems, storageKey, loadedForUser]);

  /* ➕ Ajouter au panier */
  const addToCart = (product: Omit<PanierItem, 'quantity'>, qty = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      if (existing) {
        return prev.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { ...product, quantity: qty }];
    });
    // Reset promo when cart changes
    setAppliedPromo(null);
  };

  /* ➕ Augmenter quantité */
  const increaseQty = (id: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item._id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
    setAppliedPromo(null);
  };

  /* ➖ Diminuer quantité */
  const decreaseQty = (id: string) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item._id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
    setAppliedPromo(null);
  };

  /* ❌ Supprimer */
  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item._id !== id));
    setAppliedPromo(null);
  };

  /* 💰 Sous-total */
  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => {
      const price = Number(item.promoPrice ?? item.price);
      return total + price * item.quantity;
    }, 0),
    [cartItems]
  );

  /* 💰 Total après réduction promo */
  const finalTotal = useMemo(
    () => appliedPromo
      ? Math.max(0, Math.round((cartTotal - appliedPromo.discount) * 100) / 100)
      : cartTotal,
    [cartTotal, appliedPromo]
  );

  return (
    <PanierContext.Provider
      value={{
        cartItems,
        addToCart,
        increaseQty,
        decreaseQty,
        removeFromCart,
        cartTotal,
        appliedPromo,
        setAppliedPromo,
        finalTotal,
      }}
    >
      {children}
    </PanierContext.Provider>
  );
}

/* ===========================
   HOOK
   =========================== */
export const useCart = () => {
  const context = useContext(PanierContext);
  if (!context) throw new Error("useCart doit être utilisé dans CartProvider");
  return context;
};
