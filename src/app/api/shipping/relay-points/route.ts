export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { searchRelayPoints } from "@/app/lib/chronopost/relay";
import { ChronopostError } from "@/app/lib/chronopost/client";

// ✅ GET - Recherche de points relais Chronopost (utilisé par le sélecteur au checkout)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") || "";
  const zipCode = searchParams.get("zipCode") || "";
  const city = searchParams.get("city") || "";
  const country = (searchParams.get("country") || "FR").toUpperCase();
  const maxDistanceKmParam = Number(searchParams.get("maxDistanceKm"));
  const maxDistanceKm = Number.isFinite(maxDistanceKmParam) && maxDistanceKmParam > 0 ? maxDistanceKmParam : undefined;
  const maxPointsParam = Number(searchParams.get("maxPoints"));
  const maxPoints = Number.isFinite(maxPointsParam) && maxPointsParam > 0 ? maxPointsParam : undefined;

  if (!zipCode || !city) {
    return NextResponse.json({ message: "Code postal et ville requis" }, { status: 400 });
  }

  const productCode = country === "FR" ? "86" : "49"; // Chrono Relais 13 vs Chronorelais Europe

  try {
    const points = await searchRelayPoints({ address, zipCode, city, countryCode: country, productCode, maxDistanceKm, maxPoints });
    return NextResponse.json({ points });
  } catch (error) {
    const message = error instanceof ChronopostError ? error.message : "Recherche de points relais indisponible";
    console.error("RELAY POINTS ERROR:", error);
    return NextResponse.json({ message }, { status: 502 });
  }
}
