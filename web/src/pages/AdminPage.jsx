import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest, getApiOrigin } from "../api";
import { AppShell, MessageBanner, PageHeader, SectionCard, buttonStyles } from "../components/app/AppShell";
import PlanManagement from "../components/admin/PlanManagement";

export default function AdminPage({ session, onLogout }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [courierAccounts, setCourierAccounts] = useState([]);
  const [courierFilter, setCourierFilter] = useState("PENDING");
  const [courierBusyId, setCourierBusyId] = useState("");
  const [rejectDraft, setRejectDraft] = useState({});
  const [courierLoading, setCourierLoading] = useState(false);

  const loadCouriers = useCallback(async () => {
    const courierPath =
      courierFilter === "PENDING" ? "/admin/courier-accounts?status=PENDING" : "/admin/courier-accounts";
    const couriersResult = await apiRequest(courierPath, { token: session.token });
    setCourierAccounts(couriersResult.accounts || []);
  }, [session.token, courierFilter]);

  useEffect(() => {
    async function initialLoad() {
      setLoading(true);
      setError("");
      try {
        const usersResult = await apiRequest("/admin/users", { token: session.token });
        setUsers(usersResult.users || []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    initialLoad();
  }, [session.token]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setCourierLoading(true);
      setError("");
      try {
        await loadCouriers();
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setCourierLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loadCouriers]);

  async function approveCourier(accountId) {
    setCourierBusyId(accountId);
    setError("");
    try {
      await apiRequest(`/admin/courier-accounts/${accountId}/approve`, {
        method: "PATCH",
        token: session.token,
        body: {}
      });
      setMessage(t("admin.courierApplications.approvedOk"));
      await loadCouriers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCourierBusyId("");
    }
  }

  async function rejectCourier(accountId) {
    setCourierBusyId(accountId);
    setError("");
    try {
      await apiRequest(`/admin/courier-accounts/${accountId}/reject`, {
        method: "PATCH",
        token: session.token,
        body: { rejectionReason: rejectDraft[accountId] || "" }
      });
      setMessage(t("admin.courierApplications.rejectedOk"));
      await loadCouriers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCourierBusyId("");
    }
  }

  function courierStatusLabel(status) {
    if (status === "PENDING") {
      return t("admin.courierApplications.statusPending");
    }
    if (status === "APPROVED") {
      return t("admin.courierApplications.statusApproved");
    }
    if (status === "REJECTED") {
      return t("admin.courierApplications.statusRejected");
    }
    return status;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          actions={
            <button className={buttonStyles.secondary} onClick={onLogout} type="button">
              {t("common.actions.logout")}
            </button>
          }
          description={t("admin.loggedInAs", { name: session.user.fullName, email: session.user.email })}
          eyebrow={t("admin.eyebrow")}
          title={t("admin.title")}
        />

        {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}
        {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}

        <SectionCard
          title={t("admin.courierApplications.title")}
          description={t("admin.courierApplications.description")}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                courierFilter === "PENDING" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
              onClick={() => setCourierFilter("PENDING")}
            >
              {t("admin.courierApplications.filterPending")}
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                courierFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
              onClick={() => setCourierFilter("ALL")}
            >
              {t("admin.courierApplications.filterAll")}
            </button>
          </div>

          {courierLoading ? <p className="text-sm text-slate-600">{t("common.loading.couriers")}</p> : null}

          {!courierLoading ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2 pr-4">{t("admin.courierApplications.name")}</th>
                    <th className="py-2 pr-4">{t("admin.courierApplications.email")}</th>
                    <th className="py-2 pr-4">{t("admin.courierApplications.phone")}</th>
                    <th className="py-2 pr-4">{t("admin.courierApplications.status")}</th>
                    <th className="py-2 pr-4">{t("admin.courierApplications.submitted")}</th>
                    <th className="py-2 pr-4">{t("admin.courierApplications.document")}</th>
                    <th className="py-2 pr-4"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courierAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{account.fullName}</td>
                      <td className="py-2 pr-4 text-slate-700">{account.email}</td>
                      <td className="py-2 pr-4 text-slate-700">{account.phone || "-"}</td>
                      <td className="py-2 pr-4 text-slate-700">{courierStatusLabel(account.status)}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {account.createdAt ? new Date(account.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="py-2 pr-4">
                        <a
                          className="font-medium text-brand-700 hover:text-brand-900"
                          href={`${getApiOrigin()}${account.documentUrl}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {t("admin.courierApplications.viewDoc")}
                        </a>
                      </td>
                      <td className="py-2 pr-4">
                        {account.status === "PENDING" ? (
                          <div className="flex min-w-[200px] flex-col gap-2">
                            <button
                              type="button"
                              className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                              disabled={courierBusyId === account.id}
                              onClick={() => approveCourier(account.id)}
                            >
                              {courierBusyId === account.id
                                ? t("admin.courierApplications.processing")
                                : t("admin.courierApplications.approve")}
                            </button>
                            <input
                              type="text"
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
                              placeholder={t("admin.courierApplications.rejectReasonPlaceholder")}
                              value={rejectDraft[account.id] || ""}
                              onChange={(event) =>
                                setRejectDraft((previous) => ({
                                  ...previous,
                                  [account.id]: event.target.value
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="rounded-md bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-900 disabled:opacity-60"
                              disabled={courierBusyId === account.id}
                              onClick={() => rejectCourier(account.id)}
                            >
                              {t("admin.courierApplications.reject")}
                            </button>
                          </div>
                        ) : account.status === "REJECTED" ? (
                          <span className="text-xs text-rose-700">{account.rejectionReason || "—"}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {courierAccounts.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={7}>
                        {t("admin.courierApplications.empty")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <PlanManagement token={session.token} />

        <SectionCard title={t("admin.users.title")} description={t("admin.users.description")}>
          {loading ? <p className="text-sm text-slate-600">{t("common.loading.users")}</p> : null}

          {!loading ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2 pr-4">{t("admin.users.name")}</th>
                    <th className="py-2 pr-4">{t("admin.users.email")}</th>
                    <th className="py-2 pr-4">{t("admin.users.systemRole")}</th>
                    <th className="py-2 pr-4">{t("admin.users.employeeRole")}</th>
                    <th className="py-2 pr-4">{t("admin.users.restaurant")}</th>
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
                        {t("admin.users.empty")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </AppShell>
  );
}
