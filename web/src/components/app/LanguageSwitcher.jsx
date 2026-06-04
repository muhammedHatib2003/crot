import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguage, SUPPORTED_LANGUAGES } from "../../utils/locale";

const LANGUAGE_META = {
  en: { flag: "🇬🇧", code: "EN" },
  tr: { flag: "🇹🇷", code: "TR" },
  ar: { flag: "🇸🇦", code: "AR" }
};

export default function LanguageSwitcher({ className = "" }) {
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [open, setOpen] = useState(false);
  const [animKey, setAnimKey] = useState(currentLanguage);
  const containerRef = useRef(null);

  useEffect(() => {
    setAnimKey(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(language) {
    if (language === currentLanguage) {
      setOpen(false);
      return;
    }
    i18n.changeLanguage(language);
    setOpen(false);
  }

  const meta = LANGUAGE_META[currentLanguage] || LANGUAGE_META.en;

  return (
    <div
      className={`lang-switcher relative inline-flex ${className}`.trim()}
      ref={containerRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("common.languageSwitcher.label")}
        className={`lang-switcher__trigger ui-action-sheen inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-gradient-to-r from-white via-emerald-50 to-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-[0_8px_24px_rgba(16,185,129,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_30px_rgba(16,185,129,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          open ? "lang-switcher__trigger--open" : ""
        }`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true" className="lang-switcher__icon" key={`globe-${animKey}`}>
          🌐
        </span>
        <span className="lang-switcher__flip" key={animKey}>
          <span aria-hidden="true" className="text-lg leading-none">
            {meta.flag}
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
            {meta.code}
          </span>
        </span>
        <span aria-hidden="true" className="lang-switcher__chevron text-slate-500">
          <svg fill="none" height="14" viewBox="0 0 20 20" width="14">
            <path
              d="M5 8l5 5 5-5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <ul
          aria-label={t("common.languageSwitcher.label")}
          className="lang-switcher__menu absolute right-0 top-[calc(100%+8px)] z-50 flex min-w-[180px] flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur"
          role="listbox"
        >
          {SUPPORTED_LANGUAGES.map((language, index) => {
            const itemMeta = LANGUAGE_META[language] || LANGUAGE_META.en;
            const isActive = language === currentLanguage;

            return (
              <li
                className="lang-switcher__menu-item-wrapper"
                key={language}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <button
                  aria-selected={isActive}
                  className={`lang-switcher__menu-item group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-100 via-emerald-50 to-white text-emerald-900"
                      : "text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-900"
                  }`}
                  onClick={() => handleSelect(language)}
                  role="option"
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg leading-none">
                      {itemMeta.flag}
                    </span>
                    <span>{t(`common.languageSwitcher.languages.${language}`)}</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                      isActive ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {itemMeta.code}
                  </span>
                  {isActive ? (
                    <span aria-hidden="true" className="lang-switcher__active-dot" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
