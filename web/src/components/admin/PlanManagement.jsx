import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createAdminPlan,
  getAdminPlans,
  setAdminPlanStatus,
  updateAdminPlan
} from "../../api";
import { MessageBanner, SectionCard, buttonStyles } from "../app/AppShell";

const FEATURE_KEYS = [
  "onlineOrdering",
  "qrMenu",
  "tableManagement",
  "kitchenPanel",
  "cashierPanel",
  "courierModule",
  "warehouseModule",
  "reports",
  "customDomain",
  "multiLanguage",
  "prioritySupport"
];

const LIMIT_KEYS = [
  "maxProducts",
  "maxTables",
  "maxUsers",
  "maxBranches",
  "maxOrdersPerMonth"
];

const FEATURE_LABELS = {
  onlineOrdering: "Online Ordering",
  qrMenu: "QR Menu",
  tableManagement: "Table Management",
  kitchenPanel: "Kitchen Panel",
  cashierPanel: "Cashier Panel",
  courierModule: "Courier Module",
  warehouseModule: "Warehouse Module",
  reports: "Reports",
  customDomain: "Custom Domain",
  multiLanguage: "Multi Language",
  prioritySupport: "Priority Support"
};

const LIMIT_LABELS = {
  maxProducts: "Max Products",
  maxTables: "Max Tables",
  maxUsers: "Max Users",
  maxBranches: "Max Branches",
  maxOrdersPerMonth: "Max Orders / Month"
};

const CURRENCY_OPTIONS = ["TRY", "USD", "EUR"];
const BILLING_OPTIONS = ["monthly", "yearly"];

function emptyDraft() {
  return {
    id: null,
    code: "",
    displayName: "",
    description: "",
    monthlyPrice: "",
    currency: "TRY",
    billingPeriod: "monthly",
    isActive: true,
    features: FEATURE_KEYS.reduce((accumulator, key) => {
      accumulator[key] = false;
      return accumulator;
    }, {}),
    limits: LIMIT_KEYS.reduce((accumulator, key) => {
      accumulator[key] = "";
      return accumulator;
    }, {})
  };
}

function planToDraft(plan) {
  const features = FEATURE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = Boolean(plan.features?.[key]);
    return accumulator;
  }, {});

  const limits = LIMIT_KEYS.reduce((accumulator, key) => {
    const raw = plan.limits?.[key];
    accumulator[key] = raw === null || raw === undefined ? "" : String(raw);
    return accumulator;
  }, {});

  return {
    id: plan.id,
    code: plan.code,
    displayName: plan.displayName,
    description: plan.description || "",
    monthlyPrice: String(plan.monthlyPrice ?? ""),
    currency: plan.currency || "TRY",
    billingPeriod: plan.billingPeriod || "monthly",
    isActive: plan.isActive !== false,
    features,
    limits
  };
}

function draftToPayload(draft) {
  const limits = {};
  for (const key of LIMIT_KEYS) {
    const raw = draft.limits[key];
    if (raw === "" || raw === null || raw === undefined) {
      limits[key] = null;
      continue;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) {
      limits[key] = null;
      continue;
    }
    limits[key] = Math.floor(numeric);
  }

  return {
    code: draft.code ? String(draft.code).trim() : undefined,
    displayName: String(draft.displayName || "").trim(),
    description: String(draft.description || "").trim(),
    monthlyPrice: Number(draft.monthlyPrice),
    currency: draft.currency || "TRY",
    billingPeriod: draft.billingPeriod || "monthly",
    isActive: Boolean(draft.isActive),
    features: { ...draft.features },
    limits
  };
}

function formatLimit(value) {
  if (value === null || value === undefined || value === "") {
    return "∞";
  }
  return String(value);
}

