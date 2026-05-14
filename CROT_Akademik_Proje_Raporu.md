# KAPAK

**Proje Adı:** CROT — Restoran ve Kafe İşletmeleri için Çok Kiracılı SaaS Platformu (POS, Çevrimiçi Sipariş, Kurye ve Stok)

**Hazırlayan:** [Hazırlayan]

**Üniversite:** [Üniversite]

**Bölüm:** [Bölüm]

**Ders Adı:** [Ders adı]

**Öğretim Görevlisi:** [Öğretim görevlisi]

**Tarih:** [Tarih]

---

[PLACEHOLDER_KAPAK_GORSELI]

*Şekil Açıklaması:* Kapak görseli için kurumsal logo, proje adı ve akademik kurum bilgisinin yer aldığı tek sayfalık tasarım önerilir.

---

\newpage

# ÖZET

CROT projesi, restoran ve kafe işletmelerinin masa içi sipariş, mutfak takibi, kasa tahsilatı, stok ve reçete yönetimi, QR tabanlı müşteri siparişi, gel-al (pickup), konum tabanlı çevrimiçi paket sipariş, Iyzico ile çevrimiçi kart ödemesi ve kurye eşleştirme süreçlerini tek bir yazılım katmanında birleştiren çok kiracılı bir SaaS mimarisidir. İstemci tarafında React 18 ve Vite 6 ile geliştirilen tek sayfa uygulaması, Tailwind CSS ile biçimlendirilmiş; sunucu tarafında Node.js üzerinde Express 4 ile REST API sunulmuş; kalıcı veri PostgreSQL 16 üzerinde Prisma ORM ile modellenmiştir. Kimlik doğrulama, sistem kullanıcıları, çevrimiçi müşteriler ve kuryeler için ayrıştırılmış JWT akışlarıyla yürütülür. Bu rapor, proje kaynak kodunun doğrudan incelenmesiyle hazırlanmış olup; sistem yapısı, modüller, güvenlik ve gerçek hayat kullanım senaryolarını akademik bir çerçevede ele alır. Diyagram, ekran görüntüsü ve kod örnekleri için rapor gövdesinde açıkça işaretlenmiş placeholder alanları bırakılmıştır.

---

# ABSTRACT

CROT is a multi-tenant SaaS platform for restaurants and cafés that unifies dine-in ordering (including QR flows), kitchen operations, cashier checkout, inventory and recipe-driven stock consumption, pickup ordering, location-aware online delivery ordering, Iyzico-hosted online card payments, and courier discovery with live geolocation updates. The frontend is a React 18 single-page application built with Vite 6, styled with Tailwind CSS, internationalized with i18next (Turkish, English, Arabic with RTL), and augmented with Leaflet maps via react-leaflet. The backend exposes a modular REST API implemented with Express 4 on Node.js, persists data in PostgreSQL through Prisma ORM, and separates concerns into route modules, dedicated service layers (`pos.service.js`, `inventory.js`, `kitchen.service.js`, `stock.service.js`), and cross-cutting modules such as courier dispatch and Iyzico payment orchestration. Authentication relies on stateless JSON Web Tokens with distinct payloads for system users, customers, and couriers, complemented by role checks at middleware level and fine-grained order-state transitions per operational role. This document summarizes the architecture grounded exclusively in the repository’s actual structure and dependencies; illustrative figures and screenshots are deferred to tagged placeholders for inclusion in the final Word or PDF deliverable.

---

# İÇİNDEKİLER

1. GİRİŞ  
2. PROJE ANALİZİ  
   2.1 Genel Sistem Yapısı  
   2.2 Kullanılan Teknolojiler  
   2.3 Sistem Mimarisi  
   *Ön analiz özeti (kod tabanından çıkarılan 13 başlık)*  
3. BACKEND GELİŞTİRME SÜRECİ  
   3.1 Express Yapısı  
   3.2 Route Sistemi  
   3.3 Middleware Yapısı  
   3.4 Authentication ve Authorization  
   3.5 Veritabanı Yapısı  
   3.6 API Yapısı  
4. FRONTEND GELİŞTİRME SÜRECİ  
   4.1 React Yapısı  
   4.2 Sayfa Yapısı  
   4.3 UI/UX Tasarımı  
   4.4 Çoklu Dil Desteği  
5. SİSTEM MODÜLLERİ  
   5.1 Masa Sipariş Sistemi  
   5.2 Online Sipariş Sistemi  
   5.3 Kurye Sistemi  
   5.4 Ödeme Sistemi  
   5.5 Stok Yönetimi  
6. GÜVENLİK ANALİZİ  
7. GERÇEK HAYAT SENARYOLARI  
8. KARŞILAŞILAN PROBLEMLER VE ÇÖZÜMLER  
9. GELECEKTE YAPILABİLECEK GELİŞTİRMELER  
10. SONUÇ  
KAYNAKÇA  

