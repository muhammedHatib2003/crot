const prisma = require("../../db");
const { haversineDistanceKm, parseLatitude, parseLongitude } = require("../../utils/geo");
const { mapOrder } = require("../../utils/orders");

const DEFAULT_RADIUS_KM = 18;
const LOCATION_MAX_AGE_MS = 10 * 60 * 1000;

const orderInclude = {
  items: true,
  table: true,
  payment: true,
  restaurant: true
};

class CourierDispatchError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CourierDispatchError";
    this.status = status;
  }
}

function offerRadiusKm(restaurant) {
  const r = Number(restaurant?.deliveryRadiusKm);
  if (Number.isFinite(r) && r > 0) {
    return Math.min(55, Math.max(DEFAULT_RADIUS_KM, r + 6));
  }
  return DEFAULT_RADIUS_KM;
}

function isLocationFresh(updatedAt) {
  if (!updatedAt) {
    return false;
  }
  return Date.now() - new Date(updatedAt).getTime() <= LOCATION_MAX_AGE_MS;
}

async function updateCourierLocation(courierAccountId, lat, lng) {
  const latitude = parseLatitude(lat);
  const longitude = parseLongitude(lng);
  if (latitude === null || longitude === null) {
    throw new CourierDispatchError("latitude and longitude must be valid numbers.", 400);
  }

  await prisma.courierAccount.update({
    where: { id: courierAccountId },
    data: {
      courierLatitude: latitude,
      courierLongitude: longitude,
      courierLocationUpdatedAt: new Date()
    }
  });

  return { latitude, longitude, updatedAt: new Date().toISOString() };
}

async function listNearbyOffers({ courierAccountId }) {
  const courier = await prisma.courierAccount.findFirst({
    where: { id: courierAccountId },
    select: {
      courierLatitude: true,
      courierLongitude: true,
      courierLocationUpdatedAt: true
    }
  });

  if (!courier) {
    throw new CourierDispatchError("Courier not found.", 404);
  }

  const lat = parseLatitude(courier.courierLatitude);
  const lng = parseLongitude(courier.courierLongitude);
  const fresh = isLocationFresh(courier.courierLocationUpdatedAt);

  const orders = await prisma.order.findMany({
    where: {
      orderType: "DELIVERY",
      status: "READY",
      assignedCourierAccountId: null,
      source: "ONLINE"
    },
    include: orderInclude,
    orderBy: [{ readyAt: "asc" }, { createdAt: "asc" }]
  });

  if (!fresh || lat === null || lng === null) {
    return {
      offers: [],
      locationRequired: true,
      locationMaxAgeMinutes: LOCATION_MAX_AGE_MS / 60000
    };
  }

  const offers = [];
  for (const order of orders) {
    const rest = order.restaurant;
    const rLat = parseLatitude(rest?.latitude);
    const rLng = parseLongitude(rest?.longitude);
    let distanceKm = null;
    let inRadius = true;

    if (rLat !== null && rLng !== null) {
      distanceKm = haversineDistanceKm(lat, lng, rLat, rLng);
      const radius = offerRadiusKm(rest);
      inRadius = distanceKm !== null && distanceKm <= radius;
    }

    if (inRadius) {
      const mapped = mapOrder(order);
      offers.push({
        ...mapped,
        offerDistanceKm: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null
      });
    }
  }

  return {
    offers,
    locationRequired: false,
    locationMaxAgeMinutes: LOCATION_MAX_AGE_MS / 60000
  };
}

async function acceptOrder({ orderId, courierAccountId }) {
  const courier = await prisma.courierAccount.findUnique({
    where: { id: courierAccountId },
    select: {
      courierLatitude: true,
      courierLongitude: true,
      courierLocationUpdatedAt: true
    }
  });

  if (!courier) {
    throw new CourierDispatchError("Courier not found.", 404);
  }

  const cLat = parseLatitude(courier.courierLatitude);
  const cLng = parseLongitude(courier.courierLongitude);
  if (!isLocationFresh(courier.courierLocationUpdatedAt) || cLat === null || cLng === null) {
    throw new CourierDispatchError(
      "Share a recent location before accepting. Enable GPS or location permission.",
      403
    );
  }

  const orderPreview = await prisma.order.findFirst({
    where: {
      id: orderId,
      orderType: "DELIVERY",
      status: "READY",
      assignedCourierAccountId: null,
      source: "ONLINE"
    },
    include: { restaurant: true }
  });

  if (!orderPreview) {
    throw new CourierDispatchError("This delivery was already taken or is not available.", 409);
  }

  const rest = orderPreview.restaurant;
  const rLat = parseLatitude(rest?.latitude);
  const rLng = parseLongitude(rest?.longitude);
  if (rLat !== null && rLng !== null) {
    const distanceKm = haversineDistanceKm(cLat, cLng, rLat, rLng);
    const radius = offerRadiusKm(rest);
    if (distanceKm === null || distanceKm > radius) {
      throw new CourierDispatchError("You are too far from this restaurant to accept this order.", 403);
    }
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: {
        id: orderId,
        orderType: "DELIVERY",
        status: "READY",
        assignedCourierAccountId: null,
        source: "ONLINE"
      },
      data: {
        assignedCourierAccountId: courierAccountId,
        courierAcceptedAt: now
      }
    });

    if (updated.count !== 1) {
      return { ok: false };
    }

    const order = await tx.order.findFirst({
      where: { id: orderId },
      include: orderInclude
    });

    return { ok: true, order };
  });

  if (!result.ok) {
    throw new CourierDispatchError("This delivery was already taken or is not available.", 409);
  }

  return mapOrder(result.order);
}

module.exports = {
  acceptOrder,
  CourierDispatchError,
  DEFAULT_RADIUS_KM,
  listNearbyOffers,
  orderInclude,
  updateCourierLocation
};
