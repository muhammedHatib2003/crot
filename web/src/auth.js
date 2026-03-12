const STORAGE_KEY = "crot_session";

export function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.token || !parsed.user) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getDefaultRoute(systemRole) {
  if (systemRole === "SUPER_ADMIN") {
    return "/admin";
  }
  if (systemRole === "OWNER") {
    return "/owner";
  }
  if (systemRole === "EMPLOYEE") {
    return "/employee";
  }
  return "/login";
}
