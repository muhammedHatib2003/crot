import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, apiDownload, startSubscriptionCheckout } from "../api";
import OwnerPlanCheckout from "../components/owner/OwnerPlanCheckout";
import OwnerPlanGateModal from "../components/owner/OwnerPlanGateModal";
import TableCreatePanel from "../components/owner/TableCreatePanel";
import TableQrCard from "../components/owner/TableQrCard";
import { createTableQrDataUrl } from "../components/owner/TableQrCode";
import TableQrPrint from "../components/print/TableQrPrint";
import { triggerPrint } from "../components/print/printUtils";
import RestaurantLogo from "../components/RestaurantLogo";
import { getDisplayScreenPath } from "../utils/displayApi";
import {
  getPublicAppOrigin,
  getPublicPath,
  getTableOrderLink,
  isLocalOnlyOrderOrigin,
  setPublicAppOrigin
} from "../utils/tableOrderLinks";
import useAppTranslation from "../hooks/useAppTranslation";
import useOrderNotifications from "../hooks/useOrderNotifications";
import {
  translateCategory,
  translateEmployeeRole,
  translatePaymentMethod
} from "../utils/locale";
import { bindVisibilityRefresh, FAST_POLL_MS } from "../utils/polling";
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
  { value: "chef" },
  { value: "cashier" },
  { value: "waiter" },
  { value: "inventory_manager" }
];
const TABLE_SEAT_OPTIONS = [2, 4, 6, 8, 10];
const TABLE_STATUS_OPTIONS = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
const MENU_CATEGORY_OPTIONS = ["General", "Starter", "Main", "Dessert", "Drink"];

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPickupLink(restaurantSlug) {
  if (!restaurantSlug) {
    return "";
  }

  return getPublicPath(`/${restaurantSlug}/menu`);
}

