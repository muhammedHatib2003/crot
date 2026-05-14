const ONLINE_ORDER_STATUS_TRANSITIONS = {
  PENDING: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["ON_THE_WAY", "COMPLETED"],
  ON_THE_WAY: ["COMPLETED"]
};

function roundCurrency(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.round(numeric * 100) / 100;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function mapOpeningHour(slot) {
  return {
    id: slot.id,
    dayOfWeek: Number(slot.dayOfWeek),
    openTime: slot.openTime,
    closeTime: slot.closeTime,
    isClosed: Boolean(slot.isClosed)
  };
}

function mapRestaurantBase(restaurant, options = {}) {
  const baseDeliveryFee =
    restaurant.baseDeliveryFee != null ? roundCurrency(restaurant.baseDeliveryFee) : roundCurrency(restaurant.deliveryFee);
  const feePerKm = roundCurrency(restaurant.feePerKm);
  const calculatedDeliveryFee =
    options.calculatedDeliveryFee == null ? roundCurrency(restaurant.deliveryFee) : roundCurrency(options.calculatedDeliveryFee);

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description || null,
    cuisineType: restaurant.cuisineType || null,
    logoUrl: restaurant.logoUrl || null,
    coverImageUrl: restaurant.coverImageUrl || null,
    phone: restaurant.phone || null,
    addressText: restaurant.addressText || restaurant.address || null,
    city: restaurant.city || null,
    district: restaurant.district || null,
    latitude: restaurant.latitude == null ? null : Number(restaurant.latitude),
    longitude: restaurant.longitude == null ? null : Number(restaurant.longitude),
    isOnlineOrderingEnabled: Boolean(restaurant.isOnlineOrderingEnabled ?? restaurant.onlineOrderingEnabled),
    isOpen: Boolean(restaurant.isOpen),
    isCurrentlyOpen: Boolean(options.isCurrentlyOpen),
    minimumOrderAmount: roundCurrency(
      restaurant.minimumOrderAmount != null ? restaurant.minimumOrderAmount : restaurant.minOrderAmount
    ),
    baseDeliveryFee,
    feePerKm,
    deliveryFee: calculatedDeliveryFee,
    freeDeliveryThreshold:
      restaurant.freeDeliveryThreshold == null ? null : roundCurrency(restaurant.freeDeliveryThreshold),
    estimatedDeliveryMinutes: Number(restaurant.estimatedDeliveryMinutes || 0),
    deliveryRadiusKm: Number(restaurant.deliveryRadiusKm || 0),
    pickupEnabled: Boolean(restaurant.pickupEnabled),
    deliveryEnabled: Boolean(restaurant.deliveryEnabled),
    ratingAverage: Number(restaurant.ratingAverage || 0),
    ratingCount: Number(restaurant.ratingCount || 0),
    distanceKm: options.distanceKm == null ? null : Number(options.distanceKm),
    inDeliveryZone: options.inDeliveryZone == null ? null : Boolean(options.inDeliveryZone)
  };
}

function mapCategory(category) {
  return {
    id: category.id,
    restaurantId: category.restaurantId,
    name: category.name,
    sortOrder: Number(category.sortOrder || 0),
    isActive: Boolean(category.isActive)
  };
}

function mapProduct(product) {
  return {
    id: product.id,
    restaurantId: product.restaurantId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description || null,
    price: roundCurrency(product.price),
    imageUrl: product.imageUrl || null,
    isAvailable: Boolean(product.isAvailable),
    preparationMinutes: Number(product.preparationMinutes || 0),
    sortOrder: Number(product.sortOrder || 0)
  };
}

function mapOrderItem(item) {
  const unitPrice =
    item.unitPriceSnapshot != null ? Number(item.unitPriceSnapshot) : Number(item.priceCents || 0) / 100;

  return {
    id: item.id,
    productId: item.productId || null,
    productNameSnapshot: item.productNameSnapshot || item.nameSnapshot,
    unitPriceSnapshot: roundCurrency(unitPrice),
    quantity: Number(item.quantity || 0),
    totalPrice: roundCurrency(item.totalPrice != null ? item.totalPrice : unitPrice * Number(item.quantity || 0)),
    note: item.note || item.notes || null
  };
}

function mapOnlineOrder(order) {
  return {
    id: order.id,
    orderCode: order.orderCode || null,
    publicId: order.publicId || null,
    restaurantId: order.restaurantId,
    customerId: order.customerId || order.customerUserId || null,
    orderType: order.orderType,
    status: order.status,
    customerName: order.customerName || null,
    customerPhone: order.customerPhone || null,
    deliveryAddressText: order.deliveryAddressText || order.customerAddress || null,
    deliveryLatitude: order.deliveryLatitude == null ? null : Number(order.deliveryLatitude),
    deliveryLongitude: order.deliveryLongitude == null ? null : Number(order.deliveryLongitude),
    distanceKm: order.distanceKm == null ? null : Number(order.distanceKm),
    subtotal: roundCurrency(order.subtotal != null ? order.subtotal : Number(order.subtotalCents || 0) / 100),
    deliveryFee: roundCurrency(order.deliveryFee != null ? order.deliveryFee : Number(order.deliveryFeeCents || 0) / 100),
    total: roundCurrency(order.total != null ? order.total : Number(order.totalCents || 0) / 100),
    paymentMethod: order.paymentMethod || null,
    paymentStatus: order.paymentStatus,
    note: order.note || order.notes || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    restaurant: order.restaurant
      ? {
          id: order.restaurant.id,
          name: order.restaurant.name,
          slug: order.restaurant.slug,
          logoUrl: order.restaurant.logoUrl || null
        }
      : null,
    items: Array.isArray(order.items) ? order.items.map(mapOrderItem) : []
  };
}

function mapUserAddress(address) {
  return {
    id: address.id,
    userId: address.userId,
    title: address.title,
    receiverName: address.receiverName,
    phone: address.phone,
    addressText: address.addressText,
    city: address.city || null,
    district: address.district || null,
    neighborhood: address.neighborhood || null,
    buildingNo: address.buildingNo || null,
    latitude: address.latitude == null ? null : Number(address.latitude),
    longitude: address.longitude == null ? null : Number(address.longitude),
    floor: address.floor || null,
    apartmentNo: address.apartmentNo || null,
    doorNo: address.doorNo || null,
    note: address.note || null,
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt
  };
}

function canTransitionOnlineOrder(currentStatus, nextStatus) {
  const current = String(currentStatus || "").trim().toUpperCase();
  const next = String(nextStatus || "").trim().toUpperCase();

  const allowed = ONLINE_ORDER_STATUS_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

module.exports = {
  ONLINE_ORDER_STATUS_TRANSITIONS,
  canTransitionOnlineOrder,
  mapCategory,
  mapOnlineOrder,
  mapOpeningHour,
  mapProduct,
  mapRestaurantBase,
  mapUserAddress,
  normalizeOptionalText,
  roundCurrency,
  toBoolean
};
