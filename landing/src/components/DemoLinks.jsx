import { DEMO_LINKS } from "../data/links";

const ICONS = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  store: (
    <>
      <path d="M3 8l1.5-4h15L21 8" />
      <path d="M3 8v12h18V8" />
      <path d="M3 8h18" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
      <path d="M9 11V6a3 3 0 0 1 6 0v5" />
    </>
  ),
  fire: (
    <>
      <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-5 1 1 2 1 3-3z" />
      <path d="M9 14a3 3 0 0 0 6 0" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3v18l3-2 3 2 3-2 3 2V3H6z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </>
  )
};

function DemoIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.globe}
    </svg>
  );
}

export default function DemoLinks() {
  return (
    <section id="demos" className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div
        className="pointer-events-none absolute -left-32 top-32 h-96 w-96 rounded-full bg-brand-200/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-32 h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
            Demo
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Tüm panelleri{" "}
            <span className="text-gradient">canlı olarak inceleyin</span>
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Her bir link sizi CROT uygulamasının ilgili paneline yönlendirir.
            Sunum, müşteri görüşmesi ya da kendi denemeleriniz için kullanın.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-300"
            >
              <div
                className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${link.accent} text-white shadow-glow`}
              >
                <DemoIcon name={link.icon} />
              </div>
              <h3 className="text-lg font-semibold text-ink-900">{link.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                {link.description}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-4">
                <span className="truncate text-xs font-medium text-ink-400">
                  {link.href.replace(/^https?:\/\//, "")}
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-white transition group-hover:bg-brand-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-hover:rotate-[-12deg]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7" />
                    <path d="M9 7h8v8" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-ink-500">
          Demo URL'lerini değiştirmek için <code className="rounded bg-ink-100 px-1.5 py-0.5 text-ink-700">.env</code>
          dosyasındaki <code className="rounded bg-ink-100 px-1.5 py-0.5 text-ink-700">VITE_APP_URL</code> ve ilgili
          değişkenleri ayarlayın.
        </p>
      </div>
    </section>
  );
}