*(Word veya LibreOffice’te “İçindekiler” alanı otomatik oluşturulabilir; bu liste raporun yapısal iskeletini gösterir.)*

---

\newpage

# 1. GİRİŞ

## 1.1 Projenin Amacı

CROT’un temel amacı, restoran ve kafe işletmelerinin günlük operasyonlarını tek bir dijital platform üzerinden yönetebilmelerini sağlamaktır. Bu amaç, klasik POS yazılımlarının genellikle odaklandığı ödeme ve masa yönetiminin ötesine geçerek; mutfak kuyruğu, çalışan rolleri, stok defteri, reçete bağlantısı, kamuya açık sipariş kanalları (QR ve gel-al), çevrimiçi paket sipariş ve kurye atanması gibi süreçleri aynı veri modeli üzerinde birleştirmeyi hedefler. Kod tabanında bu birleşik yaklaşım, `Order` modelinin `orderType` (DINE_IN, PICKUP, DELIVERY), `source` (WAITER, QR, PICKUP, ONLINE vb.) ve geniş bir `OrderStatus` durum makinesi ile ifade edilir.

## 1.2 Problemin Tanımı

Geleneksel olarak restoranlar; masa siparişi, mutfak ekranı, kasa, stok ve çevrimiçi sipariş platformları için farklı araçlar kullanmaktadır. Bu parçalanmış yapı, veri tutarsızlığına, çift veri girişine, raporlama zorluğuna ve entegrasyon maliyetlerine yol açar. Ayrıca küçük işletmeler, kurumsal ERP çözümlerinin karmaşıklığı ve maliyeti nedeniyle dijital dönüşümü yarım bırakabilmektedir. CROT, tek kod tabanı ve tek veritabanı şeması ile çok kiracılı bir SaaS sunarak bu problemi “tek panel, çok modül” yaklaşımıyla ele alır; her restoran `Restaurant` kaydı ve ilişkili `restaurantId` alanlarıyla mantıksal olarak izole edilir.

## 1.3 Neden Geliştirildiği

Proje, özellikle çok şubeli olmayan veya orta ölçekli işletmelerin hızlıca dijitalleşebileceği bir MVP (Minimum Viable Product) çerçevesinde kurgulanmıştır. `README.md` dosyasında yer alan kullanıcı akışı ve Docker Compose ile tek komutta ayağa kalkabilen yapı, ürünün hem geliştirici hem işletme tarafında deneme ve gösterim kolaylığı sağlaması amacıyla tasarlanmıştır. Çevrimiçi sipariş ve Iyzico entegrasyonu ile platform, yalnızca işletme içi değil müşteri yüzüne dönük gelir kanallarını da kapsayacak şekilde genişletilmiştir.

---

\newpage

# 2. PROJE ANALİZİ

Bu bölüm öncesinde kod tabanı sistematik olarak taranmıştır. Özet bulgular:

1. **Proje yapısı:** Monorepo; kökte `api/` (Express + Prisma), `web/` (React + Vite), `docker-compose.yml`.  
2. **Teknolojiler:** `api/package.json` ve `web/package.json` bağımlılıklarından çıkarılmıştır (Bölüm 2.2 ve [TABLO_TEKNOLOJILER]).  
3. **Backend mimarisi:** `api/src/server.js` merkezi router montajı; `routes/` HTTP uçları; `services/` iş kuralları; `modules/` ödeme ve kurye alt sistemleri; **ayrı bir `controllers/` klasörü projede yoktur** — işlev route dosyalarında ve servislerde birleştirilmiştir.  
4. **Frontend mimarisi:** `web/src/App.jsx` yönlendirme; `pages/` ekranlar; `components/` ve `modules/` yeniden kullanılabilir parçalar; `utils/` yardımcılar.  
5. **Authentication:** `middleware/auth.js`, `utils/token.js`, şifre için `utils/password.js`.  
6. **Veritabanı:** `api/prisma/schema.prisma` içinde 27 model ve çok sayıda enum.  
7. **API:** `/api/*` önekli REST uçları; “klasik” ve “success/data” yanıt biçimlerinin birlikte kullanımı gözlenir.  
8. **Roller:** Prisma `SystemRole` enum’u ve çalışanlar için `employeeRole` string alanı; müşteri ve kurye ayrı tablolarda.  
9. **Sipariş akışı:** `utils/orders.js` rol bazlı geçişler; `services/pos.service.js` sipariş oluşturma ve durum güncelleme; mutfakta `PREPARING` ile `inventory.consumeInventoryForOrder`.  
10. **Ödeme:** POS tarafında `Payment` ve masa checkout; çevrimiçi için `OrderPayment` ve `modules/payments/*` (Iyzico).  
11. **Online sipariş:** `routes/online.js`, `routes/me.js`, `routes/ownerOnline.js`; mesafe `utils/geo.js`, saatler `utils/restaurantHours.js`.  
12. **Kurye:** `routes/courierAuth.js`, `routes/courier.js`, `modules/courier-dispatch/dispatch.service.js`.  
13. **Stok:** `services/inventory.js`, `Ingredient`, `IngredientStock`, `StockMovement`, `Recipe`, satın alma modelleri.

