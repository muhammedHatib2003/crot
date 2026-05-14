import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMyAddresses, getOnlineRestaurants } from "../api";
import LocationPickerMap from "../components/app/LocationPickerMap";
import RestaurantCard from "../components/online/RestaurantCard";
import { getCurrentBrowserLocation, reverseGeocodeCoordinates, writeOnlineLocationContext } from "../utils/onlineLocation";

function normalizeSearchValue(value) {
  return String(value || "").trim();
}

const SORT_OPTIONS = [
  { value: "nearest", labelKey: "onlineOrder.sort.nearest" },
  { value: "fastest", labelKey: "onlineOrder.sort.fastest" },
  { value: "minimum_order", labelKey: "onlineOrder.sort.minimumOrder" },
  { value: "delivery_fee", labelKey: "onlineOrder.sort.deliveryFee" },
  { value: "rating", labelKey: "onlineOrder.sort.rating" }
];

export default function OnlineOrderPage({ customerSession, onLogout }) {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [sortBy, setSortBy] = useState("nearest");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [mapStatus, setMapStatus] = useState("");

  async function requestLocation() {
    setLocationStatus("requesting");
    try {
      const nextCoords = await getCurrentBrowserLocation();
      setCoords(nextCoords);
      setLocationStatus("granted");
      setSelectedAddressId("");
    } catch (locationError) {
      const nextStatus = locationError.message.includes("desteklemiyor") ? "unsupported" : "denied";
      setCoords(null);
      setLocationStatus(nextStatus);
    }
  }

  async function pickFromMap(nextCoords) {
    setCoords(nextCoords);
    setSelectedAddressId("");
    setLocationStatus("map-picked");
    setMapStatus(t("onlineOrder.map.picked"));
    try {
      const place = await reverseGeocodeCoordinates(nextCoords.lat, nextCoords.lng);
      setCity((previous) => place.city || previous);
      setDistrict((previous) => place.district || previous);
    } catch (error) {
      setMapStatus(t("onlineOrder.map.reverseGeocodeFailed"));
    }
  }

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (!customerSession?.token) {
      setSavedAddresses([]);
      setSelectedAddressId("");
      return;
    }

    let active = true;

    async function loadAddresses() {
      try {
        const payload = await getMyAddresses(customerSession.token);
        if (!active) {
          return;
        }

        const addresses = payload.addresses || [];
        setSavedAddresses(addresses);
      } catch (requestError) {
        if (!active) {
          return;
        }
        setError(requestError.message);
      }
    }

    loadAddresses();

    return () => {
      active = false;
    };
  }, [customerSession?.token]);

  const selectedAddress = useMemo(
    () => savedAddresses.find((address) => address.id === selectedAddressId) || null,
    [savedAddresses, selectedAddressId]
  );

  useEffect(() => {
    if (!selectedAddress) {
      return;
    }

    if (selectedAddress.latitude != null && selectedAddress.longitude != null) {
      setCoords({ lat: selectedAddress.latitude, lng: selectedAddress.longitude });
    }

    setCity((previous) => previous || selectedAddress.city || "");
    setDistrict((previous) => previous || selectedAddress.district || "");
    setLocationStatus("saved-address");
  }, [selectedAddress?.id]);

  const queryParams = useMemo(() => {
    const params = { sortBy };

    if (coords?.lat != null && coords?.lng != null) {
      params.lat = coords.lat;
      params.lng = coords.lng;
    }

    const normalizedCity = normalizeSearchValue(city);
    const normalizedDistrict = normalizeSearchValue(district);
    if (normalizedCity) {
      params.city = normalizedCity;
    }
    if (normalizedDistrict) {
      params.district = normalizedDistrict;
    }

    const normalizedSearch = normalizeSearchValue(search);
    if (normalizedSearch) {
      params.search = normalizedSearch;
    }

    if (onlyOpen) {
      params.onlyOpen = true;
    }
    if (delivery) {
      params.delivery = true;
    }
    if (pickup) {
      params.pickup = true;
    }

    return params;
  }, [city, coords?.lat, coords?.lng, delivery, district, onlyOpen, pickup, search, sortBy]);

  useEffect(() => {
    let active = true;

    async function loadRestaurants() {
      setLoading(true);
      setError("");

      try {
        const result = await getOnlineRestaurants(queryParams);
        if (!active) {
          return;
        }

        setRestaurants(result.restaurants || []);
      } catch (requestError) {
        if (!active) {
          return;
        }
        setError(requestError.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRestaurants();
    return () => {
      active = false;
    };
  }, [queryParams]);

  useEffect(() => {
    writeOnlineLocationContext({
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      city,
      district
    });
  }, [city, coords?.lat, coords?.lng, district]);

  const shouldShowAddressFallback =
    locationStatus === "denied" || locationStatus === "unsupported" || locationStatus === "saved-address" || locationStatus === "map-picked";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{t("onlineOrder.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("onlineOrder.description")}</p>
            {customerSession?.customer?.email ? (
              <p className="mt-1 text-xs text-slate-600">
                {customerSession.customer.fullName || customerSession.customer.email}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {locationStatus === "granted" ? t("onlineOrder.status.granted") : null}
              {locationStatus === "map-picked" ? t("onlineOrder.status.mapPicked") : null}
              {locationStatus === "saved-address" ? t("onlineOrder.status.savedAddress") : null}
              {locationStatus === "denied" ? t("onlineOrder.status.denied") : null}
              {locationStatus === "unsupported" ? t("onlineOrder.status.unsupported") : null}
              {locationStatus === "requesting" ? t("onlineOrder.status.requesting") : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {customerSession?.token && onLogout ? (
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onLogout}
                type="button"
              >
                {t("common.actions.logout")}
              </button>
            ) : (
              <Link
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                to="/online-order/login"
              >
                {t("onlineOrder.nav.signIn")}
              </Link>
            )}
            <Link
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              to="/online-order/my-orders"
            >
              {t("onlineOrder.nav.myOrders")}
            </Link>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={requestLocation}
              type="button"
            >
              {t("onlineOrder.useMyLocation")}
            </button>
          </div>
        </div>

        {shouldShowAddressFallback ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-800">{t("onlineOrder.fallback.title")}</p>
            {customerSession?.token ? (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSelectedAddressId(event.target.value)}
                value={selectedAddressId}
              >
                <option value="">{t("onlineOrder.fallback.selectSavedAddress")}</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.title} - {[address.neighborhood, address.addressText].filter(Boolean).join(" / ")}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-600">{t("onlineOrder.fallback.loginForSavedAddress")}</p>
            )}
            <div className="space-y-2">
              <p className="text-xs text-slate-600">{t("onlineOrder.fallback.mapHint")}</p>
              <LocationPickerMap
                heightClass="h-64"
                latitude={coords?.lat}
                longitude={coords?.lng}
                onPick={pickFromMap}
                radiusKm={0}
              />
              {mapStatus ? <p className="text-xs text-slate-600">{mapStatus}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("onlineOrder.filters.search")}</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("onlineOrder.filters.searchPlaceholder")}
              value={search}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("onlineOrder.filters.city")}</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("onlineOrder.filters.cityPlaceholder")}
              value={city}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("onlineOrder.filters.district")}</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setDistrict(event.target.value)}
              placeholder={t("onlineOrder.filters.districtPlaceholder")}
              value={district}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t("onlineOrder.filters.sort")}</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSortBy(event.target.value)}
              value={sortBy}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} type="checkbox" />
              {t("onlineOrder.filters.onlyOpen")}
            </label>
            <label className="mt-1 flex items-center gap-1.5">
              <input checked={delivery} onChange={(event) => setDelivery(event.target.checked)} type="checkbox" />
              {t("onlineOrder.filters.delivery")}
            </label>
            <label className="mt-1 flex items-center gap-1.5">
              <input checked={pickup} onChange={(event) => setPickup(event.target.checked)} type="checkbox" />
              {t("onlineOrder.filters.pickup")}
            </label>
          </div>
        </div>
      </header>

      {loading ? <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">{t("onlineOrder.loading")}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && restaurants.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">{t("onlineOrder.empty")}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </div>
    </div>
  );
}
