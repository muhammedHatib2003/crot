import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import RestaurantLogo from "../components/RestaurantLogo";

const EMPLOYEE_ROLE_OPTIONS = [
  { value: "chef", label: "Chef" },
  { value: "cashier", label: "Cashier" }
];
const TABLE_SEAT_OPTIONS = [2, 4, 6, 8, 10];
const TABLE_STATUS_OPTIONS = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
const MENU_CATEGORY_OPTIONS = ["General", "Starter", "Main", "Dessert", "Drink"];
const OWNER_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "branding", label: "Branding" },
  { id: "plan", label: "Plan" },
  { id: "employees", label: "Employees" },
  { id: "tables", label: "Tables" },
  { id: "menu", label: "Menu" }
];

function formatPrice(price) {
  return `$${Number(price || 0).toFixed(2)}`;
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

export default function OwnerPage({ session, onLogout }) {
  const token = session?.token;
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [addingMenuItem, setAddingMenuItem] = useState(false);
  const [updatingTableId, setUpdatingTableId] = useState("");
  const [updatingMenuItemId, setUpdatingMenuItemId] = useState("");
  const [tableStatusFilter, setTableStatusFilter] = useState("ALL");
  const [logoForm, setLogoForm] = useState("");
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

  const currentPlan = dashboard?.subscription?.plan || null;
  const currentLogoUrl = dashboard?.restaurant?.logoUrl || "";
  const logoPreviewUrl = logoForm === currentLogoUrl ? currentLogoUrl : logoForm.trim();
  const requiresPlanSelection = Boolean(dashboard?.requiresPlanSelection);
  const canUseBusinessTools = !requiresPlanSelection;

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );
  const filteredTables = useMemo(() => {
    if (tableStatusFilter === "ALL") {
      return tables;
    }

    return tables.filter((table) => table.status === tableStatusFilter);
  }, [tables, tableStatusFilter]);
  const tableStatusCounts = useMemo(() => {
    const counts = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0 };
    tables.forEach((table) => {
      if (counts[table.status] !== undefined) {
        counts[table.status] += 1;
      }
    });
    return counts;
  }, [tables]);

  function updateEmployeeField(key, value) {
    setEmployeeForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateTableField(key, value) {
    setTableForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateMenuField(key, value) {
    setMenuForm((previous) => ({ ...previous, [key]: value }));
  }

  function ensurePlanSelected() {
    if (!requiresPlanSelection) {
      return true;
    }

    setMessage("");
    setError("Please select a plan before using owner tools.");
    setActiveSection("plan");
    return false;
  }

  function getPlanSubmitLabel() {
    if (savingPlan) {
      return "Saving...";
    }
    if (requiresPlanSelection) {
      return "Select plan and continue";
    }
    if (selectedPlan) {
      return `Switch to ${selectedPlan.displayName}`;
    }
    return "Select a plan";
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [dashboardResult, plansResult] = await Promise.all([
        apiRequest("/owner/dashboard", { token }),
        apiRequest("/plans")
      ]);

      const nextPlans = plansResult.plans || [];

      setDashboard(dashboardResult);
      setPlans(nextPlans);
      setSelectedPlanId((previous) => {
        if (dashboardResult.subscription?.plan?.id) {
          return dashboardResult.subscription.plan.id;
        }
        if (previous) {
          return previous;
        }
        return nextPlans[0]?.id || "";
      });

      if (dashboardResult.requiresPlanSelection) {
        setEmployees([]);
        setTables([]);
        setMenuItems([]);
        return;
      }

      const [employeesResult, tablesResult, menuItemsResult] = await Promise.all([
        apiRequest("/owner/employees", { token }),
        apiRequest("/owner/tables", { token }),
        apiRequest("/owner/menu", { token })
      ]);

      setEmployees(employeesResult.employees || []);
      setTables(tablesResult.tables || []);
      setMenuItems(menuItemsResult.items || []);
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
      setActiveSection("plan");
    }
  }, [requiresPlanSelection]);

  useEffect(() => {
    setLogoForm(dashboard?.restaurant?.logoUrl || "");
  }, [dashboard?.restaurant?.logoUrl]);

  async function activatePlan(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedPlanId) {
      setError("Please select a plan.");
      return;
    }

    setSavingPlan(true);

    try {
      const result = await apiRequest("/owner/subscription/select", {
        method: "POST",
        token,
        body: { planId: selectedPlanId }
      });

      setDashboard((previous) => ({
        ...previous,
        requiresPlanSelection: false,
        subscription: result.subscription
      }));
      setMessage(`Plan switched to ${result.subscription.plan.displayName}.`);
      setActiveSection("overview");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPlan(false);
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
      setDashboard((previous) => ({
        ...previous,
        employeesCount: (previous?.employeesCount || 0) + 1
      }));
      setMessage("Employee added successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingEmployee(false);
    }
  }

  async function saveLogo(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingLogo(true);

    try {
      const result = await apiRequest("/owner/restaurant", {
        method: "PATCH",
        token,
        body: { logoUrl: logoForm }
      });

      setDashboard((previous) =>
        previous
          ? {
              ...previous,
              restaurant: result.restaurant
            }
          : previous
      );
      setLogoForm(result.restaurant?.logoUrl || "");
      setMessage(result.message || "Logo updated successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingLogo(false);
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
      setDashboard((previous) => ({
        ...previous,
        tablesCount: (previous?.tablesCount || 0) + 1
      }));
      setMessage("Table created successfully.");
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
        description: "",
        photoUrl: ""
      });
      setDashboard((previous) => ({
        ...previous,
        menuItemsCount: (previous?.menuItemsCount || 0) + 1
      }));
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
      setMessage("Menu item updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingMenuItemId("");
    }
  }

  if (loading && !dashboard) {
    return <div className="p-8 text-center text-slate-700">Loading owner panel...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-md">
        <div className="flex items-center gap-4">
          <RestaurantLogo
            className="h-16 w-16 text-xl"
            name={dashboard?.restaurant?.name}
            src={dashboard?.restaurant?.logoUrl}
          />
          <div>
            <h1 className="text-2xl font-bold text-brand-900">{dashboard?.restaurant?.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Owner: {session.user.fullName} | Employees: {dashboard?.employeesCount || 0} | Tables:{" "}
              {dashboard?.tablesCount || 0} | Menu Items: {dashboard?.menuItemsCount || 0}
            </p>
          </div>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      {message ? <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64">
          <div className="rounded-2xl bg-white p-4 shadow-md lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Owner Menu</h2>
            <p className="mt-2 text-sm text-slate-600">
              Current plan:{" "}
              <span className="font-semibold text-slate-900">
                {currentPlan ? `${currentPlan.displayName} ($${currentPlan.monthlyPrice}/mo)` : "Not selected"}
              </span>
            </p>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {OWNER_SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                const isLocked = requiresPlanSelection && !["branding", "plan"].includes(section.id);

                return (
                  <button
                    key={section.id}
                    type="button"
                    disabled={isLocked}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full ${
                      isActive ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>

            {requiresPlanSelection ? (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Select a plan to unlock employees, tables, and menu management.
              </p>
            ) : null}
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          {loading ? <p className="text-sm text-slate-500">Refreshing data...</p> : null}

          {activeSection === "overview" ? (
            <section className="rounded-2xl bg-white p-5 shadow-md">
              <h2 className="text-lg font-semibold text-brand-900">Overview</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Employees</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{dashboard?.employeesCount || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Tables</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{dashboard?.tablesCount || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Menu Items</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{dashboard?.menuItemsCount || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {currentPlan ? `${currentPlan.displayName} ($${currentPlan.monthlyPrice}/mo)` : "Not selected"}
                  </p>
                </article>
              </div>

              {requiresPlanSelection ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Plan selection required</p>
                  <p className="mt-1 text-sm text-amber-800">
                    First login detected. Select a plan to continue using your owner panel.
                  </p>
                  <button
                    className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    type="button"
                    onClick={() => setActiveSection("plan")}
                  >
                    Go to plan selection
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  Subscription is active. You can manage team, tables, and menu from the sidebar.
                </div>
              )}
            </section>
          ) : null}

          {activeSection === "branding" ? (
            <section className="rounded-2xl bg-white p-5 shadow-md">
              <h2 className="text-lg font-semibold text-brand-900">Branding</h2>
              <p className="mt-1 text-sm text-slate-600">
                Set a logo URL here. The saved logo is shown on employee screens.
              </p>

              <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center">
                <RestaurantLogo
                  className="h-24 w-24 text-3xl"
                  name={dashboard?.restaurant?.name}
                  src={logoPreviewUrl}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{dashboard?.restaurant?.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Use a direct `http` or `https` image URL. Leave it empty to remove the logo.
                  </p>
                </div>
              </div>

              <form className="mt-4 space-y-3" onSubmit={saveLogo}>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={logoForm}
                  onChange={(event) => setLogoForm(event.target.value)}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={savingLogo}
                    type="submit"
                    className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                  >
                    {savingLogo ? "Saving..." : "Save logo"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setLogoForm("")}
                  >
                    Clear field
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {activeSection === "plan" ? (
            <section className="rounded-2xl bg-white p-5 shadow-md">
              <h2 className="text-lg font-semibold text-brand-900">Plan Selection</h2>
              <p className="mt-1 text-sm text-slate-600">
                Current plan:{" "}
                <span className="font-medium">
                  {currentPlan ? `${currentPlan.displayName} ($${currentPlan.monthlyPrice}/mo)` : "Not selected"}
                </span>
              </p>
              {requiresPlanSelection ? (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                  Please select a plan to continue.
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`rounded-xl border p-4 text-left transition ${
                        isSelected ? "border-brand-700 bg-brand-50" : "border-slate-200 hover:border-brand-300"
                      }`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <p className="text-base font-semibold text-slate-900">{plan.displayName}</p>
                      <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                      <p className="mt-3 text-lg font-bold text-brand-900">${plan.monthlyPrice}/mo</p>
                    </button>
                  );
                })}
              </div>

              <form className="mt-4" onSubmit={activatePlan}>
                <button
                  disabled={savingPlan || !selectedPlan}
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                >
                  {getPlanSubmitLabel()}
                </button>
              </form>
            </section>
          ) : null}

          {activeSection === "employees" ? (
            <section className="rounded-2xl bg-white p-5 shadow-md">
              <h2 className="text-lg font-semibold text-brand-900">Employees</h2>
              <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={addEmployee}>
                <input
                  required
                  placeholder="Employee name"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={employeeForm.fullName}
                  onChange={(event) => updateEmployeeField("fullName", event.target.value)}
                />
                <select
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={employeeForm.employeeRole}
                  onChange={(event) => updateEmployeeField("employeeRole", event.target.value)}
                >
                  {EMPLOYEE_ROLE_OPTIONS.map((roleOption) => (
                    <option key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="email"
                  placeholder="Employee email"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={employeeForm.email}
                  onChange={(event) => updateEmployeeField("email", event.target.value)}
                />
                <input
                  required
                  type="password"
                  minLength={6}
                  placeholder="Login password"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={employeeForm.password}
                  onChange={(event) => updateEmployeeField("password", event.target.value)}
                />
                <input
                  placeholder="Phone (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 md:col-span-2"
                  value={employeeForm.phone}
                  onChange={(event) => updateEmployeeField("phone", event.target.value)}
                />
                <button
                  disabled={addingEmployee || !canUseBusinessTools}
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-900 disabled:opacity-60 md:col-span-2"
                >
                  {addingEmployee ? "Adding employee..." : "Add employee"}
                </button>
              </form>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="py-2 pr-4 font-medium text-slate-900">{employee.fullName}</td>
                        <td className="py-2 pr-4 text-slate-700">{employee.employeeRole}</td>
                        <td className="py-2 pr-4 text-slate-700">{employee.email}</td>
                        <td className="py-2 pr-4 text-slate-700">{employee.phone || "-"}</td>
                      </tr>
                    ))}
                    {employees.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={4}>
                          No employees yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeSection === "tables" ? (
            <section className="rounded-2xl bg-white p-5 shadow-md">
              <h2 className="text-lg font-semibold text-brand-900">Tables</h2>
              <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={addTable}>
                <input
                  required
                  placeholder="Table name (T1, A-2, Patio-1)"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 md:col-span-2"
                  value={tableForm.name}
                  onChange={(event) => updateTableField("name", event.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={tableForm.seats}
                  onChange={(event) => updateTableField("seats", Number(event.target.value))}
                >
                  {TABLE_SEAT_OPTIONS.map((seatCount) => (
                    <option key={seatCount} value={seatCount}>
                      {seatCount} seats
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={tableForm.status}
                  onChange={(event) => updateTableField("status", event.target.value)}
                >
                  {TABLE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
                <button
                  disabled={addingTable || !canUseBusinessTools}
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-900 disabled:opacity-60 md:col-span-4"
                >
                  {addingTable ? "Creating table..." : "Create table"}
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                  Available: {tableStatusCounts.AVAILABLE}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                  Occupied: {tableStatusCounts.OCCUPIED}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                  Reserved: {tableStatusCounts.RESERVED}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                  Cleaning: {tableStatusCounts.CLEANING}
                </span>
                <select
                  className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
                  value={tableStatusFilter}
                  onChange={(event) => setTableStatusFilter(event.target.value)}
                >
                  <option value="ALL">All statuses</option>
                  {TABLE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredTables.map((table) => {
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
                            disabled={updatingTableId === table.id || !canUseBusinessTools}
                            onChange={(event) => updateTableStatus(table.id, event.target.value)}
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
                {filteredTables.length === 0 ? <p className="text-sm text-slate-500">No tables yet.</p> : null}
              </div>
            </section>
          ) : null}

          {activeSection === "menu" ? (
            <section className="rounded-2xl bg-white p-5 shadow-md">
              <h2 className="text-lg font-semibold text-brand-900">Menu</h2>
              <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={addMenuItem}>
                <input
                  required
                  placeholder="Menu item name"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={menuForm.name}
                  onChange={(event) => updateMenuField("name", event.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={menuForm.category}
                  onChange={(event) => updateMenuField("category", event.target.value)}
                >
                  {MENU_CATEGORY_OPTIONS.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Price"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={menuForm.price}
                  onChange={(event) => updateMenuField("price", event.target.value)}
                />
                <input
                  placeholder="Description (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={menuForm.description}
                  onChange={(event) => updateMenuField("description", event.target.value)}
                />
                <input
                  placeholder="Photo URL (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                  value={menuForm.photoUrl}
                  onChange={(event) => updateMenuField("photoUrl", event.target.value)}
                />
                <button
                  disabled={addingMenuItem || !canUseBusinessTools}
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-900 disabled:opacity-60 md:col-span-5"
                >
                  {addingMenuItem ? "Creating menu item..." : "Create menu item"}
                </button>
              </form>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-2 pr-4">Photo</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Price</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {menuItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 pr-4">
                          {item.photoUrl ? (
                            <img alt={item.name} className="h-12 w-12 rounded-md object-cover" src={item.photoUrl} />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-200 text-[10px] text-slate-500">
                              No Photo
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-medium text-slate-900">{item.name}</td>
                        <td className="py-2 pr-4 text-slate-700">{item.category}</td>
                        <td className="py-2 pr-4 text-slate-700">{formatPrice(item.price)}</td>
                        <td className="py-2 pr-4 text-slate-700">{item.description || "-"}</td>
                        <td className="py-2 pr-4 text-slate-700">
                          <button
                            type="button"
                            disabled={updatingMenuItemId === item.id || !canUseBusinessTools}
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              item.isAvailable ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"
                            }`}
                            onClick={() => toggleMenuItemAvailability(item.id, !item.isAvailable)}
                          >
                            {updatingMenuItemId === item.id ? "Saving..." : item.isAvailable ? "Available" : "Hidden"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {menuItems.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={6}>
                          No menu items yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
