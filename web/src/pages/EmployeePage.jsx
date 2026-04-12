import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import {
  AppShell,
  MessageBanner,
  MetricGrid,
  PageHeader,
  SectionCard as SectionShell,
  buttonStyles
} from "../components/app/AppShell";

const ORDER_STATUS_OPTIONS = {
  chef: {
    PENDING: ["ACCEPTED"],
    ACCEPTED: ["PREPARING"],
    PREPARING: ["READY"]
  }
};
const PAYMENT_METHOD_OPTIONS = ["CASH", "CARD"];
const PANEL_COPY = {
  chef: {
    title: "Chef Panel",
    subtitle: "Kitchen queue, preparing flow, ready status, and order details."
  },
  cashier: {
    title: "Cashier Panel",
    subtitle: "Pickup handoff, served-table checkout, payment methods, and receipts."
  }
};
const KITCHEN_BOARD_STAGES = [
  {
    id: "PENDING",
    label: "Incoming",
    description: "New orders waiting for kitchen acceptance.",
    accent: "from-amber-100 to-white",
    badge: "bg-amber-100 text-amber-900"
  },
  {
    id: "ACCEPTED",
    label: "Accepted",
    description: "Confirmed orders queued for preparation.",
    accent: "from-violet-100 to-white",
    badge: "bg-violet-100 text-violet-900"
  },
  {
    id: "PREPARING",
    label: "Preparing",
    description: "Orders currently active on the line.",
    accent: "from-sky-100 to-white",
    badge: "bg-sky-100 text-sky-900"
  },
  {
    id: "READY",
    label: "Ready",
    description: "Finished orders waiting for pickup or payment.",
    accent: "from-emerald-100 to-white",
    badge: "bg-emerald-100 text-emerald-900"
  }
];

function formatPrice(price) {
  return `$${Number(price || 0).toFixed(2)}`;
}

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatQuantity(quantity, unit = "") {
  const normalized = Number(quantity || 0);
  const formatted = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(3).replace(/\.?0+$/, "");
  return unit ? `${formatted} ${unit}` : formatted;
}

function getStatusClass(status) {
  const map = {
    PENDING: "bg-amber-50 text-amber-700",
    ACCEPTED: "bg-violet-50 text-violet-700",
    PREPARING: "bg-sky-50 text-sky-700",
    READY: "bg-emerald-50 text-emerald-700",
    COMPLETED: "bg-slate-100 text-slate-700",
    CANCELLED: "bg-rose-50 text-rose-700"
  };

  return map[status] || "bg-slate-100 text-slate-700";
}

function getTableStatusClass(status, hasPaymentDue = false) {
  if (hasPaymentDue) {
    return {
      card: "bg-amber-50 ring-amber-200 hover:ring-amber-300",
      badge: "bg-amber-100 text-amber-800"
    };
  }

  const map = {
    AVAILABLE: {
      card: "bg-emerald-50 ring-emerald-200 hover:ring-emerald-300",
      badge: "bg-emerald-100 text-emerald-800"
    },
    OCCUPIED: {
      card: "bg-amber-50 ring-amber-200 hover:ring-amber-300",
      badge: "bg-amber-100 text-amber-800"
    },
    RESERVED: {
      card: "bg-sky-50 ring-sky-200 hover:ring-sky-300",
      badge: "bg-sky-100 text-sky-800"
    },
    CLEANING: {
      card: "bg-slate-100 ring-slate-200 hover:ring-slate-300",
      badge: "bg-slate-200 text-slate-700"
    }
  };

  return map[status] || map.CLEANING;
}

function StatIcon({ children }) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

