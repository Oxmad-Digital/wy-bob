"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "../statistiques.module.css";
import TrafficChart, { TRAFFIC_COLORS } from "./TrafficChart";
import {
  DEVICE_LABELS,
  RANGE_OPTIONS,
  TRAFFIC_TITLES,
  countryFlag,
  countryName,
  formatDecimal,
  formatDuration,
  formatNumber,
  formatPercent,
  pageLabel,
} from "./format";

// La carte (≈ 80 Ko de tracés) n'est chargée qu'une fois les données affichées.
const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Chargement de la carte…</div>,
});

const COUNTRIES_PREVIEW = 10;

const DEVICE_ICONS = {
  desktop: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  mobile: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  ),
  tablet: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  ),
};

export default function Analytics() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);

  // L'état "loading" est posé par les gestionnaires d'événements (et l'état initial),
  // pas dans l'effet : l'effet ne fait que synchroniser avec l'API.
  const changeRange = (next) => {
    if (next === range) return;
    setStatus("loading");
    setRange(next);
  };
  const retry = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/admin/analytics?range=${range}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, [range, reloadKey]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div>
          <div className={styles.overline}>Vue d&apos;ensemble</div>
          <div className={styles.muted}>Audience du site sur la période sélectionnée</div>
        </div>
        <RangeSelector value={range} onChange={changeRange} />
      </div>

      {status === "error" && (
        <div className={styles.errorBox} role="alert">
          <span>Impossible de charger les statistiques.</span>
          <button type="button" className={styles.retryBtn} onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {!data && status === "loading" && <LoadingState />}

      {data && (
        <div className={status === "loading" ? styles.refreshing : undefined} aria-busy={status === "loading"}>
          <Dashboard data={data} />
        </div>
      )}
    </div>
  );
}

