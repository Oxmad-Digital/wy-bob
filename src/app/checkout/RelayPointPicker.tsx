"use client";

import { useState } from "react";

export interface RelayPoint {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  zipCode: string;
  city: string;
  country: string;
  distanceInMeters?: number;
}

interface RelayPointPickerProps {
  address: string;
  zipCode: string;
  city: string;
  country: string;
  value: RelayPoint | null;
  onChange: (point: RelayPoint | null) => void;
}

export default function RelayPointPicker({ address, zipCode, city, country, value, onChange }: RelayPointPickerProps) {
  const [points, setPoints] = useState<RelayPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!zipCode || !city) {
      setError("Renseignez d'abord le code postal et la ville ci-dessus");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ address, zipCode, city, country: country || "FR" });
      const res = await fetch(`/api/shipping/relay-points?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Recherche indisponible");
        setPoints([]);
        return;
      }
      setPoints(data.points || []);
      if ((data.points || []).length === 0) {
        setError("Aucun point relais trouvé à proximité");
      }
    } catch {
      setError("Erreur serveur");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div className="relay-picker">
      <button type="button" className="relay-search-btn" onClick={search} disabled={loading}>
        {loading ? "Recherche…" : searched ? "Rechercher à nouveau" : "Trouver un point relais"}
      </button>

      {error && <p className="relay-error">{error}</p>}

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
        <p className="relay-selected-hint">Point relais sélectionné : <strong>{value.name}</strong></p>
      )}
    </div>
  );
}
