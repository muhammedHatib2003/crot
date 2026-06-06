import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api";
import RestaurantLogo from "../components/RestaurantLogo";
import { getDisplayOrdersPathCandidates } from "../utils/displayApi";
import { apiRequestWithPathFallback } from "../utils/pickupApi";
import { bindVisibilityRefresh, FAST_POLL_MS } from "../utils/polling";

function formatClock(value = new Date()) {
  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatUpdatedAt(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function DisplayOrderCard({ order, tone }) {
  const toneClasses = {
    preparing: "border-amber-400/40 bg-amber-500/10",
    ready: "border-emerald-400/50 bg-emerald-500/15",
    completed: "border-slate-500/40 bg-slate-500/10"
  };

  const numberClasses = {
    preparing: "text-amber-300",
    ready: "text-emerald-300",
    completed: "text-slate-200"
  };

  return (
    <article className={`rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {order.customerName ? (
            <p className="truncate text-2xl font-black uppercase tracking-wide text-white sm:text-3xl lg:text-4xl">
              {order.customerName}
            </p>
          ) : null}
          <p className={`${order.customerName ? "mt-2" : ""} text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl ${numberClasses[tone]}`}>
            {order.orderNumber}
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          {formatUpdatedAt(order.updatedAt)}
        </p>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{order.statusLabel}</p>
    </article>
  );
}

function StatusColumn({ title, subtitle, orders, tone, emptyLabel }) {
  const headerClasses = {
    preparing: "from-amber-500/25 to-amber-500/5 border-amber-400/30",
    ready: "from-emerald-500/30 to-emerald-500/5 border-emerald-400/40",
    completed: "from-slate-500/25 to-slate-500/5 border-slate-400/30"
  };

  const titleClasses = {
    preparing: "text-amber-300",
    ready: "text-emerald-300",
    completed: "text-slate-200"
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <header className={`rounded-2xl border bg-gradient-to-r px-4 py-4 ${headerClasses[tone]}`}>
        <p className={`text-2xl font-black sm:text-3xl ${titleClasses[tone]}`}>{title}</p>
        <p className="mt-1 text-sm font-medium text-white/70">{subtitle}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">{orders.length} orders</p>
      </header>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/45">{emptyLabel}</div>
        ) : (
          orders.map((order) => <DisplayOrderCard key={order.id} order={order} tone={tone} />)
        )}
      </div>
    </section>
  );
}

export default function OrderStatusScreenPage() {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-lg text-white/70">Loading order status screen...</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-lg rounded-3xl border border-rose-400/30 bg-rose-500/10 p-8">
          <p className="text-xl font-bold text-rose-200">Order Status Screen unavailable</p>
          <p className="mt-3 text-sm text-rose-100/80">{error}</p>
          <p className="mt-4 text-xs text-white/50">URL: /display/{restaurantSlug}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="flex items-center gap-4">
            <RestaurantLogo className="h-14 w-14 text-lg" name={restaurant?.name} src={restaurant?.logoUrl} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Order Status Screen</p>
              <h1 className="text-2xl font-black sm:text-3xl">{restaurant?.name || "Restaurant"}</h1>
              <p className="mt-1 text-sm text-white/55">Pickup / counter orders · today only</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tabular-nums sm:text-4xl">{formatClock(clock)}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
              Auto refresh every {FAST_POLL_MS / 1000}s
            </p>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
          <StatusColumn
            emptyLabel="No orders preparing"
            orders={groups.preparing}
            subtitle="Preparing"
            title="Hazırlanıyor"
            tone="preparing"
          />
          <StatusColumn
            emptyLabel="No orders ready"
            orders={groups.ready}
            subtitle="Ready for pickup"
            title="Hazır"
            tone="ready"
          />
          <StatusColumn
            emptyLabel="No completed orders yet"
            orders={groups.completed}
            subtitle="Recently completed"
            title="Teslim Edildi"
            tone="completed"
          />
        </main>

        {error ? <p className="mt-4 text-center text-sm text-amber-300">{error}</p> : null}
      </div>
    </div>
  );
}
