import OwnerPlanCheckout from "./OwnerPlanCheckout";
import { buttonStyles } from "../app/AppShell";

export default function OwnerPlanGateModal({
  restaurantName,
  plans,
  selectedPlanId,
  onSelectPlanId,
  onSubmit,
  savingPlan,
  error,
  onLogout
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-plan-gate-title"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">İlk kurulum</p>
              <h2 id="owner-plan-gate-title" className="mt-1 text-xl font-semibold text-slate-900">
                Plan seçimi ve ödeme
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{restaurantName}</span> için bir abonelik planı seçin.
                Ödemeyi tamamlamadan owner paneline erişemezsiniz.
              </p>
            </div>
            {onLogout ? (
              <button className={buttonStyles.secondary} onClick={onLogout} type="button">
                Çıkış yap
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
          <OwnerPlanCheckout
            compact
            currentPlan={null}
            onSelectPlanId={onSelectPlanId}
            onSubmit={onSubmit}
            plans={plans}
            savingPlan={savingPlan}
            selectedPlanId={selectedPlanId}
          />
        </div>
      </div>
    </div>
  );
}
