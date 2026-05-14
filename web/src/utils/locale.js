import { useTranslation } from "react-i18next";

export const FALLBACK_LANGUAGE = "tr";
export const SUPPORTED_LANGUAGES = ["en", "tr", "ar"];

const CATEGORY_KEY_MAP = {
  general: "common.categories.general",
  starter: "common.categories.starter",
  main: "common.categories.main",
  dessert: "common.categories.dessert",
  drink: "common.categories.drink"
};

const ORDER_STATUS_KEY_MAP = {
  PENDING: "common.orderStatus.pending",
  PREPARING: "common.orderStatus.preparing",
  READY: "common.orderStatus.ready",
  PAID: "common.orderStatus.paid",
  CANCELLED: "common.orderStatus.cancelled",
  FULFILLED: "common.orderStatus.fulfilled",
  REJECTED: "common.orderStatus.rejected"
};

const TABLE_STATUS_KEY_MAP = {
  AVAILABLE: "common.tableStatus.available",
  OCCUPIED: "common.tableStatus.occupied",
  RESERVED: "common.tableStatus.reserved",
  CLEANING: "common.tableStatus.cleaning"
};

const EMPLOYEE_ROLE_KEY_MAP = {
  chef: "common.employeeRole.chef",
  cashier: "common.employeeRole.cashier",
  waiter: "common.employeeRole.waiter",
  inventory_manager: "common.employeeRole.inventory_manager"
};

const SYSTEM_ROLE_KEY_MAP = {
  SUPER_ADMIN: "common.systemRole.super_admin",
  OWNER: "common.systemRole.owner",
  EMPLOYEE: "common.systemRole.employee"
};

const UNIT_KEY_MAP = {
  pcs: "common.units.pcs",
  kg: "common.units.kg",
  g: "common.units.g",
  l: "common.units.l",
  ml: "common.units.ml"
};

const PAYMENT_METHOD_KEY_MAP = {
  CARD: "common.paymentMethod.card",
  CASH: "common.paymentMethod.cash"
};

export function normalizeLanguage(value) {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  return SUPPORTED_LANGUAGES.includes(normalizedValue) ? normalizedValue : FALLBACK_LANGUAGE;
}

export function getLocale(value) {
  const normalized = normalizeLanguage(value);
  if (normalized === "ar") {
    return "ar";
  }
  if (normalized === "en") {
    return "en-US";
  }
  return "tr-TR";
}

export function getDirection(value) {
  return normalizeLanguage(value) === "ar" ? "rtl" : "ltr";
}

export function createLocaleFormatters(language) {
  const locale = getLocale(language);

  return {
    locale,
    formatCurrency(value, currency = "USD") {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(value || 0));
    },
    formatNumber(value, options = {}) {
      return new Intl.NumberFormat(locale, options).format(Number(value || 0));
    },
    formatDate(value, options = {}) {
      if (!value) {
        return "-";
      }

      return new Intl.DateTimeFormat(locale, options).format(new Date(value));
    },
    formatDateTime(value, options = {}) {
      if (!value) {
        return "-";
      }

      return new Intl.DateTimeFormat(locale, options).format(new Date(value));
    },
    formatTime(value, options = {}) {
      if (!value) {
        return "-";
      }

      return new Intl.DateTimeFormat(locale, options).format(new Date(value));
    }
  };
}

function translateMappedValue(t, value, keyMap) {
  const normalizedValue = String(value || "").trim();
  const lowerCasedValue = normalizedValue.toLowerCase();
  const translationKey = keyMap[normalizedValue] || keyMap[lowerCasedValue];
  return translationKey ? t(translationKey) : normalizedValue || t("common.notAvailable");
}

export function translateCategory(t, category) {
  return translateMappedValue(t, category, CATEGORY_KEY_MAP);
}

export function translateOrderStatus(t, status) {
  return translateMappedValue(t, status, ORDER_STATUS_KEY_MAP);
}

export function translateTableStatus(t, status) {
  return translateMappedValue(t, status, TABLE_STATUS_KEY_MAP);
}

export function translateEmployeeRole(t, role) {
  return translateMappedValue(t, role, EMPLOYEE_ROLE_KEY_MAP);
}

export function translateSystemRole(t, role) {
  return translateMappedValue(t, role, SYSTEM_ROLE_KEY_MAP);
}

export function translateUnit(t, unit) {
  return translateMappedValue(t, unit, UNIT_KEY_MAP);
}

export function translatePaymentMethod(t, method) {
  return translateMappedValue(t, method, PAYMENT_METHOD_KEY_MAP);
}

export function useLocaleFormatters() {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  return {
    language,
    dir: getDirection(language),
    ...createLocaleFormatters(language)
  };
}
