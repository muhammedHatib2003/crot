import LanguageSwitcher from "./LanguageSwitcher";

export default function GlobalLanguageBar({ className = "", children = null }) {
  return (
    <div className={`pointer-events-none fixed end-3 top-3 z-[90] flex items-center gap-2 ${className}`.trim()}>
      {children ? <div className="pointer-events-auto flex items-center gap-2">{children}</div> : null}
      <div className="pointer-events-auto">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
