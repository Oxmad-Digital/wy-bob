"use client";

import { useMemo, useRef, useState } from "react";
import { COUNTRY_PATHS, MAP_HEIGHT, MAP_WIDTH } from "./worldPaths";
import { countryName, formatNumber } from "./format";
import styles from "../statistiques.module.css";

// Carte choroplèthe : intensité de l'or WYBOB selon le nombre de visiteurs du pays.
// Échelle en racine carrée pour que les petits pays restent visibles à côté du premier.
const EMPTY_FILL = "#ecebe8";
const LOW = [253, 240, 211];  // #fdf0d3
const HIGH = [214, 150, 30];  // #d6961e

function fillFor(value, max) {
  if (!value || !max) return EMPTY_FILL;
  const t = Math.sqrt(value / max);
  const c = LOW.map((lo, i) => Math.round(lo + (HIGH[i] - lo) * t));
  return `rgb(${c.join(",")})`;
}

export default function WorldMap({ countries }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { code, x, y }

  const { byCode, max } = useMemo(() => {
    const map = new Map();
    let m = 0;
    for (const c of countries) {
      if (!c.country) continue;
      map.set(c.country, c.visitors);
      if (c.visitors > m) m = c.visitors;
    }
    return { byCode: map, max: m };
  }, [countries]);

  const showTip = (code, event) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ code, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const hoverValue = hover ? byCode.get(hover.code) ?? 0 : 0;

  return (
    <div className={styles.mapWrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className={styles.mapSvg}
        role="img"
        aria-label="Carte du monde des visiteurs par pays (le détail est dans la liste ci-dessus)"
      >
        {Object.entries(COUNTRY_PATHS).map(([code, d]) => {
          const value = byCode.get(code) ?? 0;
          return (
            <path
              key={code}
              d={d}
              fill={fillFor(value, max)}
              className={`${styles.mapCountry} ${hover?.code === code ? styles.mapCountryActive : ""}`}
              onMouseMove={(e) => showTip(code, e)}
              onClick={(e) => showTip(code, e)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className={styles.mapTooltip}
          style={{ left: hover.x, top: hover.y }}
          aria-hidden="true"
        >
          <strong>{countryName(hover.code)}</strong>
          <span>{formatNumber(hoverValue)} visiteur{hoverValue > 1 ? "s" : ""}</span>
        </div>
      )}

      <div className={styles.mapLegend}>
        <span>Moins</span>
        <span className={styles.mapLegendBar} />
        <span>Plus</span>
      </div>
    </div>
  );
}
