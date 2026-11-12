import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Contrôle d'accès des routes /api/admin/** : le proxy ne s'applique pas aux routes /api,
 * chaque route doit donc appeler ce helper elle-même, avant toute requête en base.
 *
 * Usage :
 *   const guard = await requireAdmin();
 *   if (guard instanceof Response) return guard;
 *   // guard est la session de l'admin
 *
 * @returns {Promise<import("next-auth").Session | NextResponse>} la session si l'utilisateur
 *   est admin, sinon une réponse JSON 401 (pas de session) ou 403 (connecté mais pas admin).
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ message: "Connexion requise" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  return session;
}
