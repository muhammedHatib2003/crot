import TableQrCode from "./TableQrCode";
import { StatusPill, buttonStyles, fieldStyles } from "../app/AppShell";

const TABLE_STATUS_OPTIONS = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

function getTableTone(status) {
  if (status === "AVAILABLE") return "success";
  if (status === "OCCUPIED") return "warning";
  if (status === "RESERVED") return "info";
  return "neutral";
}

function IconCopy() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function IconPrint() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M7 9V4h10v5" />
      <rect height="8" rx="1" width="12" x="6" y="13" />
      <path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

export default function TableQrCard({
  table,
  orderLink,
  updatingTableId,
  printingTableId,
  onStatusChange,
  onCopyLink,
  onPrint
}) {
  const isPrinting = printingTableId === table.id;
  const isUpdating = updatingTableId === table.id;

  return (
    <article className="flex h-full flex-col rounded-[28px] border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">{table.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">{table.seats} seats</p>
        </div>
        <StatusPill tone={getTableTone(table.status)}>{table.status}</StatusPill>
      </div>

      <div className="mx-auto mt-5 flex w-full max-w-[200px] justify-center rounded-[24px] border border-slate-200 bg-white p-4 shadow-inner">
        <TableQrCode size={168} tableId={table.id} />
      </div>

      <div className="mt-5">
        <label className="sr-only" htmlFor={`table-status-${table.id}`}>
          Table status
        </label>
        <select
          className={`${fieldStyles} py-2 text-xs`}
          disabled={isUpdating}
          id={`table-status-${table.id}`}
          value={table.status}
          onChange={(event) => onStatusChange(table.id, event.target.value)}
        >
          {TABLE_STATUS_OPTIONS.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {statusOption}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">QR link</p>
        <a
          className="mt-2 block break-all text-sm font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 hover:text-brand-900"
          href={orderLink}
          rel="noreferrer"
          target="_blank"
        >
          {orderLink}
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className={`${buttonStyles.secondary} w-full gap-2 py-2.5`}
          onClick={() => onCopyLink(orderLink, table.name)}
          type="button"
        >
          <IconCopy />
          Copy link
        </button>
        <button
          className={`${buttonStyles.secondary} w-full gap-2 py-2.5`}
          disabled={isPrinting}
          onClick={() => onPrint(table)}
          type="button"
        >
          <IconPrint />
          {isPrinting ? "..." : "Print QR"}
        </button>
      </div>
    </article>
  );
}
