import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createMyAddress, createOnlineOrder, getMyAddresses, getOnlineRestaurantBySlug } from "../api";
import LocationPickerMap from "../components/app/LocationPickerMap";
import CartSummary from "../components/online/CartSummary";
import { formatTryCurrency } from "../utils/currency";
import {
  clearOnlineCart,
  getOnlineCartTotals,
  readOnlineCart,
  updateOnlineCartItemQuantity,
  writeOnlineCart
} from "../utils/onlineCart";
import {
  getCurrentBrowserLocation,
  hasValidCoordinates,
  normalizeLatitude,
  normalizeLongitude,
  readOnlineLocationContext
} from "../utils/onlineLocation";

function getLoginRedirectPath(pathname) {
  return `/online-order/login?redirect=${encodeURIComponent(pathname)}`;
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function resolveDeliveryAddressText(form, mapPinLabel) {
  const trimmed = String(form.addressText || "").trim();
  if (trimmed) {
    return trimmed;
  }
  const fromParts = [form.neighborhood, form.district, form.city].filter(Boolean).join(", ").trim();
  if (fromParts) {
    return fromParts;
  }
  if (hasValidCoordinates(form.latitude, form.longitude)) {
    return mapPinLabel;
  }
  return "";
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2].map((value) => toNumber(value));
  if (values.some((value) => value === null)) {
    return null;
  }

  const [startLat, startLng, endLat, endLng] = values;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(endLat - startLat);
  const deltaLng = toRadians(endLng - startLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(startLat)) * Math.cos(toRadians(endLat)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

const ADDRESS_TITLE_OPTIONS = ["Ev", "Yurt", "Okul", "İş"];

const emptyAddressForm = {
  title: "Ev",
  receiverName: "",
  phone: "",
  city: "",
  district: "",
  neighborhood: "",
  addressText: "",
  buildingNo: "",
  floor: "",
  apartmentNo: "",
  doorNo: "",
  note: "",
  latitude: "",
  longitude: "",
  isDefault: false
};

export default function OnlineCartPage({ customerSession, onCustomerLogout }) {
  const { t } = useTranslation();
  const { restaurantSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [restaurant, setRestaurant] = useState(null);
  const [cart, setCart] = useState(() => readOnlineCart());
  const [orderType, setOrderType] = useState("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [customerName, setCustomerName] = useState(customerSession?.customer?.fullName || "");
  const [customerPhone, setCustomerPhone] = useState(customerSession?.customer?.phone || "");
  const [note, setNote] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showAdvancedAddress, setShowAdvancedAddress] = useState(false);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mapStatus, setMapStatus] = useState("");
  const [locationContext, setLocationContext] = useState(() => readOnlineLocationContext());

  useEffect(() => {
    const syncCart = () => {
      setCart(readOnlineCart());
    };

    window.addEventListener("online-order-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);

    return () => {
      window.removeEventListener("online-order-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    const syncLocationContext = () => {
      setLocationContext(readOnlineLocationContext());
    };

    window.addEventListener("online-order-location-updated", syncLocationContext);
    window.addEventListener("storage", syncLocationContext);

    return () => {
      window.removeEventListener("online-order-location-updated", syncLocationContext);
      window.removeEventListener("storage", syncLocationContext);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRestaurant() {
      setLoadingRestaurant(true);
      setError("");

      try {
        const payload = await getOnlineRestaurantBySlug(restaurantSlug, {
          lat: locationContext.lat,
          lng: locationContext.lng
        });
        if (!active) {
          return;
        }

        setRestaurant(payload.restaurant || null);
      } catch (requestError) {
        if (!active) {
          return;
        }
        setError(requestError.message);
      } finally {
        if (active) {
          setLoadingRestaurant(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      active = false;
    };
  }, [locationContext.lat, locationContext.lng, restaurantSlug]);

  useEffect(() => {
    if (!customerSession?.token) {
      setAddresses([]);
      setSelectedAddressId("");
      return;
    }

    let active = true;

    async function loadAddresses() {
      setLoadingAddresses(true);

      try {
        const payload = await getMyAddresses(customerSession.token);
        if (!active) {
          return;
        }

        const nextAddresses = payload.addresses || [];
        setAddresses(nextAddresses);
        const defaultAddress = nextAddresses.find((address) => address.isDefault) || nextAddresses[0] || null;
        setSelectedAddressId(defaultAddress?.id || "");
      } catch (requestError) {
        if (!active) {
          return;
        }
        setError(requestError.message);
      } finally {
        if (active) {
          setLoadingAddresses(false);
        }
      }
    }

    loadAddresses();

    return () => {
      active = false;
    };
  }, [customerSession?.token]);

  useEffect(() => {
    if (!customerSession) {
      return;
    }

    setCustomerName((previous) => previous || customerSession.customer?.fullName || "");
    setCustomerPhone((previous) => previous || customerSession.customer?.phone || "");
    setAddressForm((previous) => ({
      ...previous,
      receiverName: previous.receiverName || customerSession.customer?.fullName || "",
      phone: previous.phone || customerSession.customer?.phone || ""
    }));
  }, [customerSession]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) || null,
    [addresses, selectedAddressId]
  );
  const selectedAddressHasCoordinates = useMemo(() => {
    if (!selectedAddress) {
      return false;
    }
    return hasValidCoordinates(selectedAddress.latitude, selectedAddress.longitude);
  }, [selectedAddress]);

  useEffect(() => {
    if (selectedAddress) {
      return;
    }

    setAddressForm((previous) => {
      const nextLatitude =
        locationContext.lat != null && previous.latitude === "" ? String(locationContext.lat) : previous.latitude;
      const nextLongitude =
        locationContext.lng != null && previous.longitude === "" ? String(locationContext.lng) : previous.longitude;
      const nextCity = locationContext.city && !previous.city ? locationContext.city : previous.city;
      const nextDistrict = locationContext.district && !previous.district ? locationContext.district : previous.district;

      if (
        nextLatitude === previous.latitude &&
        nextLongitude === previous.longitude &&
        nextCity === previous.city &&
        nextDistrict === previous.district
      ) {
        return previous;
      }

      return {
        ...previous,
        latitude: nextLatitude,
        longitude: nextLongitude,
        city: nextCity,
        district: nextDistrict
      };
    });
  }, [locationContext.city, locationContext.district, locationContext.lat, locationContext.lng, selectedAddress]);

  const baseTotals = useMemo(() => getOnlineCartTotals(cart), [cart]);

  const deliveryDistanceKm = useMemo(() => {
    if (orderType !== "DELIVERY") {
      return null;
    }

    const customerLat = selectedAddressHasCoordinates ? selectedAddress.latitude : addressForm.latitude;
    const customerLng = selectedAddressHasCoordinates ? selectedAddress.longitude : addressForm.longitude;
    return haversineDistanceKm(restaurant?.latitude, restaurant?.longitude, customerLat, customerLng);
  }, [
    addressForm.latitude,
    addressForm.longitude,
    orderType,
    restaurant?.latitude,
    restaurant?.longitude,
    selectedAddress,
    selectedAddressHasCoordinates
  ]);

  const totals = useMemo(() => {
    if (orderType === "PICKUP") {
      return {
        subtotal: baseTotals.subtotal,
        deliveryFee: 0,
        total: baseTotals.subtotal
      };
    }

    const baseDeliveryFee = Number(restaurant?.baseDeliveryFee ?? restaurant?.deliveryFee ?? 0);
    const feePerKm = Number(restaurant?.feePerKm || 0);
    const calculatedDistance = Number(deliveryDistanceKm || 0);
    const dynamicDeliveryFee = baseDeliveryFee + calculatedDistance * feePerKm;
    const threshold = Number(restaurant?.freeDeliveryThreshold || 0);
    const isFreeDelivery = threshold > 0 && baseTotals.subtotal >= threshold;
    const deliveryFee = isFreeDelivery ? 0 : dynamicDeliveryFee;

    return {
      subtotal: baseTotals.subtotal,
      deliveryFee,
      total: baseTotals.subtotal + deliveryFee
    };
  }, [
    baseTotals.subtotal,
    deliveryDistanceKm,
    orderType,
    restaurant?.baseDeliveryFee,
    restaurant?.deliveryFee,
    restaurant?.feePerKm,
    restaurant?.freeDeliveryThreshold
  ]);

  function saveCart(nextCart) {
    const savedCart = writeOnlineCart(nextCart);
    setCart(savedCart);
  }

  function handleIncrease(productId) {
    const item = cart.items.find((entry) => entry.productId === productId);
    if (!item) {
      return;
    }

    saveCart(updateOnlineCartItemQuantity(cart, productId, item.quantity + 1));
  }

  function handleDecrease(productId) {
    const item = cart.items.find((entry) => entry.productId === productId);
    if (!item) {
      return;
    }

    saveCart(updateOnlineCartItemQuantity(cart, productId, item.quantity - 1));
  }

  function handleRemove(productId) {
    saveCart(updateOnlineCartItemQuantity(cart, productId, 0));
  }

  function useCurrentAddressLocation() {
    getCurrentBrowserLocation()
      .then((coords) => {
        setAddressForm((previous) => ({
          ...previous,
          latitude: String(coords.lat),
          longitude: String(coords.lng)
        }));
      })
      .catch((locationError) => setError(locationError.message));
  }

  function pickAddressFromMap(nextCoords) {
    setAddressForm((previous) => ({
      ...previous,
      latitude: String(nextCoords.lat),
      longitude: String(nextCoords.lng)
    }));
    setMapStatus(t("onlineOrder.map.picked"));
  }

  async function handleSaveAddress() {
    setError("");

    if (!customerSession?.token) {
      navigate(getLoginRedirectPath(location.pathname), { replace: true });
      return;
    }

    setSavingAddress(true);

    try {
      const normalizedLat = normalizeLatitude(addressForm.latitude);
      const normalizedLng = normalizeLongitude(addressForm.longitude);
      if (normalizedLat === null || normalizedLng === null) {
        setError("Adres konumu gecersiz. Lutfen konum secin veya latitude/longitude duzeltin.");
        return;
      }

      const resolvedAddressText = resolveDeliveryAddressText(addressForm, t("onlineCart.mapPinAddress"));
      if (!resolvedAddressText.trim()) {
        setError(t("onlineCart.saveAddressIncomplete"));
        return;
      }

      const payload = await createMyAddress(
        {
          ...addressForm,
          addressText: resolvedAddressText,
          latitude: normalizedLat,
          longitude: normalizedLng
        },
        customerSession.token
      );
      const savedAddress = payload.address;
      setAddresses((previous) => [savedAddress, ...previous]);
      setSelectedAddressId(savedAddress.id);
      setShowAddressForm(false);
      setAddressForm(emptyAddressForm);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function handlePlaceOrder() {
    setError("");

    if (!customerSession?.token) {
      navigate(getLoginRedirectPath(location.pathname), { replace: true });
      return;
    }

    if (!cart.restaurant?.id || cart.items.length === 0) {
      setError("Sepet boş. Sipariş oluşturmak için ürün ekleyin.");
      return;
    }

    if (cart.restaurant.slug !== restaurantSlug) {
      setError("Sepetiniz başka bir restorana ait. Lütfen sepeti temizleyin.");
      return;
    }

    if (!restaurant?.isCurrentlyOpen) {
      setError("Restoran şu an kapalı.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Müşteri adı ve telefon zorunludur.");
      return;
    }

    const resolvedManualText = resolveDeliveryAddressText(addressForm, t("onlineCart.mapPinAddress"));
    const hasManualAddress =
      hasValidCoordinates(addressForm.latitude, addressForm.longitude) && Boolean(resolvedManualText.trim());
    const canUseSelectedAddress = Boolean(selectedAddress && selectedAddressHasCoordinates);

    if (orderType === "DELIVERY" && !canUseSelectedAddress && !hasManualAddress) {
      setError(t("onlineCart.checkoutAddressIncomplete"));
      return;
    }

    if (orderType === "DELIVERY" && selectedAddress && !selectedAddressHasCoordinates && !hasManualAddress) {
      setError("Secili kayitli adreste konum bilgisi yok. Lutfen yeni adres ekleyip haritadan konum secin.");
      return;
    }

    if (orderType === "DELIVERY" && deliveryDistanceKm != null && deliveryDistanceKm > Number(restaurant?.deliveryRadiusKm || 0)) {
      setError("Seçili adres restoranın teslimat alanının dışında.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = await createOnlineOrder(
        {
          restaurantId: cart.restaurant.id,
          orderType,
          paymentMethod,
          customerName,
          customerPhone,
          note,
          addressId: orderType === "DELIVERY" && canUseSelectedAddress ? selectedAddressId || undefined : undefined,
          manualAddress:
            orderType === "DELIVERY" && !canUseSelectedAddress
              ? {
                  receiverName: addressForm.receiverName,
                  phone: addressForm.phone,
                  city: addressForm.city,
                  district: addressForm.district,
                  neighborhood: addressForm.neighborhood,
                  addressText: resolvedManualText,
                  buildingNo: addressForm.buildingNo,
                  floor: addressForm.floor,
                  apartmentNo: addressForm.apartmentNo,
                  doorNo: addressForm.doorNo,
                  note: addressForm.note,
                  latitude: normalizeLatitude(addressForm.latitude),
                  longitude: normalizeLongitude(addressForm.longitude)
                }
              : undefined,
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        },
        customerSession.token
      );

      clearOnlineCart();

      if (paymentMethod === "ONLINE") {
        navigate(`/payment/start?orderId=${encodeURIComponent(payload.order.id)}`, { replace: true });
      } else {
        navigate(`/online-order/my-orders?orderId=${encodeURIComponent(payload.order.id)}`, { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRestaurant) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-600">Sepet sayfası yükleniyor...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Sepet ve Ödeme</h1>
            <p className="mt-1 text-sm text-slate-600">{restaurant?.name || "Restoran"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              to="/online-order"
            >
              {t("onlineCart.backToRestaurants")}
            </Link>
            <Link
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              to={`/online-order/${restaurantSlug}`}
            >
              {t("onlineCart.backToMenu")}
            </Link>
            {customerSession?.token && onCustomerLogout ? (
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={onCustomerLogout}
                type="button"
              >
                {t("common.actions.logout")}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {cart.items.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-slate-600">Sepet boş. Önce ürün ekleyin.</p>
          <Link className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-900" to={`/online-order/${restaurantSlug}`}>
            Menüye dön
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Teslimat Bilgileri</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Sipariş tipi
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  onChange={(event) => setOrderType(event.target.value)}
                  value={orderType}
                >
                  <option disabled={!restaurant?.deliveryEnabled} value="DELIVERY">
                    Teslimat
                  </option>
                  <option disabled={!restaurant?.pickupEnabled} value="PICKUP">
                    Gel-al
                  </option>
                </select>
              </label>

              <label className="text-sm text-slate-700">
                Ödeme yöntemi
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  value={paymentMethod}
                >
                  <option value="CASH">Nakit</option>
                  <option value="CARD_ON_DELIVERY">Kapıda Kart</option>
                  <option value="ONLINE">Online</option>
                </select>
              </label>

              <label className="text-sm text-slate-700">
                Müşteri adı
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setCustomerName(event.target.value)} value={customerName} />
              </label>

              <label className="text-sm text-slate-700">
                Telefon
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setCustomerPhone(event.target.value)} value={customerPhone} />
              </label>

              {orderType === "DELIVERY" ? (
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">Teslimat adresi</p>
                    <button
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowAddressForm((previous) => !previous)}
                      type="button"
                    >
                      {showAddressForm ? "Formu gizle" : "Yeni adres ekle"}
                    </button>
                  </div>

                  {loadingAddresses ? <p className="text-xs text-slate-500">Adresler yükleniyor...</p> : null}

                  {addresses.length > 0 ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {addresses.map((address) => (
                        <label key={address.id} className="flex cursor-pointer gap-2 text-sm text-slate-700">
                          <input checked={selectedAddressId === address.id} name="deliveryAddress" onChange={() => setSelectedAddressId(address.id)} type="radio" />
                          <span>
                            <strong>{address.title}</strong> - {[address.neighborhood, address.addressText].filter(Boolean).join(" / ")}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Kayıtlı adres bulunmuyor.</p>
                  )}

                  {showAddressForm ? (
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
                      <label className="text-xs text-slate-600">
                        Adres türü
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => setAddressForm((previous) => ({ ...previous, title: event.target.value }))}
                          value={addressForm.title}
                        >
                          {ADDRESS_TITLE_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">Alıcı adı<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, receiverName: event.target.value }))} value={addressForm.receiverName} /></label>
                      <label className="text-xs text-slate-600">Telefon<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, phone: event.target.value }))} value={addressForm.phone} /></label>
                      <label className="text-xs text-slate-600">Şehir<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, city: event.target.value }))} value={addressForm.city} /></label>
                      <label className="text-xs text-slate-600">İlçe<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, district: event.target.value }))} value={addressForm.district} /></label>
                      <label className="text-xs text-slate-600">Mahalle<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, neighborhood: event.target.value }))} value={addressForm.neighborhood} /></label>
                      <label className="text-xs text-slate-600">Bina no<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, buildingNo: event.target.value }))} value={addressForm.buildingNo} /></label>
                      <label className="text-xs text-slate-600">Kat<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, floor: event.target.value }))} value={addressForm.floor} /></label>
                      <label className="text-xs text-slate-600">Daire no<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, apartmentNo: event.target.value }))} value={addressForm.apartmentNo} /></label>
                      <label className="text-xs text-slate-600">Kapı no<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, doorNo: event.target.value }))} value={addressForm.doorNo} /></label>
                      <label className="text-xs text-slate-600 md:col-span-2">Açık adres<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, addressText: event.target.value }))} value={addressForm.addressText} /></label>
                      <label className="text-xs text-slate-600 md:col-span-2">Adres tarifi/not<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, note: event.target.value }))} value={addressForm.note} /></label>

                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={useCurrentAddressLocation} type="button">
                          Konumumu kullan
                        </button>
                        <button className="text-xs font-medium text-brand-700" onClick={() => setShowAdvancedAddress((previous) => !previous)} type="button">
                          {showAdvancedAddress ? "Gelişmiş alanları gizle" : "Gelişmiş alanları göster"}
                        </button>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <p className="text-xs text-slate-600">GPS calismiyorsa haritadan teslimat noktasini secin.</p>
                        <LocationPickerMap
                          heightClass="h-64"
                          latitude={addressForm.latitude}
                          longitude={addressForm.longitude}
                          onPick={pickAddressFromMap}
                        />
                        {mapStatus ? <p className="text-xs text-slate-600">{mapStatus}</p> : null}
                      </div>

                      {showAdvancedAddress ? (
                        <>
                          <label className="text-xs text-slate-600">Latitude<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, latitude: event.target.value }))} value={addressForm.latitude} /></label>
                          <label className="text-xs text-slate-600">Longitude<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setAddressForm((previous) => ({ ...previous, longitude: event.target.value }))} value={addressForm.longitude} /></label>
                        </>
                      ) : null}

                      <label className="flex items-center gap-2 text-xs text-slate-700 md:col-span-2"><input checked={addressForm.isDefault} onChange={(event) => setAddressForm((previous) => ({ ...previous, isDefault: event.target.checked }))} type="checkbox" />Varsayılan adres olarak kaydet</label>

                      <div className="md:col-span-2">
                        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={savingAddress} onClick={handleSaveAddress} type="button">
                          {savingAddress ? "Kaydediliyor..." : "Adresi kaydet"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {deliveryDistanceKm != null ? <p className="text-xs text-slate-600">Restoran mesafesi: {deliveryDistanceKm.toFixed(2)} km</p> : null}
                </div>
              ) : null}

              <label className="text-sm text-slate-700 md:col-span-2">
                Sipariş notu
                <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setNote(event.target.value)} value={note} />
              </label>
            </div>
          </section>

          <aside>
            <div className="xl:sticky xl:top-6">
              <CartSummary
                cart={cart}
                onDecrease={handleDecrease}
                onIncrease={handleIncrease}
                onRemove={handleRemove}
                totals={totals}
                checkoutButton={
                  <button className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting || cart.items.length === 0} onClick={handlePlaceOrder} type="button">
                    {submitting ? "Sipariş gönderiliyor..." : "Siparişi Tamamla"}
                  </button>
                }
              />

              {orderType === "DELIVERY" && Number(restaurant?.freeDeliveryThreshold || 0) > 0 ? (
                <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                  {formatTryCurrency(restaurant?.freeDeliveryThreshold)} üzeri siparişlerde teslimat ücretsizdir.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
