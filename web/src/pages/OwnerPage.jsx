import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import RestaurantLogo from "../components/RestaurantLogo";
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
  Tabs,
  buttonStyles,
  fieldStyles
} from "../components/app/AppShell";

const EMPLOYEE_ROLE_OPTIONS = [
  { value: "chef", label: "Chef" },
  { value: "cashier", label: "Cashier" },
  { value: "waiter", label: "Waiter" },
  { value: "inventory_manager", label: "Inventory Manager" }
];
const TABLE_SEAT_OPTIONS = [2, 4, 6, 8, 10];
const TABLE_STATUS_OPTIONS = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
const MENU_CATEGORY_OPTIONS = ["General", "Starter", "Main", "Dessert", "Drink"];
const OWNER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "staff", label: "Staff" },
  { id: "tables", label: "Tables" },
  { id: "menu", label: "Menu" },
  { id: "inventory", label: "Inventory" },
  { id: "settings", label: "Settings" }
];

function formatEmployeeRoleLabel(employeeRole) {
  return EMPLOYEE_ROLE_OPTIONS.find((option) => option.value === employeeRole)?.label || employeeRole || "-";
}

function formatPrice(price) {
  return `$${Number(price || 0).toFixed(2)}`;
}

function getOrderLink(tableId) {
  if (typeof window === "undefined") {
    return `/t/${tableId}`;
  }

  return `${window.location.origin}/t/${tableId}`;
}

function getPickupLink(restaurantSlug) {
  if (!restaurantSlug) {
    return "";
  }

  if (typeof window === "undefined") {
    return `/${restaurantSlug}/menu`;
  }

  return `${window.location.origin}/${restaurantSlug}/menu`;
}

