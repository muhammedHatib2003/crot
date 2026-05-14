import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  createOwnerMenuCategory,
  createOwnerMenuProduct,
  deleteOwnerMenuCategory,
  deleteOwnerMenuProduct,
  getOwnerMenuCategories,
  getOwnerMenuProducts,
  getOwnerOnlineOrders,
  getOwnerOnlineRestaurantSettings,
  updateOwnerMenuCategory,
  updateOwnerMenuProduct,
  updateOwnerOnlineOrderStatus,
  updateOwnerOnlineRestaurantSettings
} from "../api";
import LocationPickerMap from "../components/app/LocationPickerMap";
import { formatTryCurrency } from "../utils/currency";
import {
  getCurrentBrowserLocation,
  normalizeLatitude,
  normalizeLongitude,
  reverseGeocodeCoordinates
} from "../utils/onlineLocation";

const TABS = [{ id: "general" }, { id: "location" }, { id: "hours" }, { id: "menu" }, { id: "orders" }, { id: "photos" }];
const DAYS = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];
const ORDER_NEXT = {
  PENDING: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["ON_THE_WAY", "COMPLETED"],
  ON_THE_WAY: ["COMPLETED"]
};

function buildHours(openingHours) {
  return DAYS.map((label, dayOfWeek) => {
    const row = (openingHours || []).find((slot) => Number(slot.dayOfWeek) === dayOfWeek);
    return {
      dayOfWeek,
      label,
      openTime: row?.openTime || "09:00",
      closeTime: row?.closeTime || "22:00",
      isClosed: Boolean(row?.isClosed)
    };
  });
}

