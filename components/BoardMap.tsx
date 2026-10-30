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
  icon: string;
  title: string;
  detail: string;
}

function pinIcon(p: MapPin) {
  return L.divIcon({
    className: "",
    html: `<div class="haazir-pin" style="width:30px;height:30px;background:${p.color}" aria-hidden="true">${p.label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const originIcon = L.divIcon({
  className: "",
  html: `<div class="haazir-pin" style="width:34px;height:34px;background:#0f172a;font-size:18px" aria-hidden="true">⌂</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
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
            {p.icon} {p.detail}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
