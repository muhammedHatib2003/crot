import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import RemoteImage from "../components/RemoteImage";
import KitchenBoard from "../components/kitchen/KitchenBoard";
import { normalizeImageUrl } from "../utils/images";

const POLL_INTERVAL_MS = 10000;
const NEW_ORDER_FLASH_MS = 7000;
const MENU_CATEGORY_OPTIONS = ["General", "Starter", "Main", "Dessert", "Drink"];
const LATE_MINUTES_BY_STATUS = {
  PENDING: 5,
  ACCEPTED: 8,
  PREPARING: 12,
  READY: 3
};

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatLiveClock(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

function formatClockTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatElapsed(ms) {
  const safeMs = Math.max(0, ms);
  const totalMinutes = Math.floor(safeMs / 60000);

  if (totalMinutes < 1) {
    return "< 1m";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatRelativeTime(value, nowMs) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return "-";
  }

  const elapsedMs = Math.max(0, nowMs - timestamp);
  const totalMinutes = Math.floor(elapsedMs / 60000);

  if (totalMinutes < 1) {
    return "Just now";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min ago`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
}

function getSourceLabel(order) {
  if (order.orderType === "PICKUP") {
    return "PICKUP";
  }

  if (order.orderType === "DELIVERY") {
    return "ONLINE";
  }

  return String(order.table?.name || "TABLE").toUpperCase();
}

function getActionLabel(status) {
  if (status === "PENDING" || status === "ACCEPTED") {
    return "Start";
  }

  if (status === "PREPARING") {
    return "Ready";
  }

  return "Complete";
}

function getBoardStartTime(order) {
  if (order.status === "READY") {
    return order.readyAt || order.preparingAt || order.createdAt;
  }

  if (order.status === "PREPARING") {
    return order.preparingAt || order.createdAt;
  }

  return order.createdAt;
}

function isOrderLate(order, nowMs) {
  const startedAt = toTimestamp(getBoardStartTime(order));
  const lateThresholdMinutes = LATE_MINUTES_BY_STATUS[order.status] || 10;

  return startedAt > 0 && nowMs - startedAt >= lateThresholdMinutes * 60000;
}

function createRecipeRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ingredientId: "",
    quantity: "1"
  };
}

export default function KitchenPage({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [creatingDish, setCreatingDish] = useState(false);
  const [savingDish, setSavingDish] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [newOrderIds, setNewOrderIds] = useState([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [recipeExists, setRecipeExists] = useState(false);
  const [recipeRows, setRecipeRows] = useState([]);
  const [createRecipeRows, setCreateRecipeRows] = useState([]);
  const [dishForm, setDishForm] = useState({
    name: "",
    category: MENU_CATEGORY_OPTIONS[0],
    price: "",
    stock: "0",
    description: "",
    photoUrl: ""
  });
  const [editDishForm, setEditDishForm] = useState({
    name: "",
    category: MENU_CATEGORY_OPTIONS[0],
    price: "",
    stock: "0",
    description: "",
    photoUrl: "",
    isAvailable: true
  });
  const hasLoadedRef = useRef(false);

  const restaurantName = session.user.restaurant?.name || session.user.restaurantName || "Kitchen";
  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuItemId) || null,
    [menuItems, selectedMenuItemId]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadOrders(options = {}) {
    const silent = Boolean(options.silent);
    const manual = Boolean(options.manual);

    if (!silent && !manual) {
      setLoading(true);
    }
    if (manual) {
      setRefreshing(true);
    }

    try {
      const result = await apiRequest("/kitchen/orders", { token: session.token });
      const nextOrders = result.orders || [];

      setOrders((previousOrders) => {
        if (hasLoadedRef.current) {
          const previousIds = new Set(previousOrders.map((order) => order.id));
          const incomingIds = nextOrders
            .filter((order) => !previousIds.has(order.id))
            .map((order) => order.id);

          if (incomingIds.length > 0) {
            setNewOrderIds((currentIds) => [...new Set([...currentIds, ...incomingIds])]);
            window.setTimeout(() => {
              setNewOrderIds((currentIds) => currentIds.filter((id) => !incomingIds.includes(id)));
            }, NEW_ORDER_FLASH_MS);
          }
        } else {
          hasLoadedRef.current = true;
        }

        return nextOrders;
      });

      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!silent && !manual) {
        setLoading(false);
      }
      if (manual) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadOrders();

    const poller = window.setInterval(() => {
      loadOrders({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(poller);
  }, [session.token]);

  useEffect(() => {
    setSelectedMenuItemId((previousId) => {
      if (menuItems.some((item) => item.id === previousId)) {
        return previousId;
      }

      return menuItems[0]?.id || "";
    });
  }, [menuItems]);

  useEffect(() => {
    if (!selectedMenuItem) {
      return;
    }

    setEditDishForm({
      name: selectedMenuItem.name || "",
      category: selectedMenuItem.category || MENU_CATEGORY_OPTIONS[0],
      price: String(selectedMenuItem.price || ""),
      stock: String(selectedMenuItem.stock ?? 0),
      description: selectedMenuItem.description || "",
      photoUrl: selectedMenuItem.photoUrl || "",
      isAvailable: Boolean(selectedMenuItem.isAvailable)
    });
  }, [selectedMenuItem]);

  useEffect(() => {
    if (activeTab !== "menu" || !selectedMenuItemId) {
      return;
    }

    loadRecipe(selectedMenuItemId);
  }, [activeTab, selectedMenuItemId]);

  useEffect(() => {
    if (activeTab !== "menu") {
      return;
    }

    if (menuItems.length === 0 || ingredients.length === 0) {
      loadMenu();
    }
  }, [activeTab]);

  function updateDishField(field, value) {
    setDishForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function updateEditDishField(field, value) {
    setEditDishForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function loadMenu() {
    setLoadingMenu(true);

    try {
      const [menuResult, ingredientsResult] = await Promise.all([
        apiRequest("/kitchen/menu", { token: session.token }),
        apiRequest("/kitchen/ingredients", { token: session.token })
      ]);
      setMenuItems(menuResult.items || []);
      setIngredients(ingredientsResult.ingredients || []);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMenu(false);
    }
  }

  async function createDish(event) {
    event.preventDefault();
    setCreatingDish(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/kitchen/menu", {
        method: "POST",
        token: session.token,
        body: {
          ...dishForm,
          photoUrl: normalizeImageUrl(dishForm.photoUrl)
        }
      });

      const createPayload = {
        ingredients: createRecipeRows
          .map((row) => ({
            ingredientId: row.ingredientId,
            quantity: Number(row.quantity)
          }))
          .filter((row) => row.ingredientId && row.quantity > 0)
      };

      if (createPayload.ingredients.length > 0) {
        await apiRequest(`/kitchen/menu/${result.item.id}/recipe`, {
          method: "PUT",
          token: session.token,
          body: createPayload
        });
      }

      setDishForm({
        name: "",
        category: MENU_CATEGORY_OPTIONS[0],
        price: "",
        stock: "0",
        description: "",
        photoUrl: ""
      });
      setCreateRecipeRows([]);
      setMessage(createPayload.ingredients.length > 0 ? `${result.item.name} created with recipe.` : `${result.item.name} created.`);
      await loadMenu();
      setSelectedMenuItemId(result.item.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreatingDish(false);
    }
  }

  async function loadRecipe(menuItemId) {
    if (!menuItemId) {
      setRecipeExists(false);
      setRecipeRows([]);
      return;
    }

    setLoadingRecipe(true);

    try {
      const result = await apiRequest(`/kitchen/menu/${menuItemId}/recipe`, { token: session.token });
      setRecipeExists(Boolean(result.recipe));
      setRecipeRows(
        (result.recipe?.ingredients || []).map((ingredient) => ({
          id: ingredient.id,
          ingredientId: ingredient.ingredientId,
          quantity: String(ingredient.quantity)
        }))
      );
      setError("");
    } catch (requestError) {
      setRecipeExists(false);
      setRecipeRows([]);
      setError(requestError.message);
    } finally {
      setLoadingRecipe(false);
    }
  }

  function addRecipeRow() {
    setRecipeRows((currentRows) => [...currentRows, createRecipeRow()]);
  }

  function updateRecipeRow(rowId, field, value) {
    setRecipeRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  function removeRecipeRow(rowId) {
    setRecipeRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  function addCreateRecipeRow() {
    setCreateRecipeRows((currentRows) => [...currentRows, createRecipeRow()]);
  }

  function updateCreateRecipeRow(rowId, field, value) {
    setCreateRecipeRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  function removeCreateRecipeRow(rowId) {
    setCreateRecipeRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  async function saveDish() {
    if (!selectedMenuItem) {
      return;
    }

    setSavingDish(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/kitchen/menu/${selectedMenuItem.id}`, {
        method: "PATCH",
        token: session.token,
        body: {
          ...editDishForm,
          photoUrl: normalizeImageUrl(editDishForm.photoUrl),
          price: Number(editDishForm.price),
          stock: Number(editDishForm.stock)
        }
      });

      setMenuItems((currentItems) => currentItems.map((item) => (item.id === result.item.id ? result.item : item)));
      setMessage(`${result.item.name} updated.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingDish(false);
    }
  }

  async function saveRecipe() {
    if (!selectedMenuItem) {
      return;
    }

    setSavingRecipe(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ingredients: recipeRows
          .map((row) => ({
            ingredientId: row.ingredientId,
            quantity: Number(row.quantity)
          }))
          .filter((row) => row.ingredientId && row.quantity > 0)
      };

      if (payload.ingredients.length === 0) {
        setError("Add at least one ingredient before saving the recipe.");
        return;
      }

      await apiRequest(`/kitchen/menu/${selectedMenuItem.id}/recipe`, {
        method: "PUT",
        token: session.token,
        body: payload
      });

      setMessage(`${selectedMenuItem.name} recipe saved.`);
      setRecipeExists(true);
      await loadMenu();
      await loadRecipe(selectedMenuItem.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleOrderAction(order) {
    setBusyOrderId(order.id);
    setError("");

    try {
      if (order.status === "READY") {
        await apiRequest(`/kitchen/orders/${order.id}/complete`, {
          method: "POST",
          token: session.token
        });
      } else {
        await apiRequest(`/kitchen/orders/${order.id}/status`, {
          method: "PATCH",
          token: session.token,
          body: {
            status: order.status === "PENDING" || order.status === "ACCEPTED" ? "PREPARING" : "READY"
          }
        });
      }

      await loadOrders({ silent: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrderId("");
    }
  }

  const boardOrders = useMemo(() => {
    const nowMs = now.getTime();
    const filteredOrders = orders.filter((order) => filterType === "ALL" || order.orderType === filterType);

    const normalizedOrders = filteredOrders
      .map((order) => {
        const boardStartedAt = getBoardStartTime(order);
        const boardStartedAtMs = toTimestamp(boardStartedAt);

        return {
          ...order,
          sourceLabel: getSourceLabel(order),
          placedLabel: formatRelativeTime(order.createdAt, nowMs),
          startedLabel: formatClockTime(boardStartedAt),
          elapsedLabel: formatElapsed(nowMs - boardStartedAtMs),
          actionLabel: getActionLabel(order.status),
          boardStartedAtMs,
          isLate: isOrderLate(order, nowMs),
          isNew: newOrderIds.includes(order.id)
        };
      })
      .sort((leftOrder, rightOrder) => leftOrder.boardStartedAtMs - rightOrder.boardStartedAtMs);

    return {
      PENDING: normalizedOrders.filter((order) => order.status === "PENDING" || order.status === "ACCEPTED"),
      PREPARING: normalizedOrders.filter((order) => order.status === "PREPARING"),
      READY: normalizedOrders.filter((order) => order.status === "READY")
    };
  }, [filterType, newOrderIds, now, orders]);

  const counters = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === "PENDING").length,
      preparing: orders.filter((order) => order.status === "PREPARING").length
    }),
    [orders]
  );

  const tabs = [
    { id: "orders", label: "Orders", icon: "🍽️", badge: counters.pending + counters.preparing },
    { id: "menu", label: "Menu", icon: "📖" }
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 via-teal-50/60 to-slate-100">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-200/70 bg-white/85 backdrop-blur flex flex-col shadow-[0_14px_34px_rgba(2,8,23,0.08)]">
        <div className="p-6 border-b border-slate-200/70">
          <h1 className="text-xl font-bold text-slate-950 tracking-tight">Kitchen KDS</h1>
          <p className="text-sm text-slate-600 mt-1">{restaurantName}</p>
        </div>

        <nav className="flex-1 p-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 transition-all duration-200
                ${activeTab === tab.id 
                  ? "bg-emerald-50 text-brand-900 shadow-sm ring-1 ring-emerald-200/70" 
                  : "text-slate-600 hover:bg-emerald-50/60 hover:text-slate-900"
                }
              `}
            >
              <span className="flex items-center gap-3">
                <span className="text-lg">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </span>
              {tab.badge > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-semibold
                  ${activeTab === tab.id ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}
                `}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">Current time</p>
            <p className="text-2xl font-semibold text-slate-950 tracking-tight">{formatLiveClock(now)}</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition duration-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {activeTab === "orders" && "Real-time order management and preparation tracking"}
                  {activeTab === "menu" && "Manage dishes, recipes, and menu items"}
                </p>
              </div>
              {activeTab === "orders" && (
                <div className="flex gap-2">
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="ALL">All Orders</option>
                    <option value="TABLE">Dine In</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="PICKUP">Pickup</option>
                  </select>
                  <button
                    className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                    disabled={refreshing}
                    onClick={() => loadOrders({ manual: true })}
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards - Only for orders tab */}
          {activeTab === "orders" && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-700 font-medium">Pending Orders</p>
                <p className="text-3xl font-bold text-amber-900 mt-1">{counters.pending}</p>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                <p className="text-sm text-sky-700 font-medium">In Preparation</p>
                <p className="text-3xl font-bold text-sky-900 mt-1">{counters.preparing}</p>
              </div>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              {message}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-slate-600">Loading orders...</p>
                  </div>
                </div>
              ) : (
                <KitchenBoard
                  busyOrderId={busyOrderId}
                  filterType={filterType}
                  groupedOrders={boardOrders}
                  onAction={handleOrderAction}
                  onFilterChange={setFilterType}
                />
              )}
            </>
          )}

          {/* Menu Tab */}
          {activeTab === "menu" && (
            <div className="space-y-6">
              {/* Create New Dish Section */}
              <div className="ui-surface ui-enter rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Create new dish</h3>
                    <p className="mt-1 text-sm text-slate-600">Add a menu item, then optionally define a recipe.</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    Menu
                  </span>
                </div>

                <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={createDish}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dish Name *</label>
                    <input
                      className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      required
                      value={dishForm.name}
                      onChange={(e) => updateDishField("name", e.target.value)}
                      placeholder="e.g., Margherita Pizza"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      value={dishForm.category}
                      onChange={(e) => updateDishField("category", e.target.value)}
                    >
                      {MENU_CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price *</label>
                    <input
                      className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      min="0.01"
                      required
                      step="0.01"
                      type="number"
                      value={dishForm.price}
                      onChange={(e) => updateDishField("price", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
                    <input
                      className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      min="0"
                      step="1"
                      type="number"
                      value={dishForm.stock}
                      onChange={(e) => updateDishField("stock", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      className="w-full min-h-[88px] resize-y rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      rows="3"
                      value={dishForm.description}
                      onChange={(e) => updateDishField("description", e.target.value)}
                      placeholder="Describe the dish..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Photo URL</label>
                    <input
                      className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      value={dishForm.photoUrl}
                      onChange={(e) => updateDishField("photoUrl", e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  {dishForm.photoUrl && (
                    <div className="md:col-span-2">
                      <RemoteImage
                        alt="Preview"
                        className="h-32 w-32 rounded-2xl object-cover shadow-[0_10px_22px_rgba(2,8,23,0.12)]"
                        fallbackClassName="flex h-32 w-32 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                        fallback="No photo"
                        src={dishForm.photoUrl}
                      />
                    </div>
                  )}
                  <div className="md:col-span-2 border-t border-slate-200/70 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Ingredients</label>
                        <p className="mt-1 text-xs text-slate-500">Optional on create. Add recipe lines now or save the dish and edit later.</p>
                      </div>
                      <button
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-emerald-50/60 hover:text-slate-900 hover:shadow-md"
                        onClick={addCreateRecipeRow}
                        type="button"
                      >
                        + Add Ingredient
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {createRecipeRows.length > 0 ? (
                        createRecipeRows.map((row) => (
                          <div key={row.id} className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/60 p-2">
                            <select
                              className="min-w-[220px] flex-1 rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                              value={row.ingredientId}
                              onChange={(e) => updateCreateRecipeRow(row.id, "ingredientId", e.target.value)}
                            >
                              <option value="">Select ingredient</option>
                              {ingredients.map((ingredient) => (
                                <option key={ingredient.id} value={ingredient.id}>
                                  {ingredient.name} ({ingredient.unit})
                                </option>
                              ))}
                            </select>
                            <input
                              className="w-28 rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                              min="0.001"
                              step="0.001"
                              type="number"
                              value={row.quantity}
                              onChange={(e) => updateCreateRecipeRow(row.id, "quantity", e.target.value)}
                              placeholder="Qty"
                            />
                            <button
                              className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                              onClick={() => removeCreateRecipeRow(row.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                          No ingredients added yet.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      className="ui-action-sheen inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(5,150,105,0.3)] transition duration-200 hover:-translate-y-0.5 hover:from-brand-900 hover:to-brand-700 hover:shadow-[0_14px_28px_rgba(5,150,105,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={creatingDish}
                      type="submit"
                    >
                      {creatingDish ? "Creating..." : "Create Dish"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Menu Items Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Menu items</h3>
                    <p className="mt-1 text-sm text-slate-600">Click a card to edit details and recipe.</p>
                  </div>
                  <button
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300/80 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-emerald-50/60 hover:text-slate-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loadingMenu}
                    onClick={loadMenu}
                  >
                    {loadingMenu ? "Loading..." : "Refresh"}
                  </button>
                </div>

                {loadingMenu && menuItems.length === 0 ? (
                  <div className="ui-enter rounded-2xl border border-slate-200/70 bg-white/70 p-10 text-center text-slate-600 shadow-sm">
                    Loading menu items...
                  </div>
                ) : menuItems.length === 0 ? (
                  <div className="ui-enter rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/80 px-4 py-10 text-center text-sm text-slate-600">
                    No dishes yet. Create your first dish above!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {menuItems.map((item) => (
                      <div
                        key={item.id}
                        className={`ui-enter group cursor-pointer overflow-hidden rounded-2xl border bg-white/80 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(2,8,23,0.12)] ${
                          selectedMenuItemId === item.id
                            ? "border-brand-500/60 ring-4 ring-brand-100"
                            : "border-slate-200/80 hover:border-emerald-200"
                        }`}
                        onClick={() => setSelectedMenuItemId(item.id)}
                      >
                        <RemoteImage
                          alt={item.name}
                          className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          fallbackClassName="flex h-40 items-center justify-center rounded-t-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400"
                          fallback="No Image"
                          src={item.photoUrl}
                        />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-slate-950">{item.name}</h4>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                  {item.category}
                                </span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                                  Stock {item.stock || 0}
                                </span>
                              </div>
                            </div>
                            <p className="rounded-full bg-gradient-to-r from-brand-700 to-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(5,150,105,0.22)]">
                              ${Number(item.price || 0).toFixed(2)}
                            </p>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{item.description || "No description"}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className={`text-xs px-2 py-1 rounded ${item.hasRecipe ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {item.hasRecipe ? `${item.recipeIngredientCount} ingredients` : "No recipe"}
                            </span>
                            <span className="text-xs font-medium text-slate-500 transition group-hover:text-brand-900">Edit →</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit Selected Dish */}
              {selectedMenuItem && (
                <div className="ui-surface ui-enter rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-slate-950 mb-1">Edit: {selectedMenuItem.name}</h3>
                  <p className="text-sm text-slate-600">Update details and manage the recipe.</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dish Details */}
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dish details</h4>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Name</label>
                        <input
                          className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                          value={editDishForm.name}
                          onChange={(e) => updateEditDishField("name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Category</label>
                        <select
                          className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                          value={editDishForm.category}
                          onChange={(e) => updateEditDishField("category", e.target.value)}
                        >
                          {MENU_CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">Price</label>
                          <input
                            className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                            type="number"
                            step="0.01"
                            value={editDishForm.price}
                            onChange={(e) => updateEditDishField("price", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">Stock</label>
                          <input
                            className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                            type="number"
                            step="1"
                            value={editDishForm.stock}
                            onChange={(e) => updateEditDishField("stock", e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Description</label>
                        <textarea
                          className="w-full min-h-[88px] resize-y rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                          rows="3"
                          value={editDishForm.description}
                          onChange={(e) => updateEditDishField("description", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Photo URL</label>
                        <input
                          className="w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                          value={editDishForm.photoUrl}
                          onChange={(e) => updateEditDishField("photoUrl", e.target.value)}
                        />
                      </div>
                      {editDishForm.photoUrl ? (
                        <RemoteImage
                          alt={`${editDishForm.name || selectedMenuItem.name} preview`}
                          className="h-40 w-full rounded-2xl object-cover shadow-[0_12px_26px_rgba(2,8,23,0.12)]"
                          fallbackClassName="flex h-40 w-full items-center justify-center rounded-xl bg-slate-200 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                          fallback="No photo"
                          src={editDishForm.photoUrl}
                        />
                      ) : null}
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={editDishForm.isAvailable}
                          onChange={(e) => updateEditDishField("isAvailable", e.target.checked)}
                        />
                        <span className="text-sm text-slate-700">Available on menu</span>
                      </label>
                      <button
                        className="ui-action-sheen inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(2,8,23,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(2,8,23,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={savingDish}
                        onClick={saveDish}
                      >
                        {savingDish ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    {/* Recipe Management */}
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recipe</h4>
                      {loadingRecipe ? (
                        <div className="text-center py-8 text-slate-500">Loading recipe...</div>
                      ) : (
                        <>
                          <div className="space-y-2 max-h-96 overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/60 p-3">
                            {recipeRows.length === 0 ? (
                              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white/70">
                                No ingredients yet. Add some!
                              </div>
                            ) : (
                              recipeRows.map((row) => (
                                <div key={row.id} className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-2">
                                  <select
                                    className="min-w-[220px] flex-1 rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                                    value={row.ingredientId}
                                    onChange={(e) => updateRecipeRow(row.id, "ingredientId", e.target.value)}
                                  >
                                    <option value="">Select ingredient</option>
                                    {ingredients.map((ing) => (
                                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                    ))}
                                  </select>
                                  <input
                                    className="w-24 rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                                    type="number"
                                    step="0.001"
                                    value={row.quantity}
                                    onChange={(e) => updateRecipeRow(row.id, "quantity", e.target.value)}
                                    placeholder="Qty"
                                  />
                                  <button
                                    className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                                    onClick={() => removeRecipeRow(row.id)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="inline-flex items-center justify-center rounded-xl border border-slate-300/80 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-emerald-50/60 hover:text-slate-900 hover:shadow-md"
                              onClick={addRecipeRow}
                            >
                              + Add Ingredient
                            </button>
                            <button
                              className="ui-action-sheen inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(5,150,105,0.3)] transition duration-200 hover:-translate-y-0.5 hover:from-brand-900 hover:to-brand-700 hover:shadow-[0_14px_28px_rgba(5,150,105,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={savingRecipe}
                              onClick={saveRecipe}
                            >
                              {savingRecipe ? "Saving..." : "Save Recipe"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
