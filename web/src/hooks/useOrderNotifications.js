import { useEffect, useRef } from "react";
import { useOrderNotificationContext } from "../context/OrderNotificationContext";

const REPEAT_MS = 30000;

function buildSnapshot(orders) {
  const snapshot = new Map();

  (orders || []).forEach((order) => {
    if (!order?.id) {
      return;
    }

    snapshot.set(order.id, {
      status: String(order.status || "").trim().toUpperCase(),
      createdAt: order.createdAt
    });
  });

  return snapshot;
}

export default function useOrderNotifications(orders, options = {}) {
  const enabled = options.enabled !== false;
  const panel = options.panel || "staff";
  const {
    acknowledgedOrderIds,
    pushNotification,
    acknowledgeOrder,
    playSound,
    requestBrowserPermission
  } = useOrderNotificationContext();

  const previousSnapshotRef = useRef(new Map());
  const playedEventsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const ordersRef = useRef(orders);

  ordersRef.current = orders;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    requestBrowserPermission();
    return undefined;
  }, [enabled, requestBrowserPermission]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const nextSnapshot = buildSnapshot(orders);

    if (!initializedRef.current) {
      initializedRef.current = true;
      previousSnapshotRef.current = nextSnapshot;
      return undefined;
    }

    nextSnapshot.forEach((nextState, orderId) => {
      const previousState = previousSnapshotRef.current.get(orderId);
      const order = (orders || []).find((entry) => entry.id === orderId);
      if (!order) {
        return;
      }

      if (!previousState) {
        const eventKey = `${orderId}:NEW_ORDER`;
        if (!playedEventsRef.current.has(eventKey)) {
          playedEventsRef.current.add(eventKey);
          pushNotification(order, "NEW_ORDER", panel);
          playSound("NEW_ORDER");
        }
        return;
      }

      if (previousState.status !== "READY" && nextState.status === "READY") {
        const eventKey = `${orderId}:ORDER_READY`;
        if (!playedEventsRef.current.has(eventKey)) {
          playedEventsRef.current.add(eventKey);
          pushNotification(order, "ORDER_READY", panel);
          playSound("ORDER_READY");
        }
      }

      if (previousState.status !== "CANCELLED" && nextState.status === "CANCELLED") {
        const eventKey = `${orderId}:ORDER_CANCELLED`;
        if (!playedEventsRef.current.has(eventKey)) {
          playedEventsRef.current.add(eventKey);
          acknowledgeOrder(orderId);
          pushNotification(order, "ORDER_CANCELLED", panel);
          playSound("ORDER_CANCELLED");
        }
      }
    });

    previousSnapshotRef.current = nextSnapshot;
  }, [orders, enabled, panel, pushNotification, playSound, acknowledgeOrder]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const currentOrders = ordersRef.current || [];

      currentOrders.forEach((order) => {
        if (!order?.id) {
          return;
        }

        if (acknowledgedOrderIds.has(order.id)) {
          return;
        }

        const status = String(order.status || "").trim().toUpperCase();
        if (status !== "PENDING" && status !== "ACCEPTED") {
          return;
        }

        playSound("NEW_ORDER");
      });
    }, REPEAT_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, acknowledgedOrderIds, playSound]);

  return {
    acknowledgeOrder
  };
}
