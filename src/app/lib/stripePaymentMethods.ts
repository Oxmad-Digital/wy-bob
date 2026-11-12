// Moyens de paiement Stripe, partagés par le serveur (création du PaymentIntent) et le
// navigateur (initialisation d'Elements) : une seule source, donc les deux côtés restent
// toujours cohérents.
//
// NEXT_PUBLIC_STRIPE_PAYMENT_METHODS (facultative, ex. "card") ne sert qu'aux tests locaux,
// par exemple quand le compte Stripe de test n'accepte Amazon Pay qu'en USD. Absente ou
// vide : comportement de production inchangé, ["card", "amazon_pay"]. Ce n'est pas un
// secret : la liste est de toute façon visible côté navigateur.
const DEFAULT_PAYMENT_METHODS = ["card", "amazon_pay"];

export function getStripePaymentMethods(): string[] {
  // Accès littéral obligatoire : Next.js remplace process.env.NEXT_PUBLIC_* au build.
  const raw = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_METHODS ?? "";
  const list = [...new Set(raw.split(",").map((m) => m.trim()).filter(Boolean))];
  return list.length > 0 ? list : [...DEFAULT_PAYMENT_METHODS];
}
