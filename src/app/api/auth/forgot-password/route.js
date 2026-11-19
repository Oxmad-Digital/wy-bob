import { findUserByEmail, setResetToken } from "@/app/lib/repos/users";
import { sendEmail } from "@/app/lib/mailer";
import { getPasswordResetEmailTemplate } from "@/app/lib/emailTemplates";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({ key: `forgot-password:${ip}`, windowMs: 60 * 1000, maxAttempts: 5 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ message: "Adresse email invalide" }, { status: 400 });
    }

    const user = await findUserByEmail(email.trim().toLowerCase());

    // Toujours répondre 200 pour ne pas révéler si l'email existe
    if (!user) {
      return NextResponse.json(
        { message: "Si cet email existe, un lien de réinitialisation a été envoyé." },
        { status: 200 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await setResetToken(user.id, token, expiry);

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;
    const html = getPasswordResetEmailTemplate(user.name, resetUrl);

    sendEmail({
      to: user.email,
      subject: "Réinitialisation de votre mot de passe WYBOB",
      html,
    }).catch(err => console.error("Erreur envoi email reset:", err));

    return NextResponse.json(
      { message: "Si cet email existe, un lien de réinitialisation a été envoyé." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur forgot-password:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
