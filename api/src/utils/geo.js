function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isValidLatitude(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function parseLatitude(value) {
  const numeric = toNumber(value);
  return isValidLatitude(numeric) ? numeric : null;
}

function parseLongitude(value) {
  const numeric = toNumber(value);
  return isValidLongitude(numeric) ? numeric : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  if (!isValidLatitude(lat1) || !isValidLongitude(lng1) || !isValidLatitude(lat2) || !isValidLongitude(lng2)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

module.exports = {
  haversineDistanceKm,
  isValidLatitude,
  isValidLongitude,
  parseLatitude,
  parseLongitude,
  toNumber
};
