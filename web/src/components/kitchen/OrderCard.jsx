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

  return (
    <article
      className={[
        "relative overflow-hidden rounded-[24px] border p-5 shadow-sm transition",
        tone.shell,
        order.isLate ? "ring-2 ring-rose-300 ring-offset-2 ring-offset-white" : "",
        order.isNew ? "ring-2 ring-emerald-200 ring-offset-2 ring-offset-white" : ""
      ].join(" ")}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 ${order.isLate ? "bg-rose-400" : tone.accent}`} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{order.status}</p>
          <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{order.orderCode}</h3>
          <p className="mt-3 text-lg font-semibold uppercase tracking-[0.12em] text-slate-700">{order.sourceLabel}</p>
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

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Placed</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{order.placedLabel}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Started</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{order.startedLabel}</p>
        </div>
        <div className={`rounded-2xl px-3 py-3 ${order.isLate ? "bg-rose-50" : "bg-slate-50"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Elapsed</p>
          <p className={`mt-2 text-lg font-bold ${order.isLate ? "text-rose-700" : "text-slate-900"}`}>{order.elapsedLabel}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xl font-semibold leading-tight text-slate-950">
              {item.quantity} x {item.name}
            </p>
            {item.notes ? <p className="mt-2 text-base text-slate-600">{item.notes}</p> : null}
          </div>
        ))}
      </div>

      <button
        className={[
          "mt-5 flex min-h-[60px] w-full items-center justify-center rounded-2xl px-4 text-lg font-black uppercase tracking-[0.12em] transition",
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