## 2.1 Genel Sistem Yapısı

Sistem, klasik üç katmanlı istemci–sunucu–veritabanı düzenine uyar. Tarayıcıda çalışan React uygulaması, yapılandırılmış HTTP istekleriyle Express API’sine bağlanır; API Prisma üzerinden PostgreSQL ile konuşur. Docker Compose ile üç servis (PostgreSQL, API, Web) birlikte orkestre edilebilir.

[DIYAGRAM_SISTEM_MIMARISI]

*Şekil Açıklaması:* İstemci (React/Vite), API sunucusu (Express), veritabanı (PostgreSQL) ve harici servisler (Iyzico ödeme, OpenStreetMap kutucukları) arasındaki veri ve kontrol akışını gösteren üst seviye mimari diyagram buraya eklenecektir. İstemciden API’ye Authorization başlığı ile JWT iletimi, API’den Iyzico’ya HTTPS çağrısı ve geri yönlendirme okları işaretlenmelidir.

## 2.2 Kullanılan Teknolojiler

Aşağıdaki tablo, bağımlılık manifestolarından otomatik olarak çıkarılmış özet bilgiyi içermektedir. Word/PDF çıktısında tablo biçimlendirmesi için yer tutucu kullanılmıştır.

[TABLO_TEKNOLOJILER]

**Backend:** Node.js çalışma ortamı; Express ^4.21.2; Prisma ^6.4.1 ve @prisma/client ^6.4.1; bcryptjs ^2.4.3; jsonwebtoken ^9.0.2; cors ^2.8.5; dotenv ^16.4.5; multer ^2.1.1 (dosya yükleme); geliştirmede nodemon ^3.1.9.

**Frontend:** React ^18.3.1; react-dom ^18.3.1; react-router-dom ^6.28.2; Vite ^6.0.11; @vitejs/plugin-react ^4.3.4; Tailwind CSS ^3.4.17; PostCSS ^8.5.1; Autoprefixer ^10.4.20; Leaflet ^1.9.4; react-leaflet ^4.2.1; i18next ^26.0.8; i18next-browser-languagedetector ^8.2.1; react-i18next ^17.0.6.

**Database:** PostgreSQL (Docker imajı `postgres:16-alpine`); erişim Prisma ile.

**Authentication:** JWT (`jsonwebtoken`); parola özeti `bcryptjs`; Bearer şema ile `Authorization` başlığı.

**Deployment:** Docker Compose (`docker-compose.yml`); API için `db push`, `generate`, `seed`, `dev` zinciri; Web için Vite dev sunucusu.

**Payment:** Iyzico Sandbox REST API’sine doğrudan `fetch` ile çağrı (ör. `api/src/modules/payments/iyzico.service.js`); yapılandırma `config.js` içindeki `iyzico` nesnesi ve ortam değişkenleri (`IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL`).

**Maps:** Leaflet ve react-leaflet; harita kutucukları OpenStreetMap kaynak URL’si ile (`LocationPickerMap.jsx`, `CourierLiveMap.jsx`).

**Internationalization:** i18next; kaynak dosyalar `web/src/locales/tr`, `en`, `ar` altında `common.json`.

## 2.3 Sistem Mimarisi

**İstemci–sunucu yapısı:** React SPA, tek origin üzerinden dağıtılır ve `VITE_API_BASE_URL` ile API kök adresine bağlanır (`web/src/api.js`). İstekler çoğunlukla JSON gövdeli veya çok parçalı form verisi (kurye kaydı) ile yapılır.

**REST API yapısı:** Kaynaklar mantıksal router dosyalarına bölünmüştür (`auth`, `owner`, `kitchen`, `payment`, `online`, `courier`, vb.). `GET /health` kök düzeyinde sağlık kontrolü sunar; işlevsel uçlar `/api` altında gruplanır.

**Veri akışı:** İstemci doğrulanmış isteklerde JWT taşır; sunucu ara katmanlar ile payload’ı çözer ve Prisma sorgularını restoran veya kullanıcı bağlamına göre filtreler. Kritik işlemlerde (ör. stok düşümü, kurye kabulü) veritabanı işlemleri transaction içinde yürütülür.

**Modüler yapı:** İş kuralları `services/` ve `modules/` altında tekrar kullanılabilir fonksiyonlara ayrılmış; `utils/` ortak yardımcıları (sipariş durumları, menü uygunluğu, mesafe, çalışma saatleri) barındırır. Bu ayrım, route dosyalarının şişmesini azaltır ve test edilebilirliği artırır.

---

\newpage

# 3. BACKEND GELİŞTİRME SÜRECİ

## 3.1 Express Yapısı

