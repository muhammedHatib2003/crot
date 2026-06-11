function normalizeCoordinate(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    return null;
  }
  return Number(numeric.toFixed(6));
}

function normalizeLatitude(value) {
  return normalizeCoordinate(value, -90, 90);
}

function normalizeLongitude(value) {
  return normalizeCoordinate(value, -180, 180);
}

async function reverseGeocodeCoordinates(latitude, longitude) {
  const lat = normalizeLatitude(latitude);
  const lng = normalizeLongitude(longitude);
  if (lat === null || lng === null) {
    throw new Error("Konum bilgisi gecersiz.");
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    "accept-language": "tr"
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      "User-Agent": "CROT-RestaurantApp/1.0 (contact@crot.app)"
    }
  });

  if (!response.ok) {
    throw new Error("Konum detayi alinamadi.");
  }

  const payload = await response.json();
  const address = payload?.address || {};

  const city = String(address.city || address.town || address.province || address.state || "").trim();
  const district = String(
    address.county || address.city_district || address.state_district || address.suburb || ""
  ).trim();
  const neighborhood = String(
    address.neighbourhood || address.quarter || address.residential || address.suburb || ""
  ).trim();
  const displayName = String(payload?.display_name || "").trim();

  return {
    city,
    district,
    neighborhood,
    addressText: displayName,
    displayName
  };
}

module.exports = {
  normalizeLatitude,
  normalizeLongitude,
  reverseGeocodeCoordinates
};
