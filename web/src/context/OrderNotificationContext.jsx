import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  createNotificationEntry,
  loadAcknowledgedOrderIds,
  saveAcknowledgedOrderIds
} from "../services/orderNotificationStore";
import { playNotificationSound, unlockNotificationAudio } from "../utils/notificationSounds";

const OrderNotificationContext = createContext(null);

function showBrowserNotification(entry) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const title = entry.message;
  const body = [
    entry.orderCode ? `#${entry.orderCode}` : null,
    entry.tableName ? `Table ${entry.tableName}` : null,
    entry.customerName ? entry.customerName : null
  ]
    .filter(Boolean)
    .join(" • ");

  try {
    const notification = new Notification(title, {
      body,
      tag: entry.id,
      renotify: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some mobile browsers block notifications without service worker.
  }
}

export function OrderNotificationProvider({ children, session }) {
  const restaurantId = session?.user?.restaurantId || session?.user?.restaurant?.id || "default";
  const [notifications, setNotifications] = useState([]);
  const [acknowledgedOrderIds, setAcknowledgedOrderIds] = useState(() => loadAcknowledgedOrderIds(restaurantId));
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  const unreadCount = useMemo(() => notifications.filter((entry) => !entry.read).length, [notifications]);

  const requestBrowserPermission = useCallback(async () => {
    await unlockNotificationAudio();

    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    if (Notification.permission === "granted") {
      setPermission("granted");
      return "granted";
    }

    if (Notification.permission === "denied") {
      setPermission("denied");
      return "denied";
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const pushNotification = useCallback(
    (order, type, panel = "staff") => {
      const entry = createNotificationEntry({ order, type, panel });
      if (!entry) {
        return;
      }

      setNotifications((previous) => [entry, ...previous].slice(0, 80));
      showBrowserNotification(entry);
    },
    []
  );

  const acknowledgeOrder = useCallback(
    (orderId) => {
      if (!orderId) {
        return;
      }

      setAcknowledgedOrderIds((previous) => {
        const next = new Set(previous);
        next.add(orderId);
        saveAcknowledgedOrderIds(restaurantId, next);
        return next;
      });

      setNotifications((previous) =>
        previous.map((entry) => (entry.orderId === orderId ? { ...entry, read: true } : entry))
      );
    },
    [restaurantId]
  );

  const markAllRead = useCallback(() => {
    setNotifications((previous) => previous.map((entry) => ({ ...entry, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const playSound = useCallback(async (type) => {
    await playNotificationSound(type);
  }, []);

  const value = useMemo(
    () => ({
      restaurantId,
      notifications,
      unreadCount,
      acknowledgedOrderIds,
      permission,
      requestBrowserPermission,
      pushNotification,
      acknowledgeOrder,
      markAllRead,
      clearNotifications,
      playSound
    }),
    [
      restaurantId,
      notifications,
      unreadCount,
      acknowledgedOrderIds,
      permission,
      requestBrowserPermission,
      pushNotification,
      acknowledgeOrder,
      markAllRead,
      clearNotifications,
      playSound
    ]
  );

  return <OrderNotificationContext.Provider value={value}>{children}</OrderNotificationContext.Provider>;
}

export function useOrderNotificationContext() {
  const context = useContext(OrderNotificationContext);
  if (!context) {
    throw new Error("useOrderNotificationContext must be used within OrderNotificationProvider");
  }
  return context;
}

export function useOptionalOrderNotificationContext() {
  return useContext(OrderNotificationContext);
}