Uygulama `api/src/server.js` dosyasında oluşturulur. Global ara katman olarak `cors` (origin: true, credentials: false) ve `express.json()` uygulanır. Router’lar sırayla monte edilir; tanımsız yollar için 404 JSON yanıtı, beklenmeyen hatalar için merkezi 500 işleyici tanımlanır. Graceful shutdown için `SIGINT` ve `SIGTERM` sinyallerinde Prisma bağlantısı kapatılır.

[KOD_ORNEGI_EXPRESS]

*Şekil/Kod Açıklaması:* Buraya `server.js` içinden router montaj listesi ve `app.listen` bloğunun Word’e yapıştırılmış halinin ekran görüntüsü veya kısaltılmış çıktısı eklenebilir.

## 3.2 Route Sistemi

`api/src/routes/` altında on dokuz route dosyası bulunmaktadır: `auth.js`, `plans.js`, `owner.js`, `admin.js`, `restaurant.js`, `kitchen.js`, `payment.js`, `waiter.js`, `inventory.js`, `public.js`, `publicOnlineOrder.js`, `customerAuth.js`, `customerOrders.js`, `online.js`, `me.js`, `ownerOnline.js`, `courier.js`, `courierAuth.js`, `employee.js`. Ödeme için ek olarak `api/src/modules/payments/iyzico.routes.js` kullanılır ve `server.js` içinde `/api/payments` altına bağlanır.

`server.js` montaj eşlemesi özetle şöyledir: `/api/auth`, `/api/plans`, `/api/owner` (hem klasik owner hem `ownerOnline` aynı önek altında ikinci bir `use` ile eklenir), `/api/admin`, `/api/kitchen`, `/api/cashier` ve `/api/payment` (aynı `paymentRoutes`), `/api/waiter`, `/api/inventory`, `/api/restaurant`, `/api/public` (iki router birlikte), `/api/customer/auth`, `/api/customer/orders`, `/api/online`, `/api/me`, `/api/courier-auth`, `/api/courier`, `/api/payments`.

[KOD_ORNEGI_ROUTES]

*Şekil/Kod Açıklaması:* Router import ve `app.use` satırlarının görsel özeti.

## 3.3 Middleware Yapısı

**Kimlik doğrulama:** `middleware/auth.js` dosyasında `authenticate` (JWT doğrulama ve `req.auth` doldurma), `requireRoles` (sistem rolü kontrolü), `authenticateCourier` (JWT’de `tokenType === "COURIER"` ve veritabanında `APPROVED` durumu kontrolü) tanımlıdır.

**Abonelik:** `middleware/subscription.js` içinde `requireActiveSubscription`, sahibin restoranı için `Subscription.status === "ACTIVE"` doğrular; aksi halde 403 ve `requiresPlanSelection` bayrağı döner.

[KOD_ORNEGI_MIDDLEWARE]

## 3.4 Authentication ve Authorization

**JWT sistemi:** `utils/token.js` üç imzalama fonksiyonu sunar: sistem kullanıcıları için `signUserToken` (`tokenType: "SYSTEM_USER"`, `userId`, `systemRole`, `restaurantId`), müşteriler için `signCustomerToken` (`tokenType: "CUSTOMER"`, `customerId`), kuryeler için `signCourierToken` (`tokenType: "COURIER"`, `courierAccountId`). Süre `expiresIn: "7d"` olarak ayarlanmıştır. Doğrulama `verifyToken` ile `JWT_SECRET` üzerinden yapılır.

**Roller:** Prisma şemasında `SystemRole` enum değerleri `SUPER_ADMIN`, `OWNER`, `EMPLOYEE` şeklindedir. Çalışan alt rolleri `User.employeeRole` string alanında tutulur ve kodda küçük harfe normalize edilir (ör. `chef`, `waiter`, `cashier`, `inventory_manager`). Admin route’ları `requireRoles("SUPER_ADMIN")`, owner route’ları `requireRoles("OWNER")`, çalışan modülleri önce `requireRoles("EMPLOYEE")` sonra fonksiyon içinde alt rol kontrolü ile sıkılaştırılır.

**Yetkilendirme:** Sipariş durum geçişleri `utils/orders.js` içindeki `ROLE_ORDER_TRANSITIONS` ve `getAllowedNextStatuses` ile kısıtlanır; böylece örneğin kasiyer ile mutfak aynı endpoint ailesini paylaşmasa da tutarlı bir durum makinesi korunur.

[KOD_ORNEGI_AUTH]

## 3.5 Veritabanı Yapısı

Prisma şeması PostgreSQL sağlayıcısını kullanır. Ana kiracı modeli `Restaurant` olup; kullanıcılar, masalar, menü (`MenuItem`), çevrimiçi kategori ve ürün (`Category`, `Product`), siparişler, mutfak emirleri, ödemeler, stok ve satın alma, abonelik ve kurye hesapları ile ilişkilidir.

[DIYAGRAM_VERITABANI]

