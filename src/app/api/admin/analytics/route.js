export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/require-admin";
import { getAnalytics, isAnalyticsRange } from "@/app/lib/stats/queries";

// GET /api/admin/analytics?range=today|30d|12m|all — statistiques de visite agrégées.
export async function GET(request) {
  // Avant toute requête en base : 401 sans connexion, 403 si pas admin.
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const range = new URL(request.url).searchParams.get("range") || "30d";
  if (!isAnalyticsRange(range)) {
    return NextResponse.json(
      { message: "Paramètre range invalide (today, 30d, 12m ou all)" },
      { status: 400 }
    );
  }

  try {
    const data = await getAnalytics(range);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    return NextResponse.json({ message: "Erreur lors du calcul des statistiques" }, { status: 500 });
  }
}
