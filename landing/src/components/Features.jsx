const ICON_PATHS = {
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v3" />
      <path d="M17 20h4" />
      <path d="M14 20h0" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
      <path d="M9 11V6a3 3 0 0 1 6 0v5" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="5" width="18" height="4" rx="1.5" />
      <path d="M5 9v9" />
      <path d="M19 9v9" />
      <path d="M9 14h6" />
      <path d="M12 14v4" />
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
  ),
  bike: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17h6l4-8h3" />
      <path d="M14 5h3l1 4" />
    </>
  ),
  warehouse: (
    <>
      <path d="M3 10l9-5 9 5v10H3V10z" />
      <path d="M7 20v-7h10v7" />
      <path d="M9 14h6" />
      <path d="M9 17h6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V8" />
      <path d="M10 20V4" />
      <path d="M16 20v-9" />
      <path d="M22 20H2" />
    </>
  )
};

function FeatureIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name] || ICON_PATHS.qr}
    </svg>
  );
}

const FEATURES = [
  {
    icon: "qr",
    accent: "from-emerald-500/20 to-teal-500/20",
    text: "from-emerald-700 to-teal-700",
    title: "QR Menü",
    description:
      "Müşteriler masadaki QR'ı okutur, menüyü görür, sipariş verir. Print menü dönemini bitirin."
  },
  {
    icon: "bag",
    accent: "from-orange-500/20 to-rose-500/20",
    text: "from-orange-700 to-rose-700",
    title: "Online Sipariş",
    description:
      "Teslimat ve al-götür siparişlerini tek bir online sipariş sayfasından alın, ödeme ile birleşik akış."
  },
  {
    icon: "table",
    accent: "from-sky-500/20 to-indigo-500/20",
    text: "from-sky-700 to-indigo-700",
    title: "Masa Yönetimi",
    description:
      "Salon haritası, masa durumları, hesap birleştirme ve garson atamaları — hepsi gerçek zamanlı."
  },
  {
    icon: "fire",
    accent: "from-amber-500/20 to-orange-500/20",
    text: "from-amber-700 to-orange-700",
    title: "Kitchen Panel",
    description:
      "Mutfak ekranında bekleyen, hazırlanan ve hazır siparişler kolon kolon akar. Tek tıkla yazıcıya gider."
  },
  {
    icon: "receipt",
    accent: "from-pink-500/20 to-rose-500/20",
    text: "from-pink-700 to-rose-700",
    title: "Cashier Panel",
    description:
      "Kasa, müşteri fişi ve mutfak fişi yazdırma, ödeme yöntemleri ve kurye teslim akışı tek ekranda."
  },
  {
    icon: "bike",
    accent: "from-cyan-500/20 to-sky-500/20",
    text: "from-cyan-700 to-sky-700",
    title: "Kurye Modülü",
    description:
      "Kurye onayı, sipariş atama ve teslim durumu — kurye uygulamasına gerek yok, panel üzerinden çalışır."
  },
  {
    icon: "warehouse",
    accent: "from-lime-500/20 to-emerald-500/20",
    text: "from-lime-700 to-emerald-700",
    title: "Depo Yönetimi",
    description:
      "Hammadde stoğu, reçete bazlı tüketim takibi, manuel giriş/çıkış kaydı ve alarm seviyeleri."
  },
  {
    icon: "globe",
    accent: "from-violet-500/20 to-purple-500/20",
    text: "from-violet-700 to-purple-700",
    title: "Çok Dilli Destek",
    description:
      "Tüm panel ve müşteri ekranları Türkçe, İngilizce ve Arapça desteği ile birlikte gelir."
  },
  {
    icon: "chart",
    accent: "from-slate-500/20 to-zinc-500/20",
    text: "from-slate-700 to-zinc-700",
    title: "Raporlar",
    description:
      "Satış, ürün, masa ve zaman bazlı raporlarla operasyonel ve finansal kararları veriye dayandırın."
  }
];

export default function Features() {
  return (
    <section id="features" className="relative bg-white py-24 sm:py-32">
      <div className="absolute inset-0 bg-grid-light mask-fade-bottom opacity-40" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
            Özellikler
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Bir restoranın ihtiyaç duyduğu her şey,{" "}
            <span className="text-gradient">tek platformda</span>
          </h2>
          <p className="mt-4 text-base text-ink-600">
            CROT, küçük bir kafeden çok şubeli işletmeye kadar her ölçeğe uyacak
            şekilde modüler tasarlandı.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-glow"
              style={{ animationDelay: `${0.05 * index}s` }}
            >
              <div
                className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-ink-900 transition group-hover:scale-110`}
              >
                <span className={`bg-gradient-to-br ${feature.text} bg-clip-text text-transparent`}>
                  <FeatureIcon name={feature.icon} />
                </span>
              </div>
              <h3 className="text-lg font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
