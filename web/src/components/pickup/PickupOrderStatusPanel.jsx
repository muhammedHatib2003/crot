import { formatTryCurrency } from "../../utils/currency";

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-900",
  ACCEPTED: "bg-sky-100 text-sky-900",
  PREPARING: "bg-sky-100 text-sky-900",
  READY: "bg-emerald-100 text-emerald-900",
  PAID: "bg-slate-200 text-slate-800",
  COMPLETED: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-rose-100 text-rose-900",
  REJECTED: "bg-rose-100 text-rose-900"
};

const STATUS_LABELS = {
  PENDING: "Order received",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  PAID: "Paid",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected"
};

const STATUS_FLOW = [
  { label: "Received", statuses: ["PENDING", "ACCEPTED"] },
  { label: "Preparing", statuses: ["PREPARING"] },
  { label: "Ready", statuses: ["READY"] },
  { label: "Done", statuses: ["PAID", "COMPLETED"] }
];

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusClass(status) {
  return STATUS_STYLES[status] || "bg-slate-100 text-slate-800";
}

function getStatusLabel(status, mode) {
  if (status === "READY" && mode === "table") {
    return "Ready to serve";
  }

  return STATUS_LABELS[status] || status || "Unknown";
}

function getActiveStepIndex(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (["CANCELLED", "REJECTED"].includes(normalized)) {
    return -1;
  }

  const index = STATUS_FLOW.findIndex((step) => step.statuses.includes(normalized));
  return index >= 0 ? index : 0;
}

function OrderStatusTimeline({ status, mode }) {
  const activeIndex = getActiveStepIndex(status);
  const isCancelled = ["CANCELLED", "REJECTED"].includes(String(status || "").trim().toUpperCase());

  if (isCancelled) {
    return (
      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        This order was cancelled. Place a new order if you still need food.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Order progress</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {STATUS_FLOW.map((step, index) => {
          const isComplete = activeIndex > index;
          const isCurrent = activeIndex === index;

          return (
            <div key={step.label} className="text-center">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  isComplete
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {isComplete ? "✓" : index + 1}
              </div>
              <p className={`mt-2 text-[11px] font-semibold ${isCurrent ? "text-brand-800" : "text-slate-500"}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
      {mode === "table" ? (
        <p className="mt-3 text-center text-xs text-slate-500">Your table order updates here as the kitchen works on it.</p>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-500">We will notify you on this screen when your pickup order is ready.</p>
      )}
    </div>
  );
}

export default function PickupOrderStatusPanel({
  order,
  onRefresh,
  onNewOrder,
  refreshing = false,
  mode = "pickup",
  tableName = "",
  refreshSeconds = 3,
  formatCurrency = formatTryCurrency
}) {
  if (!order) {
    return null;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const isTerminal = ["PAID", "COMPLETED", "CANCELLED", "REJECTED"].includes(order.status);
  const resolvedTableName = tableName || order.table?.name || "";

  return (
    <section
      className="rounded-3xl border border-brand-200 bg-gradient-to-b from-brand-50/80 to-white p-5 shadow-sm"
      id="order-status-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            {mode === "table" ? "Your table order" : "Your pickup order"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{order.orderCode}</h2>
          <p className="mt-1 text-xs text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClass(order.status)}`}>
          {getStatusLabel(order.status, mode)}
        </span>
      </div>

      <OrderStatusTimeline mode={mode} status={order.status} />

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {mode === "table" ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Masa</p>
              <p className="mt-1 font-medium text-slate-900">{resolvedTableName || "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ad Soyad</p>
              <p className="mt-1 font-medium text-slate-900">{order.customerName || "—"}</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer</p>
              <p className="mt-1 font-medium text-slate-900">{order.customerName || "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
              <p className="mt-1 font-medium text-slate-900">{order.customerPhone || "—"}</p>
            </div>
          </>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {mode === "table" ? "Preparing since" : "Pickup time"}
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {mode === "table"
              ? formatDateTime(order.preparingAt)
              : order.pickupTime
                ? formatDateTime(order.pickupTime)
                : "As soon as ready"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ready at</p>
          <p className="mt-1 font-medium text-slate-900">{formatDateTime(order.readyAt)}</p>
        </div>
      </div>

      {order.notes ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Order note</p>
          <p className="mt-1">{order.notes}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Items</p>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No line items.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{item.name || item.productName}</p>
                <p className="text-xs text-slate-500">
                  {item.quantity} × {formatCurrency(item.price)}
                </p>
                {item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}
              </div>
              <p className="shrink-0 font-semibold text-brand-800">
                {formatCurrency((item.price || 0) * (item.quantity || 0))}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
        <span className="text-sm font-medium">Total</span>
        <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
      </div>

      {order.paymentStatus ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Payment: <span className="font-semibold text-slate-700">{order.paymentStatus}</span>
        </p>
      ) : null}

      <p className="mt-3 text-center text-xs text-slate-400">
        Live status — auto-refreshes every {refreshSeconds} seconds
        {refreshing ? " (updating…)" : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          {refreshing ? "Updating..." : "Refresh status"}
        </button>
        {mode === "pickup" ? (
          isTerminal ? (
            <button
              className="rounded-xl bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
              onClick={onNewOrder}
              type="button"
            >
              New order
            </button>
          ) : (
            <button
              className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={onNewOrder}
              type="button"
            >
              Order again
            </button>
          )
        ) : (
          <button
            className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => document.getElementById("table-menu-section")?.scrollIntoView({ behavior: "smooth" })}
            type="button"
          >
            Add more items
          </button>
        )}
      </div>
    </section>
  );
}

export function getPickupOrderStorageKey(tenantSlug) {
  return `crot_pickup_order_${tenantSlug}`;
}
