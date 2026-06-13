import { useEffect, useRef, useState } from "react";
import { useOrderNotificationContext } from "../../context/OrderNotificationContext";
import useAppTranslation from "../../hooks/useAppTranslation";
import { unlockNotificationAudio } from "../../utils/notificationSounds";
import { buttonStyles } from "../app/AppShell";

function getTone(type) {
  if (type === "NEW_ORDER") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (type === "ORDER_READY") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (type === "ORDER_CANCELLED") {
    return "border-rose-300 bg-rose-50 text-rose-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function NotificationCenter({ className = "" }) {
  const { t, formatTime } = useAppTranslation();
  const {
    notifications,
    unreadCount,
    permission,
    requestBrowserPermission,
    acknowledgeOrder,
    markAllRead,
    clearNotifications
  } = useOrderNotificationContext();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      <button
        aria-label={t("notifications.ariaLabel")}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        onClick={async () => {
          await unlockNotificationAudio();
          setOpen((value) => !value);
        }}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-700 px-1 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("notifications.title")}</p>
              <p className="text-xs text-slate-500">{t("notifications.unread", { count: unreadCount })}</p>
            </div>
            <div className="flex gap-1">
              <button className={buttonStyles.subtle} onClick={markAllRead} type="button">
                {t("notifications.readAll")}
              </button>
              <button className={buttonStyles.subtle} onClick={clearNotifications} type="button">
                {t("notifications.clear")}
              </button>
            </div>
          </div>

          {permission !== "granted" && permission !== "denied" ? (
            <div className="border-b border-slate-100 px-4 py-2">
              <button className={`${buttonStyles.subtle} w-full text-xs`} onClick={requestBrowserPermission} type="button">
                {t("notifications.enableAlerts")}
              </button>
            </div>
          ) : null}

          <div className="max-h-80 overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">{t("notifications.empty")}</p>
            ) : (
              notifications.map((entry) => (
                <button
                  key={entry.id}
                  className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition hover:opacity-90 ${
                    entry.read ? "opacity-70" : ""
                  } ${getTone(entry.type)}`}
                  onClick={() => {
                    acknowledgeOrder(entry.orderId);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{entry.message}</p>
                    <span className="text-[10px] uppercase tracking-wide">
                      {formatTime(entry.createdAt, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs">
                    {entry.orderCode}
                    {entry.tableName ? ` • ${entry.tableName}` : ""}
                    {entry.customerName ? ` • ${entry.customerName}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
