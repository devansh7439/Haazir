"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

const pinIcon = L.divIcon({
  className: "",
  html: `<div class="haazir-pin" style="width:30px;height:30px;background:#18181b" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** One hospital on a small map, for its details page. */
export default function HospitalMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="haazir-tiles"
      />
      <Marker position={[lat, lng]} icon={pinIcon} title={name} />
    </MapContainer>
  );
}
