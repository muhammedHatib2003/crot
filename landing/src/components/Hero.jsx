import { APP_URL } from "../data/links";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-ink-950 pt-32 pb-24 text-white sm:pt-40 sm:pb-32"
    >
      <div className="absolute inset-0 bg-grid mask-fade-bottom opacity-50" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl animate-blob-spin"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-0 -z-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl animate-blob-spin"
        style={{ animationDelay: "3s" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
        <div
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200 backdrop-blur animate-fade-up"
          style={{ animationDelay: "0.05s" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
          </span>
          v1.0 · Restoranlar için yeni nesil POS &amp; SaaS
        </div>

        <h1
          className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="text-gradient">CROT</span>: Restoranlar için
          <br className="hidden sm:block" /> modern yönetim sistemi
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-balance text-base text-ink-300 sm:text-lg animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          QR menüden mutfak ve kasa panellerine, online siparişten kurye takibine
          kadar bir restoranın ihtiyaç duyduğu her şey tek bir platformda.
          Hızlı kur, anında çalışmaya başla.
        </p>

        <div
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <a
            href="#demos"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 shadow-glow transition hover:bg-brand-400"
          >
            Demoyu Gör
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </a>
          <a
            href={APP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            Panele Git
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7" />
              <path d="M9 7h8v8" />
            </svg>
          </a>
        </div>

        <div
          className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur sm:grid-cols-4 animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          {[
            { value: "11+", label: "Modül" },
            { value: "<60sn", label: "Sipariş→Mutfak" },
            { value: "3", label: "Abonelik Paketi" },
            { value: "TR · EN · AR", label: "Diller" }
          ].map((stat) => (
            <div key={stat.label} className="bg-ink-950/30 px-4 py-5">
              <p className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