function renderOrderErrorDetails(details) {
  if (Array.isArray(details?.shortages) && details.shortages.length > 0) {
    return (
      <ul className="mt-2 space-y-1 text-xs text-red-700">
        {details.shortages.map((shortage) => (
          <li key={shortage.ingredientId}>
            {shortage.ingredientName}: need {formatQuantity(shortage.requiredQuantity, shortage.unit)}, have{" "}
            {formatQuantity(shortage.currentStock, shortage.unit)}
          </li>
        ))}
      </ul>
    );
  }

  if (Array.isArray(details?.menuItems) && details.menuItems.length > 0) {
    return (
      <ul className="mt-2 space-y-1 text-xs text-red-700">
        {details.menuItems.map((menuItem) => (
          <li key={menuItem}>{menuItem} has no recipe configured yet.</li>
        ))}
      </ul>
    );
  }

  return null;
}

function OrderCard({ order, role, updatingOrderId, onUpdateOrder }) {
  const nextStatuses = ORDER_STATUS_OPTIONS[role]?.[order.status] || [];

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{order.orderCode}</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {order.table?.name || (order.orderType === "PICKUP" ? "Pickup order" : "Order")}
          </h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusClass(order.status)}`}>
          {order.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Type</p>
          <p className="mt-1 font-semibold text-slate-900">{order.orderType === "PICKUP" ? "Pickup" : "Dine-in"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Customer</p>
          <p className="mt-1 truncate font-semibold text-slate-900">{order.customerName || "Guest"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Phone</p>
          <p className="mt-1 font-semibold text-slate-900">{order.customerPhone || "-"}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-3 py-2 text-white">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">Total</p>
          <p className="mt-1 font-semibold">{formatPrice(order.total)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.quantity} pcs</p>
            </div>
            <p className="font-semibold text-brand-900">{formatPrice(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Created {formatDate(order.createdAt)}</p>

      {role === "chef" && nextStatuses.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {nextStatuses.map((statusOption) => (
            <button
              key={statusOption}
              type="button"
              disabled={updatingOrderId === order.id}
              className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
              onClick={() => onUpdateOrder(order.id, statusOption)}
            >
              {updatingOrderId === order.id
                ? "Updating..."
                : statusOption === "ACCEPTED"
                  ? "Accept order"
                  : statusOption === "PREPARING"
                    ? "Start preparing"
                    : "Mark ready"}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function EmployeePage({ session, onLogout }) {
  const [me, setMe] = useState(session.user);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersErrorDetails, setOrdersErrorDetails] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [tablesError, setTablesError] = useState("");
  const [checkoutMethods, setCheckoutMethods] = useState({});
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [checkingOutTableId, setCheckingOutTableId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const employeeRole = String(me?.employeeRole || "").trim().toLowerCase();
  const isChef = employeeRole === "chef";
  const isCashier = employeeRole === "cashier";
  const panel = PANEL_COPY[employeeRole] || {
    title: "Employee Panel",
    subtitle: "This account does not have an active workflow."
  };
  const restaurantName = me?.restaurant?.name || me?.restaurantName || "Restaurant";
  const restaurantLogoUrl = me?.restaurant?.logoUrl || "";
  const basePath = isChef ? "/kitchen" : "/payment";

  const readyPickupOrders = useMemo(
    () => orders.filter((order) => order.orderType === "PICKUP" && order.status === "READY" && !order.table),
    [orders]
  );
  const readyDineInGroups = useMemo(() => {
    const map = new Map();

    orders.forEach((order) => {
      if (order.orderType !== "DINE_IN" || !["READY", "SERVED"].includes(order.status) || !order.table) {
        return;
      }

      const current =
        map.get(order.table.id) || { table: order.table, total: 0, orders: [], readyOrders: 0, servedOrders: 0 };
      current.orders.push(order);
      current.total += Number(order.total || 0);
      if (order.status === "READY") {
        current.readyOrders += 1;
      }
      if (order.status === "SERVED") {
        current.servedOrders += 1;
      }
      map.set(order.table.id, current);
    });

    return Array.from(map.values());
  }, [orders]);
  const cashierTables = useMemo(
    () =>
      tables.map((table) => {
        const paymentGroup = readyDineInGroups.find((group) => group.table.id === table.id) || null;
        const activeTableOrders = orders.filter((order) => order.table?.id === table.id);
        const readyCount = activeTableOrders.filter((order) => order.status === "READY").length;
        const servedCount = activeTableOrders.filter((order) => order.status === "SERVED").length;

        return {
          ...table,
          paymentGroup,
          orderCount: activeTableOrders.length,
          readyCount,
          servedCount
        };
      }),
    [orders, readyDineInGroups, tables]
  );
  const selectedCashierTable = useMemo(
    () => cashierTables.find((table) => table.id === selectedTableId) || null,
    [cashierTables, selectedTableId]
  );
  const kitchenBoard = useMemo(
    () =>
      KITCHEN_BOARD_STAGES.map((stage) => ({
        ...stage,
        orders: orders.filter((order) => order.status === stage.id)
      })),
    [orders]
  );
  const summaryMetrics = useMemo(() => {
    if (isChef) {
      return [
        {
          label: "Queue",
          value: orders.length,
          detail: "Kitchen tickets",
          trend: orders.length > 0 ? `${orders.length} live` : "Idle",
          iconTone: "bg-slate-100 text-slate-600",
          icon: (
            <StatIcon>
              <path d="M8 7h8M8 12h8m-8 5h5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              <path d="M6 3h12a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </StatIcon>
          )
        },
        {
          label: "Incoming",
          value: kitchenBoard.find((stage) => stage.id === "PENDING")?.orders.length || 0,
          detail: "Awaiting acceptance",
          iconTone: "bg-amber-50 text-amber-700",
          icon: (
            <StatIcon>
              <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </StatIcon>
          )
        },
        {
          label: "Preparing",
          value: kitchenBoard.find((stage) => stage.id === "PREPARING")?.orders.length || 0,
          detail: "On the line",
          iconTone: "bg-sky-50 text-sky-700",
          icon: (
            <StatIcon>
              <path d="M5 12h14M12 5v14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </StatIcon>
          )
        },
        {
          label: "Ready",
          value: kitchenBoard.find((stage) => stage.id === "READY")?.orders.length || 0,
          detail: "Ready for handoff",
          iconTone: "bg-emerald-50 text-emerald-700",
          icon: (
            <StatIcon>
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </StatIcon>
          )
        }
      ];
    }

    return [
      {
        label: "Pickup Queue",
        value: readyPickupOrders.length,
        detail: "Ready pickup",
        trend: readyPickupOrders.length > 0 ? `${readyPickupOrders.length} waiting` : "Clear",
        iconTone: "bg-slate-100 text-slate-600",
        icon: (
          <StatIcon>
            <path d="M4 7h16M7 12h10M9 17h6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </StatIcon>
        )
      },
      {
        label: "Checkout Tables",
        value: readyDineInGroups.length,
        detail: "Tables to collect",
        trend: readyDineInGroups.length > 0 ? `${readyDineInGroups.length} open` : "Settled",
        iconTone: "bg-amber-50 text-amber-700",
        icon: (
          <StatIcon>
            <path d="M4 11h16M7 11V6m10 5V6M6 20v-5m12 5v-5M9 6h6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </StatIcon>
        )
      },
      {
        label: "Receipts",
        value: payments.length,
        detail: "Recent payments",
        trend: payments.length > 0 ? `${payments.length} logged` : "No receipts",
        iconTone: "bg-emerald-50 text-emerald-700",
        icon: (
          <StatIcon>
            <path d="M7 4h10v16l-5-2-5 2V4Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </StatIcon>
        )
      }
    ];
  }, [isChef, kitchenBoard, orders.length, payments.length, readyDineInGroups.length, readyPickupOrders.length]);

  async function loadOrders(nextRole = me?.employeeRole) {
    const role = String(nextRole || "").trim().toLowerCase();
    if (!["chef", "cashier"].includes(role)) {
      setOrders([]);
      return;
    }

    setOrdersLoading(true);
    setOrdersError("");
    setOrdersErrorDetails(null);

    try {
      const result = await apiRequest(`${role === "chef" ? "/kitchen" : "/payment"}/orders`, { token: session.token });
      setOrders(result.orders || []);
    } catch (requestError) {
      setOrdersError(requestError.message);
      setOrdersErrorDetails(requestError.details || null);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadCashierData(nextRole = me?.employeeRole) {
    if (String(nextRole || "").trim().toLowerCase() !== "cashier") {
      setPayments([]);
      setTables([]);
      return;
    }

    setPaymentsLoading(true);
    setPaymentsError("");
    setTablesError("");

    try {
      const [paymentsResult, tablesResult] = await Promise.all([
        apiRequest("/payment/payments", { token: session.token }),
        apiRequest("/payment/tables", { token: session.token })
      ]);
      setPayments(paymentsResult.payments || []);
      setTables(tablesResult.tables || []);
    } catch (requestError) {
      setPaymentsError(requestError.message);
      setTablesError(requestError.message);
    } finally {
      setPaymentsLoading(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError("");

      try {
        const result = await apiRequest("/auth/me", { token: session.token });
        setMe(result.user);
        await Promise.all([loadOrders(result.user.employeeRole), loadCashierData(result.user.employeeRole)]);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadOrders(me?.employeeRole);
      if (isCashier) {
        loadCashierData(me?.employeeRole);
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [loading, isCashier, me?.employeeRole]);

  useEffect(() => {
    if (!isCashier) {
      return;
    }

    if (cashierTables.length === 0) {
      if (selectedTableId) {
        setSelectedTableId("");
      }
      return;
    }

    if (cashierTables.some((table) => table.id === selectedTableId)) {
      return;
    }

    const nextSelectedTableId =
      cashierTables.find((table) => table.paymentGroup)?.id ||
      cashierTables.find((table) => table.status === "OCCUPIED")?.id ||
      cashierTables[0]?.id ||
      "";

    setSelectedTableId(nextSelectedTableId);
  }, [cashierTables, isCashier, selectedTableId]);

  async function updateOrderStatus(orderId, status) {
    setUpdatingOrderId(orderId);
    setOrdersError("");
    setOrdersErrorDetails(null);
    setCheckoutMessage("");

    try {
      const result = await apiRequest(`${basePath}/orders/${orderId}/status`, {
        method: "PATCH",
        token: session.token,
        body: { status }
      });

      setOrders((previous) =>
        previous.flatMap((order) => (order.id === orderId && ["COMPLETED", "CANCELLED"].includes(result.order.status) ? [] : order.id === orderId ? [result.order] : [order]))
      );

      if (isCashier) {
        await loadCashierData(me?.employeeRole);
      }
    } catch (requestError) {
      setOrdersError(requestError.message);
      setOrdersErrorDetails(requestError.details || null);
    } finally {
      setUpdatingOrderId("");
    }
  }

  async function completeCheckout(tableId) {
    setCheckingOutTableId(tableId);
    setCheckoutMessage("");
    setOrdersError("");

    try {
      const result = await apiRequest(`/payment/tables/${tableId}/checkout`, {
        method: "POST",
        token: session.token,
        body: {
          paymentMethod: checkoutMethods[tableId] || PAYMENT_METHOD_OPTIONS[0]
        }
      });

      setCheckoutMessage(
        `${result.table.name} payment received: ${formatPrice(result.total)} via ${result.payment.paymentMethod}. Receipt ${result.payment.receiptCode}.`
      );
      await Promise.all([loadOrders(me?.employeeRole), loadCashierData(me?.employeeRole)]);
    } catch (requestError) {
      setOrdersError(requestError.message);
    } finally {
      setCheckingOutTableId("");
    }
  }

  function renderChefBoard() {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {kitchenBoard.map((stage) => (
          <article key={stage.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-950">{stage.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{stage.description}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                {stage.orders.length}
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {stage.orders.map((order) => (
                <OrderCard key={order.id} onUpdateOrder={updateOrderStatus} order={order} role="chef" updatingOrderId={updatingOrderId} />
              ))}
              {stage.orders.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-500">
                  No orders in this stage.
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  function renderCashierQueue() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Dining tables</h3>
                <p className="mt-1 text-sm text-slate-500">Tap a table to inspect its current state or complete payment.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {cashierTables.length} tables
              </span>
            </div>

            {tablesError ? <MessageBanner tone="error">{tablesError}</MessageBanner> : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cashierTables.map((table) => {
                const tone = getTableStatusClass(table.status, Boolean(table.paymentGroup));
                const isSelected = table.id === selectedTableId;

                return (
                  <button
                    key={table.id}
                    className={`rounded-[24px] px-4 py-4 text-left shadow-sm ring-1 transition ${
                      tone.card
                    } ${isSelected ? "ring-2 ring-brand-500 shadow-md" : ""}`}
                    onClick={() => setSelectedTableId(table.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-950">{table.name}</p>
                        <p className="mt-1 text-xs text-slate-600">{table.seats} seats</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}>
                        {table.paymentGroup ? "payment due" : table.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white/70 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Orders</p>
                        <p className="mt-1 text-base font-semibold text-slate-950">{table.orderCount}</p>
                      </div>
                      <div className="rounded-2xl bg-white/70 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Ready</p>
                        <p className="mt-1 text-base font-semibold text-emerald-700">{table.readyCount}</p>
                      </div>
                      <div className="rounded-2xl bg-white/70 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">Served</p>
                        <p className="mt-1 text-base font-semibold text-amber-700">{table.servedCount}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700">
                        {table.paymentGroup ? "Ready to checkout" : "No payment pending"}
                      </span>
                      <span className="font-semibold text-slate-950">
                        {table.paymentGroup ? formatPrice(table.paymentGroup.total) : "-"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {cashierTables.length === 0 ? (
                <div className="col-span-full rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
                  No tables found.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            {selectedCashierTable ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Selected table</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">{selectedCashierTable.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedCashierTable.seats} seats</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      getTableStatusClass(selectedCashierTable.status, Boolean(selectedCashierTable.paymentGroup)).badge
                    }`}
                  >
                    {selectedCashierTable.paymentGroup ? "payment due" : selectedCashierTable.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Orders</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{selectedCashierTable.orderCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Status</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{selectedCashierTable.status}</p>
                  </div>
                </div>

                {selectedCashierTable.paymentGroup ? (
                  <>
                    <div className="space-y-3">
                      {selectedCashierTable.paymentGroup.orders.map((order) => (
                        <div key={order.id} className="rounded-[20px] bg-slate-50 p-3 text-sm text-slate-700">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900">{order.orderCode}</span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusClass(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3">
                                <span>
                                  {item.quantity} x {item.name}
                                </span>
                                <span>{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Total to collect</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{formatPrice(selectedCashierTable.paymentGroup.total)}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <select
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
                        value={checkoutMethods[selectedCashierTable.id] || PAYMENT_METHOD_OPTIONS[0]}
                        onChange={(event) =>
                          setCheckoutMethods((previous) => ({
                            ...previous,
                            [selectedCashierTable.id]: event.target.value
                          }))
                        }
                      >
                        {PAYMENT_METHOD_OPTIONS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={checkingOutTableId === selectedCashierTable.id}
                        className={buttonStyles.primary}
                        onClick={() => completeCheckout(selectedCashierTable.id)}
                      >
                        {checkingOutTableId === selectedCashierTable.id ? "Processing..." : "Complete payment"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
                    This table does not have any ready or served dine-in orders waiting for payment.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
                Select a table to view its current state.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">Ready pickup</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {readyPickupOrders.length} waiting
            </span>
          </div>

          {readyPickupOrders.map((order) => (
            <article key={order.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{order.orderCode}</p>
                  <h3 className="mt-2 text-base font-bold text-slate-900">{order.customerName || "Pickup customer"}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusClass(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2.5 text-sm">
                    <span className="font-medium text-slate-900">
                      {item.quantity} x {item.name}
                    </span>
                    <span className="text-slate-700">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={updatingOrderId === order.id}
                  className={buttonStyles.primary}
                  onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                >
                  {updatingOrderId === order.id ? "Updating..." : "Mark picked up"}
                </button>
              </div>
            </article>
          ))}
          {readyPickupOrders.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
              No ready pickup orders waiting.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <button
                className={buttonStyles.secondary}
                onClick={() => {
                  loadOrders(me?.employeeRole);
                  if (isCashier) {
                    loadCashierData(me?.employeeRole);
                  }
                }}
                type="button"
              >
                Refresh
              </button>
              <button className={buttonStyles.secondary} onClick={onLogout} type="button">
                Logout
              </button>
            </>
          }
          description={panel.subtitle}
          eyebrow={isChef ? "Kitchen" : "Cashier"}
          meta={[restaurantName, me.fullName, me.employeeRole || "employee"]}
          title={panel.title}
        />

        {!loading ? <MetricGrid items={summaryMetrics} variant="compact" /> : null}
        {loading ? <SectionShell><p className="text-sm text-slate-600">Loading profile...</p></SectionShell> : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {checkoutMessage ? <MessageBanner tone="success">{checkoutMessage}</MessageBanner> : null}

        {!isCashier ? (
          <SectionShell title="Kitchen queue">
            {ordersLoading ? <p className="text-sm text-slate-600">Loading orders...</p> : null}
            {ordersError ? (
              <MessageBanner tone="error">
                <p>{ordersError}</p>
                {renderOrderErrorDetails(ordersErrorDetails)}
              </MessageBanner>
            ) : null}
            {!ordersLoading && !ordersError ? renderChefBoard() : null}
          </SectionShell>
        ) : null}

        {isCashier ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <SectionShell title="Payment queue">
              {ordersLoading ? <p className="text-sm text-slate-600">Loading orders...</p> : null}
              {ordersError ? (
                <MessageBanner tone="error">
                  <p>{ordersError}</p>
                  {renderOrderErrorDetails(ordersErrorDetails)}
                </MessageBanner>
              ) : null}
              {!ordersLoading && !ordersError ? renderCashierQueue() : null}
            </SectionShell>

            <SectionShell
              actions={paymentsLoading ? <span className="text-sm text-slate-500">Refreshing...</span> : null}
              title="Recent receipts"
            >
              {paymentsError ? <MessageBanner tone="error">{paymentsError}</MessageBanner> : null}
              {!paymentsError ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        <th className="pb-3 pr-4 font-semibold">Receipt</th>
                        <th className="pb-3 pr-4 font-semibold">Table</th>
                        <th className="pb-3 pr-4 font-semibold">Method</th>
                        <th className="pb-3 pr-4 font-semibold">Orders</th>
                        <th className="pb-3 pr-4 font-semibold">Total</th>
                        <th className="pb-3 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="even:bg-slate-50/60">
                          <td className="py-4 pr-4 font-semibold text-slate-950">{payment.receiptCode}</td>
                          <td className="py-4 pr-4 text-slate-700">{payment.table?.name || "-"}</td>
                          <td className="py-4 pr-4 text-slate-700">{payment.paymentMethod}</td>
                          <td className="py-4 pr-4 text-slate-700">{payment.orders.length}</td>
                          <td className="py-4 pr-4 font-medium text-slate-900">{formatPrice(payment.total)}</td>
                          <td className="py-4 text-slate-700">{formatDate(payment.createdAt)}</td>
                        </tr>
                      ))}
                      {payments.length === 0 ? (
                        <tr>
                          <td className="py-6 text-slate-500" colSpan={6}>
                            No receipt records yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </SectionShell>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
