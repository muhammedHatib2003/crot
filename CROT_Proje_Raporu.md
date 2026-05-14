# CROT — Restoran ve Kafe Yönetimi için Çok Kiracılı SaaS Platformu

**Proje Analiz ve Teknik Değerlendirme Raporu**

---

**Hazırlayan:** Proje Geliştirme Ekibi
**Belge Türü:** Teknik / Akademik Proje Raporu
**Sürüm:** 1.0
**Yıl:** 2026
**Repo:** CROT (monorepo: `api/` + `web/`)
**Teknoloji Yığını:** React • Tailwind CSS • Vite • Node.js • Express • Prisma • PostgreSQL • Docker • Iyzico • Leaflet

---

\newpage

## Özet

CROT, restoran ve kafelerin operasyonel süreçlerini tek bir dijital platform üzerinden yönetebilmelerini sağlamak amacıyla geliştirilmiş çok kiracılı (multi-tenant) bir Yazılım-Hizmet (SaaS) çözümüdür. Platform; süper yönetici, restoran sahibi (owner), mutfak personeli (chef), garson (waiter), kasiyer (cashier), stok yöneticisi (inventory manager), kurye (courier) ve son müşteri (customer) olmak üzere sekiz farklı kullanıcı rolünü tek bir veri modeli üzerinde yönetir. Sistem; QR menü tabanlı masa siparişi, gel-al (pickup) siparişi, konum tabanlı çevrimiçi paket sipariş (delivery), otomatik mutfak emir akışı, reçete bazlı stok düşümü, satın alma siparişleri, düşük stok uyarıları, plan tabanlı abonelik yönetimi, Iyzico ile çevrimiçi kart ödemesi, kurye eşleştirme ve canlı konum izleme gibi özellikleri kapsar. Mimari, RESTful API'lere dayalı, durumsuz JWT kimlik doğrulamasıyla güçlendirilmiş, Prisma ORM aracılığıyla PostgreSQL üzerine inşa edilmiş, Docker konteynerleri ile dağıtıma hazır biçimde tasarlanmıştır. İstemci tarafında React 18 ve Vite 6 ekosistemi ile geliştirilen tek sayfa uygulaması, Tailwind CSS ile şekillendirilmiş, `react-leaflet` ile harita entegrasyonu sağlanmış ve `i18next` üzerinden Türkçe, İngilizce ve Arapça (RTL) çoklu dil desteğine kavuşturulmuştur. Bu rapor, projenin kod tabanı doğrudan incelenerek hazırlanmış olup; mimari kararları, veri modelini, API uçlarını, güvenlik mekanizmalarını, gerçek hayat kullanım senaryolarını ve sistemin ölçeklenebilirlik potansiyelini akademik bir bakış açısıyla değerlendirir.

---

## İçindekiler

1. Kapak
2. Özet
3. İçindekiler
4. Giriş
5. Projenin Amacı
6. Kullanılan Teknolojiler
7. Sistem Mimarisi
8. Backend Yapısı
9. Frontend Yapısı
10. Veritabanı Tasarımı
11. API Yapısı
12. Authentication ve Güvenlik
13. Kullanıcı Rolleri
14. Sistemin Çalışma Akışı
15. Projenin Özellikleri
16. Gerçek Hayat Senaryoları
17. Karşılaşılan Problemler ve Çözümler
18. Gelecekte Yapılabilecek Geliştirmeler
19. Sonuç
20. Kaynakça

\newpage

## 4. Giriş

Yiyecek-içecek sektörü, dijital dönüşüm ile birlikte hem işletme içi süreçlerin (mutfak, servis, kasa, stok) hem de müşteri ile temas eden süreçlerin (menü, sipariş, ödeme, teslimat) tek bir yazılım katmanından yürütülmesini zorunlu kılan bir alan haline gelmiştir. Türkiye ve dünya pazarlarında küçük ve orta ölçekli restoranlar; bağımsız POS yazılımları, ayrı çevrimiçi sipariş platformları, ayrı stok takibi araçları ve farklı ödeme entegrasyonları kullanmak zorunda kalmakta, bu da hem operasyonel maliyetleri hem de hata oranlarını artırmaktadır. CROT projesi, tam olarak bu parçalı yapıyı ortadan kaldırmayı hedefleyen, bütünleşik bir restoran işletme platformudur.

CROT; tek bir kod tabanı içinde, çok sayıda restoranın bağımsız "kiracı" (tenant) olarak hizmet alabildiği SaaS modelinde tasarlanmıştır. Her restoran kendi menüsünü, masalarını, çalışanlarını, stoklarını, açılış saatlerini, teslimat alanını ve aboneliğini bağımsız olarak yönetir. Aynı zamanda son müşteriler tek bir uygulama üzerinden, konuma duyarlı biçimde tüm restoranlara erişebilir, sipariş verebilir ve çevrimiçi ödeme yapabilir. Süper yönetici ise platformun bütününe ait kullanıcıları, abonelik planlarını ve kurye başvurularını denetler. Bu rapor; projenin tüm kod dizininin doğrudan incelenmesiyle hazırlanmış olup, mimariden veri modeline, kimlik doğrulamadan kullanıcı akışlarına kadar tüm önemli teknik kararları belgelemeyi amaçlar.

## 5. Projenin Amacı

CROT projesinin ana amacı, restoran ve kafe operasyonlarını dijital olarak uçtan uca yönetebilen, hem dahili (back-office) hem harici (müşteri tarafı) ihtiyaçları karşılayan, bulut-yerel ve çok kiracılı bir SaaS ürünü ortaya koymaktır. Daha somut alt hedefler aşağıda özetlenmiştir:

- **Operasyonel birleşim:** Mutfak, servis, kasa ve stok modüllerinin tek bir veri modeli (sipariş, masa, menü, stok hareketi) etrafında birlikte çalışmasını sağlamak; örneğin bir siparişin "PREPARING" durumuna alınmasıyla reçete bileşenlerinin stoktan otomatik olarak düşürülmesini garanti altına almak.
- **Çok kanallı sipariş:** Aynı sipariş çekirdeği üzerinden masa-içi (DINE_IN), gel-al (PICKUP) ve kapıya teslim (DELIVERY) siparişlerini yönetebilmek.
- **Çok kiracılı yapı:** Her restoranın kendi alt alanı (slug), kendi çalışanları, kendi stokları ve kendi planı ile bağımsız bir kiracı olarak çalışmasını sağlamak; verilerin restoran sınırları içinde izole kalması.
- **Konum tabanlı pazar yeri:** Müşterilerin tarayıcı konumu veya manuel adres seçimi ile yakındaki restoranları görebileceği, Haversine mesafesine göre sıralanan ve teslimat yarıçapına göre filtrelenen bir çevrimiçi sipariş deneyimi sunmak.
- **Kurye yaşam döngüsü:** Kuryelerin belge ile başvurabileceği, süper yönetici tarafından onaylanabileceği, canlı konum paylaşabileceği ve yakındaki teslimat tekliflerini görebileceği bağımsız bir portal sağlamak.
- **Ödeme modülerliği:** Hem nakit/kart bazlı kasa ödemesi hem de Iyzico üzerinden çevrimiçi kart ödemesini destekleyen, ödeme servis sağlayıcısının kolayca değiştirilebileceği bir soyutlama oluşturmak.
- **Erişilebilir ve uluslararasılaşabilir UI:** Türkçe, İngilizce ve Arapça dil desteği ve RTL yönelimi ile farklı pazarlara açık bir arayüz tasarımı sunmak.
- **MVP olgunluğu:** Üretim öncesi gereksinimleri (HTTPS, denetim günlüğü, yenileme jetonları) projenin ileri sürümlerine bırakacak şekilde fakat Docker ile tek komutla ayağa kalkabilen, gerçekçi tohum (seed) verisi içeren bir minimum yaşayabilir ürün (MVP) çıkarmak.

## 6. Kullanılan Teknolojiler

CROT projesi, modern bir tam yığın (full-stack) JavaScript ekosisteminin gerektirdiği tüm temel bileşenleri tek bir monoreposu içinde barındırmaktadır. Aşağıda, `api/package.json`, `web/package.json`, `docker-compose.yml` ve `prisma/schema.prisma` dosyalarından doğrudan tespit edilen teknolojiler kategorilere ayrılarak açıklanmaktadır.

### 6.1. Sunucu Tarafı (Backend) Teknolojileri

- **Node.js** çalışma zamanı: Tüm sunucu uygulaması Node.js üzerinde, CommonJS modül sistemiyle yazılmıştır.
- **Express 4.21:** HTTP iletişimi, yönlendirme (routing), ara katman (middleware) zinciri ve hata yönetimi çekirdek olarak Express tarafından sağlanır. Uygulamanın giriş noktası olan `api/src/server.js`, tüm router'ları `/api/...` ön ekleri altında bağlar ve tek bir merkezi 404 ve hata ara katmanı sağlar.
- **Prisma 6.4 (`prisma`, `@prisma/client`):** Veritabanı şeması `api/prisma/schema.prisma` dosyasında bildirimsel olarak tanımlanır; `prisma db push`, `prisma generate` ve özel `seed.js` betikleri ile şema yönetimi otomatize edilmiştir. Sorgularda tip güvenli bir API kullanılır ve kritik işlemler için `Prisma.TransactionIsolationLevel.Serializable` izolasyon seviyesinde işlemler (`runSerializableTransaction`) kullanılır.
- **PostgreSQL 16 (`postgres:16-alpine`):** İlişkisel veritabanı motoru olarak kullanılmıştır. UUID birincil anahtarlar, `@db.Decimal(12,3)` türünde hassas sayısal alanlar (stok miktarları için) ve coğrafi kullanım için `Float` enlem/boylam alanları içerir.
- **JSON Web Token (`jsonwebtoken 9.0`):** Kimlik doğrulama için durumsuz oturum yönetimi sağlar. Üç farklı belirteç türü tanımlanmıştır: `SYSTEM_USER`, `CUSTOMER`, `COURIER`.
- **bcryptjs 2.4:** Şifrelerin tek yönlü özetlenmesi için 10 round salt ile kullanılır (`api/src/utils/password.js`).
- **Multer 2.1:** Kurye başvurularındaki belge yüklemeleri için diske kayıt yapan dosya yükleme ara katmanı olarak yapılandırılmıştır; PDF, JPG, PNG ve WEBP formatları, 8 MB üst limitle kabul edilir.
- **CORS:** Geliştirme aşamasında geniş kaynak izinleriyle yapılandırılmıştır.
- **dotenv 16:** Ortam değişkenlerini `.env` dosyasından okumak için kullanılır.
- **Iyzico Sandbox API:** Çevrimiçi kart ödemesi için Iyzico Checkout Form akışı, doğrudan `fetch` üzerinden HMAC-SHA256 imzalı IYZWSv2 kimlik doğrulama başlığı ile entegre edilmiştir; harici bir SDK kullanılmamış, imza üretimi `node:crypto` modülü ile gerçekleştirilmiştir.
- **nodemon 3.1:** Geliştirme ortamında otomatik yeniden başlatma için.

