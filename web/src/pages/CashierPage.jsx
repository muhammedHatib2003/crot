import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import { AppShell, MessageBanner, PageHeader, SectionCard, StatusPill, buttonStyles } from "../components/app/AppShell";
import KitchenTicketPrint from "../components/print/KitchenTicketPrint";
import CustomerReceiptPrint from "../components/print/CustomerReceiptPrint";
import { triggerPrint } from "../components/print/printUtils";
import useOrderNotifications from "../hooks/useOrderNotifications";
import { bindVisibilityRefresh, FAST_POLL_MS } from "../utils/polling";

const ONLINE_NEXT_STATUSES = {
  READY: ["ON_THE_WAY", "COMPLETED", "CANCELLED"],
  ON_THE_WAY: ["COMPLETED", "CANCELLED"]
};

const STATUS_LABELS = {
  READY: "Hazır",
  ON_THE_WAY: "Kuryeye Verildi",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal"
};

const STATUS_BUTTON_LABELS = {
  ON_THE_WAY: "Kuryeye Verildi",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Et",
  PAID: "Ödendi"
};

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

function getNextStatusOptions(order) {
  const current = String(order?.status || "").trim().toUpperCase();
  const type = String(order?.orderType || "").trim().toUpperCase();
  const candidates = ONLINE_NEXT_STATUSES[current] || [];

  if (type === "PICKUP") {
    return candidates.filter((status) => status !== "ON_THE_WAY");
  }
  if (type === "DELIVERY") {
    return candidates;
  }
  return candidates.filter((status) => status !== "ON_THE_WAY");
}

