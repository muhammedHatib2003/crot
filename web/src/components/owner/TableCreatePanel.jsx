import { Field, StatusPill, buttonStyles, fieldStyles } from "../app/AppShell";

const TABLE_SEAT_OPTIONS = [2, 4, 6, 8, 10];
const TABLE_STATUS_OPTIONS = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

function getTableTone(status) {
  if (status === "AVAILABLE") return "success";
  if (status === "OCCUPIED") return "warning";
  if (status === "RESERVED") return "info";
  return "neutral";
}

function getTablePreviewClasses(status) {
  if (status === "AVAILABLE") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }
  if (status === "OCCUPIED") {
    return "border-rose-300 bg-rose-50 text-rose-950";
  }
  if (status === "RESERVED") {
    return "border-sky-300 bg-sky-50 text-sky-950";
  }
  return "border-slate-300 bg-slate-100 text-slate-900";
}

export default function TableCreatePanel({
  tableForm,
  addingTable,
  canUseBusinessTools,
  onSubmit,
  onFieldChange
}) {
  const previewName = tableForm.name?.trim() || "T12";

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.1),_transparent_40%),#ffffff] p-5">
        <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-4">
          <div className={`aspect-square rounded-[28px] border-2 p-4 shadow-sm ${getTablePreviewClasses(tableForm.status)}`}>
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">Preview</p>
                <p className="mt-2 text-2xl font-bold leading-none">{previewName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">Seats</p>
                <p className="mt-1 text-lg font-bold">{tableForm.seats}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status on create</p>
              <div className="mt-2">
                <StatusPill tone={getTableTone(tableForm.status)}>{tableForm.status}</StatusPill>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              QR ordering link and QR preview appear automatically after the table is created.
            </p>
          </div>
        </div>
      </div>

      <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Table name">
          <input
            className={fieldStyles}
            placeholder="Table 12"
            required
            value={tableForm.name}
            onChange={(event) => onFieldChange("name", event.target.value)}
          />
        </Field>
        <Field label="Seats">
          <select className={fieldStyles} value={tableForm.seats} onChange={(event) => onFieldChange("seats", Number(event.target.value))}>
            {TABLE_SEAT_OPTIONS.map((seatCount) => (
              <option key={seatCount} value={seatCount}>
                {seatCount} seats
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Status">
            <select className={fieldStyles} value={tableForm.status} onChange={(event) => onFieldChange("status", event.target.value)}>
              {TABLE_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <button className={`${buttonStyles.primary} w-full justify-center py-3.5 text-base`} disabled={addingTable || !canUseBusinessTools} type="submit">
            {addingTable ? "Creating..." : "Create table"}
          </button>
        </div>
      </form>
    </div>
  );
}
