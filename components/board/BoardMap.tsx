"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { memo, useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import type { MapPin } from "@/lib/ui/board";

// Same look, same icon object: Leaflet swaps a marker's DOM node whenever the icon changes identity, which restarts the pulse and drops hover.
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(p: MapPin) {
  const cls = ["haazir-pin", p.live ? "haazir-pin-live" : "", p.role === "selected" ? "haazir-pin-selected" : "", p.role === "out" ? "haazir-pin-out" : ""];
  const chip = p.eta ? `<span class="haazir-pin-chip">${p.eta}</span>` : "";
  const html = `<div class="haazir-pin-wrap"><div class="${cls.filter(Boolean).join(" ")}" style="width:30px;height:30px;background:${p.color}" aria-hidden="true">${p.label}</div>${chip}</div>`;
  let icon = iconCache.get(html);
  if (!icon) {
    icon = L.divIcon({ className: "", html, iconSize: [30, 30], iconAnchor: [15, 15] });
    iconCache.set(html, icon);
  }
  return icon;
}

const originIcon = L.divIcon({
  className: "",
  html: `<div class="haazir-pin-wrap"><div class="haazir-pin" style="width:34px;height:34px;background:#18181b" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></div><span class="haazir-pin-chip haazir-pin-chip-origin">You</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

/** Fits every point in view, whenever the set of points changes, and again on the "Fit all" button. */
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [44, 44], maxZoom: 13 });
    // Refit only when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  useEffect(() => {
    const Control = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create("button", "haazir-map-btn") as HTMLButtonElement;
        btn.type = "button";
        btn.textContent = "Fit all";
        btn.setAttribute("aria-label", "Fit all hospitals in view");
        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = () => map.fitBounds(L.latLngBounds(points), { padding: [44, 44], maxZoom: 13 });
        return btn;
      },
    });
    const control = new Control({ position: "topright" });
    control.addTo(map);
    return () => {
      control.remove();
    };
    // The button always fits the points it was created with; the effect re-runs when they change.
  }, [key, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** The live map: the referring centre, each hospital with its drive time, and a route to the ones that said yes. */
function BoardMap({ origin, pins }: { origin: { lat: number; lng: number; name: string | null }; pins: MapPin[] }) {
  const points = useMemo<Array<[number, number]>>(() => [[origin.lat, origin.lng], ...pins.map((p) => [p.lat, p.lng] as [number, number])], [origin, pins]);
  const routes = pins.filter((p) => p.role === "selected" || p.role === "accepted");
  return (
    <MapContainer center={[origin.lat, origin.lng]} zoom={11} scrollWheelZoom={false} zoomControl={false} className="h-full w-full" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="haazir-tiles"
      />
      <ZoomControl position="bottomright" />
      <FitBounds points={points} />
      {routes.map((p) => (
        <Polyline
          key={`route-${p.id}`}
          positions={[[origin.lat, origin.lng], [p.lat, p.lng]]}
          pathOptions={
            p.role === "selected"
              ? { color: "#15803d", weight: 4, opacity: 0.9 }
              : { color: "#15803d", weight: 2, opacity: 0.55, dashArray: "6 8" }
          }
        />
      ))}
      <Marker position={[origin.lat, origin.lng]} icon={originIcon} title={origin.name ?? "Referring centre"} zIndexOffset={500}>
        <Tooltip>{origin.name ?? "Referring centre"} (you)</Tooltip>
      </Marker>
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p)} title={p.title} zIndexOffset={p.role === "selected" ? 1000 : p.role === "accepted" ? 400 : 0}>
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

export default memo(BoardMap);
