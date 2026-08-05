// app/api/order/route.js

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Order from "@/app/models/Order";
import Counter from "@/app/models/Counter";
import Product from "@/app/models/Product";
import PromoCode from "@/app/models/PromoCode";
import ReferralConfig from "@/app/models/ReferralConfig";
import User from "@/app/models/User";
import { sendEmail } from "@/app/lib/mailer";
import Customer from "@/app/models/Customer";
import { computeOrderTotals } from "@/app/lib/pricing";
import { resolvePromoDiscount } from "@/app/lib/promo";
import { computeTotalWeightKg } from "@/app/lib/shipping/weight";
import { computeShippingFee } from "@/app/lib/shipping/pricing";
import { formatDeliveryLabel } from "@/app/lib/shipping/delivery";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

function generateRewardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `PARRAIN-${suffix}`;
}

export async function POST(req) {
  console.log("🚀 API /api/order APPELÉE");

  try {
    await connectDB();

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
    const { customer, cartItems, payment, paymentIntentId, delivery, promoCode, promoDiscount, relayPoint, recipientPickupName, idempotencyKey } = body;

    if (!customer) {
      return NextResponse.json({ message: "Client manquant" }, { status: 400 });
    }

    // Une même tentative de checkout (retries après erreur, double-clic) renvoie toujours
    // la même idempotencyKey : si une commande existe déjà pour cette clé, on la renvoie
    // telle quelle au lieu d'en recréer une (et de re-décrémenter le stock, renvoyer les emails, etc).
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Format d'email invalide" }, { status: 400 });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ message: "Panier vide" }, { status: 400 });
    }

    // Calculate total strictly server-side — fetch each product price from the database
    const products = [];
    const productPriceById = new Map();
    const weighableLines = [];
    let total = 0;

    for (const item of cartItems) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) continue;

      const product = await Product.findById(item.productId).select("price name weight variants");
      if (!product) continue;

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      total += product.price * qty;

      // On résout la variante commandée par son nom de couleur pour retrouver son _id
      // stable — indispensable pour décrémenter/restituer le bon stock de couleur, y
      // compris si la couleur est renommée par la suite dans l'admin.
      const matchedVariant = product.variants?.find((v) => v.colorName === item.color)
        ?? (product.variants?.length ? product.variants[0] : null);

      products.push({
        product: new mongoose.Types.ObjectId(item.productId),
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

    const counter = await Counter.findOneAndUpdate(
      { _id: "orderNumber" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

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

    if (promo && validatedPromoCode) {
      if (promo.isReferral) {
        await PromoCode.findByIdAndUpdate(promo._id, {
          $inc: { usedCount: 1 },
          $push: { usedByUserIds: userId },
        });

        if (promo.parrainPercent > 0) {
          const referralConfig = await ReferralConfig.findOne();
          const validityDays = referralConfig?.rewardValidityDays ?? 30;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + validityDays);

          let rewardCode;
          let attempts = 0;
          do {
            rewardCode = generateRewardCode();
            attempts++;
          } while (attempts < 10 && (await PromoCode.exists({ code: rewardCode })));

          await PromoCode.create({
            code: rewardCode,
            type: "percent",
            value: promo.parrainPercent,
            maxUses: 1,
            active: true,
            expiresAt,
          });

          const parrain = await User.findById(promo.referrerId).select("email name");
          if (parrain) {
            referralRewardData = { email: parrain.email, name: parrain.name, rewardCode, parrainPercent: promo.parrainPercent, validityDays };
          }
        }
      } else {
        await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: 1 } });
      }
    }

    const weightKg = computeTotalWeightKg(weighableLines);
    const deliveryMethod = delivery === "relais" ? "relay" : "home";
    const shippingFee = computeShippingFee({ country, weightKg, deliveryMethod });
    const { total: finalTotal } = computeOrderTotals(total - appliedDiscount, shippingFee);

    const order = await Order.create({
      orderNumber: counter.seq,
      userId: session?.user?.id ?? null,
      customer: {
        firstname,
        lastname,
        email: email.toLowerCase(),
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
      promoCode: validatedPromoCode,
      promoDiscount: appliedDiscount,
      payment: payment || "cash",
      paymentIntentId: paymentIntentId || null,
      idempotencyKey: idempotencyKey || null,
      delivery: delivery || "colissimo",
      status: "pending",
      ...(delivery === "relais" && relayPoint?.id
        ? {
            shipping: {
              relayPoint: {
                id: relayPoint.id,
                name: relayPoint.name || "",
                address1: relayPoint.address1 || "",
                zipCode: relayPoint.zipCode || "",
                city: relayPoint.city || "",
                country: relayPoint.country || country || "FR",
                latitude: typeof relayPoint.latitude === "number" ? relayPoint.latitude : undefined,
                longitude: typeof relayPoint.longitude === "number" ? relayPoint.longitude : undefined,
              },
            },
          }
        : {}),
    });

    console.log("✅ Commande créée:", order._id, "N°", order.orderNumber);

    // Le stock est réservé dès la création de la commande (avant même le paiement) ; il
    // est restauré si la commande est annulée — voir applyOrderStatusChange. Quand la
    // ligne a une variante (couleur), c'est le stock de cette variante qui est décrémenté,
    // puis le stock total du produit est recalculé comme somme des variantes.
    await Promise.all(
      products.map((line) =>
        line.variantId
          ? Product.updateOne(
              { _id: line.product, "variants._id": line.variantId },
              [
                {
                  $set: {
                    variants: {
                      $map: {
                        input: "$variants",
                        as: "v",
                        in: {
                          $cond: [
                            { $eq: ["$$v._id", line.variantId] },
                            {
                              $mergeObjects: [
                                "$$v",
                                { stock: { $max: [0, { $subtract: [{ $ifNull: ["$$v.stock", 0] }, line.quantity] }] } },
                              ],
                            },
                            "$$v",
                          ],
                        },
                      },
                    },
                  },
                },
                { $set: { stock: { $sum: "$variants.stock" } } },
              ],
              { updatePipeline: true }
            )
          : Product.updateOne(
              { _id: line.product },
              [{ $set: { stock: { $max: [0, { $subtract: ["$stock", line.quantity] }] } } }],
              { updatePipeline: true }
            )
      )
    );

    const normalizedEmail = email.toLowerCase();
    let existingCustomer = await Customer.findOne({ email: normalizedEmail });

    if (existingCustomer) {
      existingCustomer.totalOrders += 1;
      existingCustomer.totalSpent += finalTotal;
      existingCustomer.lastOrderAt = new Date();
      if (!existingCustomer.phone && phone) existingCustomer.phone = phone;
      if (!existingCustomer.city && city) existingCustomer.city = city;
      if (!existingCustomer.address && address) existingCustomer.address = address;
      await existingCustomer.save();
    } else {
      await Customer.create({
        firstname,
        lastname,
        email: normalizedEmail,
        phone: phone || "",
        city: city || "",
        address: address || "",
        totalOrders: 1,
        totalSpent: finalTotal,
        lastOrderAt: new Date(),
        status: "active",
      });
    }

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
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name || "Produit"}</td>
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
              <tr><td style="padding: 8px 0; color: #6b7280;">Nom complet</td><td style="padding: 8px 0; font-weight: bold;">${firstname} ${lastname}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #3b82f6;">${email}</a></td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Téléphone</td><td style="padding: 8px 0;">${phone || "Non renseigné"}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Adresse</td><td style="padding: 8px 0;">${address}, ${city}</td></tr>
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
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Merci pour votre achat, ${firstname} !</p>
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
              <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Adresse :</strong> ${address}, ${city}</p>
              <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Mode :</strong> ${deliveryLabels[delivery] || delivery}</p>
              <p style="margin: 0; color: #4b5563;"><strong>Paiement :</strong> ${paymentLabels[payment] || payment}</p>
            </div>
            <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">TOTAL</p>
              <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${Number(finalTotal).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
              ${validatedPromoCode ? `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.85;">Code promo : ${validatedPromoCode} (−${Number(appliedDiscount).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)</p>` : ""}
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

    if (error.name === "ValidationError") {
      return NextResponse.json(
        {
          success: false,
          message: "Erreur de validation",
          errors: Object.values(error.errors).map((e) => e.message),
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

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit")) || 50;

    const query = status ? { status } : {};

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("products.product");

    return NextResponse.json({ success: true, count: orders.length, orders });

  } catch (error) {
    console.error("❌ GET ORDERS ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
