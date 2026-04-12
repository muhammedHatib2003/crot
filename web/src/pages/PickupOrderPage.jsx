import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api";
import RemoteImage from "../components/RemoteImage";

const ORDER_STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-900",
  PREPARING: "bg-sky-100 text-sky-900",
  READY: "bg-emerald-100 text-emerald-900",
  PAID: "bg-slate-200 text-slate-800",
  CANCELLED: "bg-rose-100 text-rose-900"
};

function formatPrice(price) {
  return `$${Number(price || 0).toFixed(2)}`;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "As soon as possible";
  }

  return new Date(dateValue).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusClass(status) {
  return ORDER_STATUS_STYLES[status] || "bg-slate-100 text-slate-800";
}

function getAvailabilityClasses(item) {
  return item.isOrderable
    ? "bg-emerald-100 text-emerald-900"
    : "bg-slate-200 text-slate-700";
}

export default function PickupOrderPage() {
  const { tenantSlug } = useParams();
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
  const [activeCategory, setActiveCategory] = useState("");

  const menuItems = payload?.items || [];
  const cartItems = useMemo(
    () =>
      menuItems
        .filter((item) => item.isOrderable && Number(cart[item.id] || 0) > 0)
        .map((item) => ({
          ...item,
          quantity: Number(cart[item.id] || 0),
          lineTotal: item.price * Number(cart[item.id] || 0)
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
      const result = await apiRequest(`/public/tenants/${tenantSlug}/menu`);
      setPayload(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrder(orderId) {
    try {
      const result = await apiRequest(`/public/tenants/${tenantSlug}/orders/${orderId}`);
      setActiveOrder(result.order);
    } catch (requestError) {
      setSubmitError(requestError.message);
    }
  }

  useEffect(() => {
    loadMenu();
  }, [tenantSlug]);

  useEffect(() => {
    if (!activeOrder?.publicId) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadOrder(activeOrder.publicId);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [activeOrder?.publicId, tenantSlug]);

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
      const result = await apiRequest(`/public/tenants/${tenantSlug}/orders`, {
        method: "POST",
        body: {
          customerName,
          customerPhone,
          notes,
          items: cartItems.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity
          }))
        }
      });

      setActiveOrder(result.order);
      setSubmitMessage(result.message);
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
    return <div className="p-8 text-center text-red-700">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 rounded-3xl bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Online Pickup</p>
            <h1 className="mt-2 text-3xl font-bold text-brand-900">{payload?.restaurant?.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Order online and collect it at the restaurant when it is ready.
            </p>
          </div>
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <p className="font-semibold">Pickup</p>
            <p>Tenant: /{payload?.restaurant?.slug}</p>
          </div>
        </div>
      </header>

      {submitMessage ? (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {submitMessage}
        </div>
      ) : null}
      {submitError ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {submitError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          {activeOrder ? (
            <section className="rounded-3xl bg-white p-5 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Latest pickup order</p>
                  <h2 className="text-xl font-bold text-slate-900">{activeOrder.orderCode}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusClass(activeOrder.status)}`}>
                  {activeOrder.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{activeOrder.customerName}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Phone</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{activeOrder.customerPhone}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Pickup time</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(activeOrder.pickupTime)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{formatPrice(activeOrder.total)}</p>
              </div>
              <div className="mt-4 space-y-2">
                {activeOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} x {formatPrice(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-brand-900">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {groupedItems.length > 0 ? (
            <section className="rounded-3xl bg-white p-5 shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Browse Menu</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Choose your items</h2>
                  <p className="mt-1 text-sm text-slate-500">Pickup orders are prepared fresh and shown live to the kitchen.</p>
                </div>
                <div className="rounded-2xl bg-brand-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Selected</p>
                  <p className="mt-1 text-lg font-bold text-brand-900">{activeCategory || "-"}</p>
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
                      <p className={`text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>{items.length} items</p>
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
                            <p className="mt-2 text-sm text-slate-600">{item.description || "Freshly prepared pickup item."}</p>
                            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getAvailabilityClasses(item)}`}>
                              {item.availabilityText}
                            </span>
                          </div>
                          <p className="text-base font-bold text-brand-900">{formatPrice(item.price)}</p>
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
          ) : null}

          {groupedItems.length === 0 ? (
            <section className="rounded-3xl bg-white p-5 shadow-md">
              <p className="text-sm text-slate-500">No available menu items.</p>
            </section>
          ) : null}
        </section>

        <aside>
          <div className="rounded-3xl bg-white p-5 shadow-md xl:sticky xl:top-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Your Cart</p>
                <h2 className="text-xl font-bold text-slate-900">{cartItems.length} items selected</h2>
              </div>
              <p className="text-lg font-bold text-brand-900">{formatPrice(cartTotal)}</p>
            </div>

            <div className="mt-4 space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} x {formatPrice(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatPrice(item.lineTotal)}</p>
                  </div>
                </div>
              ))}

              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Your cart is empty. Add products from the menu to place a pickup order.
                </div>
              ) : null}
            </div>

            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="Your full name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="+1 555 123 4567"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Order note</label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  placeholder="Allergy, no onion, extra spicy..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <button
                disabled={submitting || cartItems.length === 0}
                type="submit"
                className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
              >
                {submitting ? "Sending order..." : `Place pickup order for ${formatPrice(cartTotal)}`}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
