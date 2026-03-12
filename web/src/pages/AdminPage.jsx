import { useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function AdminPage({ session, onLogout }) {
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planDrafts, setPlanDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updatePlanDraft(planId, value) {
    setPlanDrafts((previous) => ({
      ...previous,
      [planId]: value
    }));
  }

  async function savePlanPrice(plan) {
    const rawPrice = planDrafts[plan.id];
    const parsedPrice = Number(rawPrice);

    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setMessage("");
      setError("Plan price must be a whole number greater than 0.");
      return;
    }

    setSavingPlanId(plan.id);
    setMessage("");
    setError("");

    try {
      const result = await apiRequest(`/admin/plans/${plan.id}`, {
        method: "PATCH",
        token: session.token,
        body: { monthlyPrice: parsedPrice }
      });

      setPlans((previous) =>
        previous
          .map((existingPlan) => (existingPlan.id === plan.id ? result.plan : existingPlan))
          .sort((left, right) => left.monthlyPrice - right.monthlyPrice)
      );
      setPlanDrafts((previous) => ({
        ...previous,
        [plan.id]: String(result.plan.monthlyPrice)
      }));
      setMessage(`${result.plan.displayName} plan price updated.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPlanId("");
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const [usersResult, plansResult] = await Promise.all([
          apiRequest("/admin/users", { token: session.token }),
          apiRequest("/admin/plans", { token: session.token })
        ]);

        const nextPlans = plansResult.plans || [];
        setUsers(usersResult.users || []);
        setPlans(nextPlans);
        setPlanDrafts(
          nextPlans.reduce((accumulator, plan) => {
            accumulator[plan.id] = String(plan.monthlyPrice);
            return accumulator;
          }, {})
        );
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session.token]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-md">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Super Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-600">
            Logged in as {session.user.fullName} ({session.user.email})
          </p>
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

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-md">
        <h2 className="text-lg font-semibold text-brand-900">Plan Pricing</h2>
        <p className="mt-1 text-sm text-slate-600">You can update monthly plan prices from this section.</p>

        {loading ? <p className="mt-3 text-sm text-slate-600">Loading plans...</p> : null}

        {!loading ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Monthly Price ($)</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => {
                  const isSaving = savingPlanId === plan.id;
                  const draftValue = planDrafts[plan.id] ?? String(plan.monthlyPrice);
                  const hasChanges = Number(draftValue) !== plan.monthlyPrice;

                  return (
                    <tr key={plan.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{plan.code}</td>
                      <td className="py-2 pr-4 text-slate-700">{plan.displayName}</td>
                      <td className="py-2 pr-4 text-slate-700">{plan.description}</td>
                      <td className="py-2 pr-4">
                        <input
                          min="1"
                          step="1"
                          type="number"
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-brand-500"
                          value={draftValue}
                          onChange={(event) => updatePlanDraft(plan.id, event.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          disabled={isSaving || !hasChanges}
                          className="rounded-md bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                          onClick={() => savePlanPrice(plan)}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {plans.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={5}>
                      No plans found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-md">
        <h2 className="text-lg font-semibold text-brand-900">Users & Restaurants</h2>
        {loading ? <p className="mt-3 text-sm text-slate-600">Loading users...</p> : null}

        {!loading ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">System Role</th>
                  <th className="py-2 pr-4">Employee Role</th>
                  <th className="py-2 pr-4">Restaurant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{user.fullName}</td>
                    <td className="py-2 pr-4 text-slate-700">{user.email}</td>
                    <td className="py-2 pr-4 text-slate-700">{user.systemRole}</td>
                    <td className="py-2 pr-4 text-slate-700">{user.employeeRole || "-"}</td>
                    <td className="py-2 pr-4 text-slate-700">{user.restaurantName || "-"}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
