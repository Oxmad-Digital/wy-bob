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
            icon={{
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              rotation: 180,
              scale: value?.id === p.id ? 7 : 5,
              fillColor: value?.id === p.id ? "#1B1843" : "#ffffff",
              fillOpacity: 1,
              strokeColor: "#1B1843",
              strokeWeight: 2,
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