*Şekil Açıklaması:* ER diyagramında Restaurant merkezde; Order hem DiningTable hem Customer ve CourierAccount’a opsiyonel bağlarla; Recipe–MenuItem–RecipeIngredient–Ingredient zinciri; StockMovement ve IngredientStock ile çift katmanlı stok temsili gösterilmelidir.

[KOD_ORNEGI_PRISMA]

**Prisma modelleri (şemada tanımlı):** Restaurant, RestaurantOpeningHour, Category, Product, User, CourierAccount, Customer, UserAddress, Plan, Subscription, DiningTable, MenuItem, Order, KitchenOrder, Ingredient, IngredientRequest, IngredientStock, Recipe, RecipeIngredient, StockMovement, Supplier, PurchaseOrder, PurchaseOrderItem, OrderItem, Payment, OrderPayment.

**İlişkiler:** Çoğu alt kayıt `restaurantId` ile Restoran’a bağlıdır ve silmede `Cascade` veya koruma için `Restrict`/`SetNull` politikaları kullanılır. Örnek: `Order.customerId` müşteriye `SetNull` ile bağlanabilir; `RecipeIngredient.ingredient` için `Restrict` ile silinen malzemenin reçetede kopması engellenir.

**Çok kiracılı yapı:** Tek veritabanında mantıksal izolasyon `restaurantId` ve sorgu filtreleri ile sağlanır; süper yönetici hariç kullanıcıların sorguları `req.auth.restaurantId` veya çalışanın kayıtlı restoranı ile sınırlandırılır.

## 3.6 API Yapısı

**REST endpointleri:** README ve route dosyalarından doğrulanan ana gruplar şunlardır: kimlik (`/api/auth`, `/api/customer/auth`, `/api/courier-auth`), planlar (`/api/plans`), süper yönetici (`/api/admin/*`), sahip (`/api/owner/*` — klasik ve çevrimiçi ayarlar için genişletilmiş), mutfak (`/api/kitchen/*`), garson (`/api/waiter/*`), kasiyer (`/api/payment/*` ve `/api/cashier/*`), stok (`/api/inventory/*`), ortak restoran sipariş görünümü (`/api/restaurant/*`), kamuya açık (`/api/public/*`), çevrimiçi pazar (`/api/online/*`), müşteri profili (`/api/me/*`), müşteri sipariş alternatifi (`/api/customer/orders`), kurye (`/api/courier/*`), ödemeler (`/api/payments/iyzico/*`).

**Response yapıları:** Erken modüller çoğunlukla düz JSON (`{ token, user }`, `{ message }`) kullanır. Çevrimiçi müşteri ve çevrimiçi sipariş modülünde `{ success: true, data: ... }` ve `{ success: false, message }` kalıbı yaygındır. Bu ikilik, istemci tarafında `api.js` içinde bazı fonksiyonların `payload.data` beklemesi şeklinde ele alınmıştır.

**Error handling:** Özel hata sınıfları (`PosServiceError`, `InventoryError`, `PaymentError`, `CourierDispatchError`) HTTP durum kodu ve isteğe bağlı `details` taşır; route içinde `handleServiceError` kalıbı ile yakalanır. Genel Express hata ara katmanı bilinmeyen hatalarda 500 ve sabit mesaj döner.

[KOD_ORNEGI_API]

---

\newpage

# 4. FRONTEND GELİŞTİRME SÜRECİ

## 4.1 React Yapısı

`main.jsx` uygulamayı `BrowserRouter` içinde `StrictMode` ile başlatır ve `./utils/i18n` yan etkisini yükleyerek çoklu dili etkinleştirir. `App.jsx` merkezi rota ağacını tanımlar; üç oturum kanalı için durum tutar: sistem kullanıcısı (`auth.js`), çevrimiçi müşteri (`onlineAuth.js`), kurye (`courierPortalAuth.js`). Korumalı rotalar `ProtectedRoute`, `ProtectedEmployeeRoute`, `ProtectedCourierRoute` bileşenleriyle uygulanır.

[EKRAN_GORUNTUSU_REACT]

*Şekil Açıklaması:* Proje dizin yapısının IDE görünümü veya `App.jsx` rota ağacının özeti.

## 4.2 Sayfa Yapısı

`web/src/pages/` altında yirmi üç sayfa bileşeni bulunur:

- **Dashboard / Operasyon:** `OwnerPage.jsx` — sahip için sekmeli panel (Overview, Staff, Tables, Menu, Inventory, Settings); `OwnerOnlineOrdersPage.jsx` — çevrimiçi sipariş yönetimi.  
- **Login / Kayıt:** `LoginPage.jsx`, `SignupPage.jsx`; çevrimiçi müşteri için `OnlineCustomerLoginPage.jsx`, `OnlineCustomerSignupPage.jsx`; kurye için `CourierLoginPage.jsx`, `CourierSignupPage.jsx`.  
- **Kitchen:** `KitchenPage.jsx` — mutfak panosu, menü ve envanter yardımcıları ile birlikte.  
- **Waiter:** `WaiterPage.jsx` — masa ve sipariş yönetimi.  
- **Cashier:** `CashierPage.jsx` — tahsilat ve masa özeti.  
- **Inventory:** `InventoryPage.jsx` — stok ve satın alma odaklı panel.  
- **Online Order:** `OnlineOrderPage.jsx`, `OnlineRestaurantPage.jsx`, `OnlineCartPage.jsx`, `MyOnlineOrdersPage.jsx`; ödeme için `PaymentStartPage.jsx`, `PaymentResultPage.jsx`.  
- **Courier:** `CourierPage.jsx`.  
- **Diğer:** `AdminPage.jsx`, `OrderPage.jsx` (QR masa), `PickupOrderPage.jsx`, `EmployeePage.jsx` (yönlendirme).

