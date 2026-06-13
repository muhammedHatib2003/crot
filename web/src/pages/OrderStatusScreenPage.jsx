import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api";
import RestaurantLogo from "../components/RestaurantLogo";
import useAppTranslation from "../hooks/useAppTranslation";
import { getDisplayOrdersPathCandidates } from "../utils/displayApi";
import { apiRequestWithPathFallback } from "../utils/pickupApi";
import { bindVisibilityRefresh, FAST_POLL_MS } from "../utils/polling";

function DisplayOrderCard({ order, tone, formatTime }) {
  const toneClasses = {
    preparing: "border-amber-300 bg-amber-50",
    ready: "border-emerald-400 bg-emerald-50",
    completed: "border-slate-300 bg-white"
  };

  const numberClasses = {
    preparing: "text-amber-800",
    ready: "text-emerald-800",
    completed: "text-slate-800"
  };

  return (
    <article className={`rounded-2xl border px-4 py-4 shadow-sm sm:px-5 sm:py-5 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {order.customerName ? (
            <p className="truncate text-2xl font-black uppercase tracking-wide text-slate-900 sm:text-3xl lg:text-4xl">
              {order.customerName}
            </p>
          ) : null}
          <p
            className={`${order.customerName ? "mt-2" : ""} text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl ${numberClasses[tone]}`}
          >
            {order.orderNumber}
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
          {formatTime(order.updatedAt, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{order.statusLabel}</p>
    </article>
  );
}

function StatusColumn({ title, subtitle, orders, tone, emptyLabel, ordersCountLabel, formatTime }) {
  const headerClasses = {
    preparing: "from-amber-100 to-amber-50 border-amber-300",
    ready: "from-emerald-100 to-emerald-50 border-emerald-400",
    completed: "from-slate-100 to-white border-slate-300"
  };

  const titleClasses = {
    preparing: "text-amber-900",
    ready: "text-emerald-900",
    completed: "text-slate-800"
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className={`rounded-2xl border bg-gradient-to-r px-4 py-4 ${headerClasses[tone]}`}>
        <p className={`text-2xl font-black sm:text-3xl ${titleClasses[tone]}`}>{title}</p>
        <p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{ordersCountLabel}</p>
      </header>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          orders.map((order) => <DisplayOrderCard formatTime={formatTime} key={order.id} order={order} tone={tone} />)
        )}
      </div>
    </section>
  );
}

export default function OrderStatusScreenPage() {
  const { t, formatTime } = useAppTranslation();
  const { restaurantSlug } = useParams();
  const pathCandidates = useMemo(() => getDisplayOrdersPathCandidates(restaurantSlug), [restaurantSlug]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => new Date());

  async function loadDisplayOrders({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const result = await apiRequestWithPathFallback(pathCandidates, {}, apiRequest);
      setPayload(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadDisplayOrders();
  }, [restaurantSlug]);

  useEffect(() => {
    const refresh = () => loadDisplayOrders({ silent: true });
    const intervalId = window.setInterval(refresh, FAST_POLL_MS);
    const unbindVisibility = bindVisibilityRefresh(refresh);

    return () => {
      window.clearInterval(intervalId);
      unbindVisibility();
    };
  }, [restaurantSlug]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const groups = payload?.groups || { preparing: [], ready: [], completed: [] };
  const restaurant = payload?.restaurant;

  if (loading && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <p className="text-lg">{t("oss.loading")}</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center text-slate-900">
        <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-xl font-bold text-rose-700">{t("oss.unavailable")}</p>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <p className="mt-4 text-xs text-slate-500">{t("oss.urlHint", { slug: restaurantSlug })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <RestaurantLogo className="h-14 w-14 text-lg" name={restaurant?.name} src={restaurant?.logoUrl} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">{t("oss.eyebrow")}</p>
              <h1 className="text-2xl font-black sm:text-3xl">{restaurant?.name || t("common.restaurantFallback")}</h1>
              <p className="mt-1 text-sm text-slate-500">{t("oss.subtitle")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tabular-nums text-slate-900 sm:text-4xl">
              {formatTime(clock, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
              {t("oss.autoRefresh", { seconds: FAST_POLL_MS / 1000 })}
            </p>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          <StatusColumn
            emptyLabel={t("oss.columns.preparing.empty")}
            formatTime={formatTime}
            orders={groups.preparing}
            ordersCountLabel={t("oss.ordersCount", { count: groups.preparing.length })}
            subtitle={t("oss.columns.preparing.subtitle")}
            title={t("oss.columns.preparing.title")}
            tone="preparing"
          />
          <StatusColumn
            emptyLabel={t("oss.columns.ready.empty")}
            formatTime={formatTime}
            orders={groups.ready}
            ordersCountLabel={t("oss.ordersCount", { count: groups.ready.length })}
            subtitle={t("oss.columns.ready.subtitle")}
            title={t("oss.columns.ready.title")}
            tone="ready"
          />
          <StatusColumn
            emptyLabel={t("oss.columns.completed.empty")}
            formatTime={formatTime}
            orders={groups.completed}
            ordersCountLabel={t("oss.ordersCount", { count: groups.completed.length })}
            subtitle={t("oss.columns.completed.subtitle")}
            title={t("oss.columns.completed.title")}
            tone="completed"
          />
        </main>

        {error ? <p className="mt-4 text-center text-sm text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}
