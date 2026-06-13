import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOnlineRestaurantBySlug, getOnlineRestaurantMenu } from "../api";
import ProductCard from "../components/online/ProductCard";
import CartSummary from "../components/online/CartSummary";
import {
  addToOnlineCart,
  clearOnlineCart,
  getOnlineCartTotals,
  readOnlineCart,
  updateOnlineCartItemQuantity,
  writeOnlineCart
} from "../utils/onlineCart";
import { readOnlineLocationContext } from "../utils/onlineLocation";
import { formatTryCurrency } from "../utils/currency";
import useAppTranslation from "../hooks/useAppTranslation";

export default function OnlineRestaurantPage() {
  const { t } = useAppTranslation();
  const { restaurantSlug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => readOnlineCart());
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
      setLoading(true);
      setError("");

      try {
        const [detailPayload, menuPayload] = await Promise.all([
          getOnlineRestaurantBySlug(restaurantSlug, {
            lat: locationContext?.lat,
            lng: locationContext?.lng
          }),
          getOnlineRestaurantMenu(restaurantSlug)
        ]);

        if (!active) {
          return;
        }

        setRestaurant(detailPayload.restaurant || null);
        setCategories(menuPayload.categories || []);
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

    loadRestaurant();

    return () => {
      active = false;
    };
  }, [locationContext?.lat, locationContext?.lng, restaurantSlug]);

  const totals = useMemo(() => getOnlineCartTotals(cart), [cart]);

  function saveCart(nextCart) {
    const savedCart = writeOnlineCart(nextCart);
    setCart(savedCart);
  }

  function handleAddToCart(product) {
    if (!restaurant || !restaurant.isCurrentlyOpen || restaurant.inDeliveryZone === false) {
      return;
    }

    const nextCart = addToOnlineCart(cart, restaurant, product, 1);
    if (nextCart.conflictRestaurant) {
      const shouldReset = window.confirm(t("onlineRestaurant.cartConflict"));
      if (!shouldReset) {
        return;
      }

      const resetCart = addToOnlineCart(clearOnlineCart(), restaurant, product, 1);
      saveCart(resetCart);
      return;
    }

    saveCart(nextCart);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {loading ? <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">{t("onlineRestaurant.loadingMenu")}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <>
          <header className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm">
            {restaurant?.coverImageUrl ? (
              <img alt={restaurant?.name} className="h-48 w-full object-cover" src={restaurant?.coverImageUrl} />
            ) : null}
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/online-order">
                    {t("onlineRestaurant.allRestaurants")}
                  </Link>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-900">{restaurant?.name}</h1>
                  <p className="mt-1 text-sm text-slate-600">{restaurant?.description || t("onlineRestaurant.defaultDescription")}</p>
                  <p className="mt-1 text-xs text-slate-500">{[restaurant?.city, restaurant?.district].filter(Boolean).join(" / ")}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  <p>{t("onlineRestaurant.minimum", { amount: formatTryCurrency(restaurant?.minimumOrderAmount || 0) })}</p>
                  <p>{t("onlineRestaurant.delivery", { amount: formatTryCurrency(restaurant?.deliveryFee || 0) })}</p>
                  <p>{t("onlineRestaurant.estimatedTime", { minutes: restaurant?.estimatedDeliveryMinutes || 0 })}</p>
                  <p>
                    {t("onlineRestaurant.statusLabel")}{" "}
                    {restaurant?.isCurrentlyOpen ? t("onlineRestaurant.statusOpen") : t("onlineRestaurant.statusClosed")}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {!restaurant?.isCurrentlyOpen ? (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("onlineRestaurant.closedWarning")}
            </div>
          ) : null}
          {restaurant?.inDeliveryZone === false ? (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {t("onlineRestaurant.outOfZoneWarning")}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">{category.name}</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(category.products || []).map((product) => (
                      <ProductCard key={product.id} onAdd={handleAddToCart} product={product} />
                    ))}
                  </div>
                </div>
              ))}

              {categories.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">{t("onlineRestaurant.emptyMenu")}</div>
              ) : null}
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
                    <Link
                      aria-disabled={!restaurant?.isCurrentlyOpen || cart.items.length === 0}
                      className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold text-white ${
                        !restaurant?.isCurrentlyOpen || cart.items.length === 0 || restaurant?.inDeliveryZone === false
                          ? "pointer-events-none bg-slate-400 opacity-70"
                          : "bg-brand-700 hover:bg-brand-900"
                      }`}
                      to={`/online-order/${restaurantSlug}/cart`}
                    >
                      {t("onlineRestaurant.completeOrder")}
                    </Link>
                  }
                />
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
