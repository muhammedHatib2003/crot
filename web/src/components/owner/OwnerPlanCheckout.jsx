import { buttonStyles } from "../app/AppShell";

export default function OwnerPlanCheckout({
  plans,
  selectedPlanId,
  onSelectPlanId,
  currentPlan,
  onSubmit,
  savingPlan,
  compact = false
}) {
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div
        className={`grid grid-cols-1 gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}
      >
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isCurrent = currentPlan?.id === plan.id;
          const activeFeatureKeys = Object.entries(plan.features || {})
            .filter(([, enabled]) => Boolean(enabled))
            .map(([key]) => key);
          const limitEntries = Object.entries(plan.limits || {}).filter(
            ([, value]) => value !== undefined
          );
          const currency = plan.currency || "TRY";
          const periodLabel = plan.billingPeriod === "yearly" ? "/yıl" : "/ay";

          return (
            <label
              key={plan.id}
              className={`relative flex h-full cursor-pointer flex-col rounded-2xl border px-4 py-4 transition ${
                isSelected
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{plan.displayName}</p>
                  {plan.description ? (
                    <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">
                    {plan.monthlyPrice}
                    <span className="ml-1 text-xs font-medium uppercase text-slate-500">{currency}</span>
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {periodLabel}
                  </p>
                  {isCurrent ? (
                    <p className="mt-1 text-xs font-medium text-brand-700">Aktif plan</p>
                  ) : null}
                </div>
              </div>

              {activeFeatureKeys.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {activeFeatureKeys.slice(0, compact ? 4 : 6).map((featureKey) => (
                    <li key={featureKey} className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        ✓
                      </span>
                      <span className="capitalize">{featureKey.replace(/([A-Z])/g, " $1").trim()}</span>
                    </li>
                  ))}
                  {activeFeatureKeys.length > (compact ? 4 : 6) ? (
                    <li className="text-xs text-slate-500">
                      +{activeFeatureKeys.length - (compact ? 4 : 6)} özellik daha
                    </li>
                  ) : null}
                </ul>
              ) : null}

              {limitEntries.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                  {limitEntries.map(([limitKey, limitValue]) => (
                    <div key={limitKey} className="flex items-center justify-between gap-2">
                      <span className="truncate capitalize">
                        {limitKey
                          .replace(/^max/, "")
                          .replace(/([A-Z])/g, " $1")
                          .trim()
                          .toLowerCase()}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {limitValue === null || limitValue === undefined ? "∞" : limitValue}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <input
                checked={isSelected}
                className="sr-only"
                name="plan"
                onChange={() => onSelectPlanId(plan.id)}
                type="radio"
              />
            </label>
          );
        })}
        {plans.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Aktif plan bulunamadı. Lütfen daha sonra tekrar deneyin.
          </div>
        ) : null}
      </div>
      <button className={`${buttonStyles.primary} w-full sm:w-auto`} disabled={savingPlan || !selectedPlan} type="submit">
        {savingPlan
          ? "Ödeme sayfası açılıyor..."
          : selectedPlan
            ? `Iyzico ile öde — ${selectedPlan.displayName} (${selectedPlan.monthlyPrice} ${selectedPlan.currency || "TRY"})`
            : "Plan seçin"}
      </button>
      <p className="text-xs text-slate-500">
        Güvenli Iyzico ödeme sayfasına yönlendirileceksiniz. Ödeme başarılı olduğunda plan otomatik aktifleşir.
      </p>
    </form>
  );
}