function getTableQrImageUrl(tableId) {
  const orderLink = getOrderLink(tableId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(orderLink)}`;
}

function getPlanLabel(subscription) {
  if (!subscription?.plan) {
    return "No active plan";
  }

  return `${subscription.plan.displayName} (${subscription.plan.monthlyPrice}/mo)`;
}

function getTableTone(status) {
  if (status === "AVAILABLE") {
    return "success";
  }
  if (status === "OCCUPIED") {
    return "warning";
  }
  if (status === "RESERVED") {
    return "info";
  }
  return "neutral";
}

function getTablePreviewClasses(status) {
  if (status === "AVAILABLE") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }
  if (status === "OCCUPIED") {
    return "border-rose-300 bg-rose-50 text-rose-950";
  }
  if (status === "RESERVED") {
    return "border-sky-300 bg-sky-50 text-sky-950";
  }
  return "border-slate-300 bg-slate-100 text-slate-900";
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US");
}

function formatRecipeApprovalStatus(status, hasRecipe) {
  const normalized = String(status || "").trim().toUpperCase();
  if (hasRecipe || normalized) {
    return "Recipe ready";
  }
  return "Missing recipe";
}

function getRecipeApprovalTone(status, hasRecipe) {
  if (!hasRecipe) {
    return "warning";
  }
  return "success";
}

export default function OwnerPage({ session, onLogout }) {
  const token = session?.token;
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [addingMenuItem, setAddingMenuItem] = useState(false);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [updatingTableId, setUpdatingTableId] = useState("");
  const [updatingMenuItemId, setUpdatingMenuItemId] = useState("");
  const [savingIngredientId, setSavingIngredientId] = useState("");
  const [selectedRecipeItemId, setSelectedRecipeItemId] = useState("");
  const [recipeRows, setRecipeRows] = useState([]);
  const [recipeExists, setRecipeExists] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [ingredientStockInputs, setIngredientStockInputs] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    logoUrl: "",
    slug: "",
    publicOrderingEnabled: true,
    pickupEnabled: true
  });
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    employeeRole: EMPLOYEE_ROLE_OPTIONS[0].value,
    email: "",
    password: "",
    phone: ""
  });
  const [tableForm, setTableForm] = useState({
    name: "",
    seats: TABLE_SEAT_OPTIONS[1],
    status: TABLE_STATUS_OPTIONS[0]
  });
  const [menuForm, setMenuForm] = useState({
    name: "",
    category: MENU_CATEGORY_OPTIONS[0],
    price: "",
    stock: "0",
    description: "",
    photoUrl: ""
  });
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    unit: "pcs",
    minStock: "0",
    currentStock: "0"
  });

  const currentPlan = dashboard?.subscription?.plan || null;
  const pickupMenuLink = getPickupLink(dashboard?.restaurant?.slug);
  const requiresPlanSelection = Boolean(dashboard?.requiresPlanSelection);
  const canUseBusinessTools = !requiresPlanSelection;
  const restaurantName = dashboard?.restaurant?.name || "Restaurant";
  const selectedRecipeItem = useMemo(
    () => menuItems.find((item) => item.id === selectedRecipeItemId) || null,
    [menuItems, selectedRecipeItemId]
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );
  const metrics = useMemo(
    () => [
      {
        label: "Staff",
        value: dashboard?.employeesCount || 0,
        detail: "Active employee accounts"
      },
      {
        label: "Tables",
        value: dashboard?.tablesCount || 0,
        detail: "Configured dine-in tables"
      },
      {
        label: "Menu",
        value: dashboard?.menuItemsCount || 0,
        detail: "Menu items to manage"
      },
      {
        label: "Plan",
        value: currentPlan ? currentPlan.displayName : "Required",
        detail: currentPlan ? `${currentPlan.monthlyPrice}/month` : "Select a plan to unlock operations"
      }
    ],
    [currentPlan, dashboard?.employeesCount, dashboard?.menuItemsCount, dashboard?.tablesCount]
  );
  const nextSteps = useMemo(() => {
    const steps = [];

    if (requiresPlanSelection) {
      steps.push("Select a subscription plan.");
    }
    if ((dashboard?.tablesCount || 0) === 0) {
      steps.push("Add the first table.");
    }
    if ((dashboard?.menuItemsCount || 0) === 0) {
      steps.push("Add the first menu item.");
    }
    if ((dashboard?.employeesCount || 0) === 0) {
      steps.push("Invite staff accounts.");
    }

    return steps;
  }, [dashboard?.employeesCount, dashboard?.menuItemsCount, dashboard?.tablesCount, requiresPlanSelection]);

  function updateEmployeeField(key, value) {
    setEmployeeForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateTableField(key, value) {
    setTableForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateMenuField(key, value) {
    setMenuForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateIngredientField(key, value) {
    setIngredientForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateSettingsField(key, value) {
    setSettingsForm((previous) => ({ ...previous, [key]: value }));
  }

  function syncIngredientInputs(nextIngredients) {
    setIngredientStockInputs(
      Object.fromEntries(nextIngredients.map((ingredient) => [ingredient.id, String(ingredient.currentStock)]))
    );
  }

  function addRecipeRow() {
    setRecipeRows((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ingredientId: "",
        quantity: "1"
      }
    ]);
  }

  function updateRecipeRow(rowId, key, value) {
    setRecipeRows((previous) => previous.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  }

  function removeRecipeRow(rowId) {
    setRecipeRows((previous) => previous.filter((row) => row.id !== rowId));
  }

  function ensurePlanSelected() {
    if (!requiresPlanSelection) {
      return true;
    }

    setMessage("");
    setError("Select a plan in Settings before using staff, table, or menu tools.");
    setActiveTab("settings");
    return false;
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [dashboardResult, plansResult] = await Promise.all([apiRequest("/owner/dashboard", { token }), apiRequest("/plans")]);
      const nextPlans = plansResult.plans || [];

      setDashboard(dashboardResult);
      setPlans(nextPlans);
      setSelectedPlanId((previous) => dashboardResult.subscription?.plan?.id || previous || nextPlans[0]?.id || "");
      setSettingsForm({
        logoUrl: dashboardResult.restaurant?.logoUrl || "",
        slug: dashboardResult.restaurant?.slug || "",
        publicOrderingEnabled: Boolean(dashboardResult.restaurant?.publicOrderingEnabled),
        pickupEnabled: Boolean(dashboardResult.restaurant?.pickupEnabled)
      });

      if (dashboardResult.requiresPlanSelection) {
        setEmployees([]);
        setTables([]);
        setMenuItems([]);
        setIngredients([]);
        syncIngredientInputs([]);
        return;
      }

      const [employeesResult, tablesResult, menuItemsResult, ingredientsResult] = await Promise.all([
        apiRequest("/owner/employees", { token }),
        apiRequest("/owner/tables", { token }),
        apiRequest("/owner/menu", { token }),
        apiRequest("/owner/inventory/ingredients", { token })
      ]);

      setEmployees(employeesResult.employees || []);
      setTables(tablesResult.tables || []);
      const nextMenuItems = menuItemsResult.items || [];
      const nextIngredients = ingredientsResult.ingredients || [];
      setMenuItems(nextMenuItems);
      setIngredients(nextIngredients);
      syncIngredientInputs(nextIngredients);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (requiresPlanSelection) {
      setActiveTab("settings");
    }
  }, [requiresPlanSelection]);

  useEffect(() => {
    setSelectedRecipeItemId((previous) => {
      if (menuItems.some((item) => item.id === previous)) {
        return previous;
      }

      return menuItems[0]?.id || "";
    });
  }, [menuItems]);

  async function loadRecipe(menuItemId) {
    if (!menuItemId || requiresPlanSelection) {
      setRecipeRows([]);
      setRecipeExists(false);
      return;
    }

    setLoadingRecipe(true);

    try {
      const result = await apiRequest(`/owner/menu/${menuItemId}/recipe`, { token });
      setRecipeExists(Boolean(result.recipe));
      setRecipeRows(
        (result.recipe?.ingredients || []).map((ingredient) => ({
          id: ingredient.id,
          ingredientId: ingredient.ingredientId,
          quantity: String(ingredient.quantity)
        }))
      );
    } catch (requestError) {
      setRecipeExists(false);
      setRecipeRows([]);
      setError(requestError.message);
    } finally {
      setLoadingRecipe(false);
    }
  }

  useEffect(() => {
    if (!selectedRecipeItemId) {
      setRecipeRows([]);
      setRecipeExists(false);
      return;
    }

    loadRecipe(selectedRecipeItemId);
  }, [selectedRecipeItemId]);

  async function activatePlan(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedPlanId) {
      setError("Select a plan.");
      return;
    }

    setSavingPlan(true);

    try {
      const result = await apiRequest("/owner/subscription/select", {
        method: "POST",
        token,
        body: { planId: selectedPlanId }
      });

      setDashboard((previous) =>
        previous
          ? {
              ...previous,
              requiresPlanSelection: false,
              subscription: result.subscription
            }
          : previous
      );
      setMessage(`Plan switched to ${result.subscription.plan.displayName}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPlan(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingSettings(true);

    try {
      const result = await apiRequest("/owner/restaurant", {
        method: "PATCH",
        token,
        body: settingsForm
      });

      setDashboard((previous) =>
        previous
          ? {
              ...previous,
              restaurant: result.restaurant
            }
          : previous
      );
      setSettingsForm({
        logoUrl: result.restaurant?.logoUrl || "",
        slug: result.restaurant?.slug || "",
        publicOrderingEnabled: Boolean(result.restaurant?.publicOrderingEnabled),
        pickupEnabled: Boolean(result.restaurant?.pickupEnabled)
      });
      setMessage(result.message || "Settings updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function addEmployee(event) {
    event.preventDefault();

    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setAddingEmployee(true);

    try {
      const result = await apiRequest("/owner/employees", {
        method: "POST",
        token,
        body: employeeForm
      });

      setEmployees((previous) => [result.employee, ...previous]);
      setEmployeeForm({
        fullName: "",
        employeeRole: EMPLOYEE_ROLE_OPTIONS[0].value,
        email: "",
        password: "",
        phone: ""
      });
      setDashboard((previous) =>
        previous
          ? {
              ...previous,
              employeesCount: (previous.employeesCount || 0) + 1
            }
          : previous
      );
      setMessage("Employee added.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingEmployee(false);
    }
  }

  async function addTable(event) {
    event.preventDefault();

    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setAddingTable(true);

    try {
      const result = await apiRequest("/owner/tables", {
        method: "POST",
        token,
        body: tableForm
      });

      setTables((previous) => [result.table, ...previous]);
      setTableForm({
        name: "",
        seats: TABLE_SEAT_OPTIONS[1],
        status: TABLE_STATUS_OPTIONS[0]
      });
      setDashboard((previous) =>
        previous
          ? {
              ...previous,
              tablesCount: (previous.tablesCount || 0) + 1
            }
          : previous
      );
      setMessage("Table created.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingTable(false);
    }
  }

  async function updateTableStatus(tableId, status) {
    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setUpdatingTableId(tableId);

    try {
      const result = await apiRequest(`/owner/tables/${tableId}`, {
        method: "PATCH",
        token,
        body: { status }
      });

      setTables((previous) => previous.map((table) => (table.id === tableId ? result.table : table)));
      setMessage("Table updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingTableId("");
    }
  }

  async function addMenuItem(event) {
    event.preventDefault();

    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setAddingMenuItem(true);

    try {
      const result = await apiRequest("/owner/menu", {
        method: "POST",
        token,
        body: menuForm
      });

      setMenuItems((previous) => [result.item, ...previous]);
      setMenuForm({
        name: "",
        category: MENU_CATEGORY_OPTIONS[0],
        price: "",
        stock: "0",
        description: "",
        photoUrl: ""
      });
      setDashboard((previous) =>
        previous
          ? {
              ...previous,
              menuItemsCount: (previous.menuItemsCount || 0) + 1
            }
          : previous
      );
      setMessage("Menu item created.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingMenuItem(false);
    }
  }

  async function toggleMenuItemAvailability(itemId, isAvailable) {
    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setUpdatingMenuItemId(itemId);

    try {
      const result = await apiRequest(`/owner/menu/${itemId}`, {
        method: "PATCH",
        token,
        body: { isAvailable }
      });

      setMenuItems((previous) => previous.map((item) => (item.id === itemId ? result.item : item)));
      setMessage("Menu updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingMenuItemId("");
    }
  }

  async function addIngredient(event) {
    event.preventDefault();

    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setAddingIngredient(true);

    try {
      const result = await apiRequest("/owner/inventory/ingredients", {
        method: "POST",
        token,
        body: ingredientForm
      });

      const nextIngredients = [result.ingredient, ...ingredients];
      setIngredients(nextIngredients);
      syncIngredientInputs(nextIngredients);
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

  async function saveIngredientStock(ingredientId) {
    if (!ensurePlanSelected()) {
      return;
    }

    setMessage("");
    setError("");
    setSavingIngredientId(ingredientId);

    try {
      const result = await apiRequest(`/owner/inventory/ingredients/${ingredientId}`, {
        method: "PATCH",
        token,
        body: {
          currentStock: Number(ingredientStockInputs[ingredientId] || 0)
        }
      });

      const nextIngredients = ingredients.map((ingredient) => (ingredient.id === ingredientId ? result.ingredient : ingredient));
      setIngredients(nextIngredients);
      syncIngredientInputs(nextIngredients);
      setMessage(`${result.ingredient.name} stock updated.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingIngredientId("");
    }
  }

  function copyToClipboard(value, copiedLabel) {
    navigator.clipboard
      ?.writeText(value)
      .then(() => setMessage(`${copiedLabel} copied.`))
      .catch(() => setError("Could not copy to clipboard."));
  }

  function renderOverview() {
    return (
      <div className="space-y-5">
        <MetricGrid items={metrics} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Next steps" description="Focus only on the setup tasks that still block operations.">
            {nextSteps.length > 0 ? (
              <ul className="space-y-3 text-sm text-slate-700">
                {nextSteps.map((step) => (
                  <li key={step} className="rounded-xl bg-slate-50 px-4 py-3">
                    {step}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Setup complete" description="Staff, tables, menu, and plan are all configured." />
            )}
          </SectionCard>

          <SectionCard title="Ordering links" description="Keep the public ordering links easy to access and share.">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">Pickup menu</p>
                {pickupMenuLink ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a className="truncate text-sm text-brand-700 hover:text-brand-900" href={pickupMenuLink} rel="noreferrer" target="_blank">
                      {pickupMenuLink}
                    </a>
                    <button className={buttonStyles.secondary} onClick={() => copyToClipboard(pickupMenuLink, "Pickup link")} type="button">
                      Copy link
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Set a restaurant slug in Settings to enable the pickup link.</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">Example table QR link</p>
                {tables[0] ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a className="truncate text-sm text-brand-700 hover:text-brand-900" href={getOrderLink(tables[0].id)} rel="noreferrer" target="_blank">
                      {getOrderLink(tables[0].id)}
                    </a>
                    <button
                      className={buttonStyles.secondary}
                      onClick={() => copyToClipboard(getOrderLink(tables[0].id), `${tables[0].name} order link`)}
                      type="button"
                    >
                      Copy link
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Add a table to generate dine-in ordering links.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderStaff() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title="Add staff" description="Create staff accounts for kitchen, cashier, waiter, or inventory roles.">
          <form className="space-y-4" onSubmit={addEmployee}>
            <Field label="Full name">
              <input className={fieldStyles} required value={employeeForm.fullName} onChange={(event) => updateEmployeeField("fullName", event.target.value)} />
            </Field>
            <Field label="Role">
              <select className={fieldStyles} value={employeeForm.employeeRole} onChange={(event) => updateEmployeeField("employeeRole", event.target.value)}>
                {EMPLOYEE_ROLE_OPTIONS.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email">
              <input className={fieldStyles} required type="email" value={employeeForm.email} onChange={(event) => updateEmployeeField("email", event.target.value)} />
            </Field>
            <Field label="Password">
              <input
                className={fieldStyles}
                minLength={6}
                required
                type="password"
                value={employeeForm.password}
                onChange={(event) => updateEmployeeField("password", event.target.value)}
              />
            </Field>
            <Field hint="Optional" label="Phone">
              <input className={fieldStyles} value={employeeForm.phone} onChange={(event) => updateEmployeeField("phone", event.target.value)} />
            </Field>
            <button className={buttonStyles.primary} disabled={addingEmployee || !canUseBusinessTools} type="submit">
              {addingEmployee ? "Adding..." : "Add employee"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Current staff" description="Keep the staff list readable and role-focused.">
          {employees.length > 0 ? (
            <SimpleTable headers={["Name", "Role", "Email", "Phone"]}>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{employee.fullName}</td>
                  <td className="px-4 py-3 text-slate-700">{formatEmployeeRoleLabel(employee.employeeRole)}</td>
                  <td className="px-4 py-3 text-slate-700">{employee.email}</td>
                  <td className="px-4 py-3 text-slate-700">{employee.phone || "-"}</td>
                </tr>
              ))}
            </SimpleTable>
          ) : (
            <EmptyState title="No staff yet" description="Add your first employee account from the form on the left." />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderTables() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <SectionCard title="Create table" description="Name it, set the seats, and the QR link becomes ready as soon as you save.">
          <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_42%),white] p-4">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
              <div className={`aspect-square rounded-[28px] border p-4 shadow-sm ${getTablePreviewClasses(tableForm.status)}`}>
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.16em] opacity-70">Preview</p>
                    <p className="mt-2 text-2xl font-semibold">{tableForm.name || "T12"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] opacity-70">Seats</p>
                    <p className="mt-1 text-lg font-semibold">{tableForm.seats}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status on create</p>
                  <div className="mt-2">
                    <StatusPill tone={getTableTone(tableForm.status)}>{tableForm.status}</StatusPill>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  QR ordering link and QR preview appear automatically after the table is created.
                </div>
              </div>
            </div>
          </div>

          <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={addTable}>
            <Field label="Table name">
              <input
                className={fieldStyles}
                placeholder="Table 12"
                required
                value={tableForm.name}
                onChange={(event) => updateTableField("name", event.target.value)}
              />
            </Field>
            <Field label="Seats">
              <select className={fieldStyles} value={tableForm.seats} onChange={(event) => updateTableField("seats", Number(event.target.value))}>
                {TABLE_SEAT_OPTIONS.map((seatCount) => (
                  <option key={seatCount} value={seatCount}>
                    {seatCount} seats
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Status">
                <select className={fieldStyles} value={tableForm.status} onChange={(event) => updateTableField("status", event.target.value)}>
                  {TABLE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="md:col-span-2">
              <button className={`${buttonStyles.primary} w-full justify-center py-3`} disabled={addingTable || !canUseBusinessTools} type="submit">
                {addingTable ? "Creating..." : "Create table"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Tables" description="Each table gets its own QR preview so guests can scan and order.">
          {tables.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {tables.map((table) => {
                const orderLink = getOrderLink(table.id);
                const qrImageUrl = getTableQrImageUrl(table.id);

                return (
                  <article key={table.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{table.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{table.seats} seats</p>
                      </div>
                      <StatusPill tone={getTableTone(table.status)}>{table.status}</StatusPill>
                    </div>

                    <div className="mt-4 grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                        <img alt={`${table.name} QR code`} className="h-full w-full rounded-xl object-cover" src={qrImageUrl} />
                      </div>

                      <div className="space-y-3">
                        <Field label="Status">
                          <select
                            className={fieldStyles}
                            disabled={updatingTableId === table.id}
                            value={table.status}
                            onChange={(event) => updateTableStatus(table.id, event.target.value)}
                          >
                            {TABLE_STATUS_OPTIONS.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">QR link</p>
                          <a className="mt-2 block truncate text-sm text-brand-700 hover:text-brand-900" href={orderLink} rel="noreferrer" target="_blank">
                            {orderLink}
                          </a>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button className={buttonStyles.secondary} onClick={() => copyToClipboard(orderLink, `${table.name} order link`)} type="button">
                            Copy link
                          </button>
                          <button className={buttonStyles.subtle} onClick={() => copyToClipboard(qrImageUrl, `${table.name} QR image link`)} type="button">
                            Copy QR
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No tables yet" description="Add a table to start dine-in ordering." />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderMenu() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title="Kitchen-owned dishes" description="Kitchen staff creates dishes and recipes now. Owner reviews the live menu and controls visibility only.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Create flow</p>
              <p className="mt-2 text-sm text-slate-600">
                Chef creates the dish in Kitchen, writes the recipe, and asks inventory for missing ingredients.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Owner actions</p>
              <p className="mt-2 text-sm text-slate-600">
                You can still hide or show menu items and review how each dish is connected to inventory.
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Menu items" description="Kitchen adds dishes. Owner reviews the live menu and can control visibility here.">
            {menuItems.length > 0 ? (
              <SimpleTable headers={["Item", "Category", "Price", "Stock", "Recipe", "Actions"]}>
                {menuItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.description ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}
                        {!item.isOrderable ? <p className="mt-2 text-xs font-medium text-slate-500">{item.availabilityText}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.category}</td>
                    <td className="px-4 py-3 text-slate-700">{formatPrice(item.price)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{item.stock} manual</p>
                      <p className="text-xs text-slate-500">{item.orderableStock} orderable</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="space-y-2">
                        <StatusPill tone={getRecipeApprovalTone(item.recipeApprovalStatus, item.hasRecipe)}>
                          {formatRecipeApprovalStatus(item.recipeApprovalStatus, item.hasRecipe)}
                        </StatusPill>
                        {item.hasRecipe ? (
                          <div>
                            <p>{item.recipeIngredientCount} ingredients</p>
                            {item.recipeLimited ? <p className="text-xs text-slate-500">Ingredient limited</p> : null}
                          </div>
                        ) : (
                          <span className="text-slate-500">Kitchen has not submitted a recipe</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={buttonStyles.secondary}
                          disabled={updatingMenuItemId === item.id || !canUseBusinessTools}
                          onClick={() => toggleMenuItemAvailability(item.id, !item.isAvailable)}
                          type="button"
                        >
                          {updatingMenuItemId === item.id ? "Updating..." : item.isAvailable ? "Visible" : "Hidden"}
                        </button>
                        <button className={buttonStyles.subtle} onClick={() => setSelectedRecipeItemId(item.id)} type="button">
                          View recipe
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </SimpleTable>
            ) : (
              <EmptyState title="No menu items yet" description="Kitchen will add the first dish from the kitchen workspace." />
            )}
          </SectionCard>

          <SectionCard
            title={selectedRecipeItem ? `${selectedRecipeItem.name} recipe` : "Recipe view"}
            description="Kitchen manages the recipe. Owner can review the ingredient relation here."
          >
            {menuItems.length > 0 ? (
              <div className="space-y-4">
                <Field label="Menu item">
                  <select className={fieldStyles} value={selectedRecipeItemId} onChange={(event) => setSelectedRecipeItemId(event.target.value)}>
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedRecipeItem ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          Recipe state: {formatRecipeApprovalStatus(selectedRecipeItem.recipeApprovalStatus, selectedRecipeItem.hasRecipe)}
                        </p>
                        <p className="mt-1">
                          Menu state: {selectedRecipeItem.availabilityText}
                        </p>
                        {selectedRecipeItem.recipeSubmittedByName ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Last updated by {selectedRecipeItem.recipeSubmittedByName} on {formatDateTime(selectedRecipeItem.recipeLastSubmittedAt)}
                          </p>
                        ) : null}
                      </div>
                      <StatusPill tone={getRecipeApprovalTone(selectedRecipeItem.recipeApprovalStatus, selectedRecipeItem.hasRecipe)}>
                        {formatRecipeApprovalStatus(selectedRecipeItem.recipeApprovalStatus, selectedRecipeItem.hasRecipe)}
                      </StatusPill>
                    </div>
                  </div>
                ) : null}

                {loadingRecipe ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Loading recipe...
                  </div>
                ) : recipeExists ? (
                  <>
                    <div className="space-y-3">
                      {recipeRows.length > 0 ? (
                        recipeRows.map((row) => (
                          <div key={row.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_160px_100px]">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                              {ingredients.find((ingredient) => ingredient.id === row.ingredientId)?.name || "Ingredient"}
                            </div>
                            <input
                              className={fieldStyles}
                              disabled
                              readOnly
                              type="text"
                              value={row.quantity}
                            />
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                              {ingredients.find((ingredient) => ingredient.id === row.ingredientId)?.unit || "unit"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          Kitchen has not submitted a recipe yet.
                        </div>
                      )}
                    </div>

                  </>
                ) : (
                  <EmptyState title="No kitchen recipe yet" description="Kitchen staff must create the dish recipe first." />
                )}
              </div>
            ) : (
              <EmptyState title="No menu items yet" description="Kitchen needs to create a dish before a recipe can appear here." />
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderInventory() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title="Add ingredient" description="Create stock items that menu recipes will consume.">
          <form className="space-y-4" onSubmit={addIngredient}>
            <Field label="Ingredient name">
              <input className={fieldStyles} required value={ingredientForm.name} onChange={(event) => updateIngredientField("name", event.target.value)} />
            </Field>
            <Field label="Unit">
              <input className={fieldStyles} required value={ingredientForm.unit} onChange={(event) => updateIngredientField("unit", event.target.value)} />
            </Field>
            <Field label="Minimum stock">
              <input
                className={fieldStyles}
                min="0"
                step="0.001"
                type="number"
                value={ingredientForm.minStock}
                onChange={(event) => updateIngredientField("minStock", event.target.value)}
              />
            </Field>
            <Field label="Current stock">
              <input
                className={fieldStyles}
                min="0"
                step="0.001"
                type="number"
                value={ingredientForm.currentStock}
                onChange={(event) => updateIngredientField("currentStock", event.target.value)}
              />
            </Field>
            <button className={buttonStyles.primary} disabled={addingIngredient || !canUseBusinessTools} type="submit">
              {addingIngredient ? "Adding..." : "Add ingredient"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Inventory ingredients" description="Stock updates here directly affect recipe-based menu availability.">
          {ingredients.length > 0 ? (
            <div className="space-y-3">
              {ingredients.map((ingredient) => (
                <article key={ingredient.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{ingredient.name}</p>
                        {ingredient.isLowStock ? <StatusPill tone="warning">Low stock</StatusPill> : <StatusPill tone="success">Healthy</StatusPill>}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {ingredient.unit} • min {formatQuantity(ingredient.minStock)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        className={fieldStyles}
                        min="0"
                        step="0.001"
                        type="number"
                        value={ingredientStockInputs[ingredient.id] || "0"}
                        onChange={(event) =>
                          setIngredientStockInputs((previous) => ({
                            ...previous,
                            [ingredient.id]: event.target.value
                          }))
                        }
                      />
                      <button
                        className={buttonStyles.primary}
                        disabled={savingIngredientId === ingredient.id || !canUseBusinessTools}
                        onClick={() => saveIngredientStock(ingredient.id)}
                        type="button"
                      >
                        {savingIngredientId === ingredient.id ? "Saving..." : "Update stock"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No ingredients yet" description="Add stock ingredients on the left to start building recipe-based menu control." />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Restaurant settings" description="Branding and ordering controls in one place.">
          <form className="space-y-4" onSubmit={saveSettings}>
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-4">
              <RestaurantLogo className="h-16 w-16 border border-slate-200 text-lg" name={restaurantName} src={settingsForm.logoUrl} />
              <div>
                <p className="font-medium text-slate-900">{restaurantName}</p>
                <p className="text-sm text-slate-500">{getPlanLabel(dashboard?.subscription)}</p>
              </div>
            </div>
            <Field hint="Optional" label="Logo URL">
              <input className={fieldStyles} value={settingsForm.logoUrl} onChange={(event) => updateSettingsField("logoUrl", event.target.value)} />
            </Field>
            <Field label="Pickup slug">
              <input className={fieldStyles} value={settingsForm.slug} onChange={(event) => updateSettingsField("slug", event.target.value)} />
            </Field>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Public dine-in ordering</p>
                <p className="text-sm text-slate-500">Allow customers to order from table links.</p>
              </div>
              <input checked={settingsForm.publicOrderingEnabled} onChange={(event) => updateSettingsField("publicOrderingEnabled", event.target.checked)} type="checkbox" />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Pickup ordering</p>
                <p className="text-sm text-slate-500">Show the pickup menu page for online orders.</p>
              </div>
              <input checked={settingsForm.pickupEnabled} onChange={(event) => updateSettingsField("pickupEnabled", event.target.checked)} type="checkbox" />
            </label>
            <button className={buttonStyles.primary} disabled={savingSettings} type="submit">
              {savingSettings ? "Saving..." : "Save settings"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Plan" description="Choose the plan that unlocks restaurant tools.">
          <form className="space-y-4" onSubmit={activatePlan}>
            <div className="space-y-3">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const isCurrent = currentPlan?.id === plan.id;

                return (
                  <label
                    key={plan.id}
                    className={`flex cursor-pointer items-start justify-between rounded-xl border px-4 py-4 transition ${
                      isSelected ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-900">{plan.displayName}</p>
                      <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-semibold text-slate-900">${plan.monthlyPrice}</p>
                      {isCurrent ? <p className="mt-1 text-xs font-medium text-brand-700">Current plan</p> : null}
                    </div>
                    <input
                      checked={isSelected}
                      className="sr-only"
                      name="plan"
                      onChange={() => setSelectedPlanId(plan.id)}
                      type="radio"
                    />
                  </label>
                );
              })}
            </div>
            <button className={buttonStyles.primary} disabled={savingPlan || !selectedPlan} type="submit">
              {savingPlan ? "Saving..." : selectedPlan ? `Use ${selectedPlan.displayName}` : "Select a plan"}
            </button>
          </form>
        </SectionCard>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          actions={
            <>
              <button className={buttonStyles.secondary} onClick={() => loadData()} type="button">
                Refresh
              </button>
              <button className={buttonStyles.secondary} onClick={onLogout} type="button">
                Logout
              </button>
            </>
          }
          description="Manage staff, tables, menu, and business settings from a single owner workspace."
          eyebrow="Owner workspace"
          meta={[session.user.fullName, getPlanLabel(dashboard?.subscription)]}
          title={restaurantName}
        />

        {requiresPlanSelection ? (
          <MessageBanner tone="warning">
            A plan is required before staff, table, and menu tools become active.
          </MessageBanner>
        ) : null}
        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}

        <Tabs activeKey={activeTab} items={OWNER_TABS} onChange={setActiveTab} />

        {loading ? (
          <SectionCard>
            <p className="text-sm text-slate-600">Loading workspace...</p>
          </SectionCard>
        ) : null}
        {!loading && activeTab === "overview" ? renderOverview() : null}
        {!loading && activeTab === "staff" ? renderStaff() : null}
        {!loading && activeTab === "tables" ? renderTables() : null}
        {!loading && activeTab === "menu" ? renderMenu() : null}
        {!loading && activeTab === "inventory" ? renderInventory() : null}
        {!loading && activeTab === "settings" ? renderSettings() : null}
      </div>
    </AppShell>
  );
}
