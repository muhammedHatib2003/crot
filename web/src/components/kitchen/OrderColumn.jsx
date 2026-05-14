import OrderCard from "./OrderCard";

const COLUMN_STYLES = {
  PENDING: {
    shell:
      "border-amber-300/70 bg-gradient-to-b from-amber-100/90 via-amber-50/80 to-white/70 shadow-[0_18px_40px_rgba(2,8,23,0.08)]",
    badge: "bg-amber-500 text-white",
    dot: "bg-amber-500"
  },
  PREPARING: {
    shell:
      "border-sky-300/70 bg-gradient-to-b from-sky-100/90 via-sky-50/80 to-white/70 shadow-[0_18px_40px_rgba(2,8,23,0.08)]",
    badge: "bg-sky-600 text-white",
    dot: "bg-sky-600"
  },
  READY: {
    shell:
      "border-emerald-300/70 bg-gradient-to-b from-emerald-100/90 via-emerald-50/80 to-white/70 shadow-[0_18px_40px_rgba(2,8,23,0.08)]",
    badge: "bg-emerald-600 text-white",
    dot: "bg-emerald-600"
  }
};

export default function OrderColumn({ title, status, orders, busyOrderId, onAction }) {
  const style = COLUMN_STYLES[status] || COLUMN_STYLES.PENDING;
  const lateOrders = orders.filter((order) => order.isLate).length;

  return (
    <section
      className={`flex min-h-[70vh] min-w-0 flex-col rounded-[24px] border p-3 sm:p-4 ${style.shell}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/60 px-2 pb-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${style.dot} shadow-sm`} />
            Orders
          </p>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
          {lateOrders > 0 ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">{lateOrders} late</p>
          ) : null}
        </div>
        <div
          className={`flex h-10 min-w-[3.25rem] items-center justify-center rounded-2xl px-3 text-base font-black shadow-[0_14px_28px_rgba(2,8,23,0.12)] sm:h-12 sm:min-w-[3.5rem] sm:text-lg ${style.badge}`}
        >
          {orders.length}
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1 sm:mt-4 sm:space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              busy={busyOrderId === order.id}
              onAction={onAction}
              order={order}
            />
          ))
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white px-6 text-center text-base font-semibold text-slate-500 sm:min-h-[240px] sm:text-lg">
            No orders in {title.toLowerCase()}.
          </div>
        )}
      </div>
    </section>
  );
}