function RangeSelector({ value, onChange }) {
  return (
    <div className={styles.rangeSelector} role="tablist" aria-label="Période">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`${styles.rangeBtn} ${value === opt.value ? styles.rangeBtnActive : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Dashboard({ data }) {
  const { range, granularity, summary, traffic, topPages, referrers, devices, countries } = data;
  const isEmpty = summary.views === 0;
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "";

  const totalEntries = referrers.reduce((s, r) => s + r.visits, 0);
  const totalDeviceVisitors = devices.reduce((s, d) => s + d.visitors, 0);
  const totalCountryVisitors = countries.reduce((s, c) => s + c.visitors, 0);

  return (
    <div className={styles.stack}>
      {isEmpty && (
        <div className={styles.emptyBanner}>
          Aucune visite enregistrée sur cette période. Les visites sont comptées en production
          (hors robots, pages admin et administrateurs connectés).
        </div>
      )}

      <div className={styles.kpiGrid}>
        <KpiCard label="Vues" value={formatNumber(summary.views)} sub={rangeLabel} accent="#eef0f8" icon="👁" />
        <KpiCard
          label="Visiteurs uniques"
          value={formatNumber(summary.visitors)}
          sub={range === "today" ? rangeLabel : "visiteurs uniques par jour, cumulés"}
          accent="#fffbef"
          icon="👤"
        />
        <KpiCard
          label="Moyenne par jour"
          value={formatDecimal(summary.avgViewsPerDay)}
          sub={`vues / jour · ${formatDecimal(summary.avgVisitorsPerDay)} visiteurs / jour`}
          accent="#f0fdf4"
          icon="📅"
        />
        <KpiCard
          label="Durée moyenne par session"
          value={formatDuration(summary.avgSessionDurationS)}
          sub="temps passé onglet visible"
          accent="#faf5ff"
          icon="⏱"
        />
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{TRAFFIC_TITLES[granularity] ?? "Trafic"}</h2>
          <div className={styles.legend}>
            <LegendItem color={TRAFFIC_COLORS.views} label="Vues" />
            <LegendItem color={TRAFFIC_COLORS.visitors} label="Visiteurs uniques" />
          </div>
        </div>
        {traffic.length > 0 ? (
          <TrafficChart data={traffic} granularity={granularity} range={range} />
        ) : (
          <Empty />
        )}
      </section>

      <div className={styles.panelsGrid}>
        <Panel title="Pages les plus vues" column="Vues">
          <BarList
            total={summary.views}
            items={topPages.map((p) => ({ key: p.path, label: pageLabel(p.path), title: p.path, value: p.views }))}
          />
        </Panel>

        <Panel title="Provenance" column="Visites">
          <BarList
            total={totalEntries}
            items={referrers.map((r) => ({
              key: r.referrer ?? "__direct",
              label: r.referrer ?? "Direct",
              muted: !r.referrer,
              value: r.visits,
            }))}
          />
        </Panel>

        <Panel title="Appareils" column="Visiteurs">
          <BarList
            total={totalDeviceVisitors}
            items={devices.map((d) => ({
              key: d.device,
              label: DEVICE_LABELS[d.device] ?? d.device,
              icon: DEVICE_ICONS[d.device],
              value: d.visitors,
            }))}
          />
        </Panel>
      </div>

      <GeoSection countries={countries} total={totalCountryVisitors} />
    </div>
  );
}

function GeoSection({ countries, total }) {
  const [showAll, setShowAll] = useState(false);
  const items = countries.map((c) => ({
    key: c.country ?? "__unknown",
    label: countryName(c.country),
    icon: <span className={styles.flag} aria-hidden="true">{countryFlag(c.country)}</span>,
    muted: !c.country,
    value: c.visitors,
  }));
  const visible = showAll ? items : items.slice(0, COUNTRIES_PREVIEW);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Origine géographique</h2>
        <span className={styles.columnLabel}>Visiteurs</span>
      </div>

      {items.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className={styles.countryList}>
            <BarList total={total} items={visible} />
          </div>
          {items.length > COUNTRIES_PREVIEW && (
            <button type="button" className={styles.linkBtn} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Afficher moins" : `Afficher les ${items.length} pays`}
            </button>
          )}
        </>
      )}

      <div className={styles.mapSection}>
        <WorldMap countries={countries} />
      </div>
    </section>
  );
}

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon} style={{ background: accent }} aria-hidden="true">{icon}</div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiSub}>{sub}</div>
    </div>
  );
}

function Panel({ title, column, children }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <span className={styles.columnLabel}>{column}</span>
      </div>
      {children}
    </section>
  );
}

function BarList({ items, total }) {
  if (items.length === 0) return <Empty />;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className={styles.barList}>
      {items.map((item) => (
        <li key={item.key} className={styles.barRow}>
          <span className={styles.barFill} style={{ width: `${(item.value / max) * 100}%` }} aria-hidden="true" />
          <span className={`${styles.barLabel} ${item.muted ? styles.barLabelMuted : ""}`} title={item.title ?? item.label}>
            {item.icon && <span className={styles.barIcon}>{item.icon}</span>}
            <span className={styles.barText}>{item.label}</span>
          </span>
          <span className={styles.barValue}>
            {formatNumber(item.value)}
            <span className={styles.barPct}>{formatPercent(item.value, total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function LegendItem({ color, label }) {
  return (
    <span className={styles.legendItem}>
      <span className={styles.legendSwatch} style={{ background: color }} />
      {label}
    </span>
  );
}

function Empty() {
  return <div className={styles.empty}>Aucune donnée</div>;
}

function LoadingState() {
  return (
    <div className={styles.stack} aria-busy="true" aria-label="Chargement des statistiques">
      <div className={styles.kpiGrid}>
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${styles.kpiCard} ${styles.skeleton}`} style={{ height: 118 }} />)}
      </div>
      <div className={`${styles.card} ${styles.skeleton}`} style={{ height: 280 }} />
      <div className={styles.panelsGrid}>
        {[0, 1, 2].map((i) => <div key={i} className={`${styles.card} ${styles.skeleton}`} style={{ height: 220 }} />)}
      </div>
    </div>
  );
}