## 4.3 UI/UX Tasarımı

Arayüz Tailwind CSS yardımcı sınıflarıyla oluşturulmuş; `components/app/AppShell.jsx` dosyasında `buttonStyles`, `fieldStyles`, `MetricGrid`, `SectionCard`, `Drawer`, `SimpleTable` gibi tasarım sistemi ilkelleri tanımlanmıştır. Genel sayfa zemininde degrade arka planlar ve kart tabanlı düzen kullanılır.

[EKRAN_GORUNTUSU_DASHBOARD]

[EKRAN_GORUNTUSU_LOGIN]

*Şekil Açıklaması:* Sahip paneli ve giriş ekranından örnek ekran görüntüleri Word belgesine yerleştirilecektir.

## 4.4 Çoklu Dil Desteği

`web/src/utils/i18n.js` dosyası i18next’i `initReactI18next` ile bağlar; kaynaklar `en`, `tr`, `ar` dillerinde `common` namespace’i olarak yüklenir. Özel `crotAppLanguage` dedektörü önce `localStorage`, sonra tarayıcı dilini kullanır. Dil değişince `document.documentElement.lang` ve `dir` (Arapça için RTL) güncellenir. Arayüzde dil seçici `LanguageSwitcher.jsx` ile sabit konumda sunulur.

[EKRAN_GORUNTUSU_LANGUAGE]

---

\newpage

# 5. SİSTEM MODÜLLERİ

## 5.1 Masa Sipariş Sistemi

Müşteri tarafında QR ile `/order/:tableId` veya `/t/:tableId` rotaları `OrderPage.jsx` ile işlenir. API tarafında `routes/public.js` içinde `GET /api/public/tables/:tableId/menu` menü ve aktif sipariş döndürür; sipariş oluşturma `POST /api/public/tables/:tableId/orders` ile yapılır ve kaynak `QR` olarak işaretlenir. Garson modülü `routes/waiter.js` üzerinden benzer sipariş oluşturma ve durum güncelleme yetkisine sahiptir. Masanın fiziksel durumu `utils/tables.js` ve POS servisi ile sipariş durumlarına göre eşitlenir.

[DIYAGRAM_MASA_SIPARIS]

## 5.2 Online Sipariş Sistemi

Çevrimiçi keşif `routes/online.js` içinde `GET /api/online/restaurants` ile yapılır; istemci enlem-boylam ve isteğe bağlı şehir/ilçe ve sıralama parametreleri gönderir. Sunucu Haversine mesafesi ve restoran `deliveryRadiusKm` ile teslimat bölgesini hesaplar; `utils/restaurantHours.js` ile `isOpen` bayrağı ve açılış kayıtları birleştirilerek anlık açıklık değerlendirilir. Sipariş oluşturma `POST /api/online/orders` ile yapılır; ürünler veritabanından doğrulanır, fiyatlar sunucuda yeniden hesaplanır, teslimat adresi için koordinat zorunluluğu vardır. Müşteri adresleri `routes/me.js` üzerinden CRUD ile yönetilir. Sahip çevrimiçi menü ve ayarları `routes/ownerOnline.js` ile günceller.

[DIYAGRAM_ONLINE_ORDER]

## 5.3 Kurye Sistemi

Kurye başvurusu `routes/courierAuth.js` ile multipart belge yüklemesi yapılır; başlangıç durumu `PENDING` olur. Süper yönetici `routes/admin.js` ile onay/red işlemi yapar. Onaylı kurye `authenticateCourier` ile korunan `routes/courier.js` uçlarına erişir: konum gönderimi, yakındaki teklifler (`modules/courier-dispatch/dispatch.service.js`), atomik sipariş kabulü ve atanmış sipariş üzerinde durum güncelleme. İstemci `useCourierLiveLocation.js` ile konumu izler ve periyodik olarak API’ye iletir.

[DIYAGRAM_COURIER]

## 5.4 Ödeme Sistemi

**POS ödemesi:** `routes/payment.js` içinde kasiyer `POST /api/payment/tables/:tableId/checkout` ile hazır masa siparişlerini `Payment` kaydına bağlar ve siparişleri tamamlanmış ve ödenmiş işaretler.

