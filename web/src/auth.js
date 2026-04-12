const STORAGE_KEY = "crot_session";
const VALID_SYSTEM_ROLES = new Set(["SUPER_ADMIN", "OWNER", "EMPLOYEE"]);
const VALID_EMPLOYEE_ROLES = new Set(["chef", "cashier", "waiter", "inventory_manager"]);

function normalizeEmployeeRole(employeeRole) {
  return String(employeeRole || "").trim().toLowerCase();
}

function normalizeSession(session) {
  if (!session?.token || !session?.user) {
    return null;
  }

  const systemRole = String(session.user.systemRole || "").trim().toUpperCase();
  if (!VALID_SYSTEM_ROLES.has(systemRole)) {
    return null;
  }

  const normalizedEmployeeRole = normalizeEmployeeRole(session.user.employeeRole);
  if (systemRole === "EMPLOYEE" && !VALID_EMPLOYEE_ROLES.has(normalizedEmployeeRole)) {
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      systemRole,
      employeeRole: normalizedEmployeeRole || null
    }
  };
}

export function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const normalizedSession = normalizeSession(JSON.parse(raw));
    if (!normalizedSession) {
      clearSession();
      return null;
    }

    return normalizedSession;
  } catch (error) {
    clearSession();
    return null;
  }
}

export function setSession(session) {
  const normalizedSession = normalizeSession(session);
  if (!normalizedSession) {
    clearSession();
    return null;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSession));
  return normalizedSession;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getDefaultRoute(userOrSystemRole, employeeRole) {
  const systemRole =
    typeof userOrSystemRole === "object" && userOrSystemRole !== null
      ? userOrSystemRole.systemRole
      : userOrSystemRole;
  const resolvedEmployeeRole =
    typeof userOrSystemRole === "object" && userOrSystemRole !== null
      ? userOrSystemRole.employeeRole
      : employeeRole;

  if (systemRole === "SUPER_ADMIN") {
    return "/admin";
  }
  if (systemRole === "OWNER") {
    return "/owner";
  }
  if (systemRole === "EMPLOYEE") {
    const normalizedEmployeeRole = normalizeEmployeeRole(resolvedEmployeeRole);
    if (normalizedEmployeeRole === "inventory_manager") {
      return "/inventory";
    }
    if (normalizedEmployeeRole === "waiter") {
      return "/waiter";
    }
    if (normalizedEmployeeRole === "chef" || normalizedEmployeeRole === "kitchen") {
      return "/kitchen";
    }
    if (normalizedEmployeeRole === "cashier") {
      return "/cashier";
    }
    return "/login";
  }
  return "/login";
}
