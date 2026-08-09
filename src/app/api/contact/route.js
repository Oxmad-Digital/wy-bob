import { NextResponse } from "next/server";
import { sendEmail } from "@/app/lib/mailer";
import { getContactFormEmailTemplate } from "@/app/lib/emailTemplates";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit({ key: `contact:${ip}`, windowMs: 60 * 1000, maxAttempts: 5 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Trop de tentatives. Réessayez dans ${rateLimit.retryAfter} secondes.` },
        { status: 429 }
      );
    }

    const { name, email, phone, message } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ message: "Adresse email invalide" }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ message: "Le message est requis" }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
    const html = getContactFormEmailTemplate({
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "",
      message: message.trim(),
    });

    await sendEmail({
      to: adminEmail,
      subject: `📩 Nouveau message de contact — ${name.trim()}`,
      html,
      replyTo: email.trim(),
    });

    return NextResponse.json({ message: "Message envoyé" }, { status: 200 });
  } catch (error) {
    console.error("Erreur contact:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
