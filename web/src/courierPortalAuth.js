const STORAGE_KEY = "crot_courier_session";

function normalizeSession(session) {
  if (!session?.token || !session?.courier) {
    return null;
  }

  return {
    token: session.token,
    courier: {
      ...session.courier,
      email: String(session.courier.email || "").trim().toLowerCase()
    }
  };
}

export function getCourierSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const normalized = normalizeSession(JSON.parse(raw));
    if (!normalized) {
      clearCourierSession();
      return null;
    }
    return normalized;
  } catch {
    clearCourierSession();
    return null;
  }
}

export function setCourierSession(session) {
  const normalized = normalizeSession(session);
  if (!normalized) {
    clearCourierSession();
    return null;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCourierSession() {
  localStorage.removeItem(STORAGE_KEY);
}
