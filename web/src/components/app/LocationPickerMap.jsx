import { useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return null;
}

export default function LocationPickerMap({ latitude, longitude, onPick, radiusKm = 0, heightClass = "h-72" }) {
  const center = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return DEFAULT_CENTER;
  }, [latitude, longitude]);

  const hasPoint = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 ${heightClass}`}>
      <MapContainer center={center} className="h-full w-full" scrollWheelZoom zoom={hasPoint ? 15 : 11}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />
        {hasPoint ? (
          <>
            <Marker position={center} />
            {Number(radiusKm) > 0 ? (
              <Circle center={center} pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: 0.15 }} radius={Number(radiusKm) * 1000} />
            ) : null}
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
