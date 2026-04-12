import OrderCard from "./OrderCard";

const COLUMN_STYLES = {
  PENDING: {
    shell: "border-amber-200 bg-amber-50/60",
    badge: "bg-amber-500 text-white"
  },
  PREPARING: {
    shell: "border-sky-200 bg-sky-50/60",
    badge: "bg-sky-600 text-white"
  },
  READY: {
    shell: "border-emerald-200 bg-emerald-50/60",
    badge: "bg-emerald-600 text-white"
  }
};

export default function OrderColumn({ title, status, orders, busyOrderId, onAction }) {
  const style = COLUMN_STYLES[status] || COLUMN_STYLES.PENDING;

  return (
    <section className={`flex min-h-[70vh] min-w-0 flex-col rounded-[28px] border p-4 shadow-sm ${style.shell}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-2 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Orders</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
        </div>
        <div className={`flex h-12 min-w-[3.5rem] items-center justify-center rounded-2xl px-3 text-lg font-black ${style.badge}`}>
          {orders.length}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
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
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 text-center text-lg font-semibold text-slate-500">
            No orders in {title.toLowerCase()}.
          </div>
        )}
      </div>
    </section>
  );
}