function tone(status) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  if (status === "ON_THE_WAY" || status === "READY") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export default function OwnerOnlineOrdersPage({ session, onLogout }) {
  const { t } = useTranslation();
  const token = session?.token;
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [loading, setLoading] = useState(true);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mapStatus, setMapStatus] = useState("");
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);

  const [restaurant, setRestaurant] = useState(null);
  const [settings, setSettings] = useState({
    name: "",
    description: "",
    cuisineType: "",
    phone: "",
    isOnlineOrderingEnabled: true,
    isOpen: true,
    addressText: "",
    city: "",
    district: "",
    latitude: "",
    longitude: "",
    deliveryRadiusKm: 0,
    minimumOrderAmount: 0,
    baseDeliveryFee: 0,
    feePerKm: 0,
    freeDeliveryThreshold: "",
    estimatedDeliveryMinutes: 0,
    deliveryEnabled: true,
    pickupEnabled: true,
    logoUrl: "",
    coverImageUrl: "",
    openingHours: buildHours([])
  });

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: "", sortOrder: 0, isActive: true });
  const [productForm, setProductForm] = useState({
    id: "",
    name: "",
    categoryId: "",
    description: "",
    price: "",
    imageUrl: "",
    isAvailable: true,
    preparationMinutes: 20,
    sortOrder: 0
  });

  const missing = useMemo(() => {
    if (!restaurant) return [];
    const values = [];
    if (!restaurant.phone) values.push("telefon");
    if (!restaurant.cuisineType) values.push("mutfak tipi");
    if (!restaurant.addressText) values.push("adres");
    if (!restaurant.city) values.push("sehir");
    if (!restaurant.district) values.push("ilce");
    if (restaurant.latitude == null || restaurant.longitude == null) values.push("konum");
    return values;
  }, [restaurant]);

  const categoryOptions = useMemo(() => categories.map((x) => ({ id: x.id, name: x.name })), [categories]);

  function syncRestaurant(next) {
    setRestaurant(next);
    setSettings({
      name: next?.name || "",
      description: next?.description || "",
      cuisineType: next?.cuisineType || "",
      phone: next?.phone || "",
      isOnlineOrderingEnabled: Boolean(next?.isOnlineOrderingEnabled),
      isOpen: Boolean(next?.isOpen),
      addressText: next?.addressText || "",
      city: next?.city || "",
      district: next?.district || "",
      latitude: next?.latitude ?? "",
      longitude: next?.longitude ?? "",
      deliveryRadiusKm: next?.deliveryRadiusKm ?? 0,
      minimumOrderAmount: next?.minimumOrderAmount ?? 0,
      baseDeliveryFee: next?.baseDeliveryFee ?? next?.deliveryFee ?? 0,
      feePerKm: next?.feePerKm ?? 0,
      freeDeliveryThreshold: next?.freeDeliveryThreshold ?? "",
      estimatedDeliveryMinutes: next?.estimatedDeliveryMinutes ?? 0,
      deliveryEnabled: Boolean(next?.deliveryEnabled),
      pickupEnabled: Boolean(next?.pickupEnabled),
      logoUrl: next?.logoUrl || "",
      coverImageUrl: next?.coverImageUrl || "",
      openingHours: buildHours(next?.openingHours || [])
    });
  }

  async function loadOrders() {
    const payload = await getOwnerOnlineOrders(token);
    setOrders(payload.orders || []);
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [r, c, p, o] = await Promise.all([
        getOwnerOnlineRestaurantSettings(token),
        getOwnerMenuCategories(token),
        getOwnerMenuProducts(token),
        getOwnerOnlineOrders(token)
      ]);
      syncRestaurant(r.restaurant || null);
      setCategories(c.categories || []);
      setProducts(p.products || []);
      setOrders(o.orders || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      if (activeTab !== "orders") return;
      setRefreshingOrders(true);
      try {
        await loadOrders();
      } catch (e) {
        setError(e.message);
      } finally {
        setRefreshingOrders(false);
      }
    }, 15000);
    return () => clearInterval(id);
  }, [activeTab, token]);

  function setField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(payload) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const nextPayload = { ...payload };
      if (Object.prototype.hasOwnProperty.call(nextPayload, "latitude") || Object.prototype.hasOwnProperty.call(nextPayload, "longitude")) {
        const normalizedLat = normalizeLatitude(nextPayload.latitude);
        const normalizedLng = normalizeLongitude(nextPayload.longitude);
        const hasAnyCoordinate = String(nextPayload.latitude ?? "").trim() !== "" || String(nextPayload.longitude ?? "").trim() !== "";
        if (hasAnyCoordinate && (normalizedLat === null || normalizedLng === null)) {
          throw new Error("Konum gecersiz. Latitude -90..90 ve longitude -180..180 olmali.");
        }
        nextPayload.latitude = normalizedLat;
        nextPayload.longitude = normalizedLng;
      }

      const result = await updateOwnerOnlineRestaurantSettings(nextPayload, token);
      syncRestaurant(result.restaurant || null);
      setMessage("Ayarlar kaydedildi.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function useCurrentLocation() {
    try {
      const coords = await getCurrentBrowserLocation();
      setField("latitude", String(coords.lat));
      setField("longitude", String(coords.lng));
      setError("");
    } catch (locationError) {
      setError(locationError.message);
    }
  }

  async function pickLocationFromMap(nextCoords) {
    const latitude = normalizeLatitude(nextCoords?.lat);
    const longitude = normalizeLongitude(nextCoords?.lng);
    if (latitude === null || longitude === null) {
      setError("Haritadan secilen konum gecersiz.");
      return;
    }

    setField("latitude", String(latitude));
    setField("longitude", String(longitude));
    setMapStatus("Haritadan konum secildi.");
    setError("");

    try {
      const place = await reverseGeocodeCoordinates(latitude, longitude);
      if (place.city) {
        setField("city", place.city);
      }
      if (place.district) {
        setField("district", place.district);
      }
    } catch (lookupError) {
      setMapStatus("Konum secildi. Sehir/ilce otomatik doldurulamadi.");
    }
  }

  async function createCategory(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await createOwnerMenuCategory(categoryForm, token);
      const c = await getOwnerMenuCategories(token);
      setCategories(c.categories || []);
      setCategoryForm({ name: "", sortOrder: 0, isActive: true });
      setMessage("Kategori eklendi.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: productForm.name,
        categoryId: productForm.categoryId || null,
        description: productForm.description,
        price: Number(productForm.price),
        imageUrl: productForm.imageUrl,
        isAvailable: Boolean(productForm.isAvailable),
        preparationMinutes: Number(productForm.preparationMinutes),
        sortOrder: Number(productForm.sortOrder)
      };
      if (productForm.id) await updateOwnerMenuProduct(productForm.id, payload, token);
      else await createOwnerMenuProduct(payload, token);
      const p = await getOwnerMenuProducts(token);
      setProducts(p.products || []);
      setProductForm({ id: "", name: "", categoryId: "", description: "", price: "", imageUrl: "", isAvailable: true, preparationMinutes: 20, sortOrder: 0 });
      setMessage("Urun kaydedildi.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-8 text-slate-600">Online owner panel yukleniyor...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">{t("ownerOnline.panel", "Owner Panel")}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{t("ownerOnline.title", "Online Order Management")}</h1>
            <p className="text-sm text-slate-600">{restaurant?.name || "Restoran"}</p>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" to="/owner">{t("ownerOnline.mainPanel", "Main Owner Panel")}</Link>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onLogout} type="button">{t("common.actions.logout")}</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab.id} className={`rounded-lg px-3 py-2 text-sm font-medium ${activeTab === tab.id ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setActiveTab(tab.id)} type="button">{t(`ownerOnline.tabs.${tab.id}`, tab.id)}</button>
          ))}
        </div>
      </header>

      {missing.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Restoran profilinizde eksik alanlar var: {missing.join(", ")}.</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      {activeTab === "general" ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Genel Bilgiler</h2><form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveSettings({ name: settings.name, description: settings.description, cuisineType: settings.cuisineType, phone: settings.phone, isOpen: settings.isOpen, isOnlineOrderingEnabled: settings.isOnlineOrderingEnabled }); }}><label className="text-sm text-slate-700">Restoran adi<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.name} onChange={(e) => setField("name", e.target.value)} /></label><label className="text-sm text-slate-700">Mutfak tipi<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.cuisineType} onChange={(e) => setField("cuisineType", e.target.value)} /></label><label className="text-sm text-slate-700">Telefon<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.phone} onChange={(e) => setField("phone", e.target.value)} /></label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={settings.isOnlineOrderingEnabled} onChange={(e) => setField("isOnlineOrderingEnabled", e.target.checked)} />Online siparis aktif</label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={settings.isOpen} onChange={(e) => setField("isOpen", e.target.checked)} />Restoran acik</label><label className="text-sm text-slate-700 md:col-span-2">Aciklama<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.description} onChange={(e) => setField("description", e.target.value)} /></label><div className="md:col-span-2"><button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50" disabled={saving} type="submit">{saving ? "Kaydediliyor..." : "Kaydet"}</button></div></form></section> : null}

      {activeTab === "location" ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Konum ve Teslimat</h2><form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveSettings({ addressText: settings.addressText, city: settings.city, district: settings.district, latitude: settings.latitude, longitude: settings.longitude, deliveryRadiusKm: settings.deliveryRadiusKm, minimumOrderAmount: settings.minimumOrderAmount, baseDeliveryFee: settings.baseDeliveryFee, feePerKm: settings.feePerKm, freeDeliveryThreshold: settings.freeDeliveryThreshold, estimatedDeliveryMinutes: settings.estimatedDeliveryMinutes, deliveryEnabled: settings.deliveryEnabled, pickupEnabled: settings.pickupEnabled }); }}><label className="text-sm text-slate-700 md:col-span-2">Adres<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.addressText} onChange={(e) => setField("addressText", e.target.value)} /></label><label className="text-sm text-slate-700">Sehir<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.city} onChange={(e) => setField("city", e.target.value)} /></label><label className="text-sm text-slate-700">Ilce<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.district} onChange={(e) => setField("district", e.target.value)} /></label><div className="md:col-span-2 space-y-2"><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={useCurrentLocation} type="button">Konumumu kullan</button></div><p className="text-xs text-slate-500">GPS calismiyorsa haritadan secin.</p><LocationPickerMap heightClass="h-64" latitude={settings.latitude} longitude={settings.longitude} onPick={pickLocationFromMap} radiusKm={settings.deliveryRadiusKm} />{mapStatus ? <p className="text-xs text-slate-600">{mapStatus}</p> : null}</div><div className="md:col-span-2"><button className="text-xs font-medium text-brand-700" onClick={() => setShowAdvancedLocation((prev) => !prev)} type="button">{showAdvancedLocation ? "Gelis mis ayarlari gizle" : "Gelis mis ayarlari goster"}</button></div>{showAdvancedLocation ? <><label className="text-sm text-slate-700">Latitude<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.latitude} onChange={(e) => setField("latitude", e.target.value)} /></label><label className="text-sm text-slate-700">Longitude<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.longitude} onChange={(e) => setField("longitude", e.target.value)} /></label></> : null}<label className="text-sm text-slate-700">Teslimat yaricapi (km)<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.1" value={settings.deliveryRadiusKm} onChange={(e) => setField("deliveryRadiusKm", e.target.value)} /></label><label className="text-sm text-slate-700">Minimum sepet<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" value={settings.minimumOrderAmount} onChange={(e) => setField("minimumOrderAmount", e.target.value)} /></label><label className="text-sm text-slate-700">Temel teslimat ucreti<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" value={settings.baseDeliveryFee} onChange={(e) => setField("baseDeliveryFee", e.target.value)} /></label><label className="text-sm text-slate-700">Km basina ucret<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" value={settings.feePerKm} onChange={(e) => setField("feePerKm", e.target.value)} /></label><label className="text-sm text-slate-700">Ucretsiz teslimat esigi<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" value={settings.freeDeliveryThreshold} onChange={(e) => setField("freeDeliveryThreshold", e.target.value)} /></label><label className="text-sm text-slate-700">Tahmini teslimat (dk)<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" value={settings.estimatedDeliveryMinutes} onChange={(e) => setField("estimatedDeliveryMinutes", e.target.value)} /></label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={settings.deliveryEnabled} onChange={(e) => setField("deliveryEnabled", e.target.checked)} />Teslimat aktif</label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={settings.pickupEnabled} onChange={(e) => setField("pickupEnabled", e.target.checked)} />Gel-al aktif</label><div className="md:col-span-2"><button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50" disabled={saving} type="submit">{saving ? "Kaydediliyor..." : "Kaydet"}</button></div></form></section> : null}

      {activeTab === "hours" ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Calisma Saatleri</h2><form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); saveSettings({ openingHours: settings.openingHours.map((slot) => ({ dayOfWeek: slot.dayOfWeek, openTime: slot.openTime, closeTime: slot.closeTime, isClosed: slot.isClosed })) }); }}>{settings.openingHours.map((slot, index) => <div key={slot.dayOfWeek} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[160px_1fr_1fr_auto]"><p className="text-sm font-medium text-slate-700">{slot.label}</p><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="time" value={slot.openTime} onChange={(e) => setSettings((prev) => { const rows = [...prev.openingHours]; rows[index] = { ...rows[index], openTime: e.target.value }; return { ...prev, openingHours: rows }; })} /><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="time" value={slot.closeTime} onChange={(e) => setSettings((prev) => { const rows = [...prev.openingHours]; rows[index] = { ...rows[index], closeTime: e.target.value }; return { ...prev, openingHours: rows }; })} /><label className="flex items-center gap-1 text-sm text-slate-700"><input type="checkbox" checked={slot.isClosed} onChange={(e) => setSettings((prev) => { const rows = [...prev.openingHours]; rows[index] = { ...rows[index], isClosed: e.target.checked }; return { ...prev, openingHours: rows }; })} />Kapali</label></div>)}<button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50" disabled={saving} type="submit">{saving ? "Kaydediliyor..." : "Calisma saatlerini kaydet"}</button></form></section> : null}

      {activeTab === "menu" ? <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-base font-semibold text-slate-900">Kategori Ekle</h2><form className="mt-3 space-y-3" onSubmit={createCategory}><label className="text-sm text-slate-700">Kategori<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryForm.name} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))} /></label><label className="text-sm text-slate-700">Siralama<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((prev) => ({ ...prev, sortOrder: e.target.value }))} /></label><label className="flex items-center gap-2 text-sm text-slate-700"><input checked={categoryForm.isActive} onChange={(e) => setCategoryForm((prev) => ({ ...prev, isActive: e.target.checked }))} type="checkbox" />Aktif</label><button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50" disabled={saving} type="submit">{saving ? "Kaydediliyor..." : "Kategori ekle"}</button></form><h3 className="mt-6 text-base font-semibold text-slate-900">Urun Ekle / Duzenle</h3><form className="mt-3 space-y-3" onSubmit={saveProduct}><label className="text-sm text-slate-700">Urun adi<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} /></label><label className="text-sm text-slate-700">Kategori<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={productForm.categoryId} onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))}><option value="">Kategori secilmedi</option>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm text-slate-700">Aciklama<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} /></label><label className="text-sm text-slate-700">Fiyat<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))} /></label><label className="text-sm text-slate-700">Gorsel URL<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={productForm.imageUrl} onChange={(e) => setProductForm((prev) => ({ ...prev, imageUrl: e.target.value }))} /></label><label className="text-sm text-slate-700">Hazirlik (dk)<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" value={productForm.preparationMinutes} onChange={(e) => setProductForm((prev) => ({ ...prev, preparationMinutes: e.target.value }))} /></label><label className="text-sm text-slate-700">Siralama<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" value={productForm.sortOrder} onChange={(e) => setProductForm((prev) => ({ ...prev, sortOrder: e.target.value }))} /></label><label className="flex items-center gap-2 text-sm text-slate-700"><input checked={productForm.isAvailable} onChange={(e) => setProductForm((prev) => ({ ...prev, isAvailable: e.target.checked }))} type="checkbox" />Stokta var</label><div className="flex gap-2"><button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50" disabled={saving} type="submit">{saving ? "Kaydediliyor..." : productForm.id ? "Urunu guncelle" : "Urun ekle"}</button>{productForm.id ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setProductForm({ id: "", name: "", categoryId: "", description: "", price: "", imageUrl: "", isAvailable: true, preparationMinutes: 20, sortOrder: 0 })} type="button">Iptal</button> : null}</div></form></section><section className="space-y-4"><article className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-base font-semibold text-slate-900">Kategoriler</h2><div className="mt-3 space-y-2">{categories.map((category) => <div key={category.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_120px_auto_auto]"><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={category.name} onChange={(e) => setCategories((prev) => prev.map((x) => (x.id === category.id ? { ...x, name: e.target.value } : x)))} /><input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" min="0" value={category.sortOrder} onChange={(e) => setCategories((prev) => prev.map((x) => (x.id === category.id ? { ...x, sortOrder: Number(e.target.value || 0) } : x)))} /><label className="flex items-center gap-1 text-sm text-slate-700"><input checked={category.isActive} onChange={(e) => setCategories((prev) => prev.map((x) => (x.id === category.id ? { ...x, isActive: e.target.checked } : x)))} type="checkbox" />Aktif</label><div className="flex gap-2"><button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={async () => { try { await updateOwnerMenuCategory(category.id, { name: category.name, sortOrder: category.sortOrder, isActive: category.isActive }, token); setMessage("Kategori guncellendi."); } catch (e) { setError(e.message); } }} type="button">Kaydet</button><button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50" onClick={async () => { try { await deleteOwnerMenuCategory(category.id, token); setCategories((prev) => prev.filter((x) => x.id !== category.id)); } catch (e) { setError(e.message); } }} type="button">Sil</button></div></div>)}{categories.length === 0 ? <p className="text-sm text-slate-500">Kategori bulunmuyor.</p> : null}</div></article><article className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-base font-semibold text-slate-900">Urunler</h2><div className="mt-3 space-y-2">{products.map((product) => <div key={product.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{product.name}</p><p className="text-xs text-slate-500">{product.category?.name || "Kategori yok"}</p><p className="text-xs text-slate-500">{formatTryCurrency(product.price)} - {product.preparationMinutes} dk</p><p className="text-xs text-slate-500">{product.isAvailable ? "Stokta var" : "Stokta yok"}</p></div><div className="flex gap-2"><button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => setProductForm({ id: product.id, name: product.name, categoryId: product.categoryId || "", description: product.description || "", price: String(product.price), imageUrl: product.imageUrl || "", isAvailable: Boolean(product.isAvailable), preparationMinutes: product.preparationMinutes, sortOrder: product.sortOrder })} type="button">Duzenle</button><button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50" onClick={async () => { try { await deleteOwnerMenuProduct(product.id, token); setProducts((prev) => prev.filter((x) => x.id !== product.id)); } catch (e) { setError(e.message); } }} type="button">Sil</button></div></div></div>)}{products.length === 0 ? <p className="text-sm text-slate-500">Urun bulunmuyor.</p> : null}</div></article></section></div> : null}

      {activeTab === "orders" ? <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">Online Siparisler</h2><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={refreshingOrders} onClick={async () => { setRefreshingOrders(true); try { await loadOrders(); } catch (e) { setError(e.message); } finally { setRefreshingOrders(false); } }} type="button">{refreshingOrders ? "Yenileniyor..." : "Yenile"}</button></div><div className="space-y-4">{orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p><p className="text-sm font-semibold text-slate-900">{order.customerName || "Musteri"}</p><p className="text-xs text-slate-500">{order.customerPhone || "Telefon yok"}</p><p className="mt-1 text-xs text-slate-600">{order.deliveryAddressText || "Gel-al siparisi"}</p>{order.note ? <p className="mt-1 text-xs text-slate-600">Not: {order.note}</p> : null}</div><div className="text-right"><p className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone(order.status)}`}>{order.status}</p><p className="mt-2 text-sm font-semibold text-slate-900">{formatTryCurrency(order.total)}</p><p className="text-xs text-slate-500">{order.orderType} - {order.paymentMethod || "-"}</p></div></div><div className="mt-3 space-y-1.5">{(order.items || []).map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"><span>{item.quantity}x {item.productNameSnapshot}</span><span>{formatTryCurrency(item.totalPrice)}</span></div>)}</div><div className="mt-3 flex flex-wrap gap-2">{(ORDER_NEXT[order.status] || []).map((status) => <button key={status} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100" onClick={() => updateOwnerOnlineOrderStatus(order.id, status, token).then((payload) => setOrders((prev) => prev.map((x) => (x.id === order.id ? payload.order : x)))).catch((e) => setError(e.message))} type="button">{status}</button>)}</div></article>)}{orders.length === 0 ? <p className="text-sm text-slate-500">Henuz online siparis bulunmuyor.</p> : null}</div></section> : null}

      {activeTab === "photos" ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Fotograflar</h2><form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveSettings({ logoUrl: settings.logoUrl, coverImageUrl: settings.coverImageUrl }); }}><label className="text-sm text-slate-700">Logo URL<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.logoUrl} onChange={(e) => setField("logoUrl", e.target.value)} /></label><label className="text-sm text-slate-700">Kapak URL<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={settings.coverImageUrl} onChange={(e) => setField("coverImageUrl", e.target.value)} /></label><div className="rounded-xl border border-slate-200 p-3"><p className="mb-2 text-xs text-slate-600">Logo onizleme</p>{settings.logoUrl ? <img alt="logo" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" src={settings.logoUrl} /> : <p className="text-xs text-slate-500">Logo yok</p>}</div><div className="rounded-xl border border-slate-200 p-3"><p className="mb-2 text-xs text-slate-600">Kapak onizleme</p>{settings.coverImageUrl ? <img alt="cover" className="h-20 w-full rounded-xl border border-slate-200 object-cover" src={settings.coverImageUrl} /> : <p className="text-xs text-slate-500">Kapak gorseli yok</p>}</div><div className="md:col-span-2"><button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50" disabled={saving} type="submit">{saving ? "Kaydediliyor..." : "Fotograflari kaydet"}</button></div></form></section> : null}
    </div>
  );
}
