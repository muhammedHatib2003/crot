import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import {
  AppShell,
  EmptyState,
  Field,
  MessageBanner,
  MetricGrid,
  PageHeader,
  SectionCard,
  SimpleTable,
  StatusPill,
  buttonStyles,
  fieldStyles
} from "../components/app/AppShell";

function formatQuantity(value) {
  const numericValue = Number(value || 0);
  if (Number.isInteger(numericValue)) {
    return String(numericValue);
  }

  return numericValue.toFixed(3).replace(/\.?0+$/, "");
}

function formatMovementQuantity(value) {
  const numericValue = Number(value || 0);
  const prefix = numericValue > 0 ? "+" : "";
  return `${prefix}${formatQuantity(numericValue)}`;
}

function getMenuTone(item) {
  if (item.isOrderable) {
    return "success";
  }
  if (item.availabilityReason === "HIDDEN") {
    return "warning";
  }
  return "danger";
}

function getMenuLabel(item) {
  if (item.isOrderable) {
    return "Orderable";
  }
  if (item.availabilityReason === "HIDDEN") {
    return "Hidden";
  }
  if (!item.hasRecipe || item.availabilityReason === "RECIPE_INCOMPLETE") {
    return "Recipe missing";
  }

  return "Blocked";
}

function formatIngredientShortages(item) {
  if (!Array.isArray(item.ingredientShortages) || item.ingredientShortages.length === 0) {
    return item.availabilityText;
  }

  return item.ingredientShortages
    .slice(0, 2)
    .map(
      (ingredient) =>
        `${ingredient.name}: ${formatQuantity(ingredient.currentStock)}/${formatQuantity(ingredient.requiredQuantity)} ${ingredient.unit || ""}`.trim()
    )
    .join(" | ");
}

function getRequestTone(status) {
  if (status === "FULFILLED") {
    return "success";
  }
  if (status === "REJECTED") {
    return "danger";
  }
  return "warning";
}

function formatRequestStatusLabel(status) {
  if (status === "FULFILLED") {
    return "APPROVED";
  }

  return status;
}

function getRequestName(request) {
  return request.ingredientName || request.requestedIngredientName || request.ingredient?.name || "Ingredient";
}

function getRequestUnit(request) {
  return request.unit || request.requestedUnit || request.ingredient?.unit || "";
}

