import { useTranslation } from "react-i18next";
import { useLocaleFormatters } from "../utils/locale";

export default function useAppTranslation() {
  const { t, i18n } = useTranslation();
  const formatters = useLocaleFormatters();

  return {
    t,
    i18n,
    language: formatters.language,
    dir: formatters.dir,
    formatCurrency: formatters.formatCurrency,
    formatNumber: formatters.formatNumber,
    formatDate: formatters.formatDate,
    formatDateTime: formatters.formatDateTime,
    formatTime: formatters.formatTime
  };
}
