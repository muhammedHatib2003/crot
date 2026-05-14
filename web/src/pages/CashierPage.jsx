import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import { AppShell, MessageBanner, PageHeader, SectionCard, StatusPill, buttonStyles } from "../components/app/AppShell";

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getTableTone(table) {
  return table.isOccupied
    ? "border-rose-300 bg-rose-50 text-rose-950"
    : "border-emerald-300 bg-emerald-50 text-emerald-950";
}

function getTableStatusLabel(table) {
  if (table.readyOrderCount > 0) {
    return `${table.readyOrderCount} ready`;
  }
  if (table.isOccupied) {
    return `${table.activeOrderCount} active`;
  }
  return "empty";
}

export default function CashierPage({ session, onLogout }) {
  const [me, setMe] = useState(session.user);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [openTableId, setOpenTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingOutTableId, setCheckingOutTableId] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const readyOrdersByTable = useMemo(() => {
    const groupedOrders = new Map();

    orders
      .filter((order) => order.orderType === "TABLE" && order.tableId)
      .forEach((order) => {
        const currentOrders = groupedOrders.get(order.tableId) || [];
        groupedOrders.set(order.tableId, [...currentOrders, order]);
      });

    return groupedOrders;
  }, [orders]);
  const openTable = useMemo(() => tables.find((table) => table.id === openTableId) || null, [openTableId, tables]);
  const openTableOrders = useMemo(() => readyOrdersByTable.get(openTableId) || [], [openTableId, readyOrdersByTable]);
  const openTableTotal = useMemo(
    () => openTableOrders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
    [openTableOrders]
  );
  const onlineOrders = useMemo(
    () => orders.filter((order) => order.orderType !== "TABLE"),
    [orders]
  );

  async function loadQueue(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const [tablesResult, ordersResult] = await Promise.all([
        apiRequest("/cashier/tables", { token: session.token }),
        apiRequest("/cashier/orders", { token: session.token })
      ]);

      const nextTables = tablesResult.tables || [];
      setTables(nextTables);
      setOrders(ordersResult.orders || []);
      setOpenTableId((currentTableId) => (nextTables.some((table) => table.id === currentTableId) ? currentTableId : ""));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showRefresh) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError("");

      try {
        const meResult = await apiRequest("/auth/me", { token: session.token });
        setMe(meResult.user);
        const [tablesResult, ordersResult] = await Promise.all([
          apiRequest("/cashier/tables", { token: session.token }),
          apiRequest("/cashier/orders", { token: session.token })
        ]);

        setTables(tablesResult.tables || []);
        setOrders(ordersResult.orders || []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [session.token]);

  useEffect(() => {
    if (!openTableId) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenTableId("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openTableId]);

  async function checkoutTable(tableId, paymentMethod) {
    setCheckingOutTableId(tableId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/cashier/tables/${tableId}/checkout`, {
        method: "POST",
        token: session.token,
        body: {
          paymentMethod
        }
      });

      setMessage(`${result.table.name} payment completed with ${paymentMethod}.`);
      setOpenTableId("");
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCheckingOutTableId("");
    }
  }

  async function updateOrderStatus(orderId, status) {
    setUpdatingOrderId(orderId);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/cashier/orders/${orderId}/status`, {
        method: "PATCH",
        token: session.token,
        body: {
          status
        }
      });

      setMessage("Online order updated.");
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingOrderId("");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Cashier"
          eyebrow="Role"
          description="The dining room stays front and center. Tables use most of the screen, and payment details open in a popup."
          meta={[me.restaurant?.name || me.restaurantName || "Restaurant", me.fullName]}
          actions={
            <>
              <button className={buttonStyles.secondary} disabled={refreshing} onClick={() => loadQueue(true)} type="button">
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button className={buttonStyles.secondary} onClick={onLogout} type="button">
                Logout
              </button>
            </>
          }
        />

        {loading ? (
          <SectionCard>
            <p className="text-sm text-slate-600">Loading cashier tables...</p>
          </SectionCard>
        ) : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}

        {!loading ? (
          <SectionCard
            className="xl:min-h-[78vh]"
            title="Tables"
            description="The cashier view is now focused only on the dining room. Click any table to open its payment popup."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-5">
              {tables.map((table) => (
                <button
                  key={table.id}
                  className={`cashier-table-card aspect-square rounded-[28px] border p-4 text-left shadow-sm ${getTableTone(table)} ${
                    table.readyOrderCount > 0 ? "cashier-table-card--ready" : ""
                  } ${openTableId === table.id ? "ring-2 ring-slate-950" : ""}`}
                  onClick={() => {
                    setOpenTableId(table.id);
                    setError("");
                    setMessage("");
                  }}
                  type="button"
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold">{table.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em]">{getTableStatusLabel(table)}</p>
                      </div>
                      {table.readyOrderCount > 0 ? <span className="cashier-ready-dot mt-1" /> : null}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] opacity-70">Due now</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {table.totalDue > 0 ? formatPrice(table.totalDue) : table.isOccupied ? "Waiting" : formatPrice(0)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {!loading ? (
          <SectionCard
            title="Online orders"
            description="Pickup and delivery orders that reached cashier queue."
          >
            {onlineOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No online orders in cashier queue.</p>
            ) : (
              <div className="space-y-3">
                {onlineOrders.map((order) => (
                  <article key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500">{order.orderCode}</p>
                        <p className="font-semibold text-slate-900">{order.orderType}</p>
                        <p className="text-sm text-slate-600">
                          {order.customerName || "Customer"} {order.customerPhone ? `- ${order.customerPhone}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">{order.status}</p>
                        <p className="text-lg font-semibold text-slate-900">{formatPrice(order.totalPrice)}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                          {item.quantity} x {item.name}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <button
                        className={buttonStyles.primary}
                        disabled={updatingOrderId === order.id}
                        onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                        type="button"
                      >
                        {updatingOrderId === order.id ? "Updating..." : "Complete online order"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        ) : null}

        {openTable ? (
          <div className="cashier-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <button aria-label="Close payment popup" className="absolute inset-0" onClick={() => setOpenTableId("")} type="button" />
            <div className="cashier-modal-panel relative w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.32)] ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(52,211,153,0.18),_transparent_38%),white] px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Table payment</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">{openTable.name}</h2>
                    <p className="mt-2 text-sm text-slate-600">Review the current table and finish checkout from this popup.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={openTable.readyOrderCount > 0 ? "warning" : openTable.isOccupied ? "danger" : "success"}>
                      {openTable.readyOrderCount > 0 ? "Ready to pay" : openTable.isOccupied ? "Occupied" : "Empty"}
                    </StatusPill>
                    <button className={buttonStyles.secondary} onClick={() => setOpenTableId("")} type="button">
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{openTable.isOccupied ? "Occupied" : "Empty"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Ready orders</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{openTableOrders.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Due now</p>
                    <p className="cashier-total-pop mt-2 text-2xl font-semibold text-slate-950">{formatPrice(openTableTotal)}</p>
                  </div>
                </div>

                {openTableOrders.length > 0 ? (
                  <>
                    <div className="mt-5 max-h-[44vh] space-y-3 overflow-y-auto pr-1">
                      {openTableOrders.map((order) => (
                        <article key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{order.orderCode}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{order.source}</p>
                            </div>
                            <p className="text-lg font-semibold text-slate-950">{formatPrice(order.totalPrice)}</p>
                          </div>

                          <div className="mt-3 space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
                                <p className="font-medium text-slate-900">
                                  {item.quantity} x {item.name}
                                </p>
                                {item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                      <button
                        className={`${buttonStyles.secondary} cashier-payment-button min-w-[170px] px-5 py-3`}
                        disabled={checkingOutTableId === openTable.id}
                        onClick={() => checkoutTable(openTable.id, "CARD")}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-700 animate-pulse" />
                          {checkingOutTableId === openTable.id ? "Processing..." : "Pay with Card"}
                        </span>
                      </button>
                      <button
                        className={`${buttonStyles.primary} cashier-payment-button min-w-[170px] px-5 py-3`}
                        disabled={checkingOutTableId === openTable.id}
                        onClick={() => checkoutTable(openTable.id, "CASH")}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-white/90 animate-pulse" />
                          {checkingOutTableId === openTable.id ? "Processing..." : "Pay with Cash"}
                        </span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {openTable.isOccupied
                      ? "This table is still active, but no dine-in order is ready for payment yet."
                      : "This table is empty."}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
