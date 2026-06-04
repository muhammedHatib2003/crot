import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest, getApiBaseUrl } from "../api";
import PickupOrderStatusPanel, { getPickupOrderStorageKey } from "../components/pickup/PickupOrderStatusPanel";
import RemoteImage from "../components/RemoteImage";
import RestaurantLogo from "../components/RestaurantLogo";
import { formatTryCurrency } from "../utils/currency";
import {
  apiRequestWithPathFallback,
  getPickupMenuPathCandidates,
  getPickupOrderPathCandidates,
  getPickupOrdersPathCandidates
} from "../utils/pickupApi";

const TERMINAL_STATUSES = new Set(["PAID", "COMPLETED", "CANCELLED", "REJECTED"]);

function getAvailabilityClasses(item) {
  return item.isOrderable ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700";
}

export default function PickupOrderPage() {
  const { tenantSlug } = useParams();
  const menuPathCandidates = useMemo(() => getPickupMenuPathCandidates(tenantSlug), [tenantSlug]);
  const ordersPathCandidates = useMemo(() => getPickupOrdersPathCandidates(tenantSlug), [tenantSlug]);
  const storageKey = getPickupOrderStorageKey(tenantSlug);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [cart, setCart] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderRefreshing, setOrderRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");

  const menuItems = payload?.items || payload?.products || [];
  const cartItems = useMemo(
    () =>
      menuItems
        .filter((item) => item.isOrderable && Number(cart[item.id] || 0) > 0)
        .map((item) => ({
          ...item,
          quantity: Number(cart[item.id] || 0),
          lineTotal: Number(item.price || 0) * Number(cart[item.id] || 0)
        })),
    [cart, menuItems]
  );
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.lineTotal, 0), [cartItems]);
  const groupedItems = useMemo(() => {
    const groups = {};

    menuItems.forEach((item) => {
      const key = item.category || "General";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return Object.entries(groups);
  }, [menuItems]);
  const categoryNames = useMemo(() => groupedItems.map(([category]) => category), [groupedItems]);
  const visibleItems = useMemo(() => {
    if (!activeCategory) {
      return groupedItems[0]?.[1] || [];
    }

    return groupedItems.find(([category]) => category === activeCategory)?.[1] || [];
  }, [activeCategory, groupedItems]);

  function readStoredOrderId() {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(storageKey) || "";
  }

  function persistOrderId(publicId) {
    if (typeof window === "undefined" || !publicId) {
      return;
    }

    window.localStorage.setItem(storageKey, publicId);
  }

  function clearStoredOrder() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setActiveOrder(null);
    setSubmitMessage("");
    setSubmitError("");
  }

  useEffect(() => {
    if (categoryNames.length === 0) {
      setActiveCategory("");
      return;
    }

    setActiveCategory((previous) => (previous && categoryNames.includes(previous) ? previous : categoryNames[0]));
  }, [categoryNames]);

  useEffect(() => {
    setCart((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([itemId]) => menuItems.find((item) => item.id === itemId && item.isOrderable))
      )
    );
  }, [menuItems]);

  function setItemQuantity(itemId, quantity) {
    const item = menuItems.find((entry) => entry.id === itemId);

    setCart((previous) => {
      if (!item?.isOrderable) {
        return previous;
      }

      if (quantity <= 0) {
        const nextCart = { ...previous };
        delete nextCart[itemId];
        return nextCart;
      }

      return {
        ...previous,
        [itemId]: quantity
      };
    });
  }

  function increaseQuantity(itemId) {
    setItemQuantity(itemId, Number(cart[itemId] || 0) + 1);
  }

  function decreaseQuantity(itemId) {
    setItemQuantity(itemId, Number(cart[itemId] || 0) - 1);
  }

  async function loadMenu() {
    setLoading(true);
    setError("");

    try {
      const storedOrderId = readStoredOrderId();
      const query = storedOrderId ? `?orderId=${encodeURIComponent(storedOrderId)}` : "";
      const result = await apiRequestWithPathFallback(
        menuPathCandidates.map((path) => `${path}${query}`),
        {},
        apiRequest
      );
      setPayload(result);

      if (result.activeOrder) {
        setActiveOrder(result.activeOrder);
        if (result.activeOrder.customerName) {
          setCustomerName(result.activeOrder.customerName);
        }
        if (result.activeOrder.customerPhone) {
          setCustomerPhone(result.activeOrder.customerPhone);
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrder(orderId, { silent = false } = {}) {
    if (!orderId) {
      return;
    }

    if (!silent) {
      setOrderRefreshing(true);
    }

    try {
      const result = await apiRequestWithPathFallback(getPickupOrderPathCandidates(tenantSlug, orderId), {}, apiRequest);
      setActiveOrder(result.order);
      persistOrderId(result.order?.publicId || orderId);
    } catch (requestError) {
      if (!silent) {
        setSubmitError(requestError.message);
      }
    } finally {
      if (!silent) {
        setOrderRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadMenu();
  }, [tenantSlug]);

  useEffect(() => {
    if (!activeOrder?.publicId || TERMINAL_STATUSES.has(activeOrder.status)) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadOrder(activeOrder.publicId, { silent: true });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [activeOrder?.publicId, activeOrder?.status, tenantSlug]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    if (cartItems.length === 0) {
      setSubmitError("Add at least one item to your order.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError("Name and phone are required for pickup orders.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiRequestWithPathFallback(ordersPathCandidates, {
        method: "POST",
        body: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim(),
          items: cartItems.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity
          }))
        }
      });

      setActiveOrder(result.order);
      persistOrderId(result.order?.publicId);
      setSubmitMessage(result.message || "Pickup order placed successfully.");
      setCart({});
      setNotes("");
      await loadMenu();
    } catch (requestError) {
      setSubmitError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-700">Loading menu...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="text-lg font-semibold">Pickup unavailable</p>
          <p className="mt-2 text-sm">{error}</p>
          <p className="mt-3 text-xs text-rose-700/90">
            Slug: <span className="font-mono font-semibold">/{tenantSlug}/menu</span>
            <br />
            API: {getApiBaseUrl()}
            {menuPathCandidates[0]}
          </p>
          <p className="mt-3 text-xs text-rose-600">
            Owner panel → Settings: pickup slug, active plan, Public dine-in ordering and Pickup ordering enabled.
          </p>
        </div>
      </div>
    );
  }

  const restaurant = payload?.restaurant;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 rounded-3xl bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <RestaurantLogo className="h-16 w-16 shrink-0 text-lg" name={restaurant?.name} src={restaurant?.logoUrl} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Gel-Al Menü</p>
              <h1 className="mt-2 text-3xl font-bold text-brand-900">{restaurant?.name}</h1>
              <p className="mt-1 text-sm text-slate-600">Sipariş verin, hazır olunca restorandan teslim alın.</p>
            </div>
          </div>
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <p className="font-semibold">Pickup</p>
            <p className="text-brand-700">/{restaurant?.slug}</p>
          </div>
        </div>
      </header>

      {submitMessage ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{submitMessage}</div>
      ) : null}
      {submitError ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{submitError}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          {activeOrder ? (
            <div className="xl:hidden">
              <PickupOrderStatusPanel
                order={activeOrder}
                refreshing={orderRefreshing}
                onNewOrder={clearStoredOrder}
                onRefresh={() => loadOrder(activeOrder.publicId)}
              />
            </div>
          ) : null}

          {groupedItems.length > 0 ? (
            <section className="rounded-3xl bg-white p-5 shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Menü</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Ürün seçin</h2>
                </div>
                <div className="rounded-2xl bg-brand-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Kategori</p>
                  <p className="mt-1 text-lg font-bold text-brand-900">{activeCategory || "—"}</p>
                </div>
              </div>

              <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
                {groupedItems.map(([category, items]) => {
                  const isActive = category === activeCategory;

                  return (
                    <button
                      key={category}
                      type="button"
                      className={`min-w-fit rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-brand-700 bg-brand-700 text-white shadow-md"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-200 hover:bg-brand-50"
                      }`}
                      onClick={() => setActiveCategory(category)}
                    >
                      <p className="text-sm font-semibold">{category}</p>
                      <p className={`text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>{items.length} ürün</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleItems.map((item) => {
                  const quantity = Number(cart[item.id] || 0);
                  const isDisabled = !item.isOrderable;

                  return (
                    <article
                      key={item.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        isDisabled ? "border-slate-300 bg-slate-100 opacity-70 grayscale" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <RemoteImage
                        alt={item.name}
                        className="h-44 w-full object-cover"
                        fallbackClassName="flex h-44 w-full items-center justify-center bg-slate-200 text-xs text-slate-500"
                        fallback="No Photo"
                        src={item.photoUrl}
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                            <p className="mt-2 text-sm text-slate-600">{item.description || "Taze hazırlanır."}</p>
                            <span
                              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getAvailabilityClasses(item)}`}
                            >
                              {item.availabilityText}
                            </span>
                          </div>
                          <p className="text-base font-bold text-brand-900">{formatTryCurrency(item.price)}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="h-9 w-9 rounded-full border border-slate-300 text-lg text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isDisabled}
                              onClick={() => decreaseQuantity(item.id)}
                            >
                              -
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold text-slate-900">{quantity}</span>
                            <button
                              type="button"
                              className="h-9 w-9 rounded-full border border-slate-300 text-lg text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isDisabled}
                              onClick={() => increaseQuantity(item.id)}
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isDisabled}
                            onClick={() => increaseQuantity(item.id)}
                          >
                            {isDisabled ? "Unavailable" : quantity > 0 ? "Add more" : "Add to cart"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="rounded-3xl bg-white p-5 shadow-md">
              <p className="text-sm text-slate-500">No available menu items.</p>
            </section>
          )}
        </section>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          {activeOrder ? (
            <div className="hidden xl:block">
              <PickupOrderStatusPanel
                order={activeOrder}
                refreshing={orderRefreshing}
                onNewOrder={clearStoredOrder}
                onRefresh={() => loadOrder(activeOrder.publicId)}
              />
            </div>
          ) : null}

          <div className="rounded-3xl bg-white p-5 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sepet</p>
                <h2 className="text-xl font-bold text-slate-900">{cartItems.length} ürün</h2>
              </div>
              <p className="text-lg font-bold text-brand-900">{formatTryCurrency(cartTotal)}</p>
            </div>

            <div className="mt-4 space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} × {formatTryCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatTryCurrency(item.lineTotal)}</p>
                  </div>
                </div>
              ))}

              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Sepet boş. Menüden ürün ekleyerek sipariş verin.
                </div>
              ) : null}
            </div>

            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ad Soyad</label>
                <input
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="Adınız"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefon</label>
                <input
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="05xx xxx xx xx"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Sipariş notu</label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="Alerji, acısız..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <button
                disabled={submitting || cartItems.length === 0}
                type="submit"
                className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
              >
                {submitting ? "Gönderiliyor..." : `Sipariş ver — ${formatTryCurrency(cartTotal)}`}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
