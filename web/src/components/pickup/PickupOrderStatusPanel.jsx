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

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || "Unknown";
}

export default function PickupOrderStatusPanel({ order, onRefresh, onNewOrder, refreshing = false }) {
  if (!order) {
    return null;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const isTerminal = ["PAID", "COMPLETED", "CANCELLED", "REJECTED"].includes(order.status);

  return (
    <section className="rounded-3xl border border-brand-200 bg-gradient-to-b from-brand-50/80 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Your order</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{order.orderCode}</h2>
          <p className="mt-1 text-xs text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClass(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer</p>
          <p className="mt-1 font-medium text-slate-900">{order.customerName || "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
          <p className="mt-1 font-medium text-slate-900">{order.customerPhone || "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pickup time</p>
          <p className="mt-1 font-medium text-slate-900">
            {order.pickupTime ? formatDateTime(order.pickupTime) : "As soon as ready"}
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
                  {item.quantity} × {formatTryCurrency(item.price)}
                </p>
                {item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}
              </div>
              <p className="shrink-0 font-semibold text-brand-800">{formatTryCurrency((item.price || 0) * (item.quantity || 0))}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
        <span className="text-sm font-medium">Total</span>
        <span className="text-lg font-bold">{formatTryCurrency(order.total)}</span>
      </div>

      {order.paymentStatus ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Payment: <span className="font-semibold text-slate-700">{order.paymentStatus}</span>
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          {refreshing ? "Updating..." : "Refresh status"}
        </button>
        {isTerminal ? (
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
        )}
      </div>
    </section>
  );
}

export function getPickupOrderStorageKey(tenantSlug) {
  return `crot_pickup_order_${tenantSlug}`;
}
