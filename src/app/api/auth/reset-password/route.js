import { resetPasswordByToken } from "@/app/lib/repos/users";
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

    // Nouveau hash, jeton effacé, échecs remis à 0 et verrouillage levé en une seule écriture,
    // seulement si le jeton existe et n'a pas expiré (un lien ne sert qu'une fois).
    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await resetPasswordByToken(token, passwordHash, new Date());

    if (!updated) {
      return NextResponse.json(
        { message: "Lien invalide ou expiré. Veuillez faire une nouvelle demande." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Mot de passe réinitialisé avec succès." }, { status: 200 });
  } catch (error) {
    console.error("Erreur reset-password:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
