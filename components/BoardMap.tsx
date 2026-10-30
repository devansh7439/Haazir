"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  live?: boolean;
  title: string;
  detail: string;
}

function pinIcon(p: MapPin) {
  return L.divIcon({
    className: "",
    html: `<div class="haazir-pin${p.live ? " haazir-pin-live" : ""}" style="width:28px;height:28px;background:${p.color}" aria-hidden="true">${p.label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const originIcon = L.divIcon({
  className: "",
  html: `<div class="haazir-pin" style="width:32px;height:32px;background:#18181b" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 });
    // Refit only when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function BoardMap({ origin, pins }: { origin: { lat: number; lng: number; name: string | null }; pins: MapPin[] }) {
  const points = useMemo<Array<[number, number]>>(() => [[origin.lat, origin.lng], ...pins.map((p) => [p.lat, p.lng] as [number, number])], [origin, pins]);
  return (
    <MapContainer center={[origin.lat, origin.lng]} zoom={11} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="haazir-tiles"
      />
      <FitBounds points={points} />
      <Marker position={[origin.lat, origin.lng]} icon={originIcon} title={origin.name ?? "Referring centre"}>
        <Tooltip>{origin.name ?? "Referring centre"} (you)</Tooltip>
      </Marker>
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p)} title={p.title}>
          <Tooltip>
            <strong>{p.label}. {p.title}</strong>
            <br />
            {p.detail}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
