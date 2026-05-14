import { useTranslation } from "react-i18next";
import { normalizeLanguage } from "../../utils/locale";

export default function LanguageSwitcher({ className = "" }) {
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <label
      className={`inline-flex min-w-[144px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ${className}`.trim()}
    >
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {t("common.languageSwitcher.shortLabel")}
      </span>
      <select
        aria-label={t("common.languageSwitcher.label")}
        className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        value={currentLanguage}
      >
        <option value="en">{t("common.languageSwitcher.languages.en", "English")}</option>
        <option value="tr">{t("common.languageSwitcher.languages.tr")}</option>
        <option value="ar">{t("common.languageSwitcher.languages.ar")}</option>
      </select>
    </label>
  );
}
