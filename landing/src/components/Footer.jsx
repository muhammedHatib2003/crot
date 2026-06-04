import { APP_URL, DOCS_URL, GITHUB_URL } from "../data/links";

const COLS = [
  {
    title: "Ürün",
    items: [
      { label: "Özellikler", href: "#features" },
      { label: "Paketler", href: "#packages" },
      { label: "Demo", href: "#demos" }
    ]
  },
  {
    title: "Şirket",
    items: [
      { label: "Hakkında", href: "#about" },
      { label: "İletişim", href: "#contact" }
    ]
  }
];

export default function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-2">
            <a href="#top" className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7l9-4 9 4-9 4-9-4z" />
                  <path d="M3 12l9 4 9-4" />
                  <path d="M3 17l9 4 9-4" />
                </svg>
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-bold tracking-tight text-ink-900">CROT</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
                  Restaurant OS
                </span>
              </div>
            </a>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-600">
              Restoranlar ve kafeler için modern, çok modüllü yönetim platformu.
              QR menüden online siparişe, mutfak panelinden kasaya kadar her şey
              tek bir SaaS çatısı altında.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-ink-700 transition hover:text-brand-700"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ink-100 pt-6 sm:flex-row">
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} CROT. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-2">
            <a
              href={APP_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300 hover:text-ink-900"
            >
              Uygulamaya Git
            </a>
            {DOCS_URL ? (
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300 hover:text-ink-900"
              >
                Dokümanlar
              </a>
            ) : null}
            {GITHUB_URL ? (
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-700 transition hover:border-ink-300 hover:text-ink-900"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.14 1.18a10.93 10.93 0 0 1 5.72 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.73.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                </svg>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
