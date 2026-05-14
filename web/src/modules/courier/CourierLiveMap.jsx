import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length === 0) {
      return;
    }

    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 14);
      return;
    }

    const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [map, points]);

  return null;
}

export default function CourierLiveMap({
  restaurantLat,
  restaurantLng,
  restaurantLabel,
  deliveryLat,
  deliveryLng,
  deliveryLabel,
  courierLat,
  courierLng,
  courierLabel,
  heightClass = "h-80"
}) {
  const points = useMemo(() => {
    const list = [];
    if (Number.isFinite(Number(restaurantLat)) && Number.isFinite(Number(restaurantLng))) {
      list.push({ lat: Number(restaurantLat), lng: Number(restaurantLng) });
    }
    if (Number.isFinite(Number(deliveryLat)) && Number.isFinite(Number(deliveryLng))) {
      list.push({ lat: Number(deliveryLat), lng: Number(deliveryLng) });
    }
    if (Number.isFinite(Number(courierLat)) && Number.isFinite(Number(courierLng))) {
      list.push({ lat: Number(courierLat), lng: Number(courierLng) });
    }
    return list;
  }, [restaurantLat, restaurantLng, deliveryLat, deliveryLng, courierLat, courierLng]);

  const center = points[0] || DEFAULT_CENTER;

  const routeLine =
    Number.isFinite(Number(restaurantLat)) &&
    Number.isFinite(Number(restaurantLng)) &&
    Number.isFinite(Number(deliveryLat)) &&
    Number.isFinite(Number(deliveryLng))
      ? [
          [Number(restaurantLat), Number(restaurantLng)],
          [Number(deliveryLat), Number(deliveryLng)]
        ]
      : null;

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 ${heightClass}`}>
      <MapContainer center={[center.lat, center.lng]} className="h-full w-full" scrollWheelZoom zoom={13}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {routeLine ? (
          <Polyline pathOptions={{ color: "#64748b", weight: 4, opacity: 0.65 }} positions={routeLine} />
        ) : null}
        {Number.isFinite(Number(restaurantLat)) && Number.isFinite(Number(restaurantLng)) ? (
          <CircleMarker
            center={[Number(restaurantLat), Number(restaurantLng)]}
            pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.85 }}
            radius={10}
          >
            <Popup>{restaurantLabel || "Restaurant"}</Popup>
          </CircleMarker>
        ) : null}
        {Number.isFinite(Number(deliveryLat)) && Number.isFinite(Number(deliveryLng)) ? (
          <CircleMarker
            center={[Number(deliveryLat), Number(deliveryLng)]}
            pathOptions={{ color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 0.85 }}
            radius={10}
          >
            <Popup>{deliveryLabel || "Customer"}</Popup>
          </CircleMarker>
        ) : null}
        {Number.isFinite(Number(courierLat)) && Number.isFinite(Number(courierLng)) ? (
          <CircleMarker
            center={[Number(courierLat), Number(courierLng)]}
            pathOptions={{ color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.9 }}
            radius={9}
          >
            <Popup>{courierLabel || "You"}</Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  );
}
