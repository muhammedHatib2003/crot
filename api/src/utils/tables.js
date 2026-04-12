const { ACTIVE_ORDER_STATUSES } = require("./orders");

function mapTable(table) {
  return {
    id: table.id,
    name: table.name,
    seats: table.seats,
    status: table.status,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt
  };
}

async function syncTableStatus(transaction, tableId) {
  if (!tableId) {
    return;
  }

  const activeOrdersCount = await transaction.order.count({
    where: {
      tableId,
      status: {
        in: ACTIVE_ORDER_STATUSES
      }
    }
  });

  await transaction.diningTable.update({
    where: { id: tableId },
    data: {
      status: activeOrdersCount > 0 ? "OCCUPIED" : "AVAILABLE"
    }
  });
}

module.exports = {
  mapTable,
  syncTableStatus
};
