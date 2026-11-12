"use client";

import dynamic from "next/dynamic";

// Comme le dashboard : recharts n'est chargé que côté client, sur cette page.
const Analytics = dynamic(() => import("./Analytics"), {
  loading: () => <p style={{ padding: "2rem", color: "#9b9b9b" }}>Chargement des statistiques…</p>,
  ssr: false,
});

export default function AnalyticsClient() {
  return <Analytics />;
}