### 6.2. İstemci Tarafı (Frontend) Teknolojileri

- **React 18.3 (`react`, `react-dom`):** UI bileşenlerinin temelini oluşturur; uygulama `StrictMode` içinde başlatılır.
- **Vite 6:** Geliştirme sunucusu ve üretim derleyicisi olarak kullanılır; `--host 0.0.0.0 --port 5173` parametreleri ile Docker dostu çalıştırılır.
- **React Router DOM 6.28:** Tüm uygulama gezinimini ve korumalı rotaları (`ProtectedRoute`, `ProtectedEmployeeRoute`, `ProtectedCourierRoute`) yönetir.
- **Tailwind CSS 3.4:** Tüm görsel tasarım yardımcı sınıf (utility-first) yaklaşımı ile yapılır; `web/src/components/app/AppShell.jsx` içinde `buttonStyles`, `fieldStyles`, `MetricGrid`, `Drawer`, `SimpleTable` gibi yeniden kullanılabilir UI ilkelleri tanımlanmıştır.
- **Leaflet 1.9 + react-leaflet 4.2:** Hem müşteri tarafında konum seçimi (`LocationPickerMap`) hem de kurye canlı haritası (`CourierLiveMap`) OpenStreetMap kutucukları üzerine kuruludur.
- **i18next 26 + i18next-browser-languagedetector + react-i18next 17:** Türkçe, İngilizce ve Arapça çevirileri `web/src/locales/{tr,en,ar}/common.json` dosyalarından yüklenir; özel bir `crotAppLanguage` algılayıcı, kullanıcı seçimini `localStorage` üzerinde kalıcı kılar ve Arapça için `dir="rtl"` özniteliği belge köküne uygulanır.

### 6.3. Geliştirme ve Dağıtım Araçları

- **Docker + Docker Compose:** `docker-compose.yml` dosyası üç servisten oluşur: PostgreSQL veritabanı, API ve Web. API servisi başlatılırken sırayla `prisma db push`, `prisma generate`, `seed.js` ve `npm run dev` komutlarını yürütür; bu sayede ürün tek komutla ayağa kalkar.
- **PostCSS + Autoprefixer:** Tailwind çıktısının tarayıcı uyumluluğu için.

## 7. Sistem Mimarisi

CROT, üç katmanlı klasik istemci-sunucu-veritabanı mimarisinin gelişmiş bir varyantını uygular. Sistemin yüksek seviyeli bileşenleri ve etkileşim biçimleri aşağıda özetlenmiştir.

İstemci katmanında, tarayıcıda çalışan tek sayfalı bir React uygulaması bulunur. Bu uygulama, kullanıcı rolüne göre (`SUPER_ADMIN`, `OWNER`, `EMPLOYEE` ve onun alt rolleri, `CUSTOMER`, `COURIER`) farklı sayfa ağaçlarını (`OwnerPage`, `KitchenPage`, `WaiterPage`, `CashierPage`, `InventoryPage`, `OnlineOrderPage`, `CourierPage`, `AdminPage`) sunar. Tüm dış iletişim, `web/src/api.js` içinde merkezileştirilmiş `apiRequest` ve `apiFormPost` yardımcı fonksiyonları üzerinden yapılır; bu fonksiyonlar `Authorization: Bearer <token>` başlıkları ile durumsuz iletişim sağlar.

Sunucu katmanı, Express tabanlı RESTful bir HTTP API'sidir. `api/src/server.js`, modüler router'ları (`auth`, `plans`, `owner`, `admin`, `kitchen`, `cashier`/`payment`, `waiter`, `inventory`, `restaurant`, `public`, `customer/auth`, `customer/orders`, `online`, `me`, `courier-auth`, `courier`, `payments` (Iyzico)) `/api/*` ön ekleri altında birleştirir. Her router; kendi alanına ait kimlik doğrulama ara katmanını (`authenticate`, `authenticateCourier`), rol kontrolünü (`requireRoles`) ve gerektiğinde abonelik kontrolünü (`requireActiveSubscription`) zincirler. İş mantığı; `services/` (örn. `pos.service.js`, `inventory.js`, `kitchen.service.js`, `stock.service.js`) ve `modules/` (örn. `courier-dispatch/dispatch.service.js`, `payments/iyzico.service.js`, `payments/payment.service.js`) klasörlerine taşınmıştır. Bu sayede router katmanı yalnızca girdi doğrulama ve cevap biçimlendirme ile sınırlı kalır; gerçek iş kuralları yeniden kullanılabilir servis katmanında toplanır.

Veri katmanı, Prisma ORM tarafından soyutlanan PostgreSQL örneğinden oluşur. Şema, çok kiracılı bir tasarımı destekleyecek şekilde tasarlanmıştır: çoğu tabloda `restaurantId` yabancı anahtarı bulunur, `@@unique` kısıtları kiracı sınırı içinde tekillik (örn. `[restaurantId, name]`) sağlar ve `@@index` direktifleri sık sorgulanan kombinasyonları (örn. `[restaurantId, status]`, `[restaurantId, orderType, status]`) hızlandırır.

Çapraz kesen bileşenler arasında konteynerleştirme (Docker), oturum yönetimi (JWT), uluslararasılaştırma (i18next), harita servisi (OpenStreetMap), dış ödeme servisi (Iyzico) ve dosya yükleme depolaması (yerel diskte `uploads/courier-docs/`) bulunur. Bu mimari, üretim aşamasında nesne depolaması (S3 vb.), CDN, ters yönlü vekil sunucu (Nginx) ve yenileme jetonu mekanizmasıyla genişlemeye uygundur.

## 8. Backend Yapısı

Backend kodu `api/src/` altında işlevsel olarak ayrıştırılmış, sade bir mimariyle organize edilmiştir. Aşağıdaki tablo, ana klasörlerin ve dosyaların görevlerini özetlemektedir.

| Klasör / Dosya | Sorumluluk |
|---|---|
| `server.js` | Express uygulamasının başlatılması, CORS, JSON ayrıştırıcı, sağlık ucu, router kayıtları, hata ara katmanı |
| `config.js` | Ortam değişkenlerinin (PORT, JWT_SECRET, IYZICO_*, CLIENT_URL, API_URL, süper yönetici varsayılanları) merkezileştirilmesi |
| `db.js` | Tek `PrismaClient` örneğinin paylaşılması |
| `middleware/auth.js` | `authenticate` (sistem kullanıcıları/müşteriler), `authenticateCourier` (kurye), `requireRoles` (rol gereksinimi) |
| `middleware/subscription.js` | `requireActiveSubscription` ile aktif plan kontrolü |
| `routes/auth.js` | Sahip kayıt, sistem giriş, `me` |
| `routes/customerAuth.js` | Online müşteri kayıt/giriş/me |
| `routes/courierAuth.js` | Kurye kayıt (belge yükleme dahil), giriş, me |
| `routes/owner.js` | Restoran sahibi paneli: pano, çalışan, masa, menü, reçete, stok temel uçları |
| `routes/ownerOnline.js` | Online sipariş için sahibe ait kategori, ürün, açılış saati, online sipariş yönetim uçları |
| `routes/admin.js` | Süper yönetici: kullanıcılar, restoranlar, planlar, kurye onay/red |
| `routes/kitchen.js` | Mutfak: sipariş listesi, durum geçişi, mutfakta menü ekleme/güncelleme, malzeme istekleri |
| `routes/waiter.js` | Garson: masalar, ürünler, sipariş oluştur/güncelle/sil/durum |
| `routes/payment.js` | Kasiyer: hazır siparişler, masa ödemesi, fişler |
| `routes/inventory.js` | Stok yöneticisi: stok panosu, malzeme, satın alma, talep |
| `routes/restaurant.js` | Sahibin/çalışanın paylaşılan sipariş okuma/güncelleme uçları |
| `routes/public.js` | QR ile masa menüsü, gel-al menüsü, sipariş oluşturma (kimliksiz) |
| `routes/publicOnlineOrder.js` | Açık çevrimiçi restoran listesi ve menü |
| `routes/online.js` | Çevrimiçi sipariş pazaryeri: konum tabanlı arama, restoran sayfası, müşteri online sipariş oluşturma |
| `routes/me.js` | Müşterinin adres CRUD'ı ve geçmiş siparişleri |
| `routes/customerOrders.js` | Müşterinin sipariş yaratımı (alternatif uç) ve listesi |
| `routes/courier.js` | Kurye: konum güncelle, teklif listele, kabul et, sipariş güncelle |
| `routes/plans.js` | Plan listesi (genel) |
| `services/pos.service.js` | Sipariş yaşam döngüsü, masa eşitleme, masa ekleme/güncelleme, online müşteri siparişi yaratma |
| `services/inventory.js` | Reçete, stok, hareket, satın alma, malzeme talep iş kuralları; serileştirilebilir işlemler |
| `services/kitchen.service.js` | Mutfak ekranı için sipariş gruplandırma yardımcıları |
| `services/stock.service.js` | Stok hareketi yardımcıları |
| `modules/courier-dispatch/dispatch.service.js` | Kurye konum güncelleme, yarıçap içinde teklif listeleme, atomik sipariş kabul |
| `modules/payments/iyzico.service.js` | IYZWSv2 imzalı checkout form başlatma ve doğrulama |
| `modules/payments/iyzico.routes.js` | `/api/payments/iyzico/checkout`, `/callback`, `/orders/:id` |
| `modules/payments/payment.service.js` | Ödeme akışı orkestrasyonu (sipariş yükleme, durum doğrulama, yönlendirme URL'i) |
| `utils/token.js` | `signUserToken`, `signCustomerToken`, `signCourierToken`, `verifyToken` |
| `utils/password.js` | `hashPassword`, `comparePassword` |
| `utils/orders.js` | Sipariş durum makineleri, rol bazlı geçiş izinleri, sipariş haritalayıcılar |
| `utils/menu.js` | Menü öğesi listeleme ve sipariş edilebilirlik hesaplaması |
| `utils/tables.js` | Masa durumlarının siparişlere göre eşitlenmesi |
| `utils/employees.js` | Çalışan bağlamı ve rol normalizasyonu |
| `utils/geo.js` | Enlem/boylam doğrulama, Haversine mesafe |
| `utils/restaurantHours.js` | Açılış saati eşleştirme, gece yarısını aşan vardiya desteği |
| `utils/onlineOrder.js` | Restoran, sipariş, kategori haritalama; para birimi yuvarlama |
| `utils/slugs.js` | Restoran slug üretimi ve tekilleştirme |
| `prisma/schema.prisma` | Tüm veri modeli ve ilişkiler |
| `prisma/seed.js` | Süper yönetici, planlar ve örnek çevrimiçi restoranların oluşturulması |

Mimaride dikkat çeken birkaç teknik karar şunlardır:

- **Servis katmanı hata sınıfları:** `PosServiceError`, `InventoryError`, `PaymentError` ve `CourierDispatchError` özel hata sınıfları, HTTP durum kodu ile birlikte fırlatılır; router katmanındaki `handleServiceError` yardımcıları bu hataları doğru duruma çevirir. Bu, iş mantığının HTTP'den bağımsız test edilebilir kalmasını sağlar.
- **Cevap biçimi tutarlılığı:** Klasik uçlar `{ message, ... }` veya `{ token, user }` biçiminde yanıt verirken, çevrimiçi pazaryeri ve kurye gibi yeni eklenen modüller `{ success: true, data: ... }` / `{ success: false, message }` biçimini kullanır. Bu, README'de açıkça dokümante edilmiştir.
- **Atomik kritik geçişler:** Kurye'nin `READY` durumundaki bir siparişi kabul etmesi `prisma.$transaction` içinde `updateMany({ where: { ..., assignedCourierAccountId: null }, data: { assignedCourierAccountId } })` şeklinde optimistik kilit ile yapılır; `count !== 1` durumu yarış koşullarını yakalar ve 409 üretir.
- **Reçete bazlı stok düşümü:** `inventory.consumeInventoryForOrder`, sipariş `PREPARING` durumuna geçtiğinde reçete bileşenlerini doğrular ve yeterli stok varsa `StockMovement` (tipi `ORDER_CONSUMPTION`) kayıtları üretip `IngredientStock` snapshot'ını günceller.

## 9. Frontend Yapısı

İstemci uygulaması `web/src/` altında, sayfa-bileşen-modül-yardımcı bölünmesiyle organize edilmiştir.

Uygulama girişi `main.jsx` içinde `BrowserRouter` ile sarılmış `App` bileşenini render eder ve `utils/i18n.js`'yi yükleyerek dil algılamasını başlatır. `App.jsx`; üç ayrı oturum kanalı (`session` — sistem kullanıcısı, `onlineCustomerSession` — son müşteri, `courierSession` — kurye) yönetir ve bu oturumları rota seviyesinde guard bileşenlerine geçirir. `getDefaultRoute` yardımcısı, kullanıcının `systemRole` ve `employeeRole` alanlarına göre uygun panele yönlendirme yapar.

`pages/` klasörü, her biri tek bir kullanıcı yolculuğunu kapsayan büyük React bileşenlerinden oluşur:

- **`SignupPage`, `LoginPage`:** Sahip ve çalışan girişleri.
- **`OwnerPage`, `OwnerOnlineOrdersPage`:** Sekmeli sahip paneli (`Overview`, `Staff`, `Tables`, `Menu`, `Inventory`, `Settings`); QR oluşturma için `api.qrserver.com`'dan görseller; çevrimiçi sipariş yönetimi.
- **`AdminPage`:** Süper yönetici paneli; kullanıcı listesi, plan fiyat düzenleme, kurye başvurularını filtreleme/onay/red.
- **`KitchenPage` + `components/kitchen/`:** Üç sütunlu (PENDING, PREPARING, READY) "kitchen display system"; 10 saniyelik anketleme (polling), gecikme uyarıları, masa/pickup/delivery filtreleri.
- **`WaiterPage`:** Masaların durum tabanlı renklendirilmesi, garson tarafından sipariş oluşturma, "READY → SERVED" geçişi, "garson gördü" işaretlemesi.
- **`CashierPage`:** Hazır masaların tahsili, nakit/kart seçimi, fiş üretimi.
- **`InventoryPage`:** Malzeme, reçete, satın alma, talep yönetimi; düşük stok uyarıları.
- **`OrderPage`, `PickupOrderPage`:** QR ile veya tenant-slug ile kimliksiz müşteri siparişi.
- **`OnlineOrderPage`, `OnlineRestaurantPage`, `OnlineCartPage`, `MyOnlineOrdersPage`, `OnlineCustomerLoginPage`, `OnlineCustomerSignupPage`:** Konum tabanlı pazaryeri akışı.
- **`PaymentStartPage`, `PaymentResultPage`:** Iyzico checkout başlatma ve sonuç gösterme.
- **`CourierLoginPage`, `CourierSignupPage`, `CourierPage`:** Kurye yaşam döngüsü; canlı harita.

`components/` altında üç önemli alt klasör vardır: `app/` (genel UI ilkelleri ve `AppShell`), `kitchen/` (mutfak ekranı bileşenleri), `online/` (restoran kartı, ürün kartı, sepet özeti). Ek olarak `RemoteImage` ve `RestaurantLogo` bileşenleri görsel düşüş (fallback) davranışlarını kapsüller.

`modules/` klasörü, daha kapsamlı işlevsel bütünleri gruplamak için kullanılmıştır: `online-food/OnlineFoodPages.jsx` çevrimiçi siparişin alternatif/eski sürümünü, `courier/CourierLiveMap.jsx` ile `useCourierLiveLocation.js` ise Leaflet tabanlı canlı harita ve `navigator.geolocation.watchPosition` üzerine kurulu konum izleme kancasını içerir.

`utils/` altında; `currency.js` (TRY biçimleme), `i18n.js` (dil başlatma), `locale.js`/`onlineLocation.js` (tarayıcı konumu, ters geo-kodlama), `onlineCart.js` (`localStorage` üzerinde sepet kalıcılığı ve normalizasyonu), `images.js` (görsel URL normalizasyonu) gibi saf yardımcılar bulunur. Sepet, çapraz sekme tutarlılığı için `online-order-cart-updated` özel olayı ve `storage` olayı ile senkron edilir.

UI tasarımı; soft yumuşak gradyanlar, yarı saydam yüzeyler (`ui-surface`), hafif gölgeler ve marka rengi olarak yeşil (`brand-700`/`brand-500`) tonları üzerine kuruludur. `MetricGrid`, `SectionCard`, `StatusPill`, `Tabs`, `SimpleTable`, `Drawer`, `MessageBanner` gibi bileşenler tutarlı bir tasarım sistemini destekler.

## 10. Veritabanı Tasarımı

Veritabanı, `api/prisma/schema.prisma` dosyasında PostgreSQL üzerinde tanımlanmıştır. Şema, çok kiracılı bir SaaS'ı destekleyecek biçimde restorana bağlı ana akışlar (sipariş, mutfak, kasa, stok) ile platform genelindeki akışları (planlar, abonelikler, kuryeler, müşteriler) ayrıştırır. Aşağıda model grupları ve ilişkileri açıklanmıştır.

### 10.1. Kimlik ve Kiracı Modelleri

- **`Restaurant`:** Kiracının kök varlığı. Adres (city, district, addressText, latitude, longitude), iletişim, görsel (logoUrl, coverImageUrl), açılış durumu (`isOpen`), çevrimiçi sipariş bayrakları (`isOnlineOrderingEnabled`, `onlineOrderingEnabled`, `deliveryEnabled`, `pickupEnabled`, `publicOrderingEnabled`), teslimat fiyatlama parametreleri (`baseDeliveryFee`, `feePerKm`, `freeDeliveryThreshold`, `minimumOrderAmount`, `minOrderAmount`, `deliveryFee`), tahmini hazırlık süresi, teslimat yarıçapı (`deliveryRadiusKm`), ortalama puan ve tüm bağımlı koleksiyonlar (kullanıcılar, masalar, kategoriler, ürünler, açılış saatleri, siparişler, mutfak emirleri, ödemeler, malzemeler, reçeteler, stok hareketleri, satın alma siparişleri, abonelik, kurye hesapları) bu modelde toplanır.
- **`RestaurantOpeningHour`:** Haftanın gününe göre (`dayOfWeek` 0–6) açılış/kapanış saati ve `isClosed` bayrağı. `[restaurantId, dayOfWeek]` tekildir; gece yarısını aşan vardiyaları desteklemek için kapanış saatinin açılıştan küçük olması durumu `restaurantHours.js` içinde özel olarak işlenir.
- **`User`:** Sistem kullanıcıları (süper yönetici, sahibi, çalışan). `systemRole` enum'u (`SUPER_ADMIN`, `OWNER`, `EMPLOYEE`) ile ayrıldığında, `EMPLOYEE` durumunda `employeeRole` (string) alt rol bilgisini taşır. `restaurantId` ile bir restorana bağlanır; `onDelete: Cascade` ile restoran silindiğinde kullanıcılar da silinir.
- **`Customer`:** Çevrimiçi sipariş veren son müşteriler. Sistem kullanıcılarından bağımsız, kendi e-posta tekilliğine ve kendi parola özetine sahiptir; çoklu adres ve sipariş geçmişi taşır.
- **`UserAddress`:** Bir müşteriye bağlı adres defteri; varsayılan adres (`isDefault`), enlem/boylam, kapı, kat, daire numarası gibi detaylı alanlar; (kullanıcı, varsayılan) ve (kullanıcı, oluşturma) indeksleri ile.
- **`CourierAccount`:** Kurye hesapları, `User`'dan ayrı bir tabloda tutulur. Belge URL'i, başvuru durumu (`PENDING/APPROVED/REJECTED`), inceleyen yöneticiye bağlantı, red nedeni, son konum (lat/lng) ve son güncellenme zamanı gibi alanlar içerir.

### 10.2. Plan ve Abonelik

- **`Plan`:** Düz, platform ölçekli plan tablosu (`STARTER`, `GROWTH`, `PREMIUM`); `monthlyPrice` tam sayı olarak tutulur ve süper yönetici tarafından değiştirilebilir.
- **`Subscription`:** Restoran-plan ikilisini eşleştirir; restoran başına en fazla bir abonelik (`@unique restaurantId`). `status = "ACTIVE"` olduğunda `requireActiveSubscription` ara katmanından geçen sahibin yönetim uçlarına erişim sağlanır.

### 10.3. Sipariş ve Servis Modelleri

- **`DiningTable`:** Restoran masaları; isim, kapasite (`seats`), durum (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`).
- **`Order`:** Sistemin merkezi entitesi. Çoklu durum makinesini taşıyan ortak modeldir.
  - `orderType`: `DINE_IN`, `PICKUP`, `DELIVERY`.
  - `source`: "WAITER", "QR", "PICKUP", "ONLINE" gibi metin etiketleri.
  - `status`: 13 durumlu enum (`PENDING_PAYMENT`, `PAYMENT_FAILED`, `PENDING`, `SENT_TO_KITCHEN`, `ACCEPTED`, `PREPARING`, `READY`, `ON_THE_WAY`, `SERVED`, `PAID`, `COMPLETED`, `CANCELLED`, `REJECTED`).
  - `paymentStatus` ve `paymentMethod` ayrı enum'lar.
  - Mali alanlar hem cent (tam sayı) hem yüzde-değer (Float) olarak çift tutulur (`subtotalCents`/`subtotal`, `deliveryFeeCents`/`deliveryFee`, `totalCents`/`total`); bu sürdürülen evrimde geriye dönük uyumluluk içindir.
  - Kurye bağlantısı `assignedCourierAccountId`, müşteri bağlantısı çift (`customerId`, `customerUserId`) ile sağlanır.
  - Zaman damgaları geniştir: `acceptedAt`, `preparingAt`, `readyAt`, `kitchenCompletedAt`, `waiterSeenAt`, `completedAt`, `cancelledAt`, `inventoryConsumedAt`. Bu zenginlik, raporlama ve operasyonel SLA analizleri için temel oluşturur.
  - İndeksler: `[restaurantId, status]`, `[restaurantId, orderType, status]`, `[tableId, status]`, `[customerId, createdAt]`, `[restaurantId, source, createdAt]`, `[assignedCourierAccountId, status]`. Bu indeksler, mutfak/kasiyer/garson sayfalarındaki filtrelemeleri ve raporlama sorgularını verimli hale getirir.
- **`OrderItem`:** Sipariş satırları. `nameSnapshot` ve `productNameSnapshot` ile ürün adının sipariş anındaki kopyası, `priceCents` ve `unitPriceSnapshot` ile fiyat anlık değeri saklanır; bu, ürün/menü öğesi sonradan değişse bile sipariş geçmişinin değişmemesini sağlar.
- **`KitchenOrder`:** Bir siparişe 1-1 bağlı, mutfak ekranı için optimize edilmiş kayıt; durum makinesi `WAITING/PREPARING/DONE`.
- **`Payment`:** Masa kasası ödemesi (nakit/kart). `receiptCode` benzersiz ve tek başına fiş kimliği oluşturur; bir ödeme birden çok siparişi kapatabilir (`Order.paymentId`).
- **`OrderPayment`:** Çevrimiçi (Iyzico) ödeme kaydı. Sipariş başına bir kayıt; `provider` (`IYZICO`/`MANUAL`), `status`, `price`, `currency`, `conversationId`, `token`, `iyzicoPaymentId`, ham yanıt JSON'u tutulur. Yetkilendirme ve doğrulama için ayrı indeksler bulunur.

### 10.4. Menü Modelleri

- **`MenuItem`:** Klasik QR/Garson kanalları için ürünler. `priceCents`, `stock` (tam sayı), `category` metni, görsel, hazır olma durumu.
- **`Category` + `Product`:** Çevrimiçi sipariş için zenginleştirilmiş menü. Kategoriye bağlı, fiyat `Float`, hazırlık süresi (`preparationMinutes`), sıralama (`sortOrder`), aktiflik bayrağı.

Bu çift menü modeli; klasik POS ile online pazaryerinin farklı veri ihtiyaçlarını ayrıştıran bilinçli bir tasarım kararıdır.

### 10.5. Stok Modelleri

- **`Ingredient`:** Restorana ait malzemeler. `unit` (kg, lt, adet vb.), `minStock` (Decimal 12,3) düşük stok eşiği.
- **`IngredientStock`:** Her malzemeye 1-1 bağlı anlık stok özeti (`currentStock` Decimal). Hareket ledger'ı yanında performans için tutulan canlı snapshot'tır.
- **`StockMovement`:** Sayım defterinin altındaki tüm hareketler. `type` enum'u (`SALE`, `MANUAL_ENTRY`, `PURCHASE`, `ORDER_CONSUMPTION`, `WASTE`, `ADJUSTMENT`, `RETURN`), bir referans tipi/id'si (`StockReferenceType` + `referenceId`) ve isteğe bağlı sipariş bağlantısı.
- **`Recipe`** ve **`RecipeIngredient`:** Menü öğesi başına bir reçete ve birden çok malzeme miktarı (Decimal 12,3). `Recipe.approvalStatus` (`PENDING_APPROVAL`/`APPROVED`) sahibin nihai onayını gerekli kılan iş akışını destekler.
- **`IngredientRequest`:** Mutfak çalışanının stok yöneticisinden talep ettiği bileşen istekleri; `PENDING/FULFILLED/REJECTED` durumlarıyla.
- **`Supplier`, `PurchaseOrder`, `PurchaseOrderItem`:** Tedarikçi yönetimi ve satın alma siparişleri; `PurchaseOrderStatus` (`DRAFT`, `RECEIVED`, `CANCELLED`).

Bu zengin stok modeli, tipik POS yazılımlarının çok ötesine geçen, gerçek bir restoran arka ofis sürecini tarif eder.

### 10.6. Tasarım Prensipleri

- **UUID (cuid bazlı kamuya açık) birincil anahtarlar:** Çoğu modelde `@id @default(uuid())` kullanılır; bunun yanında `Order.publicId` ve `Order.orderCode` gibi tahmin edilemez kamuya açık tanımlayıcılar `@default(cuid())` ile üretilir.
- **`onDelete` davranışları:** Restoran silindiğinde tüm bağımlı kayıtlar (`Cascade`) silinir; bir malzemenin reçeteden silinmesi `Restrict` ile engellenir; satın alma kalemleri ve stok hareketleri tarihsel bütünlük için `Restrict` referansları taşır; isteğe bağlı bağlar (`SetNull`) ödeme veya kurye atamasının kaldırılmasında kullanılır.
- **İndeksleme:** Sıkça birlikte sorgulanan alanlar için bileşik indeksler tanımlanmış, sıralama gereken durumlarda (`createdAt`, `readyAt`) tarih alanları indeksin sonuna yerleştirilmiştir.

## 11. API Yapısı

API, RESTful uç ailelerinin domain bazlı router'lara bölünmesiyle organize edilir. Tüm uçlar `/api` ön ekiyle başlar. README dosyasında listelenen klasik uçlar haricinde, çevrimiçi sipariş ve kurye modülleriyle gelen yeni uçlar `success/data` formatını izler. Aşağıda en önemli uç aileleri tematik olarak özetlenmiştir.

### 11.1. Kimlik Doğrulama Uçları

- `POST /api/auth/owner-signup`: Yeni bir restoran ve sahibi tek bir işlemle yaratır; benzersiz slug üretir, parolayı bcrypt ile özetler, JWT döndürür.
- `POST /api/auth/login`: E-posta/parola ile sistem kullanıcısı girişi; sahip, çalışan ve süper yöneticiyi aynı uç karşılar.
- `GET /api/auth/me`: JWT'nin kimliğini sahibin/çalışanın güncel verisiyle birleştirir.
- `POST /api/customer/auth/{signup,login}` ve `GET /api/customer/auth/me`: Çevrimiçi sipariş müşterileri için.
- `POST /api/courier-auth/register` (multipart): Belge yüklemeli kurye başvurusu; kayıt durumu `PENDING` olarak başlar.
- `POST /api/courier-auth/login`: Kurye giriş; `PENDING/REJECTED` durumları açıkça döndürülür.

### 11.2. Süper Yönetici Uçları

- `GET /api/admin/users`, `GET /api/admin/restaurants`, `GET /api/admin/plans`, `PATCH /api/admin/plans/:planId`.
- `GET /api/admin/courier-accounts?status=PENDING|APPROVED|REJECTED`, `PATCH /api/admin/courier-accounts/:id/approve`, `PATCH /api/admin/courier-accounts/:id/reject`.

### 11.3. Restoran Sahibi Uçları

- Genel: `GET /api/owner/dashboard`, `PATCH /api/owner/restaurant`, `POST /api/owner/subscription/select|activate`.
- Ekip: `GET/POST /api/owner/employees`.
- Masalar: `GET/POST/PATCH /api/owner/tables[:tableId]`.
- Menü ve reçete: `GET /api/owner/menu`, `PATCH /api/owner/menu/:itemId`, `GET/PUT/DELETE /api/owner/menu/:itemId/recipe`, `PATCH /api/owner/menu/:itemId/recipe/approve`.
- Stok: `GET/POST /api/owner/inventory/ingredients`, `PATCH /api/owner/inventory/ingredients/:id`.
- Çevrimiçi yönetim: `GET/PUT /api/owner/restaurant/settings` (açılış saatleri, teslimat parametreleri), `GET/POST/PUT/DELETE /api/owner/menu/categories[:id]`, `GET/POST/PUT/DELETE /api/owner/menu/products[:id]`, `GET /api/owner/orders`, `GET /api/owner/orders/:id`, `PATCH /api/owner/orders/:id/status`.

### 11.4. Mutfak, Garson, Kasiyer ve Stok Yöneticisi Uçları

- Mutfak: `GET /api/kitchen/orders`, `PATCH /api/kitchen/orders/:orderId/status`, `POST /api/kitchen/orders/:orderId/complete`, mutfak menüsü ve reçete uçları, `GET/POST /api/kitchen/requests`.
- Garson: `GET /api/waiter/{tables, products}`, `POST/PUT/DELETE /api/waiter/orders[:id]`, `PATCH /api/waiter/orders/:id/status`, `PATCH /api/waiter/orders/:id/seen`.
- Kasiyer: `GET /api/payment/{orders,tables}`, `PATCH /api/payment/orders/:id/status`, `POST /api/payment/tables/:tableId/checkout`. Tüm uçlar hem `/api/payment/*` hem `/api/cashier/*` altında erişilebilir.
- Stok yöneticisi: Pano, malzeme, satın alma, talepler, hareketler, raporlar (`GET /api/inventory/...`).

### 11.5. Genel ve Müşteri Uçları

- QR ve gel-al: `GET /api/public/tables/:tableId/menu`, `POST /api/public/tables/:tableId/orders`, `GET /api/public/tenants/:slug/menu`, `POST /api/public/tenants/:slug/orders`, `GET /api/public/tenants/:slug/orders/:orderId`, `GET /api/public/orders/:publicId`.
- Çevrimiçi pazaryeri: `GET /api/online/restaurants?lat=&lng=&city=&district=&search=&onlyOpen=&delivery=&pickup=&sortBy=`, `GET /api/online/restaurants/:slug`, `GET /api/online/restaurants/:slug/menu`, `POST /api/online/orders`.
- Müşteri profili: `GET/POST/PUT/DELETE /api/me/addresses[:id]`, `GET /api/me/orders`.

### 11.6. Kurye Uçları

- `POST /api/courier/location`, `GET /api/courier/offers`, `POST /api/courier/offers/:orderId/accept`, `GET /api/courier/orders`, `PATCH /api/courier/orders/:orderId/status`. Tüm uçlar `authenticateCourier` ile korunur ve sadece `APPROVED` durumundaki kuryelere açıktır.

### 11.7. Iyzico Ödeme Uçları

- `POST /api/payments/iyzico/checkout`: Müşterinin sahip olduğu siparişi alır, Iyzico checkout formunu başlatır, jeton ve sayfa URL'ini döndürür.
- `POST /api/payments/iyzico/callback`: Iyzico'dan gelen geri çağırma; sipariş ve `OrderPayment` kayıtlarını günceller, kullanıcıyı `/payment/result` sayfasına yönlendirir.
- `GET /api/payments/iyzico/orders/:orderId`: Sipariş ve ödeme durumunu sorgular.

Tüm uçlar; girdi doğrulama, restoran sınırı kontrolü, durum makinesi izinleri ve gerektiğinde aktif abonelik gibi savunma katmanlarıyla korunur. Hata yanıtları HTTP durum kodu ile birlikte yapısal mesaj döndürür.

## 12. Authentication ve Güvenlik

CROT, durumsuz JWT tabanlı bir kimlik doğrulama mimarisi kullanır. Bu seçim, sunucunun yatay ölçeklenmesini ve istemcinin oturum yapışkanlığına ihtiyaç duymamasını sağlar. Jeton yapısı, ara katmanlar ve güvenlik kontrolleri aşağıda detaylandırılmıştır.

### 12.1. Jeton Türleri

`api/src/utils/token.js` üç farklı jeton türü tanımlar; her biri 7 gün süreyle geçerli olur ve `JWT_SECRET` ile imzalanır:

- **`SYSTEM_USER`:** `userId`, `systemRole`, `restaurantId` ve `tokenType` alanlarını taşır. Süper yönetici, sahibi ve çalışanlar bu tür jetonu kullanır.
- **`CUSTOMER`:** `userId`, `customerId`, `systemRole: "CUSTOMER"`. Çevrimiçi sipariş veren son müşteriler için.
- **`COURIER`:** `courierAccountId`, `restaurantId`, `tokenType: "COURIER"`. Kurye portalı için ayrı bir jeton ailesi.

Üç jeton ailesinin ayrılması, bir tarafın diğerine ait uçlara yanlışlıkla erişmesini engeller; özellikle `authenticateCourier` ara katmanı `payload.tokenType === "COURIER"` kontrolünü açıkça yapar ve veritabanından kurye hesabını yükleyerek `account.status === "APPROVED"` koşulunu da doğrular.

### 12.2. Ara Katmanlar

- **`authenticate`:** `Authorization: Bearer <token>` başlığını okur, jetonu doğrular ve `req.auth` nesnesine yerleştirir.
- **`requireRoles(...roles)`:** `req.auth.systemRole` ile beklenen rollerden birinin eşleştiğini doğrular; örnekler: `requireRoles("SUPER_ADMIN")`, `requireRoles("OWNER")`, `requireRoles("EMPLOYEE")`, `requireRoles("OWNER", "EMPLOYEE")`.
- **`authenticateCourier`:** Kuryeye özgü; jeton tipi ve hesap durumu ile birlikte kurye nesnesini `req.courierAccount` olarak yükler.
- **`requireActiveSubscription`:** Sahibin restoran kimliği ile abonelik tablosunu sorgular; `status === "ACTIVE"` değilse `403 requiresPlanSelection: true` döner. Bu, ücretsiz kullanım sürecinden ücretli planlara geçişi zorunlu kılar.

Çalışan rolü kontrolleri, `getEmployeeContext` yardımcısıyla DB'den çalışanın güncel `employeeRole` alanını getirir; jetona güvenmek yerine son durumu kontrol etmek, sahibin bir çalışanın rolünü değiştirmesi durumunda da güvenliği korur.

### 12.3. Şifre Yönetimi

Tüm parolalar bcryptjs kullanılarak 10 round salt ile özetlenir. Düz metin parolalar veritabanında hiçbir zaman saklanmaz. Minimum parola uzunluğu 6 karakter olarak doğrulanır.

### 12.4. Yetkilendirme ve Restoran İzolasyonu

Çoğu uçta, restoran kimliği jetondan veya çalışanın kendi kaydından çekilir; veritabanı sorguları her zaman `where: { restaurantId }` ile sınırlandırılır. Örneğin garsonun bir siparişi okuması veya güncellemesi, mutfaksal eylemde bulunması, kasiyerin masaları görmesi gibi tüm işlemler restoran sınırı içinde gerçekleşir. Süper yönetici dışı hiçbir kullanıcı, başka bir restoranın verisine ulaşamaz.

Sipariş durum geçişleri ek olarak rol bazlı bir ince taneli izin matrisi (`ROLE_ORDER_TRANSITIONS` içinde `kitchen`, `cashier`, `waiter`, `courier`, `owner`) ile kısıtlanır. Örneğin mutfak yalnızca `PENDING → ACCEPTED|PREPARING`, `PREPARING → READY` gibi geçişleri yapabilir; kurye yalnızca atanmış olduğu siparişin `READY → SERVED` ve `SERVED → COMPLETED` geçişlerini yapabilir.

### 12.5. Eşzamanlılık ve Yarış Koşulları

Stoğun azaltılması ve siparişin "PREPARING" durumuna geçişi gibi kritik işlemler `Prisma.TransactionIsolationLevel.Serializable` izolasyonunda işlemler içinde yürütülür (`runSerializableTransaction`). Bu, çift düşüm gibi anormallikleri büyük ölçüde önler. Kurye sipariş kabulü ise atomik `updateMany` ile `null assignedCourierAccountId` koşuluna bağlanır; eşzamanlı iki kuryeden yalnızca biri kazanır.

### 12.6. Dosya Yükleme Güvenliği

Kurye belge yüklemesinde Multer; yalnızca `.pdf, .jpg, .jpeg, .png, .webp` uzantılarına izin verir, 8 MB üst limit uygular ve dosya adındaki güvensiz karakterleri normalleştirir. Yüklenen dosyalar `uploads/courier-docs/` altına yazılır ve süper yönetici tarafından gözden geçirilir.

### 12.7. Üretim Önerileri

README açıkça, üretim öncesinde JWT gizinin ve süper yönetici parolasının değiştirilmesi, HTTPS, yenileme jetonları, denetim günlüğü ve gerçek ödeme entegrasyonunun güçlendirilmesi gerektiğini belirtir; bu rapor da aynı önerileri 18. bölümde detaylandırmaktadır.

## 13. Kullanıcı Rolleri

CROT veri modeli tek bir `User` tablosu üzerinden üç sistem rolünü ifade eder, bunun yanında `Customer` ve `CourierAccount` ayrı modeller olarak konumlandırılır. Bu sayede toplam sekiz davranışsal rol ortaya çıkar.

| Rol | Sistem Rolü | Çalışan Alt Rolü | Ana Yetenekler |
|---|---|---|---|
| Süper Yönetici | `SUPER_ADMIN` | — | Tüm kullanıcı ve restoranları görme; abonelik planlarının fiyatını güncelleme; kurye başvurularını onaylama/reddetme |
| Restoran Sahibi | `OWNER` | — | Kendi restoranı için plan seçimi, çalışan yönetimi, masa yönetimi, menü ve reçete yönetimi, online restoran ayarları, kategori/ürün CRUD'u, online sipariş izleme ve durum güncelleme |
| Mutfak Personeli | `EMPLOYEE` | `chef` (alias `kitchen`) | Mutfak panosunda PENDING → ACCEPTED → PREPARING → READY akışını yürütme; reçete yazma; malzeme talep oluşturma |
| Garson | `EMPLOYEE` | `waiter` | Masa yönetimi, masaya sipariş ekleme/güncelleme, READY siparişlerini SERVED'e çevirme, "garson gördü" bayrağı |
| Kasiyer | `EMPLOYEE` | `cashier` | Hazır masaların nakit/kart ile tahsili, fiş üretimi, masa durumunu temizleme |
| Stok Yöneticisi | `EMPLOYEE` | `inventory_manager` | Malzeme CRUD'u, stok hareketleri, satın alma siparişleri, tedarikçiler, düşük stok uyarıları, mutfak taleplerini onaylama/reddetme |
| Son Müşteri | (`Customer` modeli) | — | Konum tabanlı restoran arama, çevrimiçi sipariş, adres defteri, geçmiş siparişler, online ödeme |
| Kurye | (`CourierAccount` modeli) | — | Konum yayma, yakındaki teslimat tekliflerini görme, sipariş kabul etme, READY → SERVED → COMPLETED akışı |

Restoran sahibi, çalışan oluştururken alt rolü zorunlu kılar; kabul edilen alt roller `ALLOWED_EMPLOYEE_ROLES` kümesinde tutulur (`chef`, `cashier`, `waiter`, `inventory_manager`, `courier`). İstemci tarafında `getDefaultRoute`, kullanıcı rolüne göre uygun başlangıç sayfasını çözer; bu sayede her kullanıcı yalnızca kendi panelini görür.

## 14. Sistemin Çalışma Akışı

Aşağıda, sistemin uçtan uca işleyişini gerçekçi bir kronoloji içinde anlatan akışlar verilmiştir. Bu akışlar README'deki "Core user flow" bölümünden ve doğrudan kod tabanından çıkarılmıştır.

### 14.1. Restoranın Sisteme Katılması

Bir restoran sahibi `/signup` üzerinden kişisel bilgilerini ve restoran adını girer. `POST /api/auth/owner-signup` uç noktası tek bir Prisma işleminde restoranı yaratır, benzersiz bir slug üretir, sahibi `OWNER` rolüyle kayıt eder ve JWT jetonu ile birlikte sahibi yanıtlar. Sahip, panele girdiğinde abonelik gerektiğine dair `requiresPlanSelection: true` mesajını alır ve `POST /api/owner/subscription/select` ile bir plan etkinleştirir. Plan etkinleşmeden çalışan, masa, menü ve stok uçlarına erişim engellenir.

### 14.2. Restoranın Operasyonel Hazırlığı

Aktif abonelikten sonra sahip; çalışanlarını (`POST /api/owner/employees`), masalarını (`POST /api/owner/tables`), kategorilerini (`POST /api/owner/menu/categories`), ürünlerini (`POST /api/owner/menu/products`), açılış saatlerini ve teslimat ayarlarını (`PUT /api/owner/restaurant/settings`) yaratır. Stok yöneticisi malzemeleri tanımlar; mutfak veya stok yöneticisi her menü öğesi için reçete kurar. Sahip, isteğe bağlı olarak `publicOrderingEnabled` ve `pickupEnabled` bayraklarını yöneterek QR ve gel-al kanallarını açar.

### 14.3. Masa Üzerinden Sipariş

Masa başında oturan müşteri, masada bulunan QR kodu okutarak `/order/:tableId` yoluna gelir. `GET /api/public/tables/:tableId/menu` uç noktası, abonelik aktifse menü ve aktif siparişi döndürür. Müşteri sepete ürün ekleyip `POST /api/public/tables/:tableId/orders` ile siparişini oluşturur. Aynı uç, garson tarafından `POST /api/waiter/orders` ile de çağrılabilir; bu durumda `source: "WAITER"` olarak işaretlenir.

Sipariş `PENDING` durumunda mutfağa düşer. Mutfak personeli `PATCH /api/kitchen/orders/:orderId/status` ile siparişi `ACCEPTED` ve ardından `PREPARING` durumuna geçirir. `PREPARING` geçişinde `consumeInventoryForOrder` fonksiyonu, reçete bileşenlerini doğrular ve stoktan otomatik düşer; `inventoryConsumedAt` zaman damgası işaretlenir. Sipariş hazırlandığında `READY` olur ve `KitchenOrder.status` `DONE`'a geçer.

Garson `READY` siparişini `SERVED`'e çevirir; kasiyer `GET /api/payment/tables` ile masaları görür, `POST /api/payment/tables/:tableId/checkout` ile nakit veya kart ödemesi alır. Bu, `Payment` kaydı yaratır, ilgili siparişleri `COMPLETED + PAID` yapar ve `syncTableStatus` ile masa `AVAILABLE`'a döner.

### 14.4. Gel-Al (Pickup) Siparişi

Müşteri, kimliksiz olarak `<host>/<tenantSlug>/menu` sayfasına gelir. `GET /api/public/tenants/:slug/menu` ürünleri verir; `POST /api/public/tenants/:slug/orders` `orderType: "PICKUP"` ile siparişi yaratır ve `publicId` ile takip bağlantısı sağlar. Gerisi, masa siparişiyle benzer mutfak akışını izler.

### 14.5. Çevrimiçi Paket Siparişi (Delivery)

Müşteri `/online-order`'a gelir. `OnlineOrderPage`, tarayıcı konum izni ister; `getCurrentBrowserLocation` ile koordinatlar alınır ve `GET /api/online/restaurants?lat=&lng=&...` çağrılır. Sunucu tarafında her restoran için Haversine mesafesi hesaplanır, teslimat yarıçapına göre `inDeliveryZone` bayrağı belirlenir, açılış saatlerine göre `isCurrentlyOpen` hesaplanır ve sıralama (`nearest`, `fastest`, `minimum_order`, `delivery_fee`, `rating`) uygulanır.

Müşteri restoranı seçer; `OnlineRestaurantPage` üzerinden menüyü görür; ürünleri `localStorage` üzerindeki sepete (`onlineCart.js`) ekler. Sepet, çapraz sekme `online-order-cart-updated` ve `storage` olaylarıyla senkron olur. Sepet sayfasında müşteri kaydolur veya giriş yapar, kayıtlı bir adres seçer veya manuel olarak harita üzerinden konum işaretler (`LocationPickerMap`). `POST /api/online/orders` ile sipariş oluşturulur. Sunucu, ürün fiyatlarını DB'den yeniden hesaplar (istemciye güvenmeden), minimum sepet ve teslimat yarıçapını yeniden doğrular, teslimat ücretini `baseDeliveryFee + distance * feePerKm` formülüyle hesaplar ve ücretsiz teslimat eşiğini uygular.

Ödeme yöntemi `ONLINE` ise sipariş `PENDING_PAYMENT` durumunda yaratılır; istemci `POST /api/payments/iyzico/checkout` ile ödeme formunu başlatır. Sunucu, `OrderPayment` kaydı oluşturur, Iyzico'dan dönen `paymentPageUrl` veya `checkoutFormContent` istemciye iletilir; müşteri kart bilgilerini girer, Iyzico geri çağırma yapar (`POST /api/payments/iyzico/callback`), `OrderPayment` ve `Order.paymentStatus` güncellenir, müşteri `/payment/result` sayfasına yönlendirilir.

Ödeme yöntemi `CASH` veya `CARD_ON_DELIVERY` ise sipariş doğrudan `PENDING` durumunda yaratılır ve mutfağa düşer.

### 14.6. Kurye Yaşam Döngüsü

Bir kurye `/courier/signup` üzerinden ad, e-posta, parola ve belge dosyası ile başvurur. Süper yönetici, `AdminPage`'de durum filtresi `PENDING` olan başvuruları görür; belgeyi inceler ve `PATCH /api/admin/courier-accounts/:id/approve` veya `.../reject` ile sonuç verir. `APPROVED` olduğunda kurye `/courier/login`'den giriş yapar.

Kurye uygulamayı açtığında `useCourierLiveLocation` kancası, `navigator.geolocation` ile sürekli `POST /api/courier/location` gönderir. Konum 10 dakikadan eskiyse `GET /api/courier/offers`, "locationRequired: true" döndürür ve teklif listesi boş kalır. Konum güncelse, `READY` durumundaki ve atanmamış DELIVERY siparişleri arasından kuryeye ait yarıçap (`min(55, max(18, deliveryRadiusKm + 6))`) içinde olanlar listelenir. Kurye `POST /api/courier/offers/:orderId/accept` çağrısıyla siparişi atomik olarak üzerine alır. Ardından kendi kuyruğundaki siparişleri (`READY/SERVED`) `PATCH /api/courier/orders/:orderId/status` ile `SERVED` ve `COMPLETED`'e ilerletir; bu uçlar `pos.service.js`'in tek `updateOrderStatus` fonksiyonunu çağırır.

### 14.7. Süper Yönetici Denetimi

Süper yönetici, kullanıcılar ve restoranlar üzerinden platformu izler, plan fiyatlarını günceller (`PATCH /api/admin/plans/:planId`) ve kurye başvurularını onaylayarak ekosistemin genişlemesini denetler.

## 15. Projenin Özellikleri

CROT, kapsamı genişlettikçe gelişmiş bazı önemli özellikler kazanmıştır. Aşağıda en belirgin teknik ve işlevsel yetenekler listelenmiştir.

- **Çok kiracılı SaaS modeli:** Tek kod tabanı, tek veritabanı, kiracı ayrımı `restaurantId` üzerinden ve aktif abonelik kontrolüyle.
- **Plan bazlı abonelik:** STARTER, GROWTH, PREMIUM planları; süper yönetici plan fiyatlarını dinamik düzenler.
- **Çoklu kanal sipariş:** DINE_IN (QR + garson), PICKUP (tenant slug ile gel-al), DELIVERY (online pazaryeri).
- **Konum farkındalığı:** Haversine mesafesi, teslimat yarıçapı, ücretsiz teslimat eşiği, dinamik teslimat ücreti, açılış saatleri (gece yarısı geçişlerini de kapsayan).
- **Reçete tabanlı stok düşümü:** `ORDER_CONSUMPTION` hareketi, stok defteri ve canlı snapshot ile tutarlı.
- **Tedarikçi ve satın alma süreçleri:** `PurchaseOrder` ve `PurchaseOrderItem`, alındı sonrası stoğu artıran kayıtlar.
- **Mutfak ekran sistemi (KDS):** Üç sütunlu pano, polling, gecikme uyarıları, masa/pickup/delivery filtreleri, mutfak menü ekleme/düzenleme.
- **Garson masa panosu:** Masaların durum bazlı renklendirilmesi, "READY", "PREPARING", "OCCUPIED", "AVAILABLE" görsel ipuçları, "garson gördü" işaretlemesi.
- **Kasiyer ödeme akışı:** Tek tıkla nakit/kart tahsili, fiş kodu üretimi, masa durumunun otomatik güncellenmesi.
- **Çevrimiçi müşteri portalı:** Kayıt, giriş, adres defteri, harita üzerinden konum seçimi (`react-leaflet`), TR para birimi biçimleme, sepet kalıcılığı.
- **Iyzico ödeme entegrasyonu:** IYZWSv2 imzalı checkout form akışı, ham yanıt JSON'unun saklanması, geri çağırma yönetimi, sonuç sayfası.
- **Kurye portalı ve canlı izleme:** Belge yüklemeli kayıt, süper yönetici onayı, canlı konum yayını (`watchPosition` + 35 saniyelik düzenli yenileme), yakındaki teklifler, atomik sipariş kabul.
- **Çoklu dil desteği:** Türkçe, İngilizce, Arapça (Arapça için RTL); kullanıcı seçiminin `localStorage` üzerinden kalıcı tutulması.
- **Modern arayüz tasarımı:** Tailwind CSS ile soft yeşil marka teması, gölge sistemleri, rüstik gradyanlar, erişilebilir bileşen kütüphanesi.
- **Hata sınıfları ve tutarlı yanıtlar:** Servis katmanı kendi `Error` sınıflarını fırlatır, router'lar `handleServiceError` ile HTTP'ye çevirir.
- **Docker ile tek komutla kurulum:** `docker compose up --build` ile DB, API ve Web ayağa kalkar; otomatik şema basma ve seed çalışır.
- **Tohum verisi:** Beş örnek restoranın gerçekçi İstanbul koordinatları, kategorileri, ürünleri, açılış saatleri ile yaratılması, demo kullanımı kolaylaştırır.
- **Genişletilebilir mimari:** Servis ve modül ayrımı sayesinde ödeme sağlayıcı, harita servisi veya bildirim kanalı ek modüller olarak değiştirilebilir.

## 16. Gerçek Hayat Senaryoları

CROT, tek bir uçtan-uca platform olduğundan birden çok gerçek hayat kullanım vakası için doğrudan uygundur. Aşağıdaki senaryolar, sistemin mevcut özellikleri üzerinden somut işletme bağlamlarına uyarlanmıştır.

**Senaryo 1 — Bağımsız bir kafenin dijitalleşmesi.** Beş masalı, sahibinin aynı zamanda kasiyer olduğu bir kafe; CROT'a sahibi olarak kayıt olur, STARTER planını seçer ve kendisini hem `OWNER` hem de günlük çalışan olarak konumlandırır. Tek bir kişi tarafından yönetilse bile menü, masalar ve QR kodları sayesinde müşteriler garson çağırmadan sipariş verebilir; QR ile gelen siparişler doğrudan mutfağa düşer; sahibi gün sonunda kasiyer panelinden tahsilatı tamamlar.

**Senaryo 2 — Çok şubeli bir restoran zinciri için pilot.** Aynı marka altında üç farklı şube, her biri ayrı bir kiracı olarak CROT'a katılır. Her şube kendi menüsünü, çalışanlarını, stoğunu ve teslimat alanını yönetir; süper yönetici merkez tarafından planları izler ve kurye başvurularını yönetir. Şubeler birbirinden bağımsız olduğu için bir şubedeki sipariş diğerinin verilerini etkilemez.

**Senaryo 3 — Mahalle bazlı paket servis ağı.** Online sipariş modülü, müşterinin tarayıcı konumunu kullanarak yakındaki açık restoranları sıralar. Müşteri restoranı seçer, sepetine ürünler ekler, kayıtlı adresini veya harita üzerinden işaretlediği konumu seçer; sistem teslimat yarıçapı dışında ise siparişi reddeder. Kurye uygulaması üzerinden onaylı kuryeler bölgedeki "READY" siparişleri görür ve atomik kabul ile alır; canlı haritada restoran, teslimat noktası ve kurye konumu eş zamanlı gösterilir.

**Senaryo 4 — Stok kontrolü ile maliyet yönetimi.** Bir bistro, malzeme bazlı maliyet kontrolü yapmak ister. Stok yöneticisi malzemeleri ve minimum stok seviyelerini girer; mutfak veya sahibi her menü öğesi için reçete oluşturur. Bir burger siparişi `PREPARING`'e geçtiğinde reçeteye göre brioche ekmek, dana köftesi, salata, sos otomatik olarak stoktan düşer; kritik seviye altına düşen malzemeler için düşük stok uyarıları üretilir; tedarikçiden satın alma siparişi açılır, "alındı" olarak işaretlenince stok yeniden artar.

**Senaryo 5 — Yoğun saatte mutfak optimizasyonu.** Cuma akşamı yoğunluğunda mutfak ekranı, gecikme renklendirmeleriyle hangi siparişin SLA dışına çıktığını gösterir. Mutfak yöneticisi yalnızca bir tıkla siparişi "ACCEPTED" veya "PREPARING"'e alır; reçete bileşenleri arasında yetersiz stoklu bir malzeme varsa sistem geçişi engeller ve bunu mutfağa bildirir; mutfak personeli `IngredientRequest` üzerinden stok yöneticisinden acil malzeme ister.

**Senaryo 6 — Çoklu dilli turistik bölge.** Türkçe konuşan personel arka planda çalışırken müşteri tarafı arayüz, müşterinin tarayıcı diline göre Türkçe, İngilizce veya Arapça (RTL) sunulur. Bu, turistik bölgelerde yabancı müşterilerin menüyü kendi dilinde okumasını sağlar.

**Senaryo 7 — Üniversite kampüsü içinde gel-al.** Kafe, sadece kampüse gel-al hizmeti verir. Sahip `pickupEnabled = true`, `deliveryEnabled = false` yapar; müşteriler kampüs içinde QR menüden veya tenant slug'ı üzerinden siparişlerini hazırlatır ve kasaya gelip alır.

## 17. Karşılaşılan Problemler ve Çözümler

Projenin geliştirme sürecinde, kod tabanından çıkarılabilen birçok teknik problem ve bunlara karşı geliştirilmiş çözüm yaklaşımı vardır.

**Problem 1 — Aynı sipariş tablosunun çoklu kanallar için kullanılması.** Masa, gel-al ve teslimat siparişleri farklı veri ihtiyaçlarına sahiptir. Çözüm olarak `Order` tablosu, `orderType` ve `source` alanlarıyla zenginleştirilmiş, masaya özgü `tableId`, teslimata özgü `deliveryAddressText`, `deliveryLatitude`, `deliveryLongitude`, `assignedCourierAccountId`, gel-al için `pickupTime` ve müşteri tarafı için `customerId` alanları eklenmiştir. Bu sayede tek bir akış üzerinde çoklu kanal desteklenirken her kanalın kendine özgü meta verisi de korunur.

**Problem 2 — Sipariş geçmişinin ürün değişikliklerinden etkilenmemesi.** Bir ürünün adı veya fiyatı sonradan değişirse geçmiş siparişlerin bütünlüğü bozulur. Çözüm: `OrderItem.nameSnapshot`, `productNameSnapshot`, `priceCents`, `unitPriceSnapshot` alanları sipariş anındaki anlık görüntüyü saklar.

**Problem 3 — Para birimi hassasiyeti.** Float ile çalışmak finansal yuvarlama sorunlarına yol açar. Çözüm: tüm para hesapları `*Cents` (tam sayı) alanlarında yürütülür; karşılaştırma ve toplama integer aritmetiğiyle yapılır. `Float` muadilleri yalnızca dış tüketim için sağlanır.

**Problem 4 — Reçete bileşenlerinin yarış koşullarına karşı korunması.** İki sipariş aynı anda PREPARING'e geçerse stok eksiye düşebilir. Çözüm: kritik bölümler `Prisma.TransactionIsolationLevel.Serializable` izolasyonunda işlemler içinde çalışır; reçete kontrolü ve stok düşümü tek bir tutarlı okuma-yazma penceresinde gerçekleşir.

**Problem 5 — Bir teslimatın iki kuryeye atanma riski.** Çözüm: `acceptOrder` fonksiyonu `updateMany({ where: { ..., assignedCourierAccountId: null } })` ile kayıt başına optimistik kilit uygular. `updated.count !== 1` durumu açıkça algılanır ve 409 hatası ile yarış kaybeden kuryeye bildirilir.

**Problem 6 — İstemcinin sepet fiyatlarına müdahale edebilmesi.** Sunucu, sipariş yaratırken istemciden gelen fiyatı yok sayar; ürünleri DB'den çeker, fiyatları `priceCents` üzerinden yeniden hesaplar, minimum sepet ve teslimat yarıçapını yeniden doğrular. Bu, sahteciliği etkili biçimde önler.

**Problem 7 — Açılış saatlerinin gece yarısını aşması.** Bazı restoranlar 18:00-02:00 arasında çalışır. Çözüm: `restaurantHours.js` içinde `hasOvernightTail` yardımcısı, "kapanış < açılış" durumunu tespit eder ve önceki günün vardiyasının taşma kuyruğunu bugüne sayar.

**Problem 8 — Çoklu dil ve RTL desteği.** Çözüm: i18next + `applyDocumentLanguage` ile `<html dir>` özniteliği dile göre güncellenir; çevirilen tüm UI metinleri tek bir `common.json` namespace'inde toplanır; özel `crotAppLanguage` algılayıcı kullanıcı tercihini `localStorage`'da kalıcı kılar.

**Problem 9 — Üç farklı kullanıcı kimliğinin (sistem, müşteri, kurye) karışması.** Çözüm: jeton türleri (`SYSTEM_USER`, `CUSTOMER`, `COURIER`) açıkça etiketlenir; `authenticateCourier` ara katmanı `tokenType !== "COURIER"` durumunda 401 üretir. İstemci tarafında üç ayrı `localStorage` anahtarı (`crot_session`, `crot_online_customer_session`, kurye oturumu) kullanılır; bu sayede bir tarafın oturumu diğeriyle karışmaz.

**Problem 10 — Restoranın aboneliği iptal olmuşken siparişlerin alınmaya devam etmesi.** Çözüm: `validatePublicRestaurant`, kamuya açık menü ve sipariş uçlarında `subscription.status !== "ACTIVE"` durumunda 403 döndürür. Sahibin yönetim uçları da `requireActiveSubscription` ile korunur.

**Problem 11 — Kuryenin eski konuma dayanarak sipariş kabul etmesi.** Çözüm: `isLocationFresh`, en son konum güncellemesinin 10 dakikadan eski olmamasını şart koşar; aksi takdirde `locationRequired: true` ile teklif sıfırlanır ve kabul edilemez.

**Problem 12 — POS menüsü ile online menünün aynı veriyle çelişmesi.** Çözüm: iki ayrı model (`MenuItem` POS için, `Product`+`Category` online için) tutulmuş; her ikisi de `Restaurant`'a bağlanmış ancak farklı alanlar taşıyacak şekilde özelleştirilmiştir. Ortak akışlarda `OrderItem.menuItemId` ya da `productId` alternatifli olarak kullanılır.

## 18. Gelecekte Yapılabilecek Geliştirmeler

CROT, MVP olgunluğundadır; üretim ölçeğinde işletilecek bir SaaS olarak aşağıdaki geliştirmeler dikkat çekmektedir.

- **Yenileme jetonları ve oturum iptali:** Şu an JWT 7 gün geçerlidir ve devre dışı bırakılamaz. Yenileme jetonu modeli, kara liste/çıkış (logout-everywhere) yetenekleri ve cihaz bazlı oturum yönetimi eklenmelidir.
- **HTTPS ve güvenlik başlıkları:** Üretim için TLS, HSTS, CSP, X-Frame-Options gibi başlıklar bir ters yönlü vekil sunucu (Nginx/Caddy) üzerinden uygulanmalıdır.
- **Denetim kayıtları (audit log):** Plan değişiklikleri, kurye onay/red kararları, çalışan rol değişiklikleri ve büyük tutarlı sipariş güncellemeleri ayrı bir denetim modeline yazılmalıdır.
- **Gerçek zamanlı bildirim:** Mutfak panosu şu an 10 saniyelik anketleme ile çalışır. WebSocket veya Server-Sent Events ile yeni siparişlerin anlık akıtılması, kuryelere yeni tekliflerin push edilmesi ve müşteriye sipariş durum değişikliklerinin tarayıcı bildirimi olarak iletilmesi mümkündür.
- **Nesne depolaması:** Kurye belgeleri ve restoran logoları yerel diske yazılıyor; üretim için S3 uyumlu bir nesne depolaması ve CDN entegrasyonu gerekir.
- **Daha güçlü ödeme entegrasyonu:** Iyzico'nun yanı sıra Stripe, PayTR gibi alternatif sağlayıcılar; ödeme iadesi (refund), kısmi iade ve kart kayıtlama akışları desteklenebilir.
- **Sıralama ve ücretlendirme algoritmaları:** Kurye eşleştirme şu an mesafeye dayalı ve manueldir; teslimat süresine, kuryenin geçmiş başarısına, sipariş yoğunluğuna göre dinamik ücret ve otomatik atama eklenebilir.
- **Bildirim kanalları:** SMS (sipariş hazırlandı, kurye yola çıktı), e-posta ve push bildirimleri için bir bildirim modülü.
- **Analitik panosu:** Sahip için satış, en çok satan ürün, ortalama hazırlık süresi, kanal bazlı dağılım, müşteri yaşam değeri (CLV) gibi raporlar.
- **API hız sınırlaması (rate limiting):** Özellikle giriş ve kurye konum uçlarına IP bazlı sınırlama.
- **Test altyapısı:** Birim ve entegrasyon testleri (Jest, Vitest, Playwright); Prisma test veritabanı.
- **Mobil uygulama:** Kurye ve müşteri arayüzleri, React Native ile yerel uygulamaya dönüştürülerek arka plan konum izleme ve push bildirimi yetenekleri kazandırılabilir.
- **Gerçek harita yönlendirme servisi:** Mevcut harita yalnızca düz çizgi (`Polyline`) gösterir; OpenRouteService veya Mapbox Directions API ile gerçek yol rotası ve tahmini varış süresi (ETA) hesaplanabilir.
- **Çoklu plan özellik kapısı (feature gate):** Plan kodlarına göre özellik açma/kapama; örneğin online sipariş yalnızca PREMIUM planında veya çalışan limiti plana göre değişir.
- **Veritabanı bölümlendirme:** Çok kiracılı tek veritabanı yerine ileride kiracı başına şema veya sharding stratejileri.

## 19. Sonuç

CROT, restoran ve kafelerin günlük operasyonunu uçtan uca dijitalleştirebilen, çok kiracılı, çok kanallı ve çok rollü bir SaaS platformunun gerçek bir uygulamasıdır. Proje; React + Tailwind ile modern bir kullanıcı arayüzü, Express + Prisma + PostgreSQL ile sağlam bir sunucu mimarisi, Docker ile güvenilir bir dağıtım kapsülü ve Iyzico ile gerçek bir ödeme entegrasyonu sunar. Veri modelinin zenginliği — özellikle sipariş, mutfak emri, ödeme, reçete, stok hareketi ve kurye ilişkileri — sistemin yalnızca bir POS değil, aynı zamanda bir mutfak yönetim sistemi (KMS), bir mutfak ekran sistemi (KDS), bir teslimat platformu ve bir stok ERP'si olduğunu gösterir. Çok kiracılı tasarım, plan tabanlı abonelik, rol bazlı yetkilendirme ve durumsuz JWT'ler sayesinde sistem yatay olarak ölçeklenmeye uygundur. Konum tabanlı arama, açılış saatleriyle dinamik açıklık hesaplama, reçete ile otomatik stok düşümü ve atomik kurye eşleştirme gibi mekanizmalar, üretim seviyesindeki bir yazılımın kritik teknik kararlarını barındırır.

MVP olarak değerlendirildiğinde CROT, geliştirmeye değer bir omurga sunar. Yenileme jetonları, gerçek zamanlı bildirim, denetim günlüğü, gelişmiş ödeme akışları, nesne depolaması ve mobil uygulamalar gibi geliştirmeler, projeyi olgun bir ürüne dönüştürecek doğal yol haritasını oluşturur. Bu rapor; sistemin mevcut yetenekleri ile sınırlarını net bir şekilde belgeleyerek hem akademik bir analiz hem de ileri sürüm planlaması için referans niteliği taşır.

## 20. Kaynakça

Bu rapor, doğrudan proje kaynak kodunun incelenmesi temelinde hazırlanmıştır. Aşağıdaki dosya ve dış teknolojiler temel referans alınmıştır.

**Proje içi referanslar:**

- `README.md` — Proje açıklaması, çalıştırma adımları, uç listesi, çevrimiçi sipariş notları.
- `docker-compose.yml` — Üç servisli (db, api, web) konteyner yapılandırması ve ortam değişkenleri.
- `api/package.json`, `web/package.json` — Bağımlılıklar ve betikler.
- `api/prisma/schema.prisma` — Tam veri modeli ve enum tanımları.
- `api/prisma/seed.js` — Tohum verisi (planlar, süper yönetici, örnek çevrimiçi restoranlar).
- `api/src/server.js`, `api/src/config.js`, `api/src/db.js` — Sunucu girişi, yapılandırma, Prisma istemcisi.
- `api/src/middleware/auth.js`, `api/src/middleware/subscription.js` — Kimlik doğrulama, rol kontrolü, abonelik koruması.
- `api/src/routes/{auth, customerAuth, courierAuth, admin, owner, ownerOnline, kitchen, waiter, payment, inventory, restaurant, public, publicOnlineOrder, online, me, customerOrders, courier, plans}.js` — Tüm uç tanımları.
- `api/src/services/{pos.service.js, inventory.js, kitchen.service.js, stock.service.js}` — İş kuralları.
- `api/src/modules/courier-dispatch/dispatch.service.js`, `api/src/modules/payments/{iyzico.routes.js, iyzico.service.js, payment.service.js}` — Kurye eşleştirme ve Iyzico ödeme entegrasyonu.
- `api/src/utils/{token.js, password.js, orders.js, menu.js, tables.js, employees.js, geo.js, restaurantHours.js, onlineOrder.js, slugs.js}` — Yardımcı modüller.
- `web/src/main.jsx`, `web/src/App.jsx` — Uygulama girişi ve yönlendirme.
- `web/src/api.js`, `web/src/auth.js`, `web/src/onlineAuth.js`, `web/src/courierPortalAuth.js` — Sunucu istemcisi ve oturum yönetimi.
- `web/src/components/app/AppShell.jsx`, `web/src/components/app/LocationPickerMap.jsx`, `web/src/components/app/LanguageSwitcher.jsx` — UI ilkelleri ve ortak bileşenler.
- `web/src/components/{kitchen, online}/*` — Alanına özgü bileşenler.
- `web/src/modules/{courier, online-food}/*` — Kurye canlı haritası, konum kancası ve eski online sipariş modülü.
- `web/src/pages/*` — Tüm kullanıcı yolculukları için sayfalar.
- `web/src/utils/{currency, i18n, locale, images, onlineCart, onlineLocation}.js` — Yardımcı modüller.
- `web/src/locales/{tr, en, ar}/common.json` — Çoklu dil çeviri kaynakları.

**Dış teknolojiler ve standartlar:**

- Node.js (https://nodejs.org)
- Express (https://expressjs.com)
- Prisma ORM (https://www.prisma.io)
- PostgreSQL (https://www.postgresql.org)
- React (https://react.dev)
- React Router (https://reactrouter.com)
- Vite (https://vite.dev)
- Tailwind CSS (https://tailwindcss.com)
- React-Leaflet (https://react-leaflet.js.org) ve Leaflet (https://leafletjs.com)
- OpenStreetMap (https://www.openstreetmap.org)
- i18next (https://www.i18next.com)
- jsonwebtoken (https://github.com/auth0/node-jsonwebtoken)
- bcryptjs (https://github.com/dcodeIO/bcrypt.js)
- Multer (https://github.com/expressjs/multer)
- Iyzico Sandbox API (https://www.iyzico.com)
- Docker ve Docker Compose (https://www.docker.com)
- Haversine Formülü (büyük çember mesafesi) — coğrafi mesafe hesaplaması için klasik referans.
- JSON Web Token RFC 7519 — Durumsuz kimlik doğrulama standardı.
