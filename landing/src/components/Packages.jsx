const PACKAGES = [
  {
    code: "starter",
    name: "Starter",
    tagline: "Yeni açılan kafe ve butik restoranlar için",
    price: "29",
    currency: "₺",
    period: "/ay",
    accent: "from-slate-100 to-white",
    badge: "from-slate-200 to-slate-100 text-ink-700",
    cta: "Bilgi Al",
    highlights: [
      "QR menü",
      "Masa yönetimi",
      "Kitchen ve Cashier panelleri",
      "5 kullanıcı / 50 ürün limiti",
      "Çok dilli arayüz"
    ]
  },
  {
    code: "growth",
    name: "Growth",
    tagline: "Aktif sipariş alan, ekibi büyüyen restoranlar için",
    price: "79",
    currency: "₺",
    period: "/ay",
    accent: "from-brand-600 to-brand-800",
    badge: "from-brand-500 to-brand-700 text-white",
    cta: "Popüler Tercih",
    highlighted: true,
    highlights: [
      "Online sipariş + teslimat",
      "Kurye modülü",
      "Depo yönetimi ve reçete takibi",
      "Detaylı raporlar",
      "20 kullanıcı / 250 ürün",
      "3 şubeye kadar"
    ]
  },
  {
    code: "premium",
    name: "Premium",
    tagline: "Çok şubeli zincirler ve yüksek hacimli operasyonlar için",
    price: "149",
    currency: "₺",
    period: "/ay",
    accent: "from-ink-900 to-ink-950",
    badge: "from-ink-800 to-ink-900 text-white",
    cta: "Bizimle Konuş",
    dark: true,
    highlights: [
      "Sınırsız ürün, kullanıcı ve masa",
      "10 şubeye kadar",
      "Özel alan adı (custom domain)",
      "Öncelikli destek",
      "Tüm modüller dahil"
    ]
  }
];

export default function Packages() {
  return (
    <section id="packages" className="relative overflow-hidden bg-ink-50 py-24 sm:py-32">
      <div className="absolute inset-0 bg-grid-light opacity-30" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
            Paketler
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            İşletmenize uygun{" "}
            <span className="text-gradient">esnek planlar</span>
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Burada gösterilen fiyatlar tanıtım amaçlıdır. Gerçek planlar Super Admin
            panelinden dinamik olarak yönetilir ve restoran sahipleri için Iyzico
            üzerinden güvenli şekilde ödenir.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <article
              key={pkg.code}
              className={`relative flex flex-col overflow-hidden rounded-3xl border bg-gradient-to-b ${
                pkg.accent
              } p-7 shadow-card transition hover:-translate-y-1 ${
                pkg.highlighted
                  ? "border-brand-500 shadow-glow"
                  : pkg.dark
                  ? "border-ink-800"
                  : "border-ink-200"
              }`}
            >
              {pkg.highlighted ? (
                <span className="absolute right-5 top-5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                  Popüler
                </span>
              ) : null}

              <div className={pkg.highlighted || pkg.dark ? "text-white" : "text-ink-900"}>
                <h3 className="text-2xl font-bold tracking-tight">{pkg.name}</h3>
                <p
                  className={`mt-1 text-sm ${
                    pkg.highlighted ? "text-brand-100" : pkg.dark ? "text-ink-300" : "text-ink-500"
                  }`}
                >
                  {pkg.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold opacity-70">{pkg.currency}</span>
                  <span className="text-5xl font-extrabold tracking-tight">{pkg.price}</span>
                  <span
                    className={`text-sm font-medium ${
                      pkg.highlighted ? "text-brand-100" : pkg.dark ? "text-ink-400" : "text-ink-500"
                    }`}
                  >
                    {pkg.period}
                  </span>
                </div>

                <ul
                  className={`mt-6 space-y-2.5 text-sm ${
                    pkg.highlighted ? "text-brand-50" : pkg.dark ? "text-ink-200" : "text-ink-700"
                  }`}
                >
                  {pkg.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                          pkg.highlighted
                            ? "bg-white/20 text-white"
                            : pkg.dark
                            ? "bg-brand-500/20 text-brand-300"
                            : "bg-brand-100 text-brand-700"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="#contact"
                className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                  pkg.highlighted
                    ? "bg-white text-brand-700 hover:bg-brand-50"
                    : pkg.dark
                    ? "bg-brand-500 text-ink-950 hover:bg-brand-400"
                    : "border border-ink-300 bg-white text-ink-900 hover:border-ink-400"
                }`}
              >
                {pkg.cta}
              </a>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-ink-500">
          ⓘ Bu sayfa yalnızca tanıtım amaçlıdır. Ödeme akışı CROT uygulamasının
          owner panelinde Iyzico ile gerçekleşir.
        </p>
      </div>
    </section>
  );
}
