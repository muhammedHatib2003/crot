function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export const buttonStyles = {
  primary:
    "ui-action-sheen inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(5,150,105,0.3)] transition duration-200 hover:-translate-y-0.5 hover:from-brand-900 hover:to-brand-700 hover:shadow-[0_14px_28px_rgba(5,150,105,0.35)] disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center rounded-xl border border-slate-300/80 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-emerald-50/60 hover:text-slate-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60",
  subtle:
    "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 transition duration-200 hover:bg-emerald-100/80 hover:text-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
};

export const fieldStyles =
  "w-full rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export const textareaStyles = `${fieldStyles} min-h-[88px] resize-y`;

export function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50/70 to-slate-100">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}

export function PageHeader({ title, description, meta = [], actions, eyebrow }) {
  return (
    <header className="ui-surface ui-enter rounded-2xl px-5 py-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
          {meta.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {meta.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function StatusPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-300 bg-slate-100 text-slate-700",
    success: "border-emerald-300 bg-emerald-100 text-emerald-800",
    warning: "border-amber-300 bg-amber-100 text-amber-800",
    info: "border-cyan-300 bg-cyan-100 text-cyan-800",
    danger: "border-rose-300 bg-rose-100 text-rose-800"
  };

  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        tones[tone] || tones.neutral
      )}
    >
      {children}
    </span>
  );
}

export function MetricGrid({ items, variant = "default", className = "" }) {
  if (!items?.length) {
    return null;
  }

  const isCompact = variant === "compact";

  return (
    <div className={joinClasses("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={joinClasses(
            "ui-surface ui-enter rounded-2xl px-4 py-4",
            isCompact ? "min-h-[112px]" : ""
          )}
        >
          <div className="flex items-start gap-3">
            {item.icon ? (
              <div
                className={joinClasses(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  item.iconTone || "bg-slate-100 text-slate-600"
                )}
              >
                {item.icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                {item.badge ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className={joinClasses("font-semibold text-slate-950", isCompact ? "text-[1.85rem] leading-none" : "text-2xl")}>
                  {item.value}
                </p>
                {item.trend ? <p className="text-xs font-medium text-slate-500">{item.trend}</p> : null}
              </div>
              {item.detail ? (
                <p className={joinClasses("mt-1 text-slate-600", isCompact ? "text-xs" : "text-sm")}>{item.detail}</p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Tabs({ items, activeKey, onChange }) {
  return (
    <nav className="ui-surface ui-enter overflow-x-auto rounded-2xl p-1.5">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const isActive = item.id === activeKey;
          return (
            <button
              key={item.id}
              className={joinClasses(
                "rounded-xl px-4 py-2.5 text-sm font-medium transition duration-200",
                isActive
                  ? "bg-gradient-to-r from-brand-700 to-brand-500 text-white shadow-[0_10px_20px_rgba(5,150,105,0.28)]"
                  : "text-slate-600 hover:bg-emerald-100/70 hover:text-brand-900"
              )}
              onClick={() => onChange(item.id)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function SectionCard({ title, description, actions, children, className = "" }) {
  return (
    <section className={joinClasses("ui-surface ui-enter rounded-2xl p-5", className)}>
      {(title || description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            {title ? <h2 className="text-lg font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={joinClasses(title || description || actions ? "mt-5" : "", "")}>{children}</div>
    </section>
  );
}

export function MessageBanner({ tone = "info", children }) {
  const tones = {
    info: "border-cyan-300 bg-cyan-100/80 text-cyan-900",
    success: "border-emerald-300 bg-emerald-100/80 text-emerald-900",
    error: "border-rose-300 bg-rose-100/80 text-rose-900",
    warning: "border-amber-300 bg-amber-100/80 text-amber-900"
  };

  return (
    <div className={joinClasses("ui-enter rounded-2xl border px-4 py-3 text-sm shadow-[0_10px_20px_rgba(15,23,42,0.08)]", tones[tone] || tones.info)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="ui-enter rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/80 px-4 py-6 text-sm text-slate-600">
      <p className="font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 leading-6">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function TableWrap({ children }) {
  return <div className="ui-surface ui-enter overflow-x-auto rounded-2xl">{children}</div>;
}

export function SimpleTable({ headers, children }) {
  return (
    <TableWrap>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
      </table>
    </TableWrap>
  );
}

export function ListRow({ title, subtitle, meta, actions, children }) {
  return (
    <article className="ui-surface ui-enter rounded-2xl px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{title}</h3>
            {meta}
          </div>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}

export function SplitLayout({ sidebar, children }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside>{sidebar}</aside>
      <main className="space-y-5">{children}</main>
    </div>
  );
}

export function SidebarCard({ title, children }) {
  return (
    <div className="ui-surface ui-enter rounded-2xl p-4">
      {title ? <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h2> : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </div>
  );
}

export function Drawer({ open, onClose, title, description, actions, children, widthClass = "max-w-2xl" }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close drawer"
        className="cashier-modal-backdrop absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <aside className={joinClasses("cashier-modal-panel h-full w-full border-l border-emerald-200/70 bg-white/95 shadow-[0_24px_60px_rgba(2,8,23,0.28)]", widthClass)}>
          <div className="flex h-full flex-col px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
                {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <button className={buttonStyles.secondary} onClick={onClose} type="button">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-5">{children}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function identityMeta(user, extra = []) {
  const values = [];

  if (user?.fullName) {
    values.push(user.fullName);
  }
  if (user?.restaurant?.name) {
    values.push(user.restaurant.name);
  } else if (user?.restaurantName) {
    values.push(user.restaurantName);
  }
  if (user?.employeeRole) {
    values.push(user.employeeRole);
  }

  return [...values, ...extra];
}
