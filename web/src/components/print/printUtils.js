export function formatPrintDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatPrintCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
}

export function getOrderTypeLabel(order) {
  const orderType = String(order?.orderType || "").trim().toUpperCase();
  const source = String(order?.source || "").trim().toUpperCase();

  if (source === "QR" || (orderType === "TABLE" && source !== "WAITER")) {
    return "QR Masa";
  }
  if (orderType === "TABLE" || orderType === "DINE_IN") {
    return "Masa";
  }
  if (orderType === "PICKUP") {
    return "Gel-Al";
  }
  if (orderType === "DELIVERY") {
    return "Eve Teslim";
  }
  if (source === "ONLINE") {
    return "Online";
  }

  return orderType || "Sipariş";
}

export function getOrderLocationLabel(order) {
  if (order?.table?.name) {
    return `Masa: ${order.table.name}`;
  }
  if (order?.tableNumber) {
    return `Masa: ${order.tableNumber}`;
  }
  if (order?.orderType === "DELIVERY" || order?.orderType === "PICKUP") {
    return getOrderTypeLabel(order);
  }
  return getOrderTypeLabel(order);
}

export function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

export function getOrderUnitPrice(item) {
  if (Number.isFinite(item?.price)) {
    return Number(item.price);
  }
  if (Number.isFinite(item?.unitPriceSnapshot)) {
    return Number(item.unitPriceSnapshot);
  }
  if (Number.isFinite(item?.priceCents)) {
    return Number(item.priceCents) / 100;
  }
  return 0;
}

export function triggerPrint() {
  if (typeof window === "undefined") {
    return;
  }
  setTimeout(() => {
    window.print();
  }, 80);
}
