// app/api/order/route.js

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTransaction, isUuid, isMongoId } from "@/app/lib/neon";
import {
  findOrderById,
  findOrderByIdempotencyKey,
  insertOrder,
  listOrders,
  nextOrderNumber,
} from "@/app/lib/repos/orders";
import { applyLineStockDelta, findProductsByIds } from "@/app/lib/repos/products";
import { consumePromo, createPromo, promoCodeExists } from "@/app/lib/repos/promos";
import { getReferralConfig } from "@/app/lib/repos/settings";
import { findUserContactById } from "@/app/lib/repos/users";
import { recordCustomerOrder } from "@/app/lib/repos/customers";
import { sendEmail } from "@/app/lib/mailer";
import { computeOrderTotals } from "@/app/lib/pricing";
import { resolvePromoDiscount } from "@/app/lib/promo";
import { computeTotalWeightKg } from "@/app/lib/shipping/weight";
import { computeShippingFee } from "@/app/lib/shipping/pricing";
import { formatDeliveryLabel } from "@/app/lib/shipping/delivery";
import { isRelayEligible } from "@/app/lib/shipping/zones";
import { computeInsuranceFee, computeInsurableValue } from "@/app/lib/shipping/insurance";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";
import { escapeHtml } from "@/app/lib/emailTemplates";

function generateRewardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `PARRAIN-${suffix}`;
}

// Réponse renvoyée quand une commande existe déjà pour l'idempotencyKey reçue.
function alreadyCreatedResponse(existingOrder) {
  return NextResponse.json(
    {
      success: true,
      message: "Commande déjà créée",
      order: {
        _id: existingOrder._id,
        orderNumber: String(existingOrder.orderNumber).padStart(4, "0"),
        total: existingOrder.total,
        status: existingOrder.status,
        createdAt: existingOrder.createdAt,
      },
    },
    { status: 200 }
  );
}

// Violations de contraintes PostgreSQL équivalentes à une ValidationError Mongoose
// (valeur hors enum -> CHECK, champ obligatoire -> NOT NULL, valeur mal typée) : même 400.
const PG_VALIDATION_CODES = new Set(["23502", "23514", "22P02"]);