export default function PlanManagement({ token }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyDraft());
  const [mode, setMode] = useState("idle");

  const isEditing = mode === "edit";
  const isCreating = mode === "create";
  const showForm = isEditing || isCreating;

  const sortedPlans = useMemo(
    () =>
      [...plans].sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }
        return (left.monthlyPrice || 0) - (right.monthlyPrice || 0);
      }),
    [plans]
  );

  async function loadPlans() {
    setLoading(true);
    setError("");
    try {
      const nextPlans = await getAdminPlans(token);
      setPlans(nextPlans);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function startCreate() {
    setMode("create");
    setDraft(emptyDraft());
    setMessage("");
    setError("");
  }

  function startEdit(plan) {
    setMode("edit");
    setDraft(planToDraft(plan));
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setMode("idle");
    setDraft(emptyDraft());
  }

  function updateDraftField(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateFeature(key, value) {
    setDraft((previous) => ({
      ...previous,
      features: { ...previous.features, [key]: Boolean(value) }
    }));
  }

  function updateLimit(key, value) {
    setDraft((previous) => ({
      ...previous,
      limits: { ...previous.limits, [key]: value }
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = String(draft.displayName || "").trim();
    const priceValue = Number(draft.monthlyPrice);

    if (!trimmedName) {
      setError(
        t("admin.planManagement.errors.displayNameRequired", "Plan adı zorunludur.")
      );
      return;
    }
    if (!Number.isInteger(priceValue) || priceValue <= 0) {
      setError(
        t(
          "admin.planManagement.errors.priceInvalid",
          "Fiyat 0'dan büyük tam sayı olmalıdır."
        )
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = draftToPayload(draft);
      if (isCreating) {
        const result = await createAdminPlan(payload, token);
        setMessage(
          t("admin.planManagement.toasts.created", "Plan oluşturuldu: {{name}}", {
            name: result.plan?.displayName || trimmedName
          })
        );
      } else if (isEditing && draft.id) {
        const result = await updateAdminPlan(draft.id, payload, token);
        setMessage(
          t("admin.planManagement.toasts.updated", "Plan güncellendi: {{name}}", {
            name: result.plan?.displayName || trimmedName
          })
        );
      }
      await loadPlans();
      cancelEdit();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(plan) {
    setTogglingId(plan.id);
    setError("");
    setMessage("");
    try {
      await setAdminPlanStatus(plan.id, !plan.isActive, token);
      setMessage(
        plan.isActive
          ? t("admin.planManagement.toasts.deactivated", "Plan pasif yapıldı: {{name}}", {
              name: plan.displayName
            })
          : t("admin.planManagement.toasts.activated", "Plan aktifleştirildi: {{name}}", {
              name: plan.displayName
            })
      );
      await loadPlans();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTogglingId("");
    }
  }

  return (
    <SectionCard
      title={t("admin.planManagement.title", "Plan Yönetimi")}
      description={t(
        "admin.planManagement.description",
        "Abonelik planlarını oluştur, düzenle ve aktif/pasif durumunu yönet."
      )}
    >
      {message ? <MessageBanner tone="success">{message}</MessageBanner> : null}
      {error ? <MessageBanner tone="error">{error}</MessageBanner> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading
            ? t("admin.planManagement.loading", "Planlar yükleniyor...")
            : t("admin.planManagement.summary", "{{count}} plan tanımlı.", {
                count: sortedPlans.length
              })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={() => loadPlans()}
            disabled={loading}
          >
            {t("admin.planManagement.refresh", "Yenile")}
          </button>
          <button
            type="button"
            className={buttonStyles.primary}
            onClick={startCreate}
            disabled={showForm}
          >
            {t("admin.planManagement.create", "Yeni Plan")}
          </button>
        </div>
      </div>

      {!loading ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-4">{t("admin.planManagement.cols.code", "Kod")}</th>
                <th className="py-2 pr-4">{t("admin.planManagement.cols.name", "Ad")}</th>
                <th className="py-2 pr-4">{t("admin.planManagement.cols.price", "Fiyat")}</th>
                <th className="py-2 pr-4">{t("admin.planManagement.cols.period", "Periyot")}</th>
                <th className="py-2 pr-4">{t("admin.planManagement.cols.features", "Özellikler")}</th>
                <th className="py-2 pr-4">{t("admin.planManagement.cols.status", "Durum")}</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedPlans.map((plan) => {
                const activeFeatures = FEATURE_KEYS.filter(
                  (key) => Boolean(plan.features?.[key])
                );
                return (
                  <tr key={plan.id} className={plan.isActive ? "" : "bg-slate-50"}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{plan.code}</td>
                    <td className="py-2 pr-4 text-slate-800">
                      <div className="font-medium">{plan.displayName}</div>
                      {plan.description ? (
                        <div className="mt-0.5 text-xs text-slate-500 line-clamp-2 max-w-sm">
                          {plan.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-slate-800">
                      <span className="font-semibold">{plan.monthlyPrice}</span>{" "}
                      <span className="text-xs uppercase text-slate-500">
                        {plan.currency || "TRY"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-700 capitalize">
                      {plan.billingPeriod || "monthly"}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {activeFeatures.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {activeFeatures.slice(0, 4).map((key) => (
                            <span
                              key={key}
                              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700"
                            >
                              {FEATURE_LABELS[key] || key}
                            </span>
                          ))}
                          {activeFeatures.length > 4 ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              +{activeFeatures.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={plan.isActive}
                          disabled={togglingId === plan.id}
                          onChange={() => toggleStatus(plan)}
                        />
                        <span
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                            plan.isActive ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              plan.isActive ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            plan.isActive ? "text-emerald-700" : "text-slate-500"
                          }`}
                        >
                          {plan.isActive
                            ? t("admin.planManagement.statusActive", "Aktif")
                            : t("admin.planManagement.statusInactive", "Pasif")}
                        </span>
                      </label>
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        className="rounded-md bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
                        onClick={() => startEdit(plan)}
                        disabled={showForm}
                      >
                        {t("admin.planManagement.edit", "Düzenle")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedPlans.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={7}>
                    {t("admin.planManagement.empty", "Henüz plan tanımlanmamış.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {isCreating
                ? t("admin.planManagement.form.titleCreate", "Yeni plan oluştur")
                : t("admin.planManagement.form.titleEdit", "Planı düzenle")}
            </h3>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <span>{t("admin.planManagement.form.active", "Aktif")}</span>
              <input
                type="checkbox"
                className="sr-only"
                checked={draft.isActive}
                onChange={(event) => updateDraftField("isActive", event.target.checked)}
              />
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                  draft.isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    draft.isActive ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.planManagement.form.displayName", "Plan Adı")}
              </label>
              <input
                type="text"
                value={draft.displayName}
                onChange={(event) => updateDraftField("displayName", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Growth"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.planManagement.form.code", "Kod")} <span className="text-slate-400">(otomatik)</span>
              </label>
              <input
                type="text"
                value={draft.code}
                onChange={(event) => updateDraftField("code", event.target.value.toUpperCase())}
                disabled={isEditing}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:bg-slate-100"
                placeholder="GROWTH"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.planManagement.form.price", "Fiyat")}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={draft.monthlyPrice}
                onChange={(event) => updateDraftField("monthlyPrice", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="79"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.planManagement.form.currency", "Para Birimi")}
              </label>
              <select
                value={draft.currency}
                onChange={(event) => updateDraftField("currency", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.planManagement.form.period", "Periyot")}
              </label>
              <select
                value={draft.billingPeriod}
                onChange={(event) => updateDraftField("billingPeriod", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {BILLING_OPTIONS.map((period) => (
                  <option key={period} value={period}>
                    {period === "monthly"
                      ? t("admin.planManagement.form.periodMonthly", "Aylık")
                      : t("admin.planManagement.form.periodYearly", "Yıllık")}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.planManagement.form.description", "Açıklama")}
              </label>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(event) => updateDraftField("description", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder={t(
                  "admin.planManagement.form.descriptionPlaceholder",
                  "Plan açıklaması..."
                )}
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.planManagement.form.featuresTitle", "Özellikler")}
            </h4>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-300"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                    checked={Boolean(draft.features[key])}
                    onChange={(event) => updateFeature(key, event.target.checked)}
                  />
                  <span>{FEATURE_LABELS[key] || key}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.planManagement.form.limitsTitle", "Limitler")}
            </h4>
            <p className="text-xs text-slate-400">
              {t(
                "admin.planManagement.form.limitsHint",
                "Sınırsız yapmak için boş bırakın."
              )}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LIMIT_KEYS.map((key) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-600">
                    {LIMIT_LABELS[key] || key}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.limits[key]}
                    onChange={(event) => updateLimit(key, event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    placeholder={formatLimit(draft.limits[key])}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={cancelEdit}
              disabled={saving}
            >
              {t("admin.planManagement.form.cancel", "Vazgeç")}
            </button>
            <button type="submit" className={buttonStyles.primary} disabled={saving}>
              {saving
                ? t("admin.planManagement.form.saving", "Kaydediliyor...")
                : isCreating
                ? t("admin.planManagement.form.create", "Oluştur")
                : t("admin.planManagement.form.save", "Kaydet")}
            </button>
          </div>
        </form>
      ) : null}
    </SectionCard>
  );
}
