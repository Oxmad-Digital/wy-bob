// app/api/cron/track-orders/route.js
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { listOrdersToTrack } from "@/app/lib/repos/orders";
import { refreshOrderTracking } from "@/app/lib/chronopost/refreshOrderTracking";

// ✅ GET - Actualise automatiquement le suivi Chronopost de toutes les commandes en
// cours (remplace le clic manuel "Actualiser le suivi" pour les commandes qu'un admin
// n'a pas ouvertes). Appelé une fois par jour par le cron Vercel (voir vercel.json).
export async function GET(req) {
  // Sans CRON_SECRET défini, l'ancienne comparaison acceptait l'en-tête "Bearer undefined" :
  // on refuse donc explicitement si le secret n'est pas configuré.
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  // Seules les commandes déjà expédiées (skybillNumber généré) et pas encore dans un
  // état terminal ont besoin d'être re-vérifiées.
  const orders = await listOrdersToTrack();

  let updated = 0;
  const errors = [];

  // Séquentiel plutôt que Promise.all : on évite de bombarder l'API Chronopost en
  // parallèle sans connaître ses limites de débit.
  for (const order of orders) {
    try {
      await refreshOrderTracking(order);
      updated++;
    } catch (err) {
      errors.push({ orderId: order._id, message: err?.message || "Erreur inconnue" });
      console.error(`CRON TRACKING ERROR (order ${order._id}):`, err);
    }
  }

  return NextResponse.json({ processed: orders.length, updated, failed: errors.length, errors });
}
