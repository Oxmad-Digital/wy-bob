"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { bucketLabel, bucketTick, formatNumber, pickTicks, spansSeveralYears } from "./format";

// Mêmes réglages visuels que le graphique "Évolution des ventes" du dashboard.
const VIEWS_COLOR = "#1B1843";
const VISITORS_COLOR = "#F9C464";
const font = "'DM Sans', sans-serif";

// Nombre d'étiquettes de l'axe X : 6 environ, 4 sur mobile (même seuil que le CSS).
const MOBILE_QUERY = "(max-width: 640px)";
const TICKS_DESKTOP = 6;
const TICKS_MOBILE = 4;

function subscribeMobile(onChange) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
const getIsMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const getIsMobileServer = () => false;

export default function TrafficChart({ data, granularity, range }) {
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, getIsMobileServer);

  const { ticks, withYear } = useMemo(() => {
    const buckets = data.map((d) => d.bucket);
    return {
      ticks: pickTicks(buckets, isMobile ? TICKS_MOBILE : TICKS_DESKTOP),
      withYear: range === "all" && spansSeveralYears(buckets),
    };
  }, [data, isMobile, range]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="statsGradViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={VIEWS_COLOR} stopOpacity={0.14} />
            <stop offset="95%" stopColor={VIEWS_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="statsGradVisitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={VISITORS_COLOR} stopOpacity={0.35} />
            <stop offset="95%" stopColor={VISITORS_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="#f2f2f0" vertical={false} />
        <XAxis
          dataKey="bucket"
          ticks={ticks}
          interval={0}
          tickFormatter={(b) => bucketTick(b, granularity, { withYear })}
          fontSize={10}
          tick={{ fill: "#9b9b9b", fontFamily: font }}
          tickLine={false}
          axisLine={false}
          padding={{ left: 8, right: 8 }}
        />
        <YAxis
          allowDecimals={false}
          fontSize={10}
          tick={{ fill: "#9b9b9b", fontFamily: font }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          labelFormatter={(b) => bucketLabel(b, granularity)}
          formatter={(value, name) => [formatNumber(value), name]}
          contentStyle={{
            background: "#fff", border: "1px solid #ebebea", borderRadius: "8px",
            fontSize: "12px", fontFamily: font, boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          }}
          cursor={{ stroke: "#ebebea", strokeWidth: 1 }}
        />
        {/* Valeurs null = heures à venir : la courbe s'arrête à l'heure actuelle. */}
        <Area type="monotone" dataKey="views" name="Vues" stroke={VIEWS_COLOR} strokeWidth={2} fill="url(#statsGradViews)" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
        <Area type="monotone" dataKey="visitors" name="Visiteurs uniques" stroke={VISITORS_COLOR} strokeWidth={2} fill="url(#statsGradVisitors)" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const TRAFFIC_COLORS = { views: VIEWS_COLOR, visitors: VISITORS_COLOR };
