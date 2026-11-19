import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findPasswordHashById, updateProfile } from "@/app/lib/repos/users";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { name, phone, currentPassword, newPassword } = body;

    const user = await findUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });

    const patch: Record<string, unknown> = {};

    // Mise à jour nom/téléphone
    if (name && name.trim()) patch.name = name.trim();
    if (phone !== undefined && newPassword === undefined) patch.phone = phone;

    // Changement mot de passe
    if (currentPassword && newPassword) {
      const currentHash = await findPasswordHashById(user.id);
      const isValid = currentHash ? await bcrypt.compare(currentPassword, currentHash) : false;
      if (!isValid) {
        return NextResponse.json({ message: "Mot de passe actuel incorrect" }, { status: 400 });
      }
      patch.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await updateProfile(user.id, patch);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH USER PROFILE ERROR:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
