import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api";
import PickupOrderStatusPanel from "../components/pickup/PickupOrderStatusPanel";
import RemoteImage from "../components/RemoteImage";
import { bindVisibilityRefresh, FAST_POLL_MS } from "../utils/polling";

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getAvailabilityTone(product) {
  if (product.isOrderable) {
    return "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900";
  }

  return "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700";
}

const TERMINAL_STATUSES = new Set(["PAID", "COMPLETED", "CANCELLED", "REJECTED"]);

export default function OrderPage() {
  const { tableId } = useParams();
  const [payload, setPayload] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [cart, setCart] = useState({});
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [orderRefreshing, setOrderRefreshing] = useState(false);
  const [customerName, setCustomerName] = useState("");

  const products = payload?.products || payload?.items || [];
  const groupedProducts = useMemo(() => {
    const grouped = {};

    products.forEach((product) => {
      const key = product.category || "General";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(product);
    });

    return Object.entries(grouped);
  }, [products]);
  const categoryNames = useMemo(() => groupedProducts.map(([category]) => category), [groupedProducts]);
  const visibleProducts = useMemo(() => {
    if (!activeCategory) {
      return groupedProducts[0]?.[1] || [];
    }

    return groupedProducts.find(([category]) => category === activeCategory)?.[1] || [];
  }, [activeCategory, groupedProducts]);
  const cartItems = useMemo(
    () =>
      products
        .filter((product) => product.isOrderable && Number(cart[product.id]?.quantity || 0) > 0)
        .map((product) => ({
          ...product,
          quantity: Number(cart[product.id].quantity),
          notes: cart[product.id].notes || "",
          lineTotal: Number(product.price || 0) * Number(cart[product.id].quantity)
        })),
    [cart, products]
  );
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.lineTotal, 0), [cartItems]);

  useEffect(() => {
    if (categoryNames.length === 0) {
      setActiveCategory("");
      return;
    }

    setActiveCategory((currentCategory) => (categoryNames.includes(currentCategory) ? currentCategory : categoryNames[0]));
  }, [categoryNames]);

  useEffect(() => {
    setCart((currentCart) =>
      Object.fromEntries(
        Object.entries(currentCart).filter(([productId]) => products.find((product) => product.id === productId && product.isOrderable))
      )
    );
  }, [products]);

  async function loadMenu() {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(`/public/tables/${tableId}/menu`);
      setPayload(result);
      setActiveOrder(result.activeOrder || null);
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
      const result = await apiRequest(`/public/orders/${orderId}`);
      setActiveOrder(result.order);
    } catch (requestError) {
      if (!silent) {
        setError(requestError.message);
      }
    } finally {
      if (!silent) {
        setOrderRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadMenu();
  }, [tableId]);

  useEffect(() => {
    if (!activeOrder?.publicId || TERMINAL_STATUSES.has(activeOrder.status)) {
      return undefined;
    }

    const refreshOrder = () => loadOrder(activeOrder.publicId, { silent: true });
    const intervalId = setInterval(refreshOrder, FAST_POLL_MS);
    const unbindVisibility = bindVisibilityRefresh(refreshOrder);

    return () => {
      clearInterval(intervalId);
      unbindVisibility();
    };
  }, [activeOrder?.publicId, activeOrder?.status]);

  function changeQuantity(productId, nextQuantity) {
    const product = products.find((entry) => entry.id === productId);

    setCart((currentCart) => {
      if (!product?.isOrderable) {
        return currentCart;
      }

      if (nextQuantity <= 0) {
        const nextCart = { ...currentCart };
        delete nextCart[productId];
        return nextCart;
      }

      return {
        ...currentCart,
        [productId]: {
          quantity: nextQuantity,
          notes: currentCart[productId]?.notes || ""
        }
      };
    });
  }

  function updateNotes(productId, notes) {
    setCart((currentCart) => ({
      ...currentCart,
      [productId]: {
        quantity: Number(currentCart[productId]?.quantity || 1),
        notes
      }
    }));
  }

  async function placeOrder(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (cartItems.length === 0) {
        setError("Add at least one item.");
        return;
      }

      const result = await apiRequest(`/public/tables/${tableId}/orders`, {
        method: "POST",
        body: {
          customerName: customerName.trim() || undefined,
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            notes: item.notes
          }))
        }
      });

      setActiveOrder(result.order);
      setCart({});
      setMessage("Order sent. Track progress below — status updates automatically.");
      await loadMenu();
      window.requestAnimationFrame(() => {
        document.getElementById("order-status-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-600">Loading menu...</div>;
  }

  if (error && !payload) {
    return <div className="p-6 text-center text-sm text-rose-700">{error}</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-4 sm:px-6">
      <div className="space-y-4 pb-28">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">QR Table Ordering</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{payload?.restaurant?.name}</h1>
          <p className="mt-1 text-sm text-slate-600">Table {payload?.table?.name}</p>
        </header>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

        {activeOrder && !TERMINAL_STATUSES.has(activeOrder.status) ? (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <p className="font-semibold">Your order is live on this screen</p>
            <p className="mt-1 text-brand-800">Status refreshes every {FAST_POLL_MS / 1000} seconds while you keep this page open.</p>
          </div>
        ) : null}

        {activeOrder ? (
          <PickupOrderStatusPanel
            formatCurrency={formatPrice}
            mode="table"
            order={activeOrder}
            refreshSeconds={FAST_POLL_MS / 1000}
            refreshing={orderRefreshing}
            tableName={payload?.table?.name || activeOrder.table?.name}
            onRefresh={() => loadOrder(activeOrder.publicId)}
          />
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" id="table-menu-section">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groupedProducts.map(([category]) => (
              <button
                key={category}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  category === activeCategory ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {visibleProducts.map((product) => {
              const quantity = Number(cart[product.id]?.quantity || 0);
              const isDisabled = !product.isOrderable;

              return (
                <article
                  key={product.id}
                  className={`overflow-hidden rounded-2xl border transition ${
                    isDisabled ? "border-slate-300 bg-slate-100 opacity-70 grayscale" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <RemoteImage
                    alt={product.name}
                    className="h-44 w-full object-cover"
                    fallbackClassName="flex h-44 w-full items-center justify-center bg-slate-200 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                    fallback="No photo"
                    src={product.photoUrl}
                  />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.description ? <p className="mt-1 text-sm text-slate-500">{product.description}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-950">{formatPrice(product.price)}</p>
                        <span className={`mt-2 inline-flex ${getAvailabilityTone(product)}`}>{product.availabilityText}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        className="h-10 w-10 rounded-full border border-slate-300 bg-white text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isDisabled}
                        onClick={() => changeQuantity(product.id, quantity - 1)}
                        type="button"
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold text-slate-900">{quantity}</span>
                      <button
                        className="h-10 w-10 rounded-full border border-slate-300 bg-white text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isDisabled}
                        onClick={() => changeQuantity(product.id, quantity + 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>

                    {quantity > 0 && !isDisabled ? (
                      <textarea
                        className="mt-3 min-h-[72px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                        placeholder="Notes for this item"
                        value={cart[product.id]?.notes || ""}
                        onChange={(event) => updateNotes(product.id, event.target.value)}
                      />
                    ) : null}
                  </div>
                </article>
              );
            })}

            {visibleProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No products available.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <form
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] sm:px-6"
        onSubmit={placeOrder}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ad Soyad</label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Siparişte görünsün"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{cartItems.length} items</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{formatPrice(cartTotal)}</p>
            </div>
          </div>
          <button
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={submitting || cartItems.length === 0}
            type="submit"
          >
            {submitting ? "Sending..." : "Place Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
