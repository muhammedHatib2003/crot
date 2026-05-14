const ONLINE_CUSTOMER_SESSION_KEY = "crot_online_customer_session";

function normalizeCustomerSession(session) {
  if (!session?.token || !session?.customer) {
    return null;
  }

  if (!session.customer.id || !session.customer.email) {
    return null;
  }

  return {
    token: String(session.token),
    customer: {
      id: String(session.customer.id),
      fullName: String(session.customer.fullName || ""),
      email: String(session.customer.email || ""),
      phone: session.customer.phone ? String(session.customer.phone) : null
    }
  };
}

export function getOnlineCustomerSession() {
  const rawValue = localStorage.getItem(ONLINE_CUSTOMER_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const normalizedSession = normalizeCustomerSession(JSON.parse(rawValue));
    if (!normalizedSession) {
      localStorage.removeItem(ONLINE_CUSTOMER_SESSION_KEY);
      return null;
    }

    return normalizedSession;
  } catch (error) {
    localStorage.removeItem(ONLINE_CUSTOMER_SESSION_KEY);
    return null;
  }
}

export function setOnlineCustomerSession(session) {
  const normalizedSession = normalizeCustomerSession(session);
  if (!normalizedSession) {
    clearOnlineCustomerSession();
    return null;
  }

  localStorage.setItem(ONLINE_CUSTOMER_SESSION_KEY, JSON.stringify(normalizedSession));
  return normalizedSession;
}

export function clearOnlineCustomerSession() {
  localStorage.removeItem(ONLINE_CUSTOMER_SESSION_KEY);
}