export async function POST(req) {
  console.log("🚀 API /api/order APPELÉE");

  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({ key: `order-create:${ip}`, windowMs: 5 * 60 * 1000, maxAttempts: 15 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const session = await auth();

    const body = await req.json();
    // 'total' is intentionally NOT destructured from body — it is calculated server-side below
    const { customer, cartItems, payment, paymentIntentId, delivery, promoCode, promoDiscount, relayPoint, recipientPickupName, insuranceOpted, idempotencyKey } = body;

    if (!customer) {
      return NextResponse.json({ message: "Client manquant" }, { status: 400 });
    }

    // Une même tentative de checkout (retries après erreur, double-clic) renvoie toujours
    // la même idempotencyKey : si une commande existe déjà pour cette clé, on la renvoie
    // telle quelle au lieu d'en recréer une (et de re-décrémenter le stock, renvoyer les emails, etc).
    if (idempotencyKey) {
      const existingOrder = await findOrderByIdempotencyKey(idempotencyKey, { documents: false });
      if (existingOrder) return alreadyCreatedResponse(existingOrder);
    }

    const { firstname, lastname, city, address, phone, company, postalCode, country } = customer;
    // Si l'utilisateur est connecté, on force son email de compte pour la correspondance dashboard
    const email = session?.user?.email ?? customer.email;

    if (!firstname || !lastname || !email || !city || !address) {
      return NextResponse.json({ message: "Informations client manquantes" }, { status: 400 });
    }

    if (delivery === "relais" && !relayPoint?.id) {
      return NextResponse.json({ message: "Veuillez sélectionner un point relais" }, { status: 400 });
    }

    // Chronorelais n'existe qu'en France et dans les pays "classic" (UE + Europe proche) —
    // le checkout masque déjà l'option pour les autres pays, ceci est un filet de sécurité
    // côté serveur (requête forgée, état client obsolète).
    if (delivery === "relais" && !isRelayEligible(country)) {
      return NextResponse.json({ message: "Le point relais n'est pas disponible pour ce pays" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Format d'email invalide" }, { status: 400 });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ message: "Panier vide" }, { status: 400 });
    }

    // Calculate total strictly server-side — fetch all cart products in one query.
    // Les ids peuvent être des uuid ou d'anciens ObjectId encore présents dans les paniers
    // persistés (localStorage) : findProductsByIds résout les deux.
    const isValidProductId = (id) => isUuid(id) || isMongoId(id);
    const validItemIds = [...new Set(
      cartItems
        .filter((item) => isValidProductId(item.productId))
        .map((item) => item.productId)
    )];
    const productById = await findProductsByIds(validItemIds);

    const products = [];
    const productPriceById = new Map();
    const weighableLines = [];
    let total = 0;

    for (const item of cartItems) {
      if (!isValidProductId(item.productId)) continue;

      const product = productById.get(item.productId);
      if (!product) continue;

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      total += product.price * qty;

      // On résout la variante commandée par son nom de couleur pour retrouver son _id
      // stable — indispensable pour décrémenter/restituer le bon stock de couleur, y
      // compris si la couleur est renommée par la suite dans l'admin.
      const matchedVariant = product.variants?.find((v) => v.colorName === item.color)
        ?? (product.variants?.length ? product.variants[0] : null);

      products.push({
        productId: product._id,
        quantity: qty,
        color: matchedVariant?.colorName ?? null,
        variantId: matchedVariant?._id ?? null,
      });
      productPriceById.set(item.productId, product.price);
      weighableLines.push({ product: { weight: product.weight }, quantity: qty });
    }

    if (products.length === 0) {
      return NextResponse.json({ message: "Aucun produit valide dans le panier" }, { status: 400 });
    }

    // Apply promo discount — re-validate server-side for safety (même logique que
    // /api/create-payment-intent, via resolvePromoDiscount, pour que le montant facturé
    // via Stripe et le total enregistré sur la commande soient toujours identiques)
    let referralRewardData = null;
    const userId = session?.user?.id ?? null;
    const { discount: appliedDiscount, validatedCode: validatedPromoCode, promo } = await resolvePromoDiscount(
      promoCode,
      total,
      userId
    );

    const weightKg = computeTotalWeightKg(weighableLines);
    const deliveryMethod = delivery === "relais" ? "relay" : "home";
    const shippingFee = computeShippingFee({ country, weightKg, deliveryMethod });
    const discountedSubtotal = total - appliedDiscount;
    // Assurance colis optionnelle (au-delà des 250€ de responsabilité Chronopost déjà inclus) —
    // le montant assuré/facturé est toujours recalculé ici, jamais celui envoyé par le client.
    const insuranceFee = insuranceOpted ? computeInsuranceFee(discountedSubtotal) : 0;
    const { total: finalTotal } = computeOrderTotals(discountedSubtotal, shippingFee, insuranceFee);

    const normalizedEmail = email.toLowerCase();

    // Une seule transaction : numéro de commande, consommation du code promo (et récompense
    // de parrainage), commande + lignes, réservation du stock et fiche client. Si une étape
    // échoue, rien n'est enregistré (seul le numéro de séquence est consommé). Les emails
    // partent après le COMMIT.
    let order;
    try {
      order = await withTransaction(async (client) => {
        const orderNumberValue = await nextOrderNumber(client);

        if (promo && validatedPromoCode) {
          if (promo.isReferral) {
            await consumePromo(client, promo._id, { recordUserId: true, userId });

            if (promo.parrainPercent > 0) {
              const referralConfig = await getReferralConfig(client);
              const validityDays = referralConfig?.rewardValidityDays ?? 30;
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + validityDays);

              let rewardCode;
              let attempts = 0;
              do {
                rewardCode = generateRewardCode();
                attempts++;
              } while (attempts < 10 && (await promoCodeExists(client, rewardCode)));

              await createPromo(client, {
                code: rewardCode,
                type: "percent",
                value: promo.parrainPercent,
                maxUses: 1,
                active: true,
                expiresAt,
              });

              const parrain = await findUserContactById(promo.referrerId, client);
              if (parrain) {
                referralRewardData = { email: parrain.email, name: parrain.name, rewardCode, parrainPercent: promo.parrainPercent, validityDays };
              }
            }
          } else {
            await consumePromo(client, promo._id, { recordUserId: false });
          }
        }

        const orderId = await insertOrder(client, {
          orderNumber: orderNumberValue,
          // Une session émise avant la bascule porte encore un ObjectId : pas de rattachement.
          userId: isUuid(userId) ? userId : null,
          customer: {
            firstname,
            lastname,
            email: normalizedEmail,
            phone: phone || "",
            company: company || "",
            city,
            address,
            postalCode: postalCode || "",
            country: country || "",
          },
          recipientPickupName: recipientPickupName || "",
          products,
          total: finalTotal,
          shippingFee,
          insurance: {
            opted: insuranceFee > 0,
            declaredValue: insuranceFee > 0 ? computeInsurableValue(discountedSubtotal) : 0,
            fee: insuranceFee,
          },
          promoCode: validatedPromoCode,
          promoDiscount: appliedDiscount,
          payment: payment || "cash",
          paymentIntentId: paymentIntentId || null,
          idempotencyKey: idempotencyKey || null,
          delivery: delivery || "colissimo",
          status: "pending",
          relayPoint:
            delivery === "relais" && relayPoint?.id
              ? {
                  id: relayPoint.id,
                  name: relayPoint.name || "",
                  address1: relayPoint.address1 || "",
                  address2: relayPoint.address2 || "",
                  zipCode: relayPoint.zipCode || "",
                  city: relayPoint.city || "",
                  country: relayPoint.country || country || "FR",
                  latitude: typeof relayPoint.latitude === "number" ? relayPoint.latitude : undefined,
                  longitude: typeof relayPoint.longitude === "number" ? relayPoint.longitude : undefined,
                }
              : null,
        });

        // Le stock est réservé dès la création de la commande (avant même le paiement) ; il
        // est restauré si la commande est annulée — voir applyOrderStatusChange. Quand la
        // ligne a une variante (couleur), c'est le stock de cette variante qui est décrémenté,
        // puis le stock total du produit est recalculé comme somme des variantes. Plancher à 0 :
        // aucune commande n'est bloquée pour stock insuffisant (comportement d'origine).
        for (const line of products) {
          await applyLineStockDelta(
            client,
            { productId: line.productId, variantId: line.variantId, variantMongoId: null },
            -line.quantity,
            { floorZero: true }
          );
        }

        await recordCustomerOrder(client, {
          firstname,
          lastname,
          email: normalizedEmail,
          phone,
          city,
          address,
          total: finalTotal,
        });

        return findOrderById(orderId, { db: client, populate: false, documents: false });
      });
    } catch (txError) {
      // Deux requêtes simultanées avec la même idempotencyKey : la seconde heurte l'index
      // unique — on renvoie la commande créée par la première, comme le contrôle plus haut.
      if (txError?.code === "23505" && txError?.constraint === "orders_idempotency_key_key" && idempotencyKey) {
        const existingOrder = await findOrderByIdempotencyKey(idempotencyKey, { documents: false });
        if (existingOrder) return alreadyCreatedResponse(existingOrder);
      }
      throw txError;
    }

    console.log("✅ Commande créée:", order._id, "N°", order.orderNumber);

    const orderNumber = String(order.orderNumber).padStart(4, "0");
    const orderDate = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const paymentLabels = {
      cash: "💵 Espèces à la livraison",
      mobile_money: "📱 Mobile Money",
      card: "💳 Carte bancaire",
      bank_transfer: "🏦 Virement bancaire",
    };

    const deliveryLabels = {
      standard: "🚚 Livraison standard",
      express: "⚡ Livraison express",
      pickup: "🏪 Retrait en magasin",
      colissimo: `📦 ${formatDeliveryLabel({ country, deliveryMethod: "home" })}`,
      relais: `📍 ${formatDeliveryLabel({ country, deliveryMethod: "relay" })}`,
    };

    // Champs client interpolés tels quels dans les emails HTML ci-dessous : ils viennent
    // directement du body de la requête (non authentifiée), donc échappés pour éviter
    // toute injection HTML dans l'email envoyé à l'admin (et au client lui-même).
    const safeFirstname = escapeHtml(firstname);
    const safeLastname = escapeHtml(lastname);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeAddress = escapeHtml(address);
    const safeCity = escapeHtml(city);

    const productListHtml = cartItems
      .map((item) => {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPrice = productPriceById.get(item.productId);
        const lineTotal =
          unitPrice !== undefined
            ? `${Number(unitPrice * qty).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
            : "-";
        return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name ? escapeHtml(item.name) : "Produit"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${lineTotal}</td>
        </tr>
      `;
      })
      .join("");

    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🛒 Nouvelle Commande !</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Commande #${orderNumber}</p>
          </div>
          <div style="padding: 30px;">
            <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px;">
              <p style="margin: 0; color: #1e40af;"><strong>📅 Date :</strong> ${orderDate}</p>
            </div>
            <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">👤 Informations Client</h2>
            <table style="width: 100%; margin-bottom: 25px;">
              <tr><td style="padding: 8px 0; color: #6b7280;">Nom complet</td><td style="padding: 8px 0; font-weight: bold;">${safeFirstname} ${safeLastname}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #3b82f6;">${safeEmail}</a></td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Téléphone</td><td style="padding: 8px 0;">${safePhone || "Non renseigné"}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Adresse</td><td style="padding: 8px 0;">${safeAddress}, ${safeCity}</td></tr>
            </table>
            <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">📦 Produits Commandés</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Produit</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qté</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prix</th>
                </tr>
              </thead>
              <tbody>${productListHtml}</tbody>
            </table>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin: 0 0 10px 0;"><strong>💳 Paiement :</strong> ${paymentLabels[payment] || payment}</p>
              <p style="margin: 0;"><strong>🚚 Livraison :</strong> ${deliveryLabels[delivery] || delivery}</p>
            </div>
            <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">TOTAL À PAYER</p>
              <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${Number(finalTotal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
              ${validatedPromoCode ? `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.85;">Code promo : ${validatedPromoCode} (−${Number(appliedDiscount).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)</p>` : ""}
              ${insuranceFee > 0 ? `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.85;">Assurance colis souscrite : +${insuranceFee.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (valeur assurée : ${computeInsurableValue(discountedSubtotal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)</p>` : ""}
            </div>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Connectez-vous au dashboard admin pour gérer cette commande.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const clientEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Commande Confirmée !</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Merci pour votre achat, ${safeFirstname} !</p>
          </div>
          <div style="padding: 30px;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
              <p style="margin: 0; color: #166534; font-size: 14px;">NUMÉRO DE COMMANDE</p>
              <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #15803d; letter-spacing: 2px;">#${orderNumber}</p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">Nous avons bien reçu votre commande et elle est en cours de traitement. Vous recevrez un email dès que le statut sera mis à jour.</p>
            <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px;">📋 Récapitulatif</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Produit</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qté</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prix</th>
                </tr>
              </thead>
              <tbody>${productListHtml}</tbody>
            </table>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 15px 0; color: #1f2937;">📍 Détails de livraison</h3>
              <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Adresse :</strong> ${safeAddress}, ${safeCity}</p>
              <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Mode :</strong> ${deliveryLabels[delivery] || delivery}</p>
              <p style="margin: 0; color: #4b5563;"><strong>Paiement :</strong> ${paymentLabels[payment] || payment}</p>
            </div>
            <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">TOTAL</p>
              <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${Number(finalTotal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
              ${validatedPromoCode ? `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.85;">Code promo : ${validatedPromoCode} (−${Number(appliedDiscount).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)</p>` : ""}
              ${insuranceFee > 0 ? `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.85;">Dont assurance colis : +${insuranceFee.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (colis assuré jusqu'à ${computeInsurableValue(discountedSubtotal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)</p>` : ""}
            </div>
            <div style="margin-top: 30px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937;">❓ Une question ?</h3>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Répondez directement à cet email ou contactez notre service client.</p>
            </div>
          </div>
          <div style="background: #1f2937; color: white; padding: 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">Merci de votre confiance ! 🙏</p>
            <p style="margin: 0; opacity: 0.7; font-size: 14px;">© ${new Date().getFullYear()} WYBOB - Tous droits réservés</p>
          </div>
        </div>
      </body>
      </html>
    `;

    let emailErrors = [];

    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
      await sendEmail({
        to: adminEmail,
        subject: `🛒 Nouvelle commande #${orderNumber} - ${firstname} ${lastname}`,
        html: adminEmailHtml,
      });
      console.log("✅ Email ADMIN envoyé");
    } catch (emailError) {
      console.error("❌ Erreur email ADMIN:", emailError.message);
      emailErrors.push({ type: "admin", error: emailError.message });
    }

    try {
      await sendEmail({
        to: email,
        subject: `✅ Confirmation de votre commande #${orderNumber}`,
        html: clientEmailHtml,
      });
      console.log("✅ Email CLIENT envoyé à:", email);
    } catch (emailError) {
      console.error("❌ Erreur email CLIENT:", emailError.message);
      emailErrors.push({ type: "client", error: emailError.message });
    }

    if (referralRewardData) {
      const { email: parrainEmail, name: parrainName, rewardCode, parrainPercent, validityDays } = referralRewardData;
      const rewardEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;">
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:white;">
            <div style="background:linear-gradient(135deg,#1B1843,#2a236e);color:white;padding:30px;text-align:center;">
              <h1 style="margin:0;font-size:26px;">Votre filleul a commandé !</h1>
              <p style="margin:10px 0 0;opacity:.85;font-size:15px;">Vous avez gagné une récompense de parrainage</p>
            </div>
            <div style="padding:30px;">
              <p style="color:#4b5563;line-height:1.7;">Bonjour ${parrainName},<br><br>
              Un de vos filleuls vient de passer sa première commande grâce à votre code de parrainage. En récompense, voici votre bon de réduction :</p>
              <div style="background:#f0fdf4;border:2px dashed #22c55e;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Votre code de réduction</p>
                <p style="margin:0;font-size:28px;font-weight:800;color:#15803d;letter-spacing:3px;">${rewardCode}</p>
                <p style="margin:12px 0 0;font-size:14px;color:#16a34a;">− ${parrainPercent}% sur votre prochaine commande</p>
                <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Valable ${validityDays} jours · Usage unique</p>
              </div>
              <p style="color:#6b7280;font-size:13px;line-height:1.6;">Utilisez ce code au moment du paiement sur notre site. Il ne peut être utilisé qu'une seule fois.</p>
            </div>
            <div style="background:#1f2937;color:white;padding:24px;text-align:center;">
              <p style="margin:0;opacity:.7;font-size:13px;">© ${new Date().getFullYear()} WYBOB — Merci pour votre fidélité !</p>
            </div>
          </div>
        </body>
        </html>
      `;
      try {
        await sendEmail({
          to: parrainEmail,
          subject: `Votre récompense de parrainage — ${parrainPercent}% de réduction !`,
          html: rewardEmailHtml,
        });
        console.log("✅ Email PARRAIN envoyé à:", parrainEmail);
      } catch (emailError) {
        console.error("❌ Erreur email PARRAIN:", emailError.message);
        emailErrors.push({ type: "parrain", error: emailError.message });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Commande créée avec succès",
        order: {
          _id: order._id,
          orderNumber,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        },
        emailStatus: emailErrors.length === 0 ? "sent" : "partial",
        emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("❌ ORDER API ERROR:", error);

    if (PG_VALIDATION_CODES.has(error?.code)) {
      return NextResponse.json(
        {
          success: false,
          message: "Erreur de validation",
          errors: [error.message],
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(200, parseInt(searchParams.get("limit")) || 50);

    const orders = await listOrders({ status, limit });

    return NextResponse.json({ success: true, count: orders.length, orders });

  } catch (error) {
    console.error("❌ GET ORDERS ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
