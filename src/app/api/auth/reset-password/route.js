import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push("Min 8 caractères");
  if (!/[A-Z]/.test(password)) errors.push("Min 1 majuscule");
  if (!/[a-z]/.test(password)) errors.push("Min 1 minuscule");
  if (!/[0-9]/.test(password)) errors.push("Min 1 chiffre");
  if (!/[!@#$%^&*]/.test(password)) errors.push("Min 1 caractère spécial (!@#$%^&*)");
  return { isValid: errors.length === 0, errors };
}

export async function POST(req) {
  try {
    await connectDB();

    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({ key: `reset-password:${ip}`, windowMs: 60 * 1000, maxAttempts: 10 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Données manquantes" }, { status: 400 });
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.isValid) {
      return NextResponse.json({ message: pwdCheck.errors.join(", ") }, { status: 400 });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Lien invalide ou expiré. Veuillez faire une nouvelle demande." },
        { status: 400 }
      );
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();

    return NextResponse.json({ message: "Mot de passe réinitialisé avec succès." }, { status: 200 });
  } catch (error) {
    console.error("Erreur reset-password:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
