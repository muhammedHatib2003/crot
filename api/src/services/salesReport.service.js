const { formatOrderCode } = require("../utils/orders");

class SalesReportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SalesReportError";
    this.status = status;
  }
}

const SALES_ORDER_INCLUDE = {
  table: {
    select: {
      name: true
    }
  },
  items: {
    select: {
      id: true
    }
  }
};

function parseReportDateRange(fromRaw, toRaw) {
  const from = fromRaw ? new Date(String(fromRaw).trim()) : null;
  const to = toRaw ? new Date(String(toRaw).trim()) : null;

  if (!from || Number.isNaN(from.getTime())) {
    throw new SalesReportError("from date is required (YYYY-MM-DD).", 400);
  }

  if (!to || Number.isNaN(to.getTime())) {
    throw new SalesReportError("to date is required (YYYY-MM-DD).", 400);
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  if (from > to) {
    throw new SalesReportError("from must be before or equal to to.", 400);
  }

  return { from, to };
}

function getOrderSaleTimestamp(order) {
  return order.completedAt || order.createdAt;
}

function buildSalesWhere(restaurantId, from, to) {
  return {
    restaurantId,
    paymentStatus: "PAID",
    status: {
      notIn: ["CANCELLED", "REJECTED"]
    },
    OR: [
      {
        completedAt: {
          gte: from,
          lte: to
        }
      },
      {
        completedAt: null,
        createdAt: {
          gte: from,
          lte: to
        }
      }
    ]
  };
}

function addPaymentTotals(entry, order) {
  const total = Number(order.totalCents || 0) / 100;
  const method = String(order.paymentMethod || "").trim().toUpperCase();

  if (method === "CASH") {
    entry.cashTotal += total;
  } else if (method === "CARD") {
    entry.cardTotal += total;
  } else if (method === "ONLINE") {
    entry.onlineTotal += total;
  }

  return total;
}

function mapTransaction(order) {
  return {
    id: order.id,
    orderCode: formatOrderCode(order.orderCode),
    soldAt: getOrderSaleTimestamp(order),
    orderType: order.orderType,
    source: order.source,
    paymentMethod: order.paymentMethod,
    subtotal: Number(order.subtotalCents || 0) / 100,
    deliveryFee: Number(order.deliveryFeeCents || 0) / 100,
    total: Number(order.totalCents || 0) / 100,
    tableName: order.table?.name || null,
    customerName: order.customerName || null,
    itemCount: order.items?.length || 0
  };
}

function bucketKey(date, groupBy) {
  const value = new Date(date);

  if (groupBy === "month") {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }

  return value.toISOString().slice(0, 10);
}

function buildBuckets(orders, groupBy) {
  const buckets = new Map();

  orders.forEach((order) => {
    const key = bucketKey(getOrderSaleTimestamp(order), groupBy);
    const entry = buckets.get(key) || {
      period: key,
      revenue: 0,
      orderCount: 0,
      cashTotal: 0,
      cardTotal: 0,
      onlineTotal: 0
    };

    entry.revenue += addPaymentTotals(entry, order);
    entry.orderCount += 1;
    buckets.set(key, entry);
  });

  return Array.from(buckets.values()).sort((left, right) => left.period.localeCompare(right.period));
}

function buildSummary(orders) {
  let totalRevenue = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let onlineTotal = 0;
  const byType = {
    DINE_IN: 0,
    PICKUP: 0,
    DELIVERY: 0
  };

  orders.forEach((order) => {
    const totals = { cashTotal: 0, cardTotal: 0, onlineTotal: 0 };
    const total = addPaymentTotals(totals, order);
    totalRevenue += total;
    cashTotal += totals.cashTotal;
    cardTotal += totals.cardTotal;
    onlineTotal += totals.onlineTotal;

    const orderType = String(order.orderType || "DINE_IN").trim().toUpperCase();
    byType[orderType] = (byType[orderType] || 0) + total;
  });

  return {
    totalRevenue,
    totalOrders: orders.length,
    averageTicket: orders.length ? totalRevenue / orders.length : 0,
    cashTotal,
    cardTotal,
    onlineTotal,
    dineInTotal: byType.DINE_IN || 0,
    pickupTotal: byType.PICKUP || 0,
    deliveryTotal: byType.DELIVERY || 0
  };
}

async function getSalesReport(client, restaurantId, options = {}) {
  const groupBy = options.groupBy === "month" ? "month" : "day";
  const { from, to } = parseReportDateRange(options.from, options.to);

  const orders = await client.order.findMany({
    where: buildSalesWhere(restaurantId, from, to),
    include: SALES_ORDER_INCLUDE,
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }]
  });

  return {
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy
    },
    summary: buildSummary(orders),
    buckets: buildBuckets(orders, groupBy),
    transactions: orders.map(mapTransaction)
  };
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCsvDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().replace("T", " ").slice(0, 19);
}

function buildSalesCsv(report, restaurantName) {
  const lines = [];

  lines.push(`Restaurant,${escapeCsv(restaurantName)}`);
  lines.push(`From,${report.period.from.slice(0, 10)}`);
  lines.push(`To,${report.period.to.slice(0, 10)}`);
  lines.push(`Grouped by,${report.period.groupBy}`);
  lines.push("");
  lines.push("Summary");
  lines.push(`Total revenue,${report.summary.totalRevenue.toFixed(2)}`);
  lines.push(`Total orders,${report.summary.totalOrders}`);
  lines.push(`Average ticket,${report.summary.averageTicket.toFixed(2)}`);
  lines.push(`Cash total,${report.summary.cashTotal.toFixed(2)}`);
  lines.push(`Card total,${report.summary.cardTotal.toFixed(2)}`);
  lines.push(`Online total,${report.summary.onlineTotal.toFixed(2)}`);
  lines.push(`Dine-in total,${report.summary.dineInTotal.toFixed(2)}`);
  lines.push(`Pickup total,${report.summary.pickupTotal.toFixed(2)}`);
  lines.push(`Delivery total,${report.summary.deliveryTotal.toFixed(2)}`);
  lines.push("");
  lines.push("Period breakdown");
  lines.push("Period,Orders,Revenue,Cash,Card,Online");
  report.buckets.forEach((bucket) => {
    lines.push(
      [
        escapeCsv(bucket.period),
        bucket.orderCount,
        bucket.revenue.toFixed(2),
        bucket.cashTotal.toFixed(2),
        bucket.cardTotal.toFixed(2),
        bucket.onlineTotal.toFixed(2)
      ].join(",")
    );
  });
  lines.push("");
  lines.push("Transactions");
  lines.push("Date,Order,Type,Source,Payment,Table,Customer,Items,Subtotal,Delivery,Total");
  report.transactions.forEach((transaction) => {
    lines.push(
      [
        escapeCsv(formatCsvDate(transaction.soldAt)),
        escapeCsv(transaction.orderCode),
        escapeCsv(transaction.orderType),
        escapeCsv(transaction.source),
        escapeCsv(transaction.paymentMethod),
        escapeCsv(transaction.tableName),
        escapeCsv(transaction.customerName),
        transaction.itemCount,
        transaction.subtotal.toFixed(2),
        transaction.deliveryFee.toFixed(2),
        transaction.total.toFixed(2)
      ].join(",")
    );
  });

  return lines.join("\n");
}

module.exports = {
  SalesReportError,
  buildSalesCsv,
  getSalesReport
};
