import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import { sendEmail } from "@/app/lib/mailer";
import { getVerificationEmailTemplate } from "@/app/lib/emailTemplates";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await connectDB();

    const token = new URL(req.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ message: "Token manquant" }, { status: 400 });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Lien invalide ou expiré. Demandez un nouveau lien de vérification." },
        { status: 400 }
      );
    }

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

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