export default function InventoryPage({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [me, setMe] = useState(session.user);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientRequests, setIngredientRequests] = useState([]);
  const [lowStockIngredients, setLowStockIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [summary, setSummary] = useState({
    ingredientsCount: 0,
    lowStockCount: 0,
    suppliersCount: 0,
    openPurchaseOrders: 0,
    pendingIngredientRequests: 0
  });
  const [menuSummary, setMenuSummary] = useState({
    totalItems: 0,
    withRecipeCount: 0,
    missingRecipeCount: 0,
    orderableCount: 0,
    blockedCount: 0,
    ingredientLimitedCount: 0
  });
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    unit: "pcs",
    minStock: "0",
    currentStock: "0"
  });
  const [stockInputs, setStockInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [savingIngredientId, setSavingIngredientId] = useState("");
  const [handlingRequestId, setHandlingRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function syncStockInputs(nextIngredients) {
    setStockInputs(
      Object.fromEntries(nextIngredients.map((ingredient) => [ingredient.id, String(ingredient.currentStock)]))
    );
  }

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    }

    setError("");

    try {
      const [dashboardResult, requestsResult] = await Promise.all([
        apiRequest("/inventory/dashboard", { token: session.token }),
        apiRequest("/inventory/requests", { token: session.token })
      ]);
      const nextIngredients = dashboardResult.ingredients || [];

      setIngredients(nextIngredients);
      setIngredientRequests(requestsResult.requests || []);
      setLowStockIngredients(dashboardResult.lowStockIngredients || []);
      setMenuItems(dashboardResult.menuItems || []);
      setRecentMovements(dashboardResult.recentMovements || []);
      setSummary(
        dashboardResult.summary || {
          ingredientsCount: 0,
          lowStockCount: 0,
          suppliersCount: 0,
          openPurchaseOrders: 0,
          pendingIngredientRequests: 0
        }
      );
      setMenuSummary(
        dashboardResult.menuSummary || {
          totalItems: 0,
          withRecipeCount: 0,
          missingRecipeCount: 0,
          orderableCount: 0,
          blockedCount: 0,
          ingredientLimitedCount: 0
        }
      );
      syncStockInputs(nextIngredients);
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
        const [meResult, dashboardResult, requestsResult] = await Promise.all([
          apiRequest("/auth/me", { token: session.token }),
          apiRequest("/inventory/dashboard", { token: session.token }),
          apiRequest("/inventory/requests", { token: session.token })
        ]);

        const nextIngredients = dashboardResult.ingredients || [];
        setMe(meResult.user);
        setIngredients(nextIngredients);
        setIngredientRequests(requestsResult.requests || []);
        setLowStockIngredients(dashboardResult.lowStockIngredients || []);
        setMenuItems(dashboardResult.menuItems || []);
        setRecentMovements(dashboardResult.recentMovements || []);
        setSummary(
          dashboardResult.summary || {
            ingredientsCount: 0,
            lowStockCount: 0,
            suppliersCount: 0,
            openPurchaseOrders: 0,
            pendingIngredientRequests: 0
          }
        );
        setMenuSummary(
          dashboardResult.menuSummary || {
            totalItems: 0,
            withRecipeCount: 0,
            missingRecipeCount: 0,
            orderableCount: 0,
            blockedCount: 0,
            ingredientLimitedCount: 0
          }
        );
        syncStockInputs(nextIngredients);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [session.token]);

  function updateIngredientField(field, value) {
    setIngredientForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function useRequestInForm(request) {
    setIngredientForm({
      name: request.requestedIngredientName || request.ingredientName || "",
      unit: request.requestedUnit || request.unit || "pcs",
      minStock: "0",
      currentStock: String(request.quantity || 0)
    });
    setMessage(`${getRequestName(request)} loaded into the add ingredient form.`);
    setError("");
    setActiveTab("ingredients");
  }

  async function addIngredient(event) {
    event.preventDefault();
    setAddingIngredient(true);
    setError("");
    setMessage("");

    try {
      await apiRequest("/inventory/ingredients", {
        method: "POST",
        token: session.token,
        body: {
          ...ingredientForm,
          minStock: Number(ingredientForm.minStock || 0),
          currentStock: Number(ingredientForm.currentStock || 0)
        }
      });

      await loadDashboard();
      setIngredientForm({
        name: "",
        unit: "pcs",
        minStock: "0",
        currentStock: "0"
      });
      setMessage("Ingredient added.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingIngredient(false);
    }
  }

  async function saveStock(ingredientId) {
    setSavingIngredientId(ingredientId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/inventory/ingredients/${ingredientId}`, {
        method: "PATCH",
        token: session.token,
        body: {
          currentStock: Number(stockInputs[ingredientId] || 0)
        }
      });

      await loadDashboard();
      setMessage(`${result.ingredient.name} stock updated.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingIngredientId("");
    }
  }

  async function updateRequestStatus(requestId, status) {
    setHandlingRequestId(requestId);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/inventory/requests/${requestId}/status`, {
        method: "PATCH",
        token: session.token,
        body: {
          status
        }
      });

      await loadDashboard();
      setMessage(`${getRequestName(result.request)} marked ${formatRequestStatusLabel(status).toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setHandlingRequestId("");
    }
  }

  const metrics = [
    {
      label: "Ingredients",
      value: summary.ingredientsCount,
      detail: "Tracked in inventory",
      icon: "📦"
    },
    {
      label: "Low Stock",
      value: summary.lowStockCount,
      detail: "Need attention",
      icon: "⚠️",
      alert: summary.lowStockCount > 0
    },
    {
      label: "Pending Requests",
      value: summary.pendingIngredientRequests,
      detail: `${ingredientRequests.filter(r => r.status === "PENDING").length} awaiting approval`,
      icon: "📋"
    },
    {
      label: "Orderable Menu",
      value: menuSummary.orderableCount,
      detail: `out of ${menuSummary.totalItems} dishes`,
      icon: "🍽️"
    }
  ];

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "ingredients", label: "Ingredients", icon: "🥬", badge: lowStockIngredients.length },
    { id: "requests", label: "Requests", icon: "📨", badge: ingredientRequests.filter(r => r.status === "PENDING").length },
    { id: "menu", label: "Menu Impact", icon: "📖" },
    { id: "movements", label: "Movements", icon: "🔄" }
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        {/* Restaurant Info */}
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">🍽️ StockFlow</h1>
          <p className="text-sm text-slate-500 mt-1">{me.restaurant?.name || me.restaurantName || "Restaurant"}</p>
          <p className="text-xs text-slate-400 mt-1">{me.fullName}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center justify-between px-4 py-3 rounded-lg mb-1 transition-all duration-200
                ${activeTab === tab.id 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-slate-600 hover:bg-slate-100"
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
                  ${activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"}
                `}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Actions */}
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
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
                  {activeTab === "overview" && "Inventory health and key metrics at a glance"}
                  {activeTab === "ingredients" && "Manage your ingredient stock levels"}
                  {activeTab === "requests" && "Review and approve kitchen requests"}
                  {activeTab === "menu" && "See how stock affects menu availability"}
                  {activeTab === "movements" && "Track all inventory changes"}
                </p>
              </div>
              <button
                className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:shadow-sm transition-all duration-200"
                disabled={refreshing}
                onClick={() => loadDashboard(true)}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 animate-slideDown">
              <MessageBanner tone="error">{error}</MessageBanner>
            </div>
          )}
          {message && (
            <div className="mb-6 animate-slideDown">
              <MessageBanner tone="success">{message}</MessageBanner>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <svg className="animate-spin h-8 w-8 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-slate-600">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <MetricGrid items={metrics} />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="⚠️ Low Stock Alerts" description="Ingredients that need immediate attention">
                      {lowStockIngredients.length > 0 ? (
                        <div className="space-y-3">
                          {lowStockIngredients.slice(0, 5).map((ingredient) => (
                            <div key={ingredient.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <div>
                                <p className="font-medium text-amber-900">{ingredient.name}</p>
                                <p className="text-xs text-amber-700 mt-1">
                                  {formatQuantity(ingredient.currentStock)} / {formatQuantity(ingredient.minStock)} {ingredient.unit}
                                </p>
                              </div>
                              <button
                                onClick={() => setActiveTab("ingredients")}
                                className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                              >
                                Update
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="All good!" description="No low stock items at the moment." />
                      )}
                    </SectionCard>

                    <SectionCard title="📋 Pending Requests" description="Awaiting your approval">
                      {ingredientRequests.filter(r => r.status === "PENDING").length > 0 ? (
                        <div className="space-y-3">
                          {ingredientRequests.filter(r => r.status === "PENDING").slice(0, 5).map((request) => (
                            <div key={request.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-slate-900">{getRequestName(request)}</p>
                                <button
                                  onClick={() => setActiveTab("requests")}
                                  className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Review
                                </button>
                              </div>
                              <p className="text-xs text-slate-500">
                                {formatQuantity(request.quantity)} {getRequestUnit(request)} • by {request.requestedByName}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No pending requests" description="All caught up!" />
                      )}
                    </SectionCard>
                  </div>

                  <SectionCard title="📊 Menu Overview" description="How stock affects your menu">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{menuSummary.orderableCount}</p>
                        <p className="text-xs text-green-700 mt-1">Orderable Dishes</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{menuSummary.blockedCount}</p>
                        <p className="text-xs text-red-700 mt-1">Blocked Dishes</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">{menuSummary.ingredientLimitedCount}</p>
                        <p className="text-xs text-yellow-700 mt-1">Limited by Stock</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{menuSummary.missingRecipeCount}</p>
                        <p className="text-xs text-blue-700 mt-1">Missing Recipes</p>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Ingredients Tab */}
              {activeTab === "ingredients" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="Add New Ingredient" description="Create inventory items for your kitchen">
                      <form className="space-y-4" onSubmit={addIngredient}>
                        <Field label="Ingredient name">
                          <input
                            className={fieldStyles}
                            required
                            placeholder="e.g., Tomatoes, Flour, Olive Oil"
                            value={ingredientForm.name}
                            onChange={(e) => updateIngredientField("name", e.target.value)}
                          />
                        </Field>
                        <Field label="Unit">
                          <select
                            className={fieldStyles}
                            required
                            value={ingredientForm.unit}
                            onChange={(e) => updateIngredientField("unit", e.target.value)}
                          >
                            <option value="pcs">Pieces (pcs)</option>
                            <option value="kg">Kilograms (kg)</option>
                            <option value="g">Grams (g)</option>
                            <option value="l">Liters (l)</option>
                            <option value="ml">Milliliters (ml)</option>
                          </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Minimum stock">
                            <input
                              className={fieldStyles}
                              min="0"
                              step="0.001"
                              type="number"
                              value={ingredientForm.minStock}
                              onChange={(e) => updateIngredientField("minStock", e.target.value)}
                            />
                          </Field>
                          <Field label="Current stock">
                            <input
                              className={fieldStyles}
                              min="0"
                              step="0.001"
                              type="number"
                              value={ingredientForm.currentStock}
                              onChange={(e) => updateIngredientField("currentStock", e.target.value)}
                            />
                          </Field>
                        </div>
                        <button className={`${buttonStyles.primary} w-full`} disabled={addingIngredient} type="submit">
                          {addingIngredient ? "Adding..." : "Add Ingredient"}
                        </button>
                      </form>
                    </SectionCard>

                    <SectionCard title="Ingredient Stock" description="Current inventory levels">
                      {ingredients.length > 0 ? (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {ingredients.map((ingredient) => (
                            <div key={ingredient.id} className={`p-3 rounded-lg border ${ingredient.isLowStock ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-slate-900">{ingredient.name}</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    Min: {formatQuantity(ingredient.minStock)} {ingredient.unit}
                                  </p>
                                </div>
                                <StatusPill tone={ingredient.isLowStock ? "warning" : "success"}>
                                  {ingredient.isLowStock ? "Low" : "Healthy"}
                                </StatusPill>
                              </div>
                              <div className="flex items-center gap-2 mt-3">
                                <input
                                  className={`${fieldStyles} flex-1 text-sm`}
                                  min="0"
                                  step="0.001"
                                  type="number"
                                  value={stockInputs[ingredient.id] || "0"}
                                  onChange={(e) => setStockInputs(prev => ({ ...prev, [ingredient.id]: e.target.value }))}
                                />
                                <button
                                  className={`${buttonStyles.primary} text-sm px-3`}
                                  disabled={savingIngredientId === ingredient.id}
                                  onClick={() => saveStock(ingredient.id)}
                                >
                                  Update
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No ingredients yet" description="Add your first ingredient to get started." />
                      )}
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* Requests Tab */}
              {activeTab === "requests" && (
                <SectionCard title="Kitchen Requests" description="Approve or reject ingredient requests from kitchen staff">
                  {ingredientRequests.length > 0 ? (
                    <div className="space-y-4">
                      {ingredientRequests.map((request) => (
                        <div key={request.id} className="p-4 bg-white rounded-lg border border-slate-200">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-semibold text-slate-900">{getRequestName(request)}</p>
                                <StatusPill tone={getRequestTone(request.status)}>
                                  {formatRequestStatusLabel(request.status)}
                                </StatusPill>
                              </div>
                              <p className="text-sm text-slate-600">
                                {formatQuantity(request.quantity)} {getRequestUnit(request)} • by {request.requestedByName}
                              </p>
                              {request.note && <p className="text-sm text-slate-500 mt-2 italic">"{request.note}"</p>}
                              <p className="text-xs text-slate-400 mt-2">{new Date(request.createdAt).toLocaleDateString()}</p>
                            </div>

                            {request.status === "PENDING" && (
                              <div className="flex gap-2">
                                {!request.ingredient && (
                                  <button
                                    className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                                    onClick={() => useRequestInForm(request)}
                                  >
                                    Add to Form
                                  </button>
                                )}
                                <button
                                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                                  onClick={() => updateRequestStatus(request.id, "FULFILLED")}
                                  disabled={handlingRequestId === request.id}
                                >
                                  Approve
                                </button>
                                <button
                                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                  onClick={() => updateRequestStatus(request.id, "REJECTED")}
                                  disabled={handlingRequestId === request.id}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No requests" description="All caught up! No pending requests." />
                  )}
                </SectionCard>
              )}

              {/* Menu Tab */}
              {activeTab === "menu" && (
                <SectionCard title="Menu Items" description="How inventory affects each dish">
                  {menuItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <SimpleTable headers={["Dish", "Recipe", "Status", "Stock Impact"]}>
                        {menuItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-500 mt-1">{item.category}</p>
                            </td>
                            <td className="px-4 py-3">
                              {item.hasRecipe ? (
                                <span className="text-sm text-slate-700">{item.recipeIngredientCount} ingredients</span>
                              ) : (
                                <span className="text-sm text-red-600">No recipe</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill tone={getMenuTone(item)}>{getMenuLabel(item)}</StatusPill>
                              <p className="text-xs text-slate-500 mt-1">{item.availabilityText}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-700">{formatIngredientShortages(item)}</p>
                            </td>
                          </tr>
                        ))}
                      </SimpleTable>
                    </div>
                  ) : (
                    <EmptyState title="No menu items" description="Add dishes to see how inventory affects them." />
                  )}
                </SectionCard>
              )}

              {/* Movements Tab */}
              {activeTab === "movements" && (
                <SectionCard title="Recent Stock Movements" description="Track all inventory changes">
                  {recentMovements.length > 0 ? (
                    <div className="space-y-3">
                      {recentMovements.map((movement) => (
                        <div key={movement.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">{movement.ingredient?.name || "Ingredient"}</p>
                            <p className="text-sm text-slate-600 mt-1">{movement.note || "Stock updated"}</p>
                            <p className="text-xs text-slate-400 mt-1">{new Date(movement.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${movement.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatMovementQuantity(movement.quantity)} {movement.ingredient?.unit}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              New: {formatQuantity(movement.ingredient?.currentStock)} {movement.ingredient?.unit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No movements yet" description="Stock updates will appear here." />
                  )}
                </SectionCard>
              )}
            </>
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