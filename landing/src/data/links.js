function trimSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolve(varName, fallbackPath) {
  const direct = import.meta.env[varName];
  if (direct && String(direct).trim()) {
    return trimSlashes(direct);
  }
  const base = trimSlashes(import.meta.env.VITE_APP_URL || "https://app.crot.example");
  return `${base}${fallbackPath}`;
}

export const APP_URL = trimSlashes(import.meta.env.VITE_APP_URL || "https://app.crot.example");
export const OWNER_URL = resolve("VITE_OWNER_URL", "/owner");
export const ADMIN_URL = resolve("VITE_ADMIN_URL", "/admin");
export const KITCHEN_URL = resolve("VITE_KITCHEN_URL", "/kitchen");
export const CASHIER_URL = resolve("VITE_CASHIER_URL", "/cashier");
export const ONLINE_ORDER_URL = resolve("VITE_ONLINE_ORDER_URL", "/order");
export const GITHUB_URL = trimSlashes(import.meta.env.VITE_GITHUB_URL || "");
export const DOCS_URL = trimSlashes(import.meta.env.VITE_DOCS_URL || "");

export const DEMO_LINKS = [
  {
    id: "app",
    title: "Web Uygulaması",
    description: "Tüm panellerin yaşadığı CROT web uygulaması. Tek hesap, çok rol.",
    href: APP_URL,
    accent: "from-emerald-500 to-teal-500",
    icon: "globe"
  },
  {
    id: "owner",
    title: "Restoran Sahibi Paneli",
    description: "Menüler, masalar, çalışanlar, abonelik ve ödeme yönetimi tek ekranda.",
    href: OWNER_URL,
    accent: "from-sky-500 to-indigo-500",
    icon: "store"
  },
  {
    id: "admin",
    title: "Super Admin Paneli",
    description: "Tüm restoranların yönetildiği, plan ve kurye onaylarının verildiği panel.",
    href: ADMIN_URL,
    accent: "from-violet-500 to-fuchsia-500",
    icon: "shield"
  },
  {
    id: "online",
    title: "Online Sipariş Sayfası",
    description: "Müşterilerin restoran seçip teslimat / al-götür siparişi verdiği sayfa.",
    href: ONLINE_ORDER_URL,
    accent: "from-orange-500 to-rose-500",
    icon: "bag"
  },
  {
    id: "kitchen",
    title: "Mutfak Paneli",
    description: "Şefin sipariş akışını ve hazırlık sürelerini takip ettiği canlı ekran.",
    href: KITCHEN_URL,
    accent: "from-amber-500 to-orange-500",
    icon: "fire"
  },
  {
    id: "cashier",
    title: "Kasa Paneli",
    description: "Sipariş tamamlama, fiş yazdırma ve teslim akışlarının yönetildiği kasa ekranı.",
    href: CASHIER_URL,
    accent: "from-pink-500 to-rose-500",
    icon: "receipt"
  }
];
