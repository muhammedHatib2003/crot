const STATS = [
  { value: "11+", label: "Entegre modül" },
  { value: "3", label: "Abonelik paketi" },
  { value: "TR · EN · AR", label: "Dil desteği" },
  { value: "100%", label: "Açık kaynak temelli" }
];

export default function About() {
  return (
    <section id="about" className="relative overflow-hidden bg-gradient-to-b from-white to-ink-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
              Hakkında
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              Restoran ve kafe işletmelerinin{" "}
              <span className="text-gradient">tek platformdan</span> yönetilmesi için
              tasarlandı.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-600">
              CROT, küçük bir kafenin tek başına kullanabileceği kadar sade, çok şubeli
              bir zincirin işine yarayacak kadar güçlü bir restoran yönetim platformudur.
              Sipariş alma, mutfak akışı, kasa, online sipariş ve kurye süreçleri tek
              uygulamada birleşir; restoran sahibi her şeyi tek panelden yönetir.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-600">
              Sistem modüler bir SaaS olarak çalışır: backend Render üzerinde, ön yüz
              Vercel'de host edilir, masaüstü için ayrı bir Electron uygulaması bulunur.
              Ödeme ihtiyaçları için Iyzico entegrasyonu hazırdır. Super Admin paneli
              sayesinde abonelik planları dinamik olarak yönetilebilir.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                "Tek tenant, çok rol",
                "QR menü tabanlı sipariş",
                "Print-friendly fiş çıktıları",
                "Iyzico entegrasyonu",
                "Render + Vercel deploy"
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-brand-200/40 via-cyan-200/30 to-transparent blur-2xl" aria-hidden="true" />
            <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-card sm:p-8">
              <div className="grid grid-cols-2 gap-5">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-ink-100 bg-ink-50/50 p-5"
                  >
                    <p className="text-3xl font-extrabold tracking-tight text-ink-900">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-ink-100 pt-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-sm text-ink-700">
                    <strong className="font-semibold">Tek codebase</strong> — web, masaüstü ve mobil dostu
                    arayüz aynı kaynaktan beslenir.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-sm text-ink-700">
                    <strong className="font-semibold">Hızlı kurulum</strong> — yeni bir restoran
                    eklemek dakikalar alır, her şey hazır gelir.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-sm text-ink-700">
                    <strong className="font-semibold">Güvenli ödeme</strong> — Iyzico ile entegre
                    abonelik akışı, owner paneline gömülü.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
