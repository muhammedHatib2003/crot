import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enCommon from "../locales/en/common.json";
import arCommon from "../locales/ar/common.json";
import trCommon from "../locales/tr/common.json";
import { FALLBACK_LANGUAGE, getDirection, normalizeLanguage } from "./locale";

const STORAGE_KEY = "crot_language";

function getSavedLanguage() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return String(window.localStorage.getItem(STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function getBrowserLanguage() {
  if (typeof navigator === "undefined") {
    return FALLBACK_LANGUAGE;
  }

  return navigator.language || navigator.languages?.[0] || FALLBACK_LANGUAGE;
}

function applyDocumentLanguage(language) {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedLanguage = normalizeLanguage(language);
  document.documentElement.lang = normalizedLanguage;
  document.documentElement.dir = getDirection(normalizedLanguage);
}

const appDetector = {
  name: "crotAppLanguage",
  lookup() {
    const savedLanguage = getSavedLanguage();
    if (savedLanguage) {
      return normalizeLanguage(savedLanguage);
    }

    return normalizeLanguage(getBrowserLanguage());
  },
  cacheUserLanguage(language) {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, normalizeLanguage(language));
    } catch {
      // Ignore storage failures and keep the in-memory language.
    }
  }
};

const detector = new LanguageDetector();
detector.addDetector(appDetector);

i18n.use(detector).use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    tr: { common: trCommon },
    ar: { common: arCommon }
  },
  supportedLngs: ["en", "tr", "ar"],
  fallbackLng: FALLBACK_LANGUAGE,
  ns: ["common"],
  defaultNS: "common",
  load: "languageOnly",
  interpolation: {
    escapeValue: false
  },
  detection: {
    order: ["crotAppLanguage"],
    caches: ["crotAppLanguage"]
  },
  react: {
    useSuspense: false
  }
});

applyDocumentLanguage(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

export { STORAGE_KEY as LANGUAGE_STORAGE_KEY };
export default i18n;
