const ONLINE_LOCATION_KEY = "crot_online_order_location";

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCoordinate(value, min, max) {
  const numeric = toNumber(value);
  if (numeric === null || numeric < min || numeric > max) {
    return null;
  }

  return Number(numeric.toFixed(6));
}

export function normalizeLatitude(value) {
  return normalizeCoordinate(value, -90, 90);
}

export function normalizeLongitude(value) {
  return normalizeCoordinate(value, -180, 180);
}

export function hasValidCoordinates(latitude, longitude) {
  return normalizeLatitude(latitude) !== null && normalizeLongitude(longitude) !== null;
}

function mapGeolocationError(error) {
  const code = Number(error?.code);
  if (code === 1) {
    return "Konum izni reddedildi. Tarayici ayarlarindan bu site icin konum izni verin.";
  }
  if (code === 2) {
    return "Konum bilgisi su an alinamiyor. Lutfen GPS/acik alan baglantisini kontrol edin.";
  }
  if (code === 3) {
    return "Konum alma suresi doldu. Tekrar deneyin.";
  }
  return "Konum alinamadi.";
}

export async function getCurrentBrowserLocation(options = {}) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Konum ozelligi icin guvenli baglanti gerekli (HTTPS veya localhost).");
  }

  if (!navigator?.geolocation) {
    throw new Error("Tarayici konum ozelligini desteklemiyor.");
  }

  return new Promise((resolve, reject) => {
    const successHandler = (position) => {
      const lat = normalizeLatitude(position?.coords?.latitude);
      const lng = normalizeLongitude(position?.coords?.longitude);
      if (lat === null || lng === null) {
        reject(new Error("Konum bilgisi gecersiz."));
        return;
      }
      resolve({ lat, lng });
    };

    const fallbackOptions = {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 120000,
      ...options
    };

    const primaryOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
      ...options
    };

    navigator.geolocation.getCurrentPosition(
      successHandler,
      (error) => {
        if (Number(error?.code) === 3) {
          navigator.geolocation.getCurrentPosition(
            successHandler,
            (fallbackError) => reject(new Error(mapGeolocationError(fallbackError))),
            fallbackOptions
          );
          return;
        }
        reject(new Error(mapGeolocationError(error)));
      },
      primaryOptions
    );
  });
}

export async function reverseGeocodeCoordinates(latitude, longitude) {
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
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Konum detayi alinamadi.");
  }

  const payload = await response.json();
  const address = payload?.address || {};
  return {
    city: String(address.city || address.town || address.province || address.state || "").trim(),
    district: String(address.county || address.state_district || address.suburb || "").trim(),
    displayName: String(payload?.display_name || "").trim()
  };
}

function normalize(value) {
  const lat = normalizeLatitude(value?.lat);
  const lng = normalizeLongitude(value?.lng);

  return {
    lat,
    lng,
    city: String(value?.city || "").trim(),
    district: String(value?.district || "").trim()
  };
}

export function readOnlineLocationContext() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ONLINE_LOCATION_KEY) || "null");
    return normalize(parsed || {});
  } catch (error) {
    return normalize({});
  }
}

export function writeOnlineLocationContext(value) {
  const normalized = normalize(value || {});
  localStorage.setItem(ONLINE_LOCATION_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event("online-order-location-updated"));
  return normalized;
}
