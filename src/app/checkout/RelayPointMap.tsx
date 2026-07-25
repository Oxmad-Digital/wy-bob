"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import type { RelayPoint } from "./RelayPointPicker";
import { useLanguage } from "@/contexts/LanguageContext";

interface RelayPointMapProps {
  points: RelayPoint[];
  value: RelayPoint | null;
  onChange: (point: RelayPoint) => void;
  address: string;
  zipCode: string;
  city: string;
  country: string;
}

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const MAP_OPTIONS = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

type GeoRelayPoint = RelayPoint & { latitude: number; longitude: number };

// Pin en forme de colis (plutôt que la flèche par défaut de l'API) pour symboliser
// visuellement un point relais. Couleur dorée quand sélectionné (cohérent avec
// .relay-point-selected dans checkout.css), navy sinon.
function relayMarkerIcon(selected: boolean): google.maps.Icon {
  const fill = selected ? "#F9C464" : "#1B1843";
  const size = selected ? 34 : 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.716 23.284 0 15 0z" fill="${fill}"/>
    <circle cx="15" cy="15" r="9" fill="#ffffff"/>
    <path d="M15 8.5l6 3v7l-6 3-6-3v-7l6-3z" fill="none" stroke="${fill}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M9 11.5L15 15l6-3.5M15 15v7" fill="none" stroke="${fill}" stroke-width="1.4" stroke-linejoin="round"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size * (38 / 30)),
    anchor: new google.maps.Point(size / 2, size * (38 / 30)),
  };
}

export default function RelayPointMap({ points, value, onChange, address, zipCode, city, country }: RelayPointMapProps) {
  const { t } = useLanguage();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey || "",
    id: "wybob-google-maps",
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const [customerPosition, setCustomerPosition] = useState<google.maps.LatLngLiteral | null>(null);

  const pointsWithCoords: GeoRelayPoint[] = points.filter(
    (p): p is GeoRelayPoint => typeof p.latitude === "number" && typeof p.longitude === "number"
  );

  // Géocode l'adresse client à chaque nouvelle recherche pour la situer sur la carte
  // (Chronopost ne renvoie que les coordonnées des points relais, pas celles de l'adresse).
  useEffect(() => {
    if (!isLoaded || !zipCode || !city) return;
    const geocoder = new google.maps.Geocoder();
    const fullAddress = [address, zipCode, city, country].filter(Boolean).join(", ");
    geocoder.geocode({ address: fullAddress }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        setCustomerPosition({ lat: loc.lat(), lng: loc.lng() });
      } else {
        setCustomerPosition(null);
      }
    });
  }, [isLoaded, address, zipCode, city, country]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const positions = pointsWithCoords.map((p) => ({ lat: p.latitude, lng: p.longitude }));
    if (customerPosition) positions.push(customerPosition);
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setCenter(positions[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    positions.forEach((pos) => bounds.extend(pos));
    map.fitBounds(bounds, 48);
  }, [pointsWithCoords, customerPosition]);

  useEffect(() => {
    fitBounds();
  }, [fitBounds]);

  if (!apiKey || !isLoaded || pointsWithCoords.length === 0) return null;

  return (
    <div className="relay-map">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        options={MAP_OPTIONS}
        onLoad={(map) => {
          mapRef.current = map;
          fitBounds();
        }}
      >
        {customerPosition && (
          <Marker
            position={customerPosition}
            title={t.checkout.relay.customerMarkerLabel}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#F9C464",
              fillOpacity: 1,
              strokeColor: "#1B1843",
              strokeWeight: 2,
            }}
          />
        )}
        {pointsWithCoords.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.latitude, lng: p.longitude }}
            title={p.name}
            onClick={() => onChange(p)}
            icon={relayMarkerIcon(value?.id === p.id)}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
