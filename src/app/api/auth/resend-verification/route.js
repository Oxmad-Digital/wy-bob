import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import { sendEmail } from "@/app/lib/mailer";
import { getAccountVerificationEmailTemplate } from "@/app/lib/emailTemplates";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export async function POST(req) {
  try {
    await connectDB();

    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({ key: `resend-verification:${ip}`, windowMs: 60 * 1000, maxAttempts: 5 });
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

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Toujours répondre 200 pour ne pas révéler si l'email existe
    if (!user || user.emailVerified) {
      return NextResponse.json(
        { message: "Si ce compte existe et n'est pas encore vérifié, un email a été envoyé." },
        { status: 200 }
      );
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;
    const html = getAccountVerificationEmailTemplate(user.name, verifyUrl);

    sendEmail({
      to: user.email,
      subject: "Confirmez votre adresse email — WYBOB 🎩",
      html,
    }).catch(err => console.error("Erreur email vérification:", err));

    return NextResponse.json(
      { message: "Si ce compte existe et n'est pas encore vérifié, un email a été envoyé." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur resend-verification:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