**Çevrimiçi ödeme:** `modules/payments/payment.service.js` sipariş sahipliğini ve tutarı doğrular; `iyzico.service.js` IYZWSv2 imzalı istekle checkout formunu başlatır; `OrderPayment` kaydı oluşturulur veya güncellenir. Geri çağırma `POST /api/payments/iyzico/callback` ile işlenir ve kullanıcı `CLIENT_URL` üzerindeki sonuç sayfasına yönlendirilir.

[DIYAGRAM_PAYMENT]

## 5.5 Stok Yönetimi

Stok modeli çift katmanlıdır: `StockMovement` olay defteri ve `IngredientStock` anlık özet tablosu. `Recipe` ve `RecipeIngredient` menü kalemlerini malzemelere bağlar. `services/inventory.js` içinde malzeme oluşturma, reçete yazma, düşük stok raporu, satın alma ve mutfağın malzeme talepleri (`IngredientRequest`) iş kurallarıyla yönetilir. Mutfak siparişi `PREPARING` durumuna geçerken `consumeInventoryForOrder` ile stok düşümü tetiklenir; yetersiz stok veya eksik reçete durumunda işlem reddedilir.

[DIYAGRAM_STOCK]

---

\newpage

# 6. GÜVENLİK ANALİZİ

**JWT güvenliği:** Jetonlar tek bir `JWT_SECRET` ile imzalanır; süresi dolduğunda veya imza geçersizse 401 döner. Üretim öncesi güçlü giz ve sızdırılmaması kritiktir. README, JWT değiştirilmesi gerektiğini belirtir.

**Şifre hashleme:** `bcryptjs` ile 10 tur hash kullanılır; düz metin parola veritabanında saklanmaz.

**Rol bazlı erişim:** `requireRoles` sistem rollerini filtreler; çalışan modüllerinde ek olarak alt rol veritabanından doğrulanır (`getEmployeeContext`). Kurye için ek olarak hesap durumu `APPROVED` şartı aranır.

**Veri izolasyonu:** Restoran kullanıcıları için sorgular `restaurantId` ile sınırlanır. Süper yönetici geniş okuma yetkisine sahiptir. Müşteri uçları sipariş ve adres için sahiplik kontrolü yapar (`customerId` / `customerUserId` eşlemesi).

**API güvenliği:** CORS geliştirme dostu geniş ayarla açılmıştır; üretimde kısıtlı origin önerilir. Genel rate limiting, CSRF koruması (cookie tabanlı oturum olmadığı için sınırlı etki) ve request boyutu limitleri (Multer dışında global limit kodda açıkça görülmemektir) için iyileştirme alanı vardır. Iyzico iletişimi HTTPS üzerinden yapılır.

**Teknik değerlendirme:** MVP için makul bir güvenlik tabanı sunulmuş; üretim için denetim günlüğü, token iptali, HTTPS zorunluluğu ve yapılandırma sırlarının güvenli saklanması README ile uyumlu şekilde tamamlanmalıdır.

---

\newpage

# 7. GERÇEK HAYAT SENARYOLARI

**Restoran kullanımı:** Sahip sisteme kaydolur, plan seçer, masaları ve çalışanları tanımlar. Şef mutfak ekranından siparişleri kabul edip hazırlar; garson servisi tamamlar; kasiyer akşam kapanışında masaları tahsil eder.

**Paket servis:** Müşteri `/online-order` üzerinden konumunu paylaşır, yakındaki restoranları görür, sepet oluşturur ve teslimat veya gel-al seçer. Adres haritadan işaretlenebilir veya kayıtlı adresten seçilir.

**QR sipariş:** Masadaki QR kod `OrderPage` ile menüyü açar; müşteri kimlik gerektirmeden sipariş iletir (restoranın aboneliği ve `publicOrderingEnabled` koşulları sağlanmalıdır).

**Kurye akışı:** Kurye belgeyle kaydolur; yönetici onaylar. Kurye uygulama açıkken konumunu paylaşır, sistem REST durumu READY olan ve atanmamış teslimatları mesafeye göre listeler ve ilk kabul eden kurye atomik olarak atar.

**Online ödeme:** Müşteri siparişte ödeme yöntemi ONLINE seçerse sipariş önce ödeme bekleyen duruma alınır; Iyzico formu açılır, başarılı geri çağırma sonrası sipariş iş akışına girer.

---

\newpage

# 8. KARŞILAŞILAN PROBLEMLER VE ÇÖZÜMLER

**Teknik problemler:** Çok kanallı siparişin tek `Order` modelinde birleştirilmesi; çözüm olarak `orderType` ve `source` alanları ve rol bazlı durum geçişleri kullanılmıştır. Fiyat manipülasyonuna karşı çevrimiçi siparişte sunucu tarafında yeniden fiyatlandırma uygulanır.

**Mimari problemler:** İş mantığının route dosyalarında şişmesini önlemek için `services/` ve `modules/` ayrımı yapılmıştır; Controller katmanı kullanılmadığından sorumluluk route ve service arasında bilinççe paylaşılmıştır.

