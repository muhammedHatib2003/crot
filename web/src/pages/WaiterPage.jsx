import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import { AppShell, MessageBanner, PageHeader, SectionCard, StatusPill, buttonStyles } from "../components/app/AppShell";

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function createDraftId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDraftFromOrder(order) {
  if (!order) {
    return [];
  }

  return order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    notes: item.notes || ""
  }));
}

function hasReadyOrder(table) {
  return (table?.activeOrders || []).some((order) => order.status === "READY");
}

function getTableTone(table) {
  return table.pendingOrder || table.activeOrderCount > 0 || table.isOccupied
    ? "border-rose-300 bg-rose-50 text-rose-950"
    : "border-emerald-300 bg-emerald-50 text-emerald-950";
}

function getTableStatusLabel(table) {
  if (hasReadyOrder(table)) {
    return "READY";
  }
  if (table.pendingOrder) {
    return table.pendingOrder.status || "PENDING";
  }
  if ((table?.activeOrders || []).some((order) => order.status === "PREPARING")) {
    return "PREPARING";
  }
  if (table.isOccupied) {
    return "OCCUPIED";
  }
  return "AVAILABLE";
}

function getStatusTone(status) {
  if (status === "READY") {
    return "bg-amber-100 text-amber-900";
  }
  if (status === "PREPARING") {
    return "bg-sky-100 text-sky-900";
  }
  return "bg-slate-100 text-slate-700";
}

function getSeenActionStyles(waiterSeenAt) {
  return waiterSeenAt
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100";
}

function formatSeenTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function WaiterPage({ session, onLogout }) {
  const [me, setMe] = useState(session.user);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [openTableId, setOpenTableId] = useState("");
  const [draftItems, setDraftItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [seeingOrderId, setSeeingOrderId] = useState("");
  const [payingOrderId, setPayingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const openTable = useMemo(() => tables.find((table) => table.id === openTableId) || null, [openTableId, tables]);
  const pendingOrder = openTable?.pendingOrder || null;
  const activeOrders = useMemo(
    () => (openTable?.activeOrders || []).filter((order) => order.id !== pendingOrder?.id),
    [openTable?.activeOrders, pendingOrder?.id]
  );
  const draftTotal = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return sum + (product ? Number(product.price || 0) * Number(item.quantity || 0) : 0);
      }, 0),
    [draftItems, products]
  );
  const floorSummary = useMemo(() => {
    const occupiedTables = tables.filter((table) => table.isOccupied).length;
    const readyTables = tables.filter((table) => hasReadyOrder(table)).length;

    return {
      totalTables: tables.length,
      occupiedTables,
      readyTables,
      productsCount: products.length
    };
  }, [products.length, tables]);

  function syncDraftForTable(nextTableId, nextTables = tables) {
    const nextTable = nextTables.find((table) => table.id === nextTableId);
    setDraftItems(buildDraftFromOrder(nextTable?.pendingOrder));
  }

  function closePopup() {
    setOpenTableId("");
    setDraftItems([]);
  }

  function openPopup(tableId) {
    setOpenTableId(tableId);
    syncDraftForTable(tableId);
    setError("");
    setMessage("");
  }

  async function loadData(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const [tablesResult, productsResult] = await Promise.all([
        apiRequest("/waiter/tables", { token: session.token }),
        apiRequest("/waiter/products", { token: session.token })
      ]);

      const nextTables = tablesResult.tables || [];
      setTables(nextTables);
      setProducts(productsResult.products || []);

      const nextOpenTableId = nextTables.find((table) => table.id === openTableId)?.id || "";
      setOpenTableId(nextOpenTableId);
      setDraftItems(buildDraftFromOrder(nextTables.find((table) => table.id === nextOpenTableId)?.pendingOrder));
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
        const [tablesResult, productsResult] = await Promise.all([
          apiRequest("/waiter/tables", { token: session.token }),
          apiRequest("/waiter/products", { token: session.token })
        ]);

        setTables(tablesResult.tables || []);
        setProducts(productsResult.products || []);
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
        closePopup();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openTableId]);

  function addProduct(product) {
    setDraftItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.productId === product.id && !item.notes);
      if (existingItem) {
        return currentItems.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                quantity: item.quantity + 1
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          id: createDraftId(),
          productId: product.id,
          name: product.name,
          quantity: 1,
          notes: ""
        }
      ];
    });
  }

  function updateDraftItem(draftItemId, quantity) {
    if (quantity <= 0) {
      setDraftItems((currentItems) => currentItems.filter((item) => item.id !== draftItemId));
      return;
    }

    setDraftItems((currentItems) =>
      currentItems.map((item) => (item.id === draftItemId ? { ...item, quantity } : item))
    );
  }

  async function saveOrder() {
    if (!openTable) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (draftItems.length === 0 && pendingOrder) {
        await apiRequest(`/waiter/orders/${pendingOrder.id}`, {
          method: "DELETE",
          token: session.token
        });
        setMessage("Pending order removed.");
      } else if (draftItems.length === 0) {
        setError("Add at least one item before saving.");
        return;
      } else if (pendingOrder) {
        await apiRequest(`/waiter/orders/${pendingOrder.id}`, {
          method: "PUT",
          token: session.token,
          body: {
            items: draftItems
          }
        });
        setMessage("Order updated.");
      } else {
        await apiRequest("/waiter/orders", {
          method: "POST",
          token: session.token,
          body: {
            tableId: openTable.id,
            items: draftItems
          }
        });
        setMessage("Order created.");
      }

      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(orderId) {
    setPayingOrderId(orderId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/waiter/orders/${orderId}/status`, {
        method: "PATCH",
        token: session.token,
        body: {
          status: "PAID"
        }
      });

      setMessage(`${result.order.orderCode} marked as paid.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPayingOrderId("");
    }
  }

  async function markSeen(orderId) {
    setSeeingOrderId(orderId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/waiter/orders/${orderId}/seen`, {
        method: "PATCH",
        token: session.token
      });

      setMessage(`${result.order.orderCode} waiter marked as seen.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSeeingOrderId("");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Waiter"
          eyebrow="Role"
          description="Tables now own the screen. Click any table to open the service popup and handle orders there."
          meta={[me.restaurant?.name || me.restaurantName || "Restaurant", me.fullName]}
          actions={
            <>
              <button className={buttonStyles.secondary} disabled={refreshing} onClick={() => loadData(true)} type="button">
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
            <p className="text-sm text-slate-600">Loading tables...</p>
          </SectionCard>
        ) : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}
        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}

        {!loading ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,4fr)_minmax(260px,1fr)]">
            <SectionCard
              className="xl:min-h-[74vh]"
              title="Tables"
              description="The floor takes about 80% of the UI now. Click a table to open its order popup."
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-5">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    className={`cashier-table-card aspect-square rounded-[28px] border p-4 text-left shadow-sm ${getTableTone(table)} ${
                      hasReadyOrder(table) ? "cashier-table-card--ready" : ""
                    } ${openTableId === table.id ? "ring-2 ring-slate-950" : ""}`}
                    onClick={() => openPopup(table.id)}
                    type="button"
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-semibold">{table.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em]">{getTableStatusLabel(table)}</p>
                        </div>
                        {hasReadyOrder(table) ? <span className="cashier-ready-dot mt-1" /> : null}
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] opacity-70">Service</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {getTableStatusLabel(table)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard title="Service lane" description="The side rail stays small so the tables remain primary.">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Tables</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">{floorSummary.totalTables}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-rose-700">Busy</p>
                      <p className="mt-2 text-2xl font-semibold text-rose-950">{floorSummary.occupiedTables}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Ready</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-950">{floorSummary.readyTables}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Products loaded</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{floorSummary.productsCount}</p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {openTable ? (
          <div className="cashier-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <button aria-label="Close table popup" className="absolute inset-0" onClick={closePopup} type="button" />
            <div className="cashier-modal-panel relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.32)] ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_38%),white] px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Table service</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">{openTable.name}</h2>
                    <p className="mt-2 text-sm text-slate-600">Add products, update the pending order, and close ready tickets from this popup.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={hasReadyOrder(openTable) ? "warning" : openTable.isOccupied ? "danger" : "success"}>
                      {hasReadyOrder(openTable) ? "Ready on table" : openTable.isOccupied ? "Occupied" : "Empty"}
                    </StatusPill>
                    <button className={buttonStyles.secondary} onClick={closePopup} type="button">
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Pending order</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{pendingOrder ? pendingOrder.orderCode : "None"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Draft items</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{draftItems.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Active orders</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{activeOrders.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Draft total</p>
                    <p className="cashier-total-pop mt-2 text-2xl font-semibold text-slate-950">{formatPrice(draftTotal)}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.12fr)_380px]">
                  <div className="space-y-5">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">Add products</h3>
                          <p className="mt-1 text-sm text-slate-600">Tap a product to add it to this table's draft.</p>
                        </div>
                        <StatusPill tone="info">{products.length} products</StatusPill>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {products.map((product) => (
                          <button
                            key={product.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                            onClick={() => addProduct(product)}
                            type="button"
                          >
                            <div>
                              <p className="font-medium text-slate-900">{product.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {product.category} • {product.orderableStock} left
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{formatPrice(product.price)}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">Active orders</h3>
                          <p className="mt-1 text-sm text-slate-600">Ready tickets can be acknowledged here by the waiter.</p>
                        </div>
                        <StatusPill tone={activeOrders.length > 0 ? "warning" : "neutral"}>{activeOrders.length} open</StatusPill>
                      </div>

                      <div className="mt-4 space-y-3">
                        {activeOrders.map((order) => (
                          <article key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{order.orderCode}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                                  {order.source} • {formatPrice(order.totalPrice)}
                                </p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusTone(order.status)}`}>
                                {order.status}
                              </span>
                            </div>

                            <div className="mt-3 space-y-2">
                              {order.items.map((item) => (
                                <div key={item.id} className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
                                  {item.quantity} x {item.name}
                                </div>
                              ))}
                            </div>

                            {order.status === "READY" ? (
                              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                                {!order.waiterSeenAt ? (
                                  <button
                                    className={`inline-flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-sm transition ${getSeenActionStyles(order.waiterSeenAt)}`}
                                    disabled={seeingOrderId === order.id}
                                    onClick={() => markSeen(order.id)}
                                    type="button"
                                  >
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                    <span className="flex flex-col leading-tight">
                                      <span>{seeingOrderId === order.id ? "Updating..." : "Goruldu"}</span>
                                      <span className="text-[11px] font-medium text-amber-700">Ready ticket seen</span>
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    className={`inline-flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-sm ${getSeenActionStyles(order.waiterSeenAt)}`}
                                  >
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    <span className="flex flex-col leading-tight">
                                      <span>Goruldu</span>
                                      <span className="text-[11px] font-medium text-emerald-700">Seen at {formatSeenTime(order.waiterSeenAt)}</span>
                                    </span>
                                  </div>
                                )}
                                <button
                                  className={`${buttonStyles.primary} cashier-payment-button`}
                                  disabled={payingOrderId === order.id}
                                  onClick={() => markPaid(order.id)}
                                  type="button"
                                >
                                  {payingOrderId === order.id ? "Updating..." : "Paid"}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))}

                        {activeOrders.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            No active orders on this table.
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">Pending draft</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {pendingOrder ? "Update or clear the current pending order." : "Create a new pending order for this table."}
                        </p>
                      </div>
                      <StatusPill tone={pendingOrder ? "info" : "neutral"}>{pendingOrder ? "Editing" : "New draft"}</StatusPill>
                    </div>

                    <div className="mt-4 space-y-3">
                      {draftItems.map((item) => {
                        const product = products.find((entry) => entry.id === item.productId);

                        return (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-slate-900">{item.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatPrice(product?.price || 0)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  className={buttonStyles.secondary}
                                  onClick={() => updateDraftItem(item.id, item.quantity - 1)}
                                  type="button"
                                >
                                  -
                                </button>
                                <span className="min-w-8 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                                <button
                                  className={buttonStyles.secondary}
                                  onClick={() => updateDraftItem(item.id, item.quantity + 1)}
                                  type="button"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {draftItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          No pending items for this table yet.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Pending total</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-950">{formatPrice(draftTotal)}</p>
                      </div>
                      <button className={`${buttonStyles.primary} cashier-payment-button`} disabled={saving} onClick={saveOrder} type="button">
                        {saving ? "Saving..." : pendingOrder ? (draftItems.length > 0 ? "Update order" : "Delete draft") : "Create order"}
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
