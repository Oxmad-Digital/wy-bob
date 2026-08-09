import { NextResponse } from "next/server";
import { sendEmail } from "@/app/lib/mailer";
import { getContactFormEmailTemplate } from "@/app/lib/emailTemplates";
import { checkRateLimit, getClientIp } from "@/app/lib/rateLimit";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Vérifie les octets d'en-tête plutôt que de faire confiance au `type` déclaré
// par le client (spoofable), pour ne joindre à l'email que de vraies images.
function isValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length > 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

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

    const formData = await req.formData();
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const subject = String(formData.get("subject") || "");
    const orderNumber = String(formData.get("orderNumber") || "");
    const message = String(formData.get("message") || "");
    const honeypot = String(formData.get("hp_website") || "");
    const attachment = formData.get("attachment");

    // Champ piège invisible pour les utilisateurs : s'il est rempli, c'est un bot.
    // On répond succès sans rien envoyer, pour ne pas l'alerter.
    if (honeypot.trim()) {
      return NextResponse.json({ message: "Message envoyé" }, { status: 200 });
    }

    if (!name.trim()) {
      return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ message: "Adresse email invalide" }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ message: "Le message est requis" }, { status: 400 });
    }

    let attachments;
    if (attachment && typeof attachment === "object" && attachment.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.has(attachment.type)) {
        return NextResponse.json({ message: "Format d'image non supporté (JPG, PNG ou WEBP uniquement)" }, { status: 400 });
      }
      if (attachment.size > MAX_ATTACHMENT_SIZE) {
        return NextResponse.json({ message: "Image trop lourde (5 Mo max)" }, { status: 400 });
      }
      const buffer = Buffer.from(await attachment.arrayBuffer());
      if (!isValidImageSignature(buffer, attachment.type)) {
        return NextResponse.json({ message: "Fichier image invalide" }, { status: 400 });
      }
      attachments = [{ filename: attachment.name || "photo.jpg", content: buffer }];
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
    const html = getContactFormEmailTemplate({
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "",
      subject: subject.trim(),
      orderNumber: orderNumber.trim(),
      message: message.trim(),
      hasAttachment: Boolean(attachments),
    });

    await sendEmail({
      to: adminEmail,
      subject: `📩 Nouveau message de contact — ${name.trim()}`,
      html,
      replyTo: email.trim(),
      attachments,
    });

    return NextResponse.json({ message: "Message envoyé" }, { status: 200 });
  } catch (error) {
    console.error("Erreur contact:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
