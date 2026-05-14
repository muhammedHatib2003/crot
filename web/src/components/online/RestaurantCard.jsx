import { Link } from "react-router-dom";
import { formatTryCurrency } from "../../utils/currency";

function formatDistance(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value).toFixed(1)} km`;
}

function formatRating(value, count) {
  if (!Number(count || 0)) {
    return "Yeni";
  }

  return `${Number(value || 0).toFixed(1)} (${Number(count || 0)})`;
}

export default function RestaurantCard({ restaurant }) {
  const inDeliveryZone = restaurant.inDeliveryZone !== false;
  const canOrder = Boolean(restaurant.isCurrentlyOpen) && inDeliveryZone;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {restaurant.coverImageUrl ? (
        <img alt={restaurant.name} className="h-40 w-full object-cover" src={restaurant.coverImageUrl} />
      ) : (
        <div className="h-24 w-full bg-gradient-to-r from-slate-200 to-slate-100" />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {restaurant.logoUrl ? (
              <img alt={restaurant.name} className="h-12 w-12 rounded-xl border border-slate-200 object-cover" src={restaurant.logoUrl} />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                {String(restaurant.name || "R").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{restaurant.name}</h2>
              <p className="text-xs text-slate-500">{restaurant.cuisineType || "Restoran"}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              restaurant.isCurrentlyOpen ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
            }`}
          >
            {restaurant.isCurrentlyOpen ? "Acik" : "Kapali"}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600">{restaurant.description || "Aciklama bulunmuyor."}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p>Puan: {formatRating(restaurant.ratingAverage, restaurant.ratingCount)}</p>
          <p>Uzaklik: {formatDistance(restaurant.distanceKm)}</p>
          <p>Sure: {Number(restaurant.estimatedDeliveryMinutes || 0)} dk</p>
          <p>Min sepet: {formatTryCurrency(restaurant.minimumOrderAmount)}</p>
          <p className="col-span-2">Teslimat ucreti: {formatTryCurrency(restaurant.deliveryFee)}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 ${restaurant.deliveryEnabled ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"}`}>
            {restaurant.deliveryEnabled ? "Teslimat var" : "Teslimat yok"}
          </span>
          <span className={`rounded-full px-2.5 py-1 ${restaurant.pickupEnabled ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
            {restaurant.pickupEnabled ? "Gel-al var" : "Gel-al yok"}
          </span>
        </div>

        {!inDeliveryZone ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            Bolgenize teslimat yok
          </p>
        ) : null}

        <div className="mt-5">
          <Link
            aria-disabled={!canOrder}
            className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              canOrder ? "bg-brand-700 hover:bg-brand-900" : "pointer-events-none bg-slate-400"
            }`}
            to={`/online-order/${restaurant.slug}`}
          >
            {canOrder ? "Restorana Git" : "Su an siparis verilemez"}
          </Link>
        </div>
      </div>
    </article>
  );
}