function getStatusTone(status) {
  const upper = String(status || "").trim().toUpperCase();
  if (upper === "READY") return "bg-emerald-100 text-emerald-800";
  if (upper === "ON_THE_WAY") return "bg-sky-100 text-sky-800";
  if (upper === "COMPLETED") return "bg-slate-200 text-slate-700";
  if (upper === "CANCELLED" || upper === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
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
  const [products, setProducts] = useState([]);
  const [openTableId, setOpenTableId] = useState("");
  const [tablePanelMode, setTablePanelMode] = useState("payment");
  const [draftItems, setDraftItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [checkingOutTableId, setCheckingOutTableId] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [payingOrderId, setPayingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [printPayload, setPrintPayload] = useState(null);
  const { acknowledgeOrder } = useOrderNotifications(orders, { panel: "cashier" });

  const restaurantInfo = useMemo(
    () => ({
      name: me?.restaurant?.name || me?.restaurantName || "Restoran",
      logoUrl: me?.restaurant?.logoUrl || null
    }),
    [me?.restaurant?.name, me?.restaurantName, me?.restaurant?.logoUrl]
  );

  function openPrint(mode, order) {
    if (!order) {
      return;
    }
    setPrintPayload({ mode, order });
  }

  useEffect(() => {
    if (!printPayload) {
      return undefined;
    }

    triggerPrint();

    function handleAfterPrint() {
      setPrintPayload(null);
    }

    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printPayload]);

  const readyOrdersByTable = useMemo(() => {
    const groupedOrders = new Map();

    orders
      .filter((order) => order.orderType === "TABLE" && order.tableId && order.status === "READY")
      .forEach((order) => {
        const currentOrders = groupedOrders.get(order.tableId) || [];
        groupedOrders.set(order.tableId, [...currentOrders, order]);
      });

    return groupedOrders;
  }, [orders]);
  const openTable = useMemo(() => tables.find((table) => table.id === openTableId) || null, [openTableId, tables]);
  const pendingTableOrder = openTable?.pendingOrder || null;
  const openTableOrders = useMemo(() => readyOrdersByTable.get(openTableId) || [], [openTableId, readyOrdersByTable]);
  const openTableTotal = useMemo(
    () => openTableOrders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
    [openTableOrders]
  );
  const draftTotal = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return sum + (product ? Number(product.price || 0) * Number(item.quantity || 0) : 0);
      }, 0),
    [draftItems, products]
  );

  function syncDraftForTable(tableId, nextTables = tables) {
    const nextTable = nextTables.find((table) => table.id === tableId);
    setDraftItems(buildDraftFromOrder(nextTable?.pendingOrder));
  }

  function closeTablePopup() {
    setOpenTableId("");
    setDraftItems([]);
  }

  function openTablePopup(tableId, mode = "payment") {
    setOpenTableId(tableId);
    setTablePanelMode(mode);
    syncDraftForTable(tableId);
    setError("");
    setMessage("");
  }
  const onlineOrders = useMemo(
    () => orders.filter((order) => order.orderType !== "TABLE"),
    [orders]
  );

  async function loadQueue(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const [tablesResult, ordersResult, productsResult] = await Promise.all([
        apiRequest("/cashier/tables", { token: session.token }),
        apiRequest("/cashier/orders", { token: session.token }),
        apiRequest("/cashier/products", { token: session.token })
      ]);

      const nextTables = tablesResult.tables || [];
      setTables(nextTables);
      setOrders(ordersResult.orders || []);
      setProducts(productsResult.products || []);
      setOpenTableId((currentTableId) => {
        if (!nextTables.some((table) => table.id === currentTableId)) {
          return "";
        }
        syncDraftForTable(currentTableId, nextTables);
        return currentTableId;
      });
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
        const [tablesResult, ordersResult, productsResult] = await Promise.all([
          apiRequest("/cashier/tables", { token: session.token }),
          apiRequest("/cashier/orders", { token: session.token }),
          apiRequest("/cashier/products", { token: session.token })
        ]);

        setTables(tablesResult.tables || []);
        setOrders(ordersResult.orders || []);
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
    if (loading) {
      return undefined;
    }

    const refreshQueue = () => loadQueue();
    const poller = window.setInterval(refreshQueue, FAST_POLL_MS);
    const unbindVisibility = bindVisibilityRefresh(refreshQueue);

    return () => {
      window.clearInterval(poller);
      unbindVisibility();
    };
  }, [loading, session.token]);

  useEffect(() => {
    if (!openTableId) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeTablePopup();
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
      closeTablePopup();
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCheckingOutTableId("");
    }
  }

  async function checkoutPickupOrder(orderId, paymentMethod) {
    setPayingOrderId(orderId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/cashier/orders/${orderId}/checkout`, {
        method: "POST",
        token: session.token,
        body: { paymentMethod }
      });

      setMessage(result.message || `Pickup payment completed (${paymentMethod}).`);
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPayingOrderId("");
    }
  }

  function addProduct(product) {
    setDraftItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.productId === product.id && !item.notes);
      if (existingItem) {
        return currentItems.map((item) =>
          item.id === existingItem.id ? { ...item, quantity: item.quantity + 1 } : item
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

  async function saveTableOrder() {
    if (!openTable) {
      return;
    }

    setSavingOrder(true);
    setError("");
    setMessage("");

    try {
      if (draftItems.length === 0 && pendingTableOrder) {
        await apiRequest(`/cashier/orders/${pendingTableOrder.id}`, {
          method: "DELETE",
          token: session.token
        });
        setMessage("Bekleyen siparis kaldirildi.");
      } else if (draftItems.length === 0) {
        setError("Kaydetmeden once en az bir urun ekleyin.");
        return;
      } else if (pendingTableOrder) {
        await apiRequest(`/cashier/orders/${pendingTableOrder.id}`, {
          method: "PUT",
          token: session.token,
          body: { items: draftItems }
        });
        setMessage("Masa siparisi guncellendi.");
      } else {
        await apiRequest("/cashier/orders", {
          method: "POST",
          token: session.token,
          body: {
            tableId: openTable.id,
            items: draftItems
          }
        });
        setMessage("Masa acildi ve siparis mutfaga gonderildi.");
      }

      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingOrder(false);
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

      const friendlyStatus = STATUS_LABELS[status] || status;
      setMessage(`Sipariş durumu güncellendi: ${friendlyStatus}.`);
      acknowledgeOrder(orderId);
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
            description="Masaya tiklayin: odeme veya masa acma / siparis ekleme."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-5">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className={`cashier-table-card aspect-square rounded-[28px] border p-4 text-left shadow-sm ${getTableTone(table)} ${
                    table.readyOrderCount > 0 ? "cashier-table-card--ready" : ""
                  } ${openTableId === table.id ? "ring-2 ring-slate-950" : ""}`}
                >
                  <button
                    className="flex h-full w-full flex-col justify-between text-left"
                    onClick={() => openTablePopup(table.id, table.readyOrderCount > 0 ? "payment" : "order")}
                    type="button"
                  >
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
                  </button>
                  {!table.isOccupied && table.readyOrderCount === 0 ? (
                    <button
                      className={`${buttonStyles.secondary} mt-3 w-full py-2 text-xs`}
                      onClick={() => openTablePopup(table.id, "order")}
                      type="button"
                    >
                      Masa Ac
                    </button>
                  ) : null}
                </div>
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
                {onlineOrders.map((order) => {
                  const nextStatuses = getNextStatusOptions(order);
                  const deliveryAddress =
                    order.orderType === "DELIVERY"
                      ? order.deliveryAddressText || order.customerAddress
                      : "";

                  return (
                    <article key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-500">{order.orderCode}</p>
                          <p className="font-semibold text-slate-900">{order.orderType}</p>
                          <p className="text-sm text-slate-600">
                            <span className="font-semibold text-slate-950">{order.customerName || "Customer"}</span>
                            {order.customerPhone ? <span className="text-slate-500"> · {order.customerPhone}</span> : null}
                          </p>
                          {deliveryAddress ? (
                            <p className="mt-1 text-xs text-slate-500">{deliveryAddress}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusTone(order.status)}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{formatPrice(order.totalPrice)}</p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                            <p className="font-medium text-slate-900">
                              {item.quantity} x {item.name}
                            </p>
                            {item.notes ? <p className="mt-0.5 text-xs text-slate-500">Not: {item.notes}</p> : null}
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className={buttonStyles.secondary}
                          onClick={() => openPrint("kitchen", order)}
                          type="button"
                        >
                          Mutfak Fişi Yazdır
                        </button>
                        <button
                          className={buttonStyles.secondary}
                          onClick={() => openPrint("customer", order)}
                          type="button"
                        >
                          Müşteri Fişi Yazdır
                        </button>
                        {order.orderType === "PICKUP" && order.status === "READY" ? (
                          <>
                            <button
                              className={buttonStyles.primary}
                              disabled={payingOrderId === order.id}
                              onClick={() => checkoutPickupOrder(order.id, "CASH")}
                              type="button"
                            >
                              {payingOrderId === order.id ? "Processing..." : "Nakit Öde & Teslim Et"}
                            </button>
                            <button
                              className={buttonStyles.primary}
                              disabled={payingOrderId === order.id}
                              onClick={() => checkoutPickupOrder(order.id, "CARD")}
                              type="button"
                            >
                              {payingOrderId === order.id ? "Processing..." : "Kart Öde & Teslim Et"}
                            </button>
                            <button
                              className={buttonStyles.secondary}
                              disabled={updatingOrderId === order.id}
                              onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                              type="button"
                            >
                              {updatingOrderId === order.id ? "Updating..." : "Teslim Edildi (ödeme alındı)"}
                            </button>
                          </>
                        ) : null}
                        {order.orderType !== "PICKUP"
                          ? nextStatuses.map((status) => (
                              <button
                                key={status}
                                className={status === "CANCELLED" ? buttonStyles.secondary : buttonStyles.primary}
                                disabled={updatingOrderId === order.id}
                                onClick={() => updateOrderStatus(order.id, status)}
                                type="button"
                              >
                                {updatingOrderId === order.id
                                  ? "Updating..."
                                  : STATUS_BUTTON_LABELS[status] || status}
                              </button>
                            ))
                          : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        ) : null}

        {openTable ? (
          <div className="cashier-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <button aria-label="Close payment popup" className="absolute inset-0" onClick={closeTablePopup} type="button" />
            <div className="cashier-modal-panel relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.32)] ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(52,211,153,0.18),_transparent_38%),white] px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Masa islemleri</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">{openTable.name}</h2>
                    <p className="mt-2 text-sm text-slate-600">Odeme alin veya masayi acip siparis ekleyin.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={openTable.readyOrderCount > 0 ? "warning" : openTable.isOccupied ? "danger" : "success"}>
                      {openTable.readyOrderCount > 0 ? "Ready to pay" : openTable.isOccupied ? "Occupied" : "Empty"}
                    </StatusPill>
                    <button className={buttonStyles.secondary} onClick={closeTablePopup} type="button">
                      Close
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    className={tablePanelMode === "payment" ? buttonStyles.primary : buttonStyles.secondary}
                    onClick={() => setTablePanelMode("payment")}
                    type="button"
                  >
                    Odeme
                  </button>
                  <button
                    className={tablePanelMode === "order" ? buttonStyles.primary : buttonStyles.secondary}
                    onClick={() => setTablePanelMode("order")}
                    type="button"
                  >
                    Masa Ac / Siparis
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {tablePanelMode === "order" ? (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5">
                      <h3 className="text-lg font-semibold text-slate-950">Urunler</h3>
                      <p className="mt-1 text-sm text-slate-600">Urun secerek masaya siparis ekleyin.</p>
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
                              <p className="mt-1 text-xs text-slate-500">{product.category}</p>
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{formatPrice(product.price)}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5">
                      <h3 className="text-lg font-semibold text-slate-950">Taslak siparis</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {pendingTableOrder ? pendingTableOrder.orderCode : "Yeni masa"}
                      </p>
                      <div className="mt-4 space-y-3">
                        {draftItems.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-slate-900">{item.name}</p>
                              <div className="flex items-center gap-2">
                                <button className={buttonStyles.secondary} onClick={() => updateDraftItem(item.id, item.quantity - 1)} type="button">
                                  -
                                </button>
                                <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                                <button className={buttonStyles.secondary} onClick={() => updateDraftItem(item.id, item.quantity + 1)} type="button">
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {draftItems.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            Henuz urun eklenmedi.
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-950">Toplam: {formatPrice(draftTotal)}</p>
                      <button
                        className={`${buttonStyles.primary} mt-4 w-full`}
                        disabled={savingOrder}
                        onClick={saveTableOrder}
                        type="button"
                      >
                        {savingOrder ? "Kaydediliyor..." : pendingTableOrder ? "Siparisi Guncelle" : "Masayi Ac ve Gonder"}
                      </button>
                    </section>
                  </div>
                ) : (
                  <>
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

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className={buttonStyles.secondary}
                              onClick={() => openPrint("kitchen", order)}
                              type="button"
                            >
                              Mutfak Fişi Yazdır
                            </button>
                            <button
                              className={buttonStyles.secondary}
                              onClick={() => openPrint("customer", order)}
                              type="button"
                            >
                              Müşteri Fişi Yazdır
                            </button>
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
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="print-area" aria-hidden="true">
        {printPayload?.mode === "kitchen" ? (
          <KitchenTicketPrint order={printPayload.order} restaurant={restaurantInfo} />
        ) : null}
        {printPayload?.mode === "customer" ? (
          <CustomerReceiptPrint order={printPayload.order} restaurant={restaurantInfo} />
        ) : null}
      </div>
    </AppShell>
  );
}
