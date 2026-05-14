import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../api";
import { AppShell, MessageBanner, PageHeader, SectionCard, buttonStyles } from "../components/app/AppShell";
import CourierLiveMap from "../modules/courier/CourierLiveMap";
import { useCourierLiveLocation } from "../modules/courier/useCourierLiveLocation";

function getCardStyles(status) {
  if (status === "SERVED") {
    return "border-sky-200 bg-sky-50";
  }
  return "border-amber-200 bg-amber-50";
}

function getAction(status) {
  if (status === "READY") {
    return {
      nextStatus: "SERVED",
      key: "pickup"
    };
  }
  return {
    nextStatus: "COMPLETED",
    key: "delivered"
  };
}

export default function CourierPage({ courierSession, onLogout }) {
  const { t } = useTranslation();
  const [me, setMe] = useState(courierSession.courier);
  const [tab, setTab] = useState("offers");
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [locationRequired, setLocationRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [myPos, setMyPos] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const prevOfferIds = useRef(new Set());
  const offersBootstrapped = useRef(false);

  useCourierLiveLocation(courierSession.token, true, setMyPos);

  const stats = useMemo(
    () => ({
      ready: orders.filter((order) => order.status === "READY").length,
      served: orders.filter((order) => order.status === "SERVED").length
    }),
    [orders]
  );

  const loadOffers = useCallback(async () => {
    const result = await apiRequest("/courier/offers", { token: courierSession.token });
    setOffers(result.offers || []);
    setLocationRequired(Boolean(result.locationRequired));
    const nextIds = new Set((result.offers || []).map((o) => o.id));
    if (!offersBootstrapped.current) {
      offersBootstrapped.current = true;
      prevOfferIds.current = nextIds;
    } else if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.visibilityState === "hidden"
    ) {
      for (const id of nextIds) {
        if (!prevOfferIds.current.has(id)) {
          // eslint-disable-next-line no-new
          new Notification(t("courier.notify.newTitle"), {
            body: t("courier.notify.newBody")
          });
          break;
        }
      }
      prevOfferIds.current = nextIds;
    } else {
      prevOfferIds.current = nextIds;
    }
  }, [courierSession.token, t]);

  const loadOrders = useCallback(async () => {
    const result = await apiRequest("/courier/orders", { token: courierSession.token });
    setOrders(result.orders || []);
  }, [courierSession.token]);

  const refreshAll = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) {
        setRefreshing(true);
      }
      setError("");
      try {
        await Promise.all([loadOffers(), loadOrders()]);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        if (showRefreshing) {
          setRefreshing(false);
        }
      }
    },
    [loadOffers, loadOrders]
  );

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError("");
      try {
        const meResult = await apiRequest("/courier-auth/me", { token: courierSession.token });
        setMe(meResult.courier);
        await refreshAll();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [courierSession.token, refreshAll]);

  useEffect(() => {
    if (loading) {
      return undefined;
    }
    const id = setInterval(() => {
      refreshAll();
    }, 4500);
    return () => clearInterval(id);
  }, [loading, refreshAll]);

  useEffect(() => {
    if (tab === "offers" && offers.length > 0) {
      setSelectedOfferId((prev) => (prev && offers.some((o) => o.id === prev) ? prev : offers[0].id));
    }
  }, [tab, offers]);

  useEffect(() => {
    if (tab === "queue" && orders.length > 0) {
      setSelectedQueueId((prev) => (prev && orders.some((o) => o.id === prev) ? prev : orders[0].id));
    }
  }, [tab, orders]);

  const mapOrder = useMemo(() => {
    if (tab === "offers") {
      return offers.find((o) => o.id === selectedOfferId) || offers[0] || null;
    }
    return orders.find((o) => o.id === selectedQueueId) || orders[0] || null;
  }, [tab, offers, orders, selectedOfferId, selectedQueueId]);

  async function acceptOffer(orderId) {
    setBusyOrderId(orderId);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/courier/offers/${orderId}/accept`, {
        method: "POST",
        token: courierSession.token
      });
      setMessage(t("courier.messages.accepted"));
      setTab("queue");
      await refreshAll();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrderId("");
    }
  }

  async function updateOrderStatus(orderId, nextStatus) {
    setBusyOrderId(orderId);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(`/courier/orders/${orderId}/status`, {
        method: "PATCH",
        token: courierSession.token,
        body: { status: nextStatus }
      });
      setMessage(t("courier.messages.updated", { code: result.order.orderCode }));
      await refreshAll();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrderId("");
    }
  }

  async function requestNotifyPermission() {
    if (typeof Notification === "undefined") {
      return;
    }
    await Notification.requestPermission();
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title={t("courier.title")}
          eyebrow={t("courier.eyebrow")}
          description={t("courier.description")}
          meta={[
            me.restaurant?.name || me.restaurantName || t("courier.platformLabel"),
            me.fullName
          ]}
          actions={
            <>
              <button className={buttonStyles.secondary} type="button" onClick={requestNotifyPermission}>
                {t("courier.actions.enableNotify")}
              </button>
              <button className={buttonStyles.secondary} disabled={refreshing} onClick={() => refreshAll(true)} type="button">
                {refreshing ? t("common.actions.refreshing") : t("common.actions.refresh")}
              </button>
              <button className={buttonStyles.secondary} onClick={onLogout} type="button">
                {t("common.actions.logout")}
              </button>
            </>
          }
        />

        {loading ? (
          <SectionCard>
            <p className="text-sm text-slate-600">{t("courier.loading")}</p>
          </SectionCard>
        ) : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}
        {locationRequired ? <MessageBanner tone="warning">{t("courier.locationHint")}</MessageBanner> : null}

        {!loading ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                tab === "offers" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
              onClick={() => setTab("offers")}
            >
              {t("courier.tabs.offers")} {offers.length ? `(${offers.length})` : ""}
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                tab === "queue" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
              onClick={() => setTab("queue")}
            >
              {t("courier.tabs.queue")} {orders.length ? `(${orders.length})` : ""}
            </button>
          </div>
        ) : null}

        {!loading && mapOrder ? (
          <SectionCard title={t("courier.map.title")} description={t("courier.map.description")}>
            <CourierLiveMap
              courierLabel={t("courier.map.you")}
              courierLat={myPos?.lat}
              courierLng={myPos?.lng}
              deliveryLabel={mapOrder.customerAddress || mapOrder.deliveryAddressText || t("courier.map.dropoff")}
              deliveryLat={mapOrder.deliveryLatitude}
              deliveryLng={mapOrder.deliveryLongitude}
              restaurantLabel={mapOrder.restaurant?.name || t("courier.map.pickup")}
              restaurantLat={mapOrder.restaurant?.latitude}
              restaurantLng={mapOrder.restaurant?.longitude}
            />
          </SectionCard>
        ) : null}

        {!loading && tab === "offers" ? (
          <SectionCard title={t("courier.offers.title")} description={t("courier.offers.description")}>
            {offers.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {offers.map((order) => (
                  <article
                    key={order.id}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      order.id === selectedOfferId ? "ring-2 ring-slate-900" : ""
                    } border-amber-200 bg-amber-50`}
                    onClick={() => setSelectedOfferId(order.id)}
                    role="presentation"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{order.orderCode}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-600">{t("courier.status.ready")}</p>
                        {order.offerDistanceKm != null ? (
                          <p className="mt-1 text-xs text-slate-600">
                            {t("courier.offers.distance", { km: order.offerDistanceKm })}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-lg font-semibold text-slate-950">${Number(order.totalPrice || 0).toFixed(2)}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-slate-900">{t("courier.fields.customer")}</span>{" "}
                        {order.customerName || t("common.notAvailable")}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">{t("courier.fields.phone")}</span>{" "}
                        {order.customerPhone || t("common.notAvailable")}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">{t("courier.fields.address")}</span>{" "}
                        {order.customerAddress || order.deliveryAddressText || t("common.notAvailable")}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className={buttonStyles.primary}
                        disabled={busyOrderId === order.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptOffer(order.id);
                        }}
                        type="button"
                      >
                        {busyOrderId === order.id ? t("courier.actions.accepting") : t("courier.actions.accept")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                {t("courier.offers.empty")}
              </div>
            )}
          </SectionCard>
        ) : null}

        {!loading && tab === "queue" ? (
          <SectionCard
            title={t("courier.queue.title")}
            description={t("courier.queue.stats", { ready: stats.ready, served: stats.served })}
          >
            {orders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {orders.map((order) => {
                  const action = getAction(order.status);
                  return (
                    <article
                      key={order.id}
                      className={`cursor-pointer rounded-2xl border p-4 ${getCardStyles(order.status)} ${
                        order.id === selectedQueueId ? "ring-2 ring-slate-900" : ""
                      }`}
                      onClick={() => setSelectedQueueId(order.id)}
                      role="presentation"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-950">{order.orderCode}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-600">
                            {order.status === "SERVED" ? t("courier.status.onTheWay") : t("courier.status.assigned")}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-slate-950">${Number(order.totalPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700">
                        <p>
                          <span className="font-medium text-slate-900">{t("courier.fields.customer")}</span>{" "}
                          {order.customerName || t("common.notAvailable")}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">{t("courier.fields.phone")}</span>{" "}
                          {order.customerPhone || t("common.notAvailable")}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">{t("courier.fields.address")}</span>{" "}
                          {order.customerAddress || order.deliveryAddressText || t("common.notAvailable")}
                        </p>
                        {order.notes ? (
                          <p>
                            <span className="font-medium text-slate-900">{t("courier.fields.note")}</span> {order.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-slate-700">
                            {item.quantity} x {item.name}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          className={buttonStyles.primary}
                          disabled={busyOrderId === order.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, action.nextStatus);
                          }}
                          type="button"
                        >
                          {busyOrderId === order.id
                            ? t("courier.actions.updating")
                            : t(`courier.actions.${action.key}`)}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                {t("courier.queue.empty")}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}
