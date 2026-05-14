const TONE_STYLES = {
  PENDING: {
    shell: "border-amber-200 bg-white",
    badge: "bg-amber-100 text-amber-800",
    accent: "bg-amber-400",
    button: "bg-amber-500 text-white hover:bg-amber-600"
  },
  PREPARING: {
    shell: "border-sky-200 bg-white",
    badge: "bg-sky-100 text-sky-800",
    accent: "bg-sky-400",
    button: "bg-sky-600 text-white hover:bg-sky-700"
  },
  READY: {
    shell: "border-emerald-200 bg-white",
    badge: "bg-emerald-100 text-emerald-800",
    accent: "bg-emerald-400",
    button: "bg-emerald-600 text-white hover:bg-emerald-700"
  }
};

export default function OrderCard({ order, busy, onAction }) {
  const tone = TONE_STYLES[order.status] || TONE_STYLES.PENDING;
  const totalItems = order.items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  return (
    <article
      className={[
        "relative overflow-hidden rounded-[20px] border p-4 shadow-sm transition sm:rounded-[24px] sm:p-5",
        tone.shell,
        order.isLate ? "ring-2 ring-rose-300 ring-offset-2 ring-offset-white" : "",
        order.isNew ? "ring-2 ring-emerald-200 ring-offset-2 ring-offset-white" : ""
      ].join(" ")}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 ${order.isLate ? "bg-rose-400" : tone.accent}`} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{order.status}</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:mt-3 sm:text-3xl md:text-4xl">{order.orderCode}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-3">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 sm:text-base">{order.sourceLabel}</p>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 sm:text-[11px]">
              {totalItems} items
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${tone.badge}`}>
            {order.actionLabel}
          </span>
          {order.isNew ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              New
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Placed</p>
          <p className="mt-1.5 text-base font-bold text-slate-900 sm:mt-2 sm:text-lg">{order.placedLabel}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Started</p>
          <p className="mt-1.5 text-base font-bold text-slate-900 sm:mt-2 sm:text-lg">{order.startedLabel}</p>
        </div>
        <div className={`rounded-xl px-3 py-2.5 sm:rounded-2xl sm:py-3 ${order.isLate ? "bg-rose-50" : "bg-slate-50"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Elapsed</p>
          <p className={`mt-1.5 text-base font-bold sm:mt-2 sm:text-lg ${order.isLate ? "text-rose-700" : "text-slate-900"}`}>{order.elapsedLabel}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
            <p className="text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
              {item.quantity} x {item.name}
            </p>
            {item.notes ? <p className="mt-1.5 text-sm text-slate-600 sm:mt-2 sm:text-base">{item.notes}</p> : null}
          </div>
        ))}
      </div>

      <button
        className={[
          "mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-base font-black uppercase tracking-[0.1em] transition sm:mt-5 sm:min-h-[60px] sm:rounded-2xl sm:text-lg sm:tracking-[0.12em]",
          busy ? "cursor-wait bg-slate-200 text-slate-500" : tone.button
        ].join(" ")}
        disabled={busy}
        onClick={() => onAction(order)}
        type="button"
      >
        {busy ? "Working..." : order.actionLabel}
      </button>
    </article>
  );
}
