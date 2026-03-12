import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import RestaurantLogo from "../components/RestaurantLogo";

const EMPLOYEE_PANELS = {
  chef: {
    title: "Chef Panel",
    subtitle: "See new table orders, prepare them, and mark them ready."
  },
  cashier: {
    title: "Cashier Panel",
    subtitle: "Track ready tables, collect payment, and free the table."
  }
};
const TABLE_STATUS_OPTIONS = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" }
];
const ORDER_STATUS_OPTIONS = {
  chef: {
    PENDING: ["PREPARING"],
    PREPARING: ["READY"]
  }
};
const ORDER_STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-900",
  PREPARING: "bg-sky-100 text-sky-900",
  READY: "bg-emerald-100 text-emerald-900",
  PAID: "bg-slate-200 text-slate-800",
  CANCELLED: "bg-rose-100 text-rose-900"
};

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

function getOrderLink(tableId) {
  if (typeof window === "undefined") {
    return `/order/${tableId}`;
  }
  return `${window.location.origin}/order/${tableId}`;
}

function getQrImageUrl(orderUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(orderUrl)}`;
}

function getTableCardClasses(status) {
  if (status === "AVAILABLE") {
    return "border-green-500 bg-green-100 text-green-900";
  }
  if (status === "RESERVED") {
    return "border-amber-500 bg-amber-100 text-amber-900";
  }
  if (status === "CLEANING") {
    return "border-sky-500 bg-sky-100 text-sky-900";
  }
  return "border-red-500 bg-red-100 text-red-900";
}

function getStatusClass(status) {
  return ORDER_STATUS_STYLES[status] || "bg-slate-100 text-slate-800";
}

function getEmployeePanel(employeeRole) {
  return (
    EMPLOYEE_PANELS[String(employeeRole || "").trim().toLowerCase()] || {
      title: "Employee Panel",
      subtitle: "This account does not have an active workflow."
    }
  );
}

function getNextOrderStatuses(employeeRole, currentStatus) {
  return ORDER_STATUS_OPTIONS[String(employeeRole || "").trim().toLowerCase()]?.[currentStatus] || [];
}

export default function EmployeePage({ session, onLogout }) {
  const [me, setMe] = useState(session.user);
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState("");
  const [updatingTableId, setUpdatingTableId] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [checkoutMethods, setCheckoutMethods] = useState({});
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [checkingOutTableId, setCheckingOutTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const employeeRole = String(me?.employeeRole || "").trim().toLowerCase();
  const isChef = employeeRole === "chef";
  const isCashier = employeeRole === "cashier";
  const panel = getEmployeePanel(me?.employeeRole);
  const restaurantName = me?.restaurant?.name || me?.restaurantName || "Restaurant";
  const restaurantLogoUrl = me?.restaurant?.logoUrl || "";
  const groupedCashierTables = useMemo(() => {
    const map = new Map();

    orders.forEach((order) => {
      if (!order.table) {
        return;
      }

      const current = map.get(order.table.id) || {
        table: order.table,
        orders: [],
        total: 0
      };

      current.orders.push(order);
      current.total += Number(order.total || 0);
      map.set(order.table.id, current);
    });

    return Array.from(map.values());
  }, [orders]);

  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const ordersResult = await apiRequest("/employee/orders", { token: session.token });
      setOrders(ordersResult.orders || []);
    } catch (requestError) {
      setOrdersError(requestError.message);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadTables(nextRole) {
    const cashierMode = String(nextRole || "").trim().toLowerCase() === "cashier";
    if (!cashierMode) {
      setTables([]);
      setTablesError("");
      setTablesLoading(false);
      return;
    }

    setTablesLoading(true);
    setTablesError("");

    try {
      const tablesResult = await apiRequest("/employee/tables", { token: session.token });
      setTables(tablesResult.tables || []);
    } catch (requestError) {
      setTablesError(requestError.message);
    } finally {
      setTablesLoading(false);
    }
  }

  async function loadPayments(nextRole) {
    const cashierMode = String(nextRole || "").trim().toLowerCase() === "cashier";
    if (!cashierMode) {
      setPayments([]);
      setPaymentsError("");
      setPaymentsLoading(false);
      return;
    }

    setPaymentsLoading(true);
    setPaymentsError("");

    try {
      const paymentsResult = await apiRequest("/employee/payments", { token: session.token });
      setPayments(paymentsResult.payments || []);
    } catch (requestError) {
      setPaymentsError(requestError.message);
    } finally {
      setPaymentsLoading(false);
    }
  }

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const result = await apiRequest("/auth/me", { token: session.token });
        const nextUser = result.user;

        setMe(nextUser);
        await Promise.all([loadOrders(), loadTables(nextUser.employeeRole), loadPayments(nextUser.employeeRole)]);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadOrders();
      if (isCashier) {
        loadTables(me?.employeeRole);
        loadPayments(me?.employeeRole);
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [loading, isCashier, me?.employeeRole]);

  async function updateCashierTableStatus(tableId, status) {
    setTablesError("");
    setUpdatingTableId(tableId);

    try {
      const result = await apiRequest(`/employee/tables/${tableId}/status`, {
        method: "PATCH",
        token: session.token,
        body: { status }
      });
      setTables((previous) => previous.map((table) => (table.id === tableId ? result.table : table)));
    } catch (requestError) {
      setTablesError(requestError.message);
    } finally {
      setUpdatingTableId("");
    }
  }

  async function updateOrderStatus(orderId, status) {
    setOrdersError("");
    setCheckoutMessage("");
    setUpdatingOrderId(orderId);

    try {
      const result = await apiRequest(`/employee/orders/${orderId}/status`, {
        method: "PATCH",
        token: session.token,
        body: { status }
      });

      setOrders((previous) => previous.map((order) => (order.id === orderId ? result.order : order)));
      if (isCashier) {
        await loadTables(me?.employeeRole);
      }
    } catch (requestError) {
      setOrdersError(requestError.message);
    } finally {
      setUpdatingOrderId("");
    }
  }

  async function completeCheckout(tableId) {
    setOrdersError("");
    setTablesError("");
    setPaymentsError("");
    setCheckoutMessage("");
    setCheckingOutTableId(tableId);

    try {
      const result = await apiRequest(`/employee/tables/${tableId}/checkout`, {
        method: "POST",
        token: session.token,
        body: {
          paymentMethod: checkoutMethods[tableId] || PAYMENT_METHOD_OPTIONS[0].value
        }
      });

      setCheckoutMessage(
        `${result.table.name} payment received: ${formatPrice(result.total)} via ${result.payment.paymentMethod}. Receipt ${result.payment.receiptCode}.`
      );
      await Promise.all([loadOrders(), loadTables(me?.employeeRole), loadPayments(me?.employeeRole)]);
    } catch (requestError) {
      setOrdersError(requestError.message);
    } finally {
      setCheckingOutTableId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-md">
        <div className="flex items-center gap-4">
          <RestaurantLogo className="h-16 w-16 text-xl" name={restaurantName} src={restaurantLogoUrl} />
          <div>
            <h1 className="text-2xl font-bold text-brand-900">{panel.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{panel.subtitle}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{restaurantName}</p>
          </div>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-md">
        {loading ? <p className="text-sm text-slate-600">Loading profile...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error ? (
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
              <p className="mt-1 font-semibold text-slate-900">{me.fullName}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
              <p className="mt-1 font-semibold text-slate-900">{me.employeeRole || "Employee"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Restaurant</p>
              <div className="mt-2 flex items-center gap-3">
                <RestaurantLogo className="h-12 w-12 text-sm" name={restaurantName} src={restaurantLogoUrl} />
                <p className="font-semibold text-slate-900">{restaurantName || "-"}</p>
              </div>
            </div>
            <div className="rounded-xl bg-brand-50 p-3">
              <p className="text-xs uppercase tracking-wide text-brand-700">
                {isChef ? "Kitchen Queue" : isCashier ? "Ready Tables" : "Status"}
              </p>
              <p className="mt-1 text-xl font-bold text-brand-900">
                {isCashier ? groupedCashierTables.length : orders.length}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {checkoutMessage ? (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {checkoutMessage}
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">{isChef ? "Kitchen Orders" : "Payment Queue"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isChef
                ? "New customer orders appear here as soon as a QR order is sent."
                : "Ready tables appear here for payment collection."}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={loadOrders}
          >
            Refresh
          </button>
        </div>

        {ordersLoading ? <p className="mt-3 text-sm text-slate-600">Loading orders...</p> : null}
        {ordersError ? <p className="mt-3 text-sm text-red-600">{ordersError}</p> : null}

        {!ordersLoading && !ordersError && isChef ? (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {orders.map((order) => {
              const nextStatuses = getNextOrderStatuses(employeeRole, order.status);

              return (
                <article key={order.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{order.orderCode}</p>
                      <h3 className="text-lg font-bold text-slate-900">{order.table?.name || "Table"}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-3">
                    <p>Customer: {order.customerName || "Guest"}</p>
                    <p>Total: {formatPrice(order.total)}</p>
                    <p>Created: {formatDate(order.createdAt)}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.quantity} pcs</p>
                        </div>
                        <p className="font-semibold text-brand-900">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>

                  {nextStatuses.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextStatuses.map((statusOption) => (
                        <button
                          key={statusOption}
                          type="button"
                          disabled={updatingOrderId === order.id}
                          className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                          onClick={() => updateOrderStatus(order.id, statusOption)}
                        >
                          {updatingOrderId === order.id
                            ? "Updating..."
                            : statusOption === "PREPARING"
                              ? "Start preparing"
                              : "Mark ready"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {orders.length === 0 ? <p className="text-sm text-slate-500">No kitchen orders right now.</p> : null}
          </div>
        ) : null}

        {!ordersLoading && !ordersError && isCashier ? (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {groupedCashierTables.map((group) => (
              <article key={group.table.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Ready table</p>
                    <h3 className="text-lg font-bold text-slate-900">{group.table.name}</h3>
                  </div>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
                    {group.orders.length} order
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {group.orders.map((order) => (
                    <div key={order.id} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{order.orderCode}</p>
                          <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm text-slate-700">
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

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total to collect</p>
                    <p className="text-xl font-bold text-brand-900">{formatPrice(group.total)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                      value={checkoutMethods[group.table.id] || PAYMENT_METHOD_OPTIONS[0].value}
                      onChange={(event) =>
                        setCheckoutMethods((previous) => ({
                          ...previous,
                          [group.table.id]: event.target.value
                        }))
                      }
                    >
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={checkingOutTableId === group.table.id}
                      className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                      onClick={() => completeCheckout(group.table.id)}
                    >
                      {checkingOutTableId === group.table.id ? "Processing..." : "Complete payment"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {groupedCashierTables.length === 0 ? (
              <p className="text-sm text-slate-500">No ready tables waiting for payment.</p>
            ) : null}
          </div>
        ) : null}

        {!ordersLoading && !ordersError && !isChef && !isCashier ? (
          <p className="mt-4 text-sm text-slate-500">This employee account does not have an active workflow.</p>
        ) : null}
      </section>

      {isCashier ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-900">Recent Receipts</h2>
            {paymentsLoading ? <p className="text-sm text-slate-500">Refreshing...</p> : null}
          </div>
          {paymentsError ? <p className="mt-3 text-sm text-red-600">{paymentsError}</p> : null}
          {!paymentsError ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2 pr-4">Receipt</th>
                    <th className="py-2 pr-4">Table</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Orders</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{payment.receiptCode}</td>
                      <td className="py-2 pr-4 text-slate-700">{payment.table?.name || "-"}</td>
                      <td className="py-2 pr-4 text-slate-700">{payment.paymentMethod}</td>
                      <td className="py-2 pr-4 text-slate-700">{payment.orders.length}</td>
                      <td className="py-2 pr-4 text-slate-700">{formatPrice(payment.total)}</td>
                      <td className="py-2 pr-4 text-slate-700">{formatDate(payment.createdAt)}</td>
                    </tr>
                  ))}
                  {payments.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={6}>
                        No receipt records yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {isCashier ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-900">Restaurant Tables</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => loadTables(me?.employeeRole)}
            >
              Refresh tables
            </button>
          </div>
          {tablesLoading ? <p className="mt-3 text-sm text-slate-600">Loading tables...</p> : null}
          {tablesError ? <p className="mt-3 text-sm text-red-600">{tablesError}</p> : null}
          {!tablesLoading && !tablesError ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tables.map((table) => {
                const orderLink = getOrderLink(table.id);
                const qrImageUrl = getQrImageUrl(orderLink);

                return (
                  <article
                    key={table.id}
                    className={`rounded-2xl border-2 p-3 shadow-sm ${getTableCardClasses(table.status)}`}
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-bold">{table.name}</p>
                          <p className="text-xs">Seats: {table.seats}</p>
                        </div>
                        <p className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold">{table.status}</p>
                      </div>

                      <div className="mt-3 flex justify-center">
                        <img alt={`QR for ${table.name}`} className="h-24 w-24 rounded-md bg-white p-1" src={qrImageUrl} />
                      </div>

                      <a
                        className="mt-2 truncate text-center text-xs font-medium underline"
                        href={orderLink}
                        rel="noreferrer"
                        target="_blank"
                        title={orderLink}
                      >
                        Open order link
                      </a>

                      <div className="mt-auto pt-2">
                        <select
                          className="w-full rounded-md border border-white/70 bg-white/80 px-2 py-1 text-xs outline-none"
                          value={table.status}
                          disabled={updatingTableId === table.id}
                          onChange={(event) => updateCashierTableStatus(table.id, event.target.value)}
                        >
                          {TABLE_STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {statusOption}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-center text-[10px]">
                          {updatingTableId === table.id ? "Updating..." : "Live status"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
              {tables.length === 0 ? <p className="text-sm text-slate-500">No tables found.</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