function getPlanLabel(subscription, t, formatCurrency) {
  if (!subscription?.plan) {
    return t("owner.plan.none");
  }

  return `${subscription.plan.displayName} (${t("owner.plan.monthly", { price: formatCurrency(subscription.plan.monthlyPrice) })})`;
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

function formatRecipeApprovalStatus(status, hasRecipe, t) {
  const normalized = String(status || "").trim().toUpperCase();
  if (hasRecipe || normalized) {
    return t("owner.menu.recipeReady");
  }
  return t("owner.menu.missingRecipe");
}

function getRecipeApprovalTone(status, hasRecipe) {
  if (!hasRecipe) {
    return "warning";
  }
  return "success";
}

export default function OwnerPage({ session, onLogout }) {
  const { t, formatCurrency, formatNumber, formatDateTime } = useAppTranslation();
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
  const [printTableQr, setPrintTableQr] = useState(null);
  const [printingTableId, setPrintingTableId] = useState("");
  const [reportFrom, setReportFrom] = useState(() => toDateInputValue(new Date()));
  const [reportTo, setReportTo] = useState(() => toDateInputValue(new Date()));
  const [reportGroupBy, setReportGroupBy] = useState("day");
  const [salesReport, setSalesReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    logoUrl: "",
    coverImageUrl: "",
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
    description: "",
    photoUrl: ""
  });
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    unit: "pcs",
    minStock: "0",
    currentStock: "0"
  });
  const [activeOrders, setActiveOrders] = useState([]);

  const currentPlan = dashboard?.subscription?.plan || null;
  const pickupMenuLink = getPickupLink(dashboard?.restaurant?.slug);
  const orderStatusScreenLink = dashboard?.restaurant?.slug
    ? getPublicPath(getDisplayScreenPath(dashboard.restaurant.slug))
    : "";
  const requiresPlanSelection = Boolean(dashboard?.requiresPlanSelection);
  const canUseBusinessTools = !requiresPlanSelection;
  const showPlanGate = requiresPlanSelection && !loading;
  const restaurantName = dashboard?.restaurant?.name || t("common.restaurantFallback");
  const ownerTabs = useMemo(() => {
    const tabs = [
      { id: "overview", label: t("owner.tabs.overview") },
      { id: "staff", label: t("owner.tabs.staff") },
      { id: "tables", label: t("owner.tabs.tables") },
      { id: "menu", label: t("owner.tabs.menu") },
      { id: "inventory", label: t("owner.tabs.inventory") },
      { id: "settings", label: t("owner.tabs.settings") }
    ];

    if (canUseBusinessTools) {
      tabs.splice(1, 0, { id: "reports", label: t("owner.tabs.reports") });
    }

    return tabs;
  }, [canUseBusinessTools, t]);
  const selectedRecipeItem = useMemo(
    () => menuItems.find((item) => item.id === selectedRecipeItemId) || null,
    [menuItems, selectedRecipeItemId]
  );
  const metrics = useMemo(
    () => [
      {
        label: t("owner.metrics.staff"),
        value: dashboard?.employeesCount || 0,
        detail: t("owner.metrics.staffDetail")
      },
      {
        label: t("owner.metrics.tables"),
        value: dashboard?.tablesCount || 0,
        detail: t("owner.metrics.tablesDetail")
      },
      {
        label: t("owner.metrics.menu"),
        value: dashboard?.menuItemsCount || 0,
        detail: t("owner.metrics.menuDetail")
      },
      {
        label: t("owner.metrics.plan"),
        value: currentPlan ? currentPlan.displayName : t("owner.metrics.planRequired"),
        detail: currentPlan
          ? t("common.monthlyPriceShort", { price: formatCurrency(currentPlan.monthlyPrice) })
          : t("owner.metrics.planDetail")
      }
    ],
    [currentPlan, dashboard?.employeesCount, dashboard?.menuItemsCount, dashboard?.tablesCount, formatCurrency, t]
  );
  const nextSteps = useMemo(() => {
    const steps = [];

    if (requiresPlanSelection) {
      steps.push(t("owner.steps.selectPlan"));
    }
    if ((dashboard?.tablesCount || 0) === 0) {
      steps.push(t("owner.steps.addTable"));
    }
    if ((dashboard?.menuItemsCount || 0) === 0) {
      steps.push(t("owner.steps.addMenuItem"));
    }
    if ((dashboard?.employeesCount || 0) === 0) {
      steps.push(t("owner.steps.inviteStaff"));
    }

    return steps;
  }, [dashboard?.employeesCount, dashboard?.menuItemsCount, dashboard?.tablesCount, requiresPlanSelection, t]);

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
    setError(t("owner.planRequired"));
    return false;
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [dashboardResult, plansResult] = await Promise.all([apiRequest("/owner/dashboard", { token }), apiRequest("/plans")]);
      const nextPlans = plansResult.plans || [];

      setDashboard(dashboardResult);
      if (dashboardResult.publicAppUrl) {
        setPublicAppOrigin(dashboardResult.publicAppUrl);
      }
      setPlans(nextPlans);
      setSelectedPlanId((previous) => dashboardResult.subscription?.plan?.id || previous || nextPlans[0]?.id || "");
      setSettingsForm({
        logoUrl: dashboardResult.restaurant?.logoUrl || "",
        coverImageUrl: dashboardResult.restaurant?.coverImageUrl || "",
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
    if (!token || requiresPlanSelection) {
      return undefined;
    }

    let cancelled = false;

    async function loadActiveOrders() {
      try {
        const result = await apiRequest("/restaurant/orders?active=true", { token });
        if (!cancelled) {
          setActiveOrders(result.orders || []);
        }
      } catch {
        // Polling errors should not block the owner workspace.
      }
    }

    loadActiveOrders();
    const poller = window.setInterval(loadActiveOrders, FAST_POLL_MS);
    const unbindVisibility = bindVisibilityRefresh(loadActiveOrders);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
      unbindVisibility();
    };
  }, [token, requiresPlanSelection]);

  useEffect(() => {
    if (activeTab !== "reports" || !canUseBusinessTools || !token) {
      return;
    }

    loadSalesReport();
  }, [activeTab, reportFrom, reportTo, reportGroupBy, canUseBusinessTools, token]);

  useEffect(() => {
    if (!printTableQr) {
      return undefined;
    }

    triggerPrint();

    function handleAfterPrint() {
      setPrintTableQr(null);
    }

    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printTableQr]);

  useEffect(() => {
    if (!requiresPlanSelection) {
      return undefined;
    }

    function handleVisibilityRefresh() {
      if (document.visibilityState === "visible") {
        loadData();
      }
    }

    window.addEventListener("focus", loadData);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      window.removeEventListener("focus", loadData);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
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

  useOrderNotifications(activeOrders, { enabled: canUseBusinessTools && !loading, panel: "owner" });

  async function activatePlan(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedPlanId) {
      setError(t("owner.messages.selectPlan"));
      return;
    }

    setSavingPlan(true);

    try {
      const result = await startSubscriptionCheckout(selectedPlanId, token);

      if (result?.paymentPageUrl) {
        setMessage(t("owner.messages.redirectingPayment"));
        window.location.assign(result.paymentPageUrl);
        return;
      }

      setError(t("owner.messages.paymentPageFailed"));
    } catch (requestError) {
      setError(requestError.message || t("owner.messages.paymentStartFailed"));
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
        coverImageUrl: result.restaurant?.coverImageUrl || "",
        slug: result.restaurant?.slug || "",
        publicOrderingEnabled: Boolean(result.restaurant?.publicOrderingEnabled),
        pickupEnabled: Boolean(result.restaurant?.pickupEnabled)
      });
      setMessage(result.message || t("owner.messages.settingsUpdated"));
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
      setMessage(t("owner.messages.employeeAdded"));
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
      setMessage(t("owner.messages.tableCreated"));
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
      setMessage(t("owner.messages.tableUpdated"));
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
      setMessage(t("owner.messages.menuItemCreated"));
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
      setMessage(t("owner.messages.menuUpdated"));
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
      setMessage(t("owner.messages.ingredientAdded"));
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
      setMessage(t("owner.messages.stockUpdated", { name: result.ingredient.name }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingIngredientId("");
    }
  }

  function copyToClipboard(value, copiedLabel) {
    navigator.clipboard
      ?.writeText(value)
      .then(() => setMessage(t("common.copied", { label: copiedLabel })))
      .catch(() => setError(t("common.clipboardFailed")));
  }

  function applyReportPreset(preset) {
    const now = new Date();

    if (preset === "today") {
      const value = toDateInputValue(now);
      setReportFrom(value);
      setReportTo(value);
      setReportGroupBy("day");
      return;
    }

    if (preset === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setReportFrom(toDateInputValue(from));
      setReportTo(toDateInputValue(to));
      setReportGroupBy("day");
      return;
    }

    if (preset === "yearly") {
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      setReportFrom(toDateInputValue(from));
      setReportTo(toDateInputValue(now));
      setReportGroupBy("month");
    }
  }

  async function loadSalesReport() {
    if (!token || !canUseBusinessTools) {
      return;
    }

    setLoadingReport(true);

    try {
      const params = new URLSearchParams({
        from: reportFrom,
        to: reportTo,
        groupBy: reportGroupBy
      });
      const result = await apiRequest(`/owner/reports/sales?${params.toString()}`, { token });
      setSalesReport(result.report || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingReport(false);
    }
  }

  async function downloadSalesReport() {
    if (!token || !canUseBusinessTools) {
      return;
    }

    setDownloadingReport(true);
    setError("");

    try {
      const params = new URLSearchParams({
        from: reportFrom,
        to: reportTo,
        groupBy: reportGroupBy
      });
      const blob = await apiDownload(`/owner/reports/sales/export?${params.toString()}`, { token });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sales-${reportFrom}-${reportTo}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(t("owner.reports.downloadStarted"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloadingReport(false);
    }
  }

  function translateReportOrderType(orderType) {
    const key = `owner.reports.orderTypes.${String(orderType || "").trim().toUpperCase()}`;
    const translated = t(key);
    return translated === key ? orderType : translated;
  }

  async function handlePrintTableQr(table) {
    if (!table?.id) {
      return;
    }

    setPrintingTableId(table.id);
    setError("");
    setMessage("");

    try {
      const orderLink = getTableOrderLink(table.id);
      const qrDataUrl = await createTableQrDataUrl(table.id, 320);
      setPrintTableQr({
        tableName: table.name,
        seats: table.seats,
        orderLink,
        qrDataUrl
      });
    } catch (requestError) {
      setError(requestError.message || t("owner.messages.qrPrintFailed"));
    } finally {
      setPrintingTableId("");
    }
  }

  function renderOverview() {
    return (
      <div className="space-y-5">
        <MetricGrid items={metrics} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title={t("owner.overview.nextStepsTitle")} description={t("owner.overview.nextStepsDescription")}>
            {nextSteps.length > 0 ? (
              <ul className="space-y-3 text-sm text-slate-700">
                {nextSteps.map((step) => (
                  <li key={step} className="rounded-xl bg-slate-50 px-4 py-3">
                    {step}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("owner.overview.setupCompleteTitle")} description={t("owner.overview.setupCompleteDescription")} />
            )}
          </SectionCard>

          <SectionCard title={t("owner.overview.orderingLinksTitle")} description={t("owner.overview.orderingLinksDescription")}>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{t("owner.overview.pickupMenu")}</p>
                {pickupMenuLink ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a className="truncate text-sm text-brand-700 hover:text-brand-900" href={pickupMenuLink} rel="noreferrer" target="_blank">
                      {pickupMenuLink}
                    </a>
                    <button className={buttonStyles.secondary} onClick={() => copyToClipboard(pickupMenuLink, t("owner.overview.pickupMenu"))} type="button">
                      {t("owner.overview.copyLink")}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t("owner.overview.pickupLinkHint")}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{t("owner.overview.orderStatusScreen")}</p>
                <p className="mt-1 text-xs text-slate-500">{t("owner.overview.orderStatusScreenHint")}</p>
                {orderStatusScreenLink ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a className={buttonStyles.primary} href={orderStatusScreenLink} rel="noreferrer" target="_blank">
                      {t("owner.overview.openOrderStatusScreen")}
                    </a>
                    <button
                      className={buttonStyles.secondary}
                      onClick={() => copyToClipboard(orderStatusScreenLink, t("owner.overview.orderStatusScreen"))}
                      type="button"
                    >
                      {t("owner.overview.copyLink")}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t("owner.overview.displayScreenHint")}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{t("owner.overview.exampleTableQr")}</p>
                {tables[0] ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a className="truncate text-sm text-brand-700 hover:text-brand-900" href={getTableOrderLink(tables[0].id)} rel="noreferrer" target="_blank">
                      {getTableOrderLink(tables[0].id)}
                    </a>
                    <button
                      className={buttonStyles.secondary}
                      onClick={() => copyToClipboard(getTableOrderLink(tables[0].id), `${tables[0].name} order link`)}
                      type="button"
                    >
                      {t("owner.overview.copyLink")}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t("owner.overview.addTableForLinks")}</p>
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
        <SectionCard title={t("owner.staff.addTitle")} description={t("owner.staff.addDescription")}>
          <form className="space-y-4" onSubmit={addEmployee}>
            <Field label={t("common.fullName")}>
              <input className={fieldStyles} required value={employeeForm.fullName} onChange={(event) => updateEmployeeField("fullName", event.target.value)} />
            </Field>
            <Field label={t("common.role")}>
              <select className={fieldStyles} value={employeeForm.employeeRole} onChange={(event) => updateEmployeeField("employeeRole", event.target.value)}>
                {EMPLOYEE_ROLE_OPTIONS.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {translateEmployeeRole(t, roleOption.value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("common.labels.email")}>
              <input className={fieldStyles} required type="email" value={employeeForm.email} onChange={(event) => updateEmployeeField("email", event.target.value)} />
            </Field>
            <Field label={t("common.password")}>
              <input
                className={fieldStyles}
                minLength={6}
                required
                type="password"
                value={employeeForm.password}
                onChange={(event) => updateEmployeeField("password", event.target.value)}
              />
            </Field>
            <Field hint={t("common.optional")} label={t("common.phone")}>
              <input className={fieldStyles} value={employeeForm.phone} onChange={(event) => updateEmployeeField("phone", event.target.value)} />
            </Field>
            <button className={buttonStyles.primary} disabled={addingEmployee || !canUseBusinessTools} type="submit">
              {addingEmployee ? t("common.actions.adding") : t("owner.staff.addEmployee")}
            </button>
          </form>
        </SectionCard>

        <SectionCard title={t("owner.staff.currentTitle")} description={t("owner.staff.currentDescription")}>
          {employees.length > 0 ? (
            <SimpleTable headers={[t("owner.staff.headers.name"), t("owner.staff.headers.role"), t("owner.staff.headers.email"), t("owner.staff.headers.phone")]}>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{employee.fullName}</td>
                  <td className="px-4 py-3 text-slate-700">{translateEmployeeRole(t, employee.employeeRole)}</td>
                  <td className="px-4 py-3 text-slate-700">{employee.email}</td>
                  <td className="px-4 py-3 text-slate-700">{employee.phone || t("common.notAvailable")}</td>
                </tr>
              ))}
            </SimpleTable>
          ) : (
            <EmptyState title={t("owner.staff.emptyTitle")} description={t("owner.staff.emptyDescription")} />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderTables() {
    const publicOrderBase = getPublicAppOrigin();

    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <SectionCard title={t("owner.tables.createTitle")} description={t("owner.tables.createDescription")}>
          <TableCreatePanel
            addingTable={addingTable}
            canUseBusinessTools={canUseBusinessTools}
            tableForm={tableForm}
            onFieldChange={updateTableField}
            onSubmit={addTable}
          />
        </SectionCard>

        <SectionCard title={t("owner.tables.listTitle")} description={t("owner.tables.listDescription")}>
          {isLocalOnlyOrderOrigin() ? (
            <MessageBanner tone="warning">
              {t("owner.tables.localOriginWarning")}
            </MessageBanner>
          ) : publicOrderBase ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
              <span className="font-semibold">{t("owner.tables.guestLinks")}</span>{" "}
              <span className="break-all font-medium">{publicOrderBase}</span>
            </div>
          ) : null}

          {tables.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {tables.map((table) => (
                <TableQrCard
                  key={table.id}
                  orderLink={getTableOrderLink(table.id)}
                  printingTableId={printingTableId}
                  table={table}
                  updatingTableId={updatingTableId}
                  onCopyLink={(link, name) => copyToClipboard(link, `${name} order link`)}
                  onPrint={handlePrintTableQr}
                  onStatusChange={updateTableStatus}
                />
              ))}
            </div>
          ) : (
            <EmptyState title={t("owner.tables.emptyTitle")} description={t("owner.tables.emptyDescription")} />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderMenu() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title={t("owner.menu.kitchenOwnedTitle")} description={t("owner.menu.kitchenOwnedDescription")}>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("owner.menu.createFlow")}</p>
              <p className="mt-2 text-sm text-slate-600">
                {t("owner.menu.createFlowDescription")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t("owner.menu.ownerActions")}</p>
              <p className="mt-2 text-sm text-slate-600">
                {t("owner.menu.ownerActionsDescription")}
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title={t("owner.menu.itemsTitle")} description={t("owner.menu.itemsDescription")}>
            {menuItems.length > 0 ? (
              <SimpleTable headers={[t("owner.menu.headers.item"), t("owner.menu.headers.category"), t("owner.menu.headers.price"), t("owner.menu.headers.availability"), t("owner.menu.headers.recipe"), t("owner.menu.headers.actions")]}>
                {menuItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.description ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}
                        {!item.isOrderable ? <p className="mt-2 text-xs font-medium text-slate-500">{item.availabilityText}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{translateCategory(t, item.category)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{item.isOrderable ? t("owner.menu.available") : item.availabilityText || t("owner.menu.unavailable")}</p>
                      {item.hasRecipe && item.orderableStock != null ? (
                        <p className="text-xs text-slate-500">{t("owner.menu.servingsFromIngredients", { count: item.orderableStock })}</p>
                      ) : (
                        <p className="text-xs text-slate-500">{t("owner.menu.noIngredientRecipe")}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="space-y-2">
                        <StatusPill tone={getRecipeApprovalTone(item.recipeApprovalStatus, item.hasRecipe)}>
                          {formatRecipeApprovalStatus(item.recipeApprovalStatus, item.hasRecipe, t)}
                        </StatusPill>
                        {item.hasRecipe ? (
                          <div>
                            <p>{t("common.ingredientsCount", { count: item.recipeIngredientCount })}</p>
                            {item.recipeLimited ? <p className="text-xs text-slate-500">{t("owner.menu.ingredientLimited")}</p> : null}
                          </div>
                        ) : (
                          <span className="text-slate-500">{t("owner.menu.noKitchenRecipe")}</span>
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
                          {updatingMenuItemId === item.id ? t("common.actions.updating") : item.isAvailable ? t("owner.menu.visible") : t("owner.menu.hidden")}
                        </button>
                        <button className={buttonStyles.subtle} onClick={() => setSelectedRecipeItemId(item.id)} type="button">
                          {t("owner.menu.viewRecipe")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </SimpleTable>
            ) : (
              <EmptyState title={t("owner.menu.emptyTitle")} description={t("owner.menu.emptyDescription")} />
            )}
          </SectionCard>

          <SectionCard
            title={selectedRecipeItem ? t("owner.menu.recipeViewNamed", { name: selectedRecipeItem.name }) : t("owner.menu.recipeViewTitle")}
            description={t("owner.menu.recipeViewDescription")}
          >
            {menuItems.length > 0 ? (
              <div className="space-y-4">
                <Field label={t("owner.menu.menuItemLabel")}>
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
                          {t("owner.menu.recipeState", {
                            status: formatRecipeApprovalStatus(selectedRecipeItem.recipeApprovalStatus, selectedRecipeItem.hasRecipe, t)
                          })}
                        </p>
                        <p className="mt-1">
                          {t("owner.menu.menuState", { state: selectedRecipeItem.availabilityText })}
                        </p>
                        {selectedRecipeItem.recipeSubmittedByName ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {t("owner.menu.lastUpdatedBy", {
                              name: selectedRecipeItem.recipeSubmittedByName,
                              date: formatDateTime(selectedRecipeItem.recipeLastSubmittedAt)
                            })}
                          </p>
                        ) : null}
                      </div>
                      <StatusPill tone={getRecipeApprovalTone(selectedRecipeItem.recipeApprovalStatus, selectedRecipeItem.hasRecipe)}>
                        {formatRecipeApprovalStatus(selectedRecipeItem.recipeApprovalStatus, selectedRecipeItem.hasRecipe, t)}
                      </StatusPill>
                    </div>
                  </div>
                ) : null}

                {loadingRecipe ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {t("common.loading.recipe")}
                  </div>
                ) : recipeExists ? (
                  <>
                    <div className="space-y-3">
                      {recipeRows.length > 0 ? (
                        recipeRows.map((row) => (
                          <div key={row.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_160px_100px]">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                              {ingredients.find((ingredient) => ingredient.id === row.ingredientId)?.name || t("common.labels.ingredients")}
                            </div>
                            <input
                              className={fieldStyles}
                              disabled
                              readOnly
                              type="text"
                              value={row.quantity}
                            />
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                              {ingredients.find((ingredient) => ingredient.id === row.ingredientId)?.unit || t("common.labels.unit")}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          {t("owner.menu.noKitchenRecipeYet")}
                        </div>
                      )}
                    </div>

                  </>
                ) : (
                  <EmptyState title={t("owner.menu.noKitchenRecipeEmptyTitle")} description={t("owner.menu.noKitchenRecipeEmptyDescription")} />
                )}
              </div>
            ) : (
              <EmptyState title={t("owner.menu.noMenuForRecipeTitle")} description={t("owner.menu.noMenuForRecipeDescription")} />
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderInventory() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title={t("owner.inventory.addTitle")} description={t("owner.inventory.addDescription")}>
          <form className="space-y-4" onSubmit={addIngredient}>
            <Field label={t("owner.inventory.ingredientName")}>
              <input className={fieldStyles} required value={ingredientForm.name} onChange={(event) => updateIngredientField("name", event.target.value)} />
            </Field>
            <Field label={t("common.labels.unit")}>
              <input className={fieldStyles} required value={ingredientForm.unit} onChange={(event) => updateIngredientField("unit", event.target.value)} />
            </Field>
            <Field label={t("common.labels.minimumStock")}>
              <input
                className={fieldStyles}
                min="0"
                step="0.001"
                type="number"
                value={ingredientForm.minStock}
                onChange={(event) => updateIngredientField("minStock", event.target.value)}
              />
            </Field>
            <Field label={t("common.labels.currentStock")}>
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
              {addingIngredient ? t("common.actions.adding") : t("owner.inventory.addTitle")}
            </button>
          </form>
        </SectionCard>

        <SectionCard title={t("owner.inventory.listTitle")} description={t("owner.inventory.listDescription")}>
          {ingredients.length > 0 ? (
            <div className="space-y-3">
              {ingredients.map((ingredient) => (
                <article key={ingredient.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{ingredient.name}</p>
                        {ingredient.isLowStock ? <StatusPill tone="warning">{t("owner.inventory.lowStock")}</StatusPill> : <StatusPill tone="success">{t("owner.inventory.healthy")}</StatusPill>}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {t("owner.inventory.minUnit", {
                          unit: ingredient.unit,
                          min: formatNumber(ingredient.minStock, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                        })}
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
                        {savingIngredientId === ingredient.id ? t("common.actions.saving") : t("owner.inventory.updateStock")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title={t("owner.inventory.emptyTitle")} description={t("owner.inventory.emptyDescription")} />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title={t("owner.settings.title")} description={t("owner.settings.description")}>
          <form className="space-y-4" onSubmit={saveSettings}>
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-4">
              <RestaurantLogo className="h-16 w-16 border border-slate-200 text-lg" name={restaurantName} src={settingsForm.logoUrl} />
              <div>
                <p className="font-medium text-slate-900">{restaurantName}</p>
                <p className="text-sm text-slate-500">{getPlanLabel(dashboard?.subscription, t, formatCurrency)}</p>
              </div>
            </div>
            <Field hint={t("common.optional")} label={t("owner.settings.logoUrl")}>
              <input className={fieldStyles} value={settingsForm.logoUrl} onChange={(event) => updateSettingsField("logoUrl", event.target.value)} />
            </Field>
            <Field hint={t("owner.settings.coverImageUrlHint")} label={t("owner.settings.coverImageUrl")}>
              <input
                className={fieldStyles}
                placeholder="https://..."
                value={settingsForm.coverImageUrl}
                onChange={(event) => updateSettingsField("coverImageUrl", event.target.value)}
              />
            </Field>
            {settingsForm.coverImageUrl ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <img alt={t("owner.settings.coverPreview")} className="h-36 w-full object-cover" src={settingsForm.coverImageUrl} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("owner.settings.coverEmpty")}</p>
            )}
            <Field label={t("owner.settings.pickupSlug")}>
              <input className={fieldStyles} value={settingsForm.slug} onChange={(event) => updateSettingsField("slug", event.target.value)} />
            </Field>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{t("owner.settings.publicOrdering")}</p>
                <p className="text-sm text-slate-500">{t("owner.settings.publicOrderingHint")}</p>
              </div>
              <input checked={settingsForm.publicOrderingEnabled} onChange={(event) => updateSettingsField("publicOrderingEnabled", event.target.checked)} type="checkbox" />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{t("owner.settings.pickupOrdering")}</p>
                <p className="text-sm text-slate-500">{t("owner.settings.pickupOrderingHint")}</p>
              </div>
              <input checked={settingsForm.pickupEnabled} onChange={(event) => updateSettingsField("pickupEnabled", event.target.checked)} type="checkbox" />
            </label>
            <button className={buttonStyles.primary} disabled={savingSettings} type="submit">
              {savingSettings ? t("common.actions.saving") : t("owner.settings.saveSettings")}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title={t("owner.settings.subscriptionTitle")}
          description={
            canUseBusinessTools
              ? t("owner.settings.subscriptionActiveDescription")
              : t("owner.settings.subscriptionLockedDescription")
          }
        >
          {canUseBusinessTools ? (
            <OwnerPlanCheckout
              currentPlan={currentPlan}
              onSelectPlanId={setSelectedPlanId}
              onSubmit={activatePlan}
              plans={plans}
              savingPlan={savingPlan}
              selectedPlanId={selectedPlanId}
            />
          ) : (
            <p className="text-sm text-slate-600">
              {t("owner.settings.dashboardLocked")}
            </p>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderReports() {
    const summary = salesReport?.summary;
    const reportMetrics = summary
      ? [
          {
            label: t("owner.reports.metrics.revenue"),
            value: formatCurrency(summary.totalRevenue),
            detail: t("owner.reports.metrics.revenueDetail")
          },
          {
            label: t("owner.reports.metrics.orders"),
            value: formatNumber(summary.totalOrders),
            detail: t("owner.reports.metrics.ordersDetail")
          },
          {
            label: t("owner.reports.metrics.averageTicket"),
            value: formatCurrency(summary.averageTicket),
            detail: t("owner.reports.metrics.averageTicketDetail")
          },
          {
            label: t("owner.reports.metrics.cash"),
            value: formatCurrency(summary.cashTotal),
            detail: t("owner.reports.metrics.cardOnline", {
              card: formatCurrency(summary.cardTotal),
              online: formatCurrency(summary.onlineTotal)
            })
          }
        ]
      : [];

    return (
      <div className="space-y-5">
        <SectionCard
          title={t("owner.reports.filtersTitle")}
          description={t("owner.reports.filtersDescription")}
        >
          <div className="flex flex-wrap gap-2">
            <button className={buttonStyles.secondary} onClick={() => applyReportPreset("today")} type="button">
              {t("owner.reports.presets.today")}
            </button>
            <button className={buttonStyles.secondary} onClick={() => applyReportPreset("month")} type="button">
              {t("owner.reports.presets.month")}
            </button>
            <button className={buttonStyles.secondary} onClick={() => applyReportPreset("yearly")} type="button">
              {t("owner.reports.presets.yearly")}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t("owner.reports.from")}>
              <input className={fieldStyles} onChange={(event) => setReportFrom(event.target.value)} type="date" value={reportFrom} />
            </Field>
            <Field label={t("owner.reports.to")}>
              <input className={fieldStyles} onChange={(event) => setReportTo(event.target.value)} type="date" value={reportTo} />
            </Field>
            <Field label={t("owner.reports.groupBy")}>
              <select className={fieldStyles} onChange={(event) => setReportGroupBy(event.target.value)} value={reportGroupBy}>
                <option value="day">{t("owner.reports.groupByDay")}</option>
                <option value="month">{t("owner.reports.groupByMonth")}</option>
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <button className={buttonStyles.primary} disabled={loadingReport} onClick={loadSalesReport} type="button">
                {loadingReport ? t("owner.reports.loading") : t("owner.reports.refresh")}
              </button>
              <button className={buttonStyles.secondary} disabled={downloadingReport || loadingReport} onClick={downloadSalesReport} type="button">
                {downloadingReport ? t("owner.reports.downloading") : t("owner.reports.downloadCsv")}
              </button>
            </div>
          </div>
        </SectionCard>

        {loadingReport && !salesReport ? (
          <SectionCard>
            <p className="text-sm text-slate-600">{t("owner.reports.loading")}</p>
          </SectionCard>
        ) : null}

        {summary ? <MetricGrid items={reportMetrics} /> : null}

        {summary ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard title={t("owner.reports.breakdownTitle")} description={t("owner.reports.breakdownDescription")}>
              {(salesReport?.buckets || []).length === 0 ? (
                <EmptyState title={t("owner.reports.noDataTitle")} description={t("owner.reports.noDataDescription")} />
              ) : (
                <SimpleTable
                  headers={[
                    t("owner.reports.columns.period"),
                    t("owner.reports.columns.orders"),
                    t("owner.reports.columns.revenue"),
                    t("owner.reports.columns.cash"),
                    t("owner.reports.columns.card"),
                    t("owner.reports.columns.online")
                  ]}
                >
                  {(salesReport?.buckets || []).map((bucket) => (
                    <tr key={bucket.period}>
                      <td className="px-4 py-3 font-medium text-slate-900">{bucket.period}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(bucket.orderCount)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(bucket.revenue)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(bucket.cashTotal)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(bucket.cardTotal)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(bucket.onlineTotal)}</td>
                    </tr>
                  ))}
                </SimpleTable>
              )}
            </SectionCard>

            <SectionCard title={t("owner.reports.channelTitle")} description={t("owner.reports.channelDescription")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("owner.reports.orderTypes.DINE_IN")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(summary.dineInTotal)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("owner.reports.orderTypes.PICKUP")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(summary.pickupTotal)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("owner.reports.orderTypes.DELIVERY")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(summary.deliveryTotal)}</p>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        <SectionCard title={t("owner.reports.transactionsTitle")} description={t("owner.reports.transactionsDescription")}>
          {(salesReport?.transactions || []).length === 0 ? (
            <EmptyState title={t("owner.reports.noTransactionsTitle")} description={t("owner.reports.noTransactionsDescription")} />
          ) : (
            <SimpleTable
              headers={[
                t("owner.reports.columns.date"),
                t("owner.reports.columns.order"),
                t("owner.reports.columns.type"),
                t("owner.reports.columns.payment"),
                t("owner.reports.columns.customer"),
                t("owner.reports.columns.total")
              ]}
            >
              {(salesReport?.transactions || []).map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(transaction.soldAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{transaction.orderCode}</td>
                  <td className="px-4 py-3 text-slate-700">{translateReportOrderType(transaction.orderType)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {transaction.paymentMethod ? translatePaymentMethod(t, transaction.paymentMethod) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{transaction.customerName || transaction.tableName || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(transaction.total)}</td>
                </tr>
              ))}
            </SimpleTable>
          )}
        </SectionCard>
      </div>
    );
  }

  function handleTabChange(tabId) {
    if (showPlanGate) {
      return;
    }
    setActiveTab(tabId);
  }

  return (
    <AppShell>
      {showPlanGate ? (
        <OwnerPlanGateModal
          error={error}
          onLogout={onLogout}
          onSelectPlanId={setSelectedPlanId}
          onSubmit={activatePlan}
          plans={plans}
          restaurantName={restaurantName}
          savingPlan={savingPlan}
          selectedPlanId={selectedPlanId}
        />
      ) : null}

      <div className={showPlanGate ? "pointer-events-none select-none opacity-40" : "space-y-5"}>
        <PageHeader
          actions={
            <>
              <button className={buttonStyles.secondary} disabled={showPlanGate} onClick={() => loadData()} type="button">
                {t("common.actions.refresh")}
              </button>
              {canUseBusinessTools ? (
                <Link className={buttonStyles.secondary} to="/owner/online-orders">
                  {t("owner.onlineOrdersLink")}
                </Link>
              ) : null}
              <button className={buttonStyles.secondary} onClick={onLogout} type="button">
                {t("common.actions.logout")}
              </button>
            </>
          }
          description={t("owner.description")}
          eyebrow={t("owner.eyebrow")}
          meta={[session.user.fullName, getPlanLabel(dashboard?.subscription, t, formatCurrency)]}
          title={restaurantName}
        />

        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}
        {!showPlanGate && error ? <MessageBanner tone="error">{error}</MessageBanner> : null}

        {!showPlanGate ? <Tabs activeKey={activeTab} items={ownerTabs} onChange={handleTabChange} /> : null}

        {loading ? (
          <SectionCard>
            <p className="text-sm text-slate-600">{t("common.loading.workspace")}</p>
          </SectionCard>
        ) : null}
        {!loading && !showPlanGate && activeTab === "overview" ? renderOverview() : null}
        {!loading && !showPlanGate && activeTab === "reports" ? renderReports() : null}
        {!loading && !showPlanGate && activeTab === "staff" ? renderStaff() : null}
        {!loading && !showPlanGate && activeTab === "tables" ? renderTables() : null}
        {!loading && !showPlanGate && activeTab === "menu" ? renderMenu() : null}
        {!loading && !showPlanGate && activeTab === "inventory" ? renderInventory() : null}
        {!loading && !showPlanGate && activeTab === "settings" ? renderSettings() : null}
      </div>

      <div className="print-area" aria-hidden="true">
        {printTableQr ? (
          <TableQrPrint
            orderLink={printTableQr.orderLink}
            qrDataUrl={printTableQr.qrDataUrl}
            restaurantName={restaurantName}
            seats={printTableQr.seats}
            tableName={printTableQr.tableName}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
