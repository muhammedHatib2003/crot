import OrderColumn from "./OrderColumn";

const BOARD_COLUMNS = [
  { key: "PENDING", title: "Pending" },
  { key: "PREPARING", title: "Preparing" },
  { key: "READY", title: "Ready" }
];

const FILTER_OPTIONS = [
  { key: "ALL", label: "All orders" },
  { key: "TABLE", label: "Table" },
  { key: "PICKUP", label: "Pickup" },
  { key: "DELIVERY", label: "Delivery" }
];

export default function KitchenBoard({ groupedOrders, busyOrderId, filterType, onFilterChange, onAction }) {
  const totalVisibleOrders = BOARD_COLUMNS.reduce((total, column) => total + (groupedOrders[column.key] || []).length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Queue</p>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{totalVisibleOrders}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((filter) => {
          const active = filter.key === filterType;

          return (
            <button
              key={filter.key}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] transition sm:px-4 sm:py-2 sm:text-sm",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              ].join(" ")}
              onClick={() => onFilterChange(filter.key)}
              type="button"
            >
              {filter.label}
            </button>
          );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 2xl:grid-cols-3">
        {BOARD_COLUMNS.map((column) => (
          <OrderColumn
            key={column.key}
            busyOrderId={busyOrderId}
            onAction={onAction}
            orders={groupedOrders[column.key] || []}
            status={column.key}
            title={column.title}
          />
        ))}
      </div>
    </div>
  );
}

