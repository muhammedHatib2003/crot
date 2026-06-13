import { useMemo } from "react";
import useAppTranslation from "../../hooks/useAppTranslation";
import { translateOrderStatus } from "../../utils/locale";
import OrderColumn from "./OrderColumn";

export default function KitchenBoard({ groupedOrders, busyOrderId, filterType, onFilterChange, onAction, onPrint, onCancel }) {
  const { t } = useAppTranslation();

  const boardColumns = useMemo(
    () => [
      { key: "PENDING", title: translateOrderStatus(t, "PENDING") },
      { key: "PREPARING", title: translateOrderStatus(t, "PREPARING") },
      { key: "READY", title: translateOrderStatus(t, "READY") }
    ],
    [t]
  );

  const filterOptions = useMemo(
    () => [
      { key: "ALL", label: t("kitchen.allOrders") },
      { key: "TABLE", label: t("kitchen.dineIn") },
      { key: "PICKUP", label: t("kitchen.pickup") },
      { key: "DELIVERY", label: t("kitchen.online") }
    ],
    [t]
  );

  const totalVisibleOrders = boardColumns.reduce((total, column) => total + (groupedOrders[column.key] || []).length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("kitchen.column.orders")}</p>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{totalVisibleOrders}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => {
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
        {boardColumns.map((column) => (
          <OrderColumn
            key={column.key}
            busyOrderId={busyOrderId}
            onAction={onAction}
            onCancel={onCancel}
            onPrint={onPrint}
            orders={groupedOrders[column.key] || []}
            status={column.key}
            title={column.title}
          />
        ))}
      </div>
    </div>
  );
}
