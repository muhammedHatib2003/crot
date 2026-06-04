function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/$/, "");
}

function isLocalOrigin(value) {
  return /localhost|127\.0\.0\.1/i.test(String(value || ""));
}

let runtimePublicOrigin = "";

export function setPublicAppOrigin(origin) {
  runtimePublicOrigin = normalizeOrigin(origin);
}

export function getPublicAppOrigin() {
  const fromRuntime = normalizeOrigin(runtimePublicOrigin);
  if (fromRuntime && !isLocalOrigin(fromRuntime)) {
    return fromRuntime;
  }

  const fromVite = normalizeOrigin(import.meta.env.VITE_PUBLIC_APP_URL);
  if (fromVite && !isLocalOrigin(fromVite)) {
    return fromVite;
  }

  if (typeof window !== "undefined") {
    const fromWindow = normalizeOrigin(window.location.origin);
    if (fromWindow && !isLocalOrigin(fromWindow)) {
      return fromWindow;
    }
  }

  return "";
}

export function getTableOrderLink(tableId) {
  const origin = getPublicAppOrigin();
  const path = `/t/${tableId}`;

  if (!origin) {
    return path;
  }

  return `${origin}${path}`;
}

export function isLocalOnlyOrderOrigin() {
  return !getPublicAppOrigin();
}

export function getPublicPath(path) {
  const origin = getPublicAppOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!origin) {
    return normalizedPath;
  }

  return `${origin}${normalizedPath}`;
}