**Performans sorunları:** Mutfak sayfası periyodik anketleme kullanır; yüksek trafikte WebSocket ile iyileştirilebilir (Gelecek çalışma).

**Güvenlik sorunları:** JWT süresi uzun (7 gün); üretimde yenileme ve iptal mekanizması önerilir. Kurye belgeleri yerel disktedir; üretimde nesne depolama şarttır.

---

\newpage

# 9. GELECEKTE YAPILABİLECEK GELİŞTİRMELER

- **Mobil uygulama:** React Native veya Flutter ile kurye ve müşteri için yerel uygulama.  
- **Bildirim sistemi:** Push, SMS veya e-posta ile sipariş durumu ve kurye teklif bildirimleri.  
- **AI entegrasyonu:** Talep tahmini, dinamik hazırlık süresi veya menü önerisi (iş kurallarıyla birlikte).  
- **Gerçek zamanlı socket sistemi:** Sipariş ve mutfak panosu için WebSocket veya SSE.  
- **Analitik sistemler:** Satış raporları, en çok satan ürün, SLA ihlalleri.  

README’de ayrıca HTTPS, yenileme jetonları ve denetim günlüğü üretim için önerilmiştir.

---

\newpage

# 10. SONUÇ

CROT projesi, kod tabanında doğrulanabilir biçimde, çok kiracılı restoran SaaS’ının operasyonel ve müşteri yüzünü bir araya getiren bütünleşik bir mimari sunmaktadır. Backend tarafında Express modüler router yapısı, Prisma ile ilişkisel modelleme ve servis katmanında POS, envanter ve ödeme orkestrasyonu birlikte çalışır. Frontend tarafında React Router ile rol bazlı paneller, Tailwind ile tutarlı UI ve i18next ile çok dillilik sağlanmıştır. JWT tabanlı üçlü kimlik ailesi ve veritabanı tabanlı ek kontroller, güvenlik için makul bir MVP düzeyi oluşturur. Diyagram ve ekran görüntüsü placeholder’ları ile tamamlanacak bu rapor, projenin akademik ve profesyonel dokümantasyonunu Word/PDF ortamında zenginleştirmeye uygundur.

**Teknik değerlendirme özeti:** Mimari tutarlılık yüksek; modülerlik ve çok kiracılı izolasyon pratik seviyededir. Üretim öncesi güvenlik ve gözlemlenebilirlik (logging, rate limit, secrets management) ile gerçek zamanlı iletişim katmanı kritik iyileştirme alanlarıdır.

---

# KAYNAKÇA

- React Documentation. https://react.dev  
- Express Documentation. https://expressjs.com  
- Prisma Documentation. https://www.prisma.io/docs  
- PostgreSQL Documentation. https://www.postgresql.org/docs  
- JWT Introduction (RFC 7519 bağlamında). https://jwt.io  
- Tailwind CSS Documentation. https://tailwindcss.com/docs  
- Vite Documentation. https://vite.dev  
- React Router Documentation. https://reactrouter.com  
- Leaflet Documentation. https://leafletjs.com  
- i18next Documentation. https://www.i18next.com  
- Iyzico Developer Kaynakları (ödeme API). https://www.iyzico.com  

---

## Ek Placeholder Envanteri (Şekil ve Kod)

| Etiket | Amaç |
|--------|------|
| [PLACEHOLDER_KAPAK_GORSELI] | Kapak görseli |
| [DIYAGRAM_SISTEM_MIMARISI] | Üst seviye mimari |
| [TABLO_TEKNOLOJILER] | Teknoloji tablosu (Word tablo aracı) |
| [DIYAGRAM_VERITABANI] | ER diyagramı |
| [DIYAGRAM_MASA_SIPARIS] | QR/garson sipariş sırası |
| [DIYAGRAM_ONLINE_ORDER] | Çevrimiçi sipariş sırası |
| [DIYAGRAM_COURIER] | Kurye yaşam döngüsü |
| [DIYAGRAM_PAYMENT] | POS ve Iyzico ödeme akışı |
| [DIYAGRAM_STOCK] | Reçete ve stok düşümü |
| [KOD_ORNEGI_EXPRESS] | server.js özeti |
| [KOD_ORNEGI_ROUTES] | Router montajı |
| [KOD_ORNEGI_MIDDLEWARE] | auth ve subscription |
| [KOD_ORNEGI_AUTH] | token imzalama |
| [KOD_ORNEGI_PRISMA] | şema özeti |
| [KOD_ORNEGI_API] | örnek endpoint listesi |
| [EKRAN_GORUNTUSU_REACT] | IDE veya yapı |
| [EKRAN_GORUNTUSU_DASHBOARD] | Sahip paneli |
| [EKRAN_GORUNTUSU_LOGIN] | Giriş |
| [EKRAN_GORUNTUSU_LANGUAGE] | Dil seçici |
