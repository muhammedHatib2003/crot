function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
  subtle:
    "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
};

export const fieldStyles =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export const textareaStyles = `${fieldStyles} min-h-[88px] resize-y`;

export function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}

export function PageHeader({ title, description, meta = [], actions, eyebrow }) {
  return (
    <header className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200/70 md:px-6">
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
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
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
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700"
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
            "rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70",
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
    <nav className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const isActive = item.id === activeKey;
          return (
            <button
              key={item.id}
              className={joinClasses(
                "rounded-xl px-4 py-2.5 text-sm font-medium transition",
                isActive ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
    <section className={joinClasses("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70", className)}>
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
    info: "border-slate-200 bg-white text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return (
    <div className={joinClasses("rounded-2xl border px-4 py-3 text-sm shadow-sm", tones[tone] || tones.info)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
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
  return <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">{children}</div>;
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
    <article className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
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
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
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
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <aside className={joinClasses("h-full w-full border-l border-slate-200 bg-white shadow-2xl", widthClass)}>
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
