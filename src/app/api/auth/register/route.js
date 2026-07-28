import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { sendEmail } from "@/app/lib/mailer";
import { getAccountVerificationEmailTemplate } from "@/app/lib/emailTemplates";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

function sanitize(input) {
  if (typeof input !== "string") return input;
  return input.trim().replace(/[<>]/g, "").replace(/javascript:/gi, "").replace(/on\w+=/gi, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push("Min 8 caractères");
  if (!/[A-Z]/.test(password)) errors.push("Min 1 majuscule");
  if (!/[a-z]/.test(password)) errors.push("Min 1 minuscule");
  if (!/[0-9]/.test(password)) errors.push("Min 1 chiffre");
  if (!/[!@#$%^&*]/.test(password)) errors.push("Min 1 caractère spécial");
  if (["password", "123456", "12345678"].some(c => password.toLowerCase().includes(c))) {
    errors.push("Mot de passe trop commun");
  }
  return { isValid: errors.length === 0, errors };
}

export async function POST(req) {
  try {
    await connectDB();

    const ip = getClientIp(req);

    const rateLimit = await checkRateLimit({ key: `register:${ip}`, windowMs: 60 * 1000, maxAttempts: 5 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    let { name, email, password } = body;

    name = sanitize(name);
    email = sanitize(email)?.toLowerCase();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Tous les champs sont obligatoires" },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { message: "Le nom doit contenir entre 2 et 50 caractères" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "Adresse email invalide" },
        { status: 400 }
      );
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.isValid) {
      return NextResponse.json(
        { message: pwdCheck.errors.join(", ") },
        { status: 400 }
      );
    }

    /* ✅ Vérification si email existe déjà */
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: "Cet email est déjà utilisé" },
        { status: 400 }
      );
    }

    /* Hash mot de passe */
    const hashedPassword = await bcrypt.hash(password, 12);

    /* Token de vérification email — valable 24h */
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "customer",
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
    });

    /* 📧 Email de vérification en arrière-plan — ne bloque pas */
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;
    const html = getAccountVerificationEmailTemplate(name, verifyUrl);

    sendEmail({
      to: email,
      subject: "Confirmez votre adresse email — WYBOB 🎩",
      html,
    }).catch(err => console.error("Erreur email vérification:", err));

    return NextResponse.json(
      { message: "Compte créé ! Vérifiez votre boîte mail pour activer votre compte." },
      { status: 201 }
    );

  } catch (error) {
    console.error("Erreur inscription:", error);

    if (error.code === 11000) {
      return NextResponse.json({ message: "Email déjà utilisé" }, { status: 400 });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message);
      return NextResponse.json({ message: messages.join(". ") }, { status: 400 });
    }

    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}