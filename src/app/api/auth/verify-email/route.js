import { verifyEmailByToken } from "@/app/lib/repos/users";
import { sendEmail } from "@/app/lib/mailer";
import { getVerificationEmailTemplate } from "@/app/lib/emailTemplates";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ message: "Token manquant" }, { status: 400 });
    }

    // Valide l'email et efface le jeton en une seule écriture : { name, email } ou null.
    const user = await verifyEmailByToken(token, new Date());

    if (!user) {
      return NextResponse.json(
        { message: "Lien invalide ou expiré. Demandez un nouveau lien de vérification." },
        { status: 400 }
      );
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
    const html = getVerificationEmailTemplate(user.name, dashboardUrl);
    sendEmail({
      to: user.email,
      subject: "Bienvenue sur WYBOB 🎩",
      html,
    }).catch(err => console.error("Erreur email bienvenue:", err));

    return NextResponse.json(
      { message: "Votre email a été vérifié avec succès !" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur verify-email:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
