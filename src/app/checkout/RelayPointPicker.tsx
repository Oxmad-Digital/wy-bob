"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import RelayPointMap from "./RelayPointMap";

export interface RelayPoint {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  zipCode: string;
  city: string;
  country: string;
  distanceInMeters?: number;
  latitude?: number;
  longitude?: number;
}

interface RelayPointPickerProps {
  address: string;
  zipCode: string;
  city: string;
  country: string;
  value: RelayPoint | null;
  onChange: (point: RelayPoint | null) => void;
}

const RADIUS_OPTIONS_KM = [5, 10, 20, 50];

// Chronopost plafonne le nombre de points renvoyés indépendamment du rayon (maxPointChronopost) :
// sans faire varier ce plafond avec le rayon, un rayon plus large ne renvoie pas plus de points
// dans une zone dense (le plafond est déjà atteint par les points les plus proches).
// Le service refuse toute valeur > 25 ("max_pudo_number must be less than or equal to 25").
const MAX_POINTS_BY_RADIUS_KM: Record<number, number> = { 5: 8, 10: 15, 20: 25, 50: 25 };

export default function RelayPointPicker({ address, zipCode, city, country, value, onChange }: RelayPointPickerProps) {
  const { t } = useLanguage();
  const [points, setPoints] = useState<RelayPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);

  const search = async () => {
    if (!zipCode || !city) {
      setError(t.checkout.relay.missingFields);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const maxPoints = MAX_POINTS_BY_RADIUS_KM[radiusKm] ?? 8;
      const params = new URLSearchParams({
        address,
        zipCode,
        city,
        country: country || "FR",
        maxDistanceKm: String(radiusKm),
        maxPoints: String(maxPoints),
      });
      const res = await fetch(`/api/shipping/relay-points?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t.checkout.relay.unavailable);
        setPoints([]);
        return;
      }
      setPoints(data.points || []);
      if ((data.points || []).length === 0) {
        setError(t.checkout.relay.noneFound);
      }
    } catch {
      setError(t.checkout.relay.serverError);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div className="relay-picker">
      <div className="relay-search-row">
        <button type="button" className="relay-search-btn" onClick={search} disabled={loading}>
          {loading ? t.checkout.relay.searching : searched ? t.checkout.relay.findAgain : t.checkout.relay.findButton}
        </button>
        <label className="relay-radius-label">
          {t.checkout.relay.radiusLabel}
          <select
            className="relay-radius-select"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>{km} km</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="relay-error">{error}</p>}

      {points.length > 0 && (
        <RelayPointMap
          points={points}
          value={value}
          onChange={onChange}
          address={address}
          zipCode={zipCode}
          city={city}
          country={country}
        />
      )}

      {points.length > 0 && (
        <div className="relay-list">
          {points.map((p) => (
            <label key={p.id} className={`relay-point-card ${value?.id === p.id ? "relay-point-selected" : ""}`}>
              <input
                type="radio"
                name="relayPoint"
                checked={value?.id === p.id}
                onChange={() => onChange(p)}
              />
              <div className="relay-point-info">
                <strong>{p.name}</strong>
                <span>{p.address1}{p.address2 ? `, ${p.address2}` : ""}</span>
                <span>{p.zipCode} {p.city}</span>
                {p.distanceInMeters !== undefined && (
                  <span className="relay-point-distance">{Math.round(p.distanceInMeters)} m</span>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {value && (
        <p className="relay-selected-hint">{t.checkout.relay.selectedHint} <strong>{value.name}</strong></p>
      )}
    </div>
  );
}
