# PlanToBee: Canlıya Çıkış Rehberi

Bu rehber PlanToBee'yi ücretsiz servislerle internete açmak için adım adım yol gösterir. Sırayla ilerle; her adım bir öncekinde not aldığın bilgileri kullanır.

> Servislerin ekranları ve düğme adları zamanla değişebilir. Bir düğmeyi bulamazsan menü yolunu ve alan adını takip et, gerekirse ilgili servisin belgesine bak (bağlantılar her bölümün başında).

> Kökteki `index.html` (GitHub Pages'teki eski Firebase sürümü) bu kurulumdan etkilenmez; ona dokunulmaz, eskisi gibi yayında kalır.

---

## 1. Genel bakış

| Parça | Servis | Ne yapar |
|---|---|---|
| Veritabanı | **Neon** (yönetilen PostgreSQL) | Kullanıcılar, aileler, planlar burada durur. |
| API (backend) | **Render** (Docker web servisi) | `backend/PlanToBee.API`. Tarayıcıdan gelen istekleri işler, veritabanına bağlanır, e-posta gönderir. |
| Site (frontend) | **Cloudflare Pages** | `frontend/`. Kullanıcının tarayıcısına inen React uygulaması. |
| E-posta | **Brevo** (SMTP) | Doğrulama, şifre sıfırlama ve davet e-postalarını gönderir. |

Nasıl konuşurlar:

```
Tarayıcı ──(1) siteyi indirir──> Cloudflare Pages  (https://<proje>.pages.dev)
   │
   └──(2) API istekleri (VITE_API_URL)──> Render proxy ──> PlanToBee API konteyneri
                                                              │
                                   (3) SSL ile ──> Neon PostgreSQL
                                   (4) SMTP 587 + STARTTLS ──> Brevo ──> kullanıcının gelen kutusu
```

- Site, API'nin adresini **build sırasında** `VITE_API_URL` değişkeninden öğrenir.
- API, sitenin adresini `App__FrontendBaseUrl` ayarından öğrenir. Bu adres iki iş görür: e-postalardaki linkler bu adresle başlar ve API yalnızca bu adresten gelen tarayıcı isteklerine izin verir (**CORS**: tarayıcının, bir sitenin başka bir adresteki API'yi çağırmasına izin verilip verilmediğini kontrol etmesi).
- API ilk açılışta veritabanında tabloları kendisi oluşturur (**migration**: veritabanı şemasını koddaki modele getiren adımlar). Elle SQL çalıştırman gerekmez.

**Terimler:**
- **Ortam değişkeni (environment variable):** Servisin ayar ekranına girilen `AD = değer` çifti. Şifreler koda değil buraya yazılır.
- **Gizli (secret):** Başkası görürse zarar verecek değer (şifre, anahtar). Hiçbir zaman GitHub'a, ekran görüntüsüne ya da sohbete yapıştırılmaz.
- **Proxy:** Render'da isteği internetten alıp konteynere ileten ara sunucu. HTTPS'i (şifreli bağlantıyı) o çözer; konteynere istek düz HTTP olarak gelir.

---

## 2. Ortam değişkenleri

Render'daki değişken adlarında `__` (iki alt çizgi) bir alt bölümü gösterir: `Email__Smtp__Password` = `Email > Smtp > Password` ayarı. Adları **birebir** yaz (büyük/küçük harf dahil).

Varsayılanı olan değişkenleri girmen gerekmez; varsayılanlar `appsettings.json` ve `appsettings.Production.json` dosyalarındadır.

### Render (API)

| Değişken | Ne işe yarar | Zorunlu mu / varsayılan | Örnek biçim | Değer nereden | Gizli mi |
|---|---|---|---|---|---|
| `ConnectionStrings__Default` | Veritabanı bağlantısı. Neon'un verdiği `postgresql://` adresi olduğu gibi yapıştırılır. | **Zorunlu** | `postgresql://neondb_owner:<şifre>@ep-xxx-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Neon > Connect (doğrudan bağlantı, havuz kapalı) | **Evet** |
| `Jwt__Key` | Oturum belirteçlerini (giriş anahtarlarını) imzalayan anahtar. | **Zorunlu**, en az 32 karakter | 64 karakterlik rastgele metin | Kendin üretirsin (aşağıya bak) | **Evet** |
| `Email__Smtp__Username` | Brevo SMTP kullanıcı adı. | **Zorunlu** | `8a1b2c001@smtp-brevo.com` | Brevo > SMTP & API > SMTP sekmesi > **Login** | Evet (hassas) |
| `Email__Smtp__Password` | Brevo SMTP anahtarı (Brevo hesap şifren **değil**). | **Zorunlu** | `xsmtpsib-...` | Brevo > SMTP & API > SMTP > Generate a new SMTP key | **Evet** |
| `Email__From` | E-postaların gönderen adresi. Brevo'da **doğrulanmış** olmalı. | **Zorunlu** | `plantobee@alanadin.com` | Brevo > Senders'ta doğruladığın adres | Hayır |
| `App__FrontendBaseUrl` | Sitenin adresi: e-posta linkleri ve CORS izni. `https://` ile başlar, sonunda `/` ve yol yok. | **Zorunlu** | `https://plantobee.pages.dev` | Cloudflare Pages proje adresi | Hayır |
| `Email__FromName` | Gönderen adı (gelen kutusunda görünen). | İsteğe bağlı, `PlanToBee` | `PlanToBee` | Sen seçersin | Hayır |
| `Email__Smtp__Host` | SMTP sunucusu. | İsteğe bağlı, `smtp-relay.brevo.com` | `smtp-relay.brevo.com` | Brevo > SMTP sekmesi | Hayır |
| `Email__Smtp__Port` | SMTP portu (STARTTLS). | İsteğe bağlı, `587` | `587` (engelliyse `2525`) | Brevo > SMTP sekmesi | Hayır |
| `Email__Smtp__EnableSsl` | STARTTLS ile şifreli bağlantı. Üretimde `false` kabul edilmez. | İsteğe bağlı, `true` | `true` | Değiştirme | Hayır |
| `Email__Provider` | E-posta sağlayıcısı. Üretimde yalnızca `Smtp` kabul edilir. | İsteğe bağlı, `Smtp` | `Smtp` | Değiştirme | Hayır |
| `ASPNETCORE_ENVIRONMENT` | Ortam adı. Docker imajı zaten `Production` ile açılır. | İsteğe bağlı, `Production` | `Production` | Değiştirme | Hayır |
| `PORT` | API'nin dinlediği port. **Render kendisi verir, girme.** | Otomatik (Render: `10000`). Yoksa `8080`. | `10000` | Render | Hayır |
| `Jwt__Issuer` / `Jwt__Audience` | Belirteç düzenleyici / hedef adı. | İsteğe bağlı, `plantobee` | `plantobee` | Değiştirme | Hayır |
| `ForwardedHeaders__Enabled` | Proxy'nin eklediği gerçek istemci IP'si ve HTTPS bilgisini kullan. | İsteğe bağlı, üretimde `true` | `true` | Değiştirme | Hayır |
| `ForwardedHeaders__ForwardLimit` | `X-Forwarded-For` listesinde sağdan kaç girişe güvenileceği (Render için **1**). | İsteğe bağlı, `1` | `1` | Bölüm 5'teki kontrolle doğrulanır | Hayır |
| `ForwardedHeaders__KnownProxies` | Güvenilen proxy IP'leri (virgülle). Render'da boş kalır. | İsteğe bağlı, boş | `10.0.0.5` | - | Hayır |
| `ForwardedHeaders__KnownNetworks` | Güvenilen proxy ağları (CIDR). Render'da boş kalır. | İsteğe bağlı, boş | `10.0.0.0/8` | - | Hayır |
| `ForwardedHeaders__LogDiagnostics` | Her isteğin ham `X-Forwarded-For` başlığını ve bulunan IP'yi loglar. Yalnızca kontrol için kısa süre aç. | İsteğe bağlı, `false` | `true` | - | Hayır |
| `RateLimits__Auth` | Giriş/kayıt/şifre işlemleri: IP başına dakikada en fazla istek. | İsteğe bağlı, `20` | `20` | - | Hayır |
| `RateLimits__InvitePublic` | Davet linki/kodu doğrulama: IP başına 5 dakikada en fazla istek. | İsteğe bağlı, `10` | `10` | - | Hayır |
| `RateLimits__InviteSend` | Davet gönderme: kullanıcı başına saatte en fazla istek. | İsteğe bağlı, `20` | `20` | - | Hayır |
| `RateLimits__Session` | Oturum bilgisi (`/auth/me`): kullanıcı başına dakikada en fazla istek. | İsteğe bağlı, `120` | `120` | - | Hayır |

> Kullanma: `ASPNETCORE_FORWARDEDHEADERS_ENABLED`. Bu, .NET'in kendi kısayolu; PlanToBee kendi `ForwardedHeaders__*` ayarlarını kullanır, ikisi birlikte kafa karıştırır.

### Cloudflare Pages (site)

| Değişken | Ne işe yarar | Zorunlu mu / varsayılan | Örnek biçim | Değer nereden | Gizli mi |
|---|---|---|---|---|---|
| `VITE_API_URL` | Sitenin istek atacağı API adresi, **sonunda `/api`**. Build sırasında koda gömülür. | **Zorunlu** (yoksa build durur) | `https://plantobee-api.onrender.com/api` | Render servis adresi + `/api` | Hayır (tarayıcıya gider) |
| `NODE_VERSION` | Build'de kullanılacak Node.js sürümü. | İsteğe bağlı (`frontend/.node-version` = 22) | `22` | - | Hayır |

### JWT anahtarı nasıl üretilir

Mac'te **Terminal**'i aç ve şunu yaz:

```bash
openssl rand -base64 48
```

Çıkan yaklaşık 64 karakterlik satırın tamamı `Jwt__Key` değeridir. Bir yere (ör. parola yöneticisi) kaydet, başka yere yapıştırma.

> **Önemli:** Repo geçmişinde (ilk backend commit'i `664694a`, `appsettings.json`) eski bir JWT anahtarı açık metin olarak bulunuyor. O anahtar herkese açık sayılır. Canlıda **mutlaka yeni** bir anahtar üret. API, o eski anahtarla açılmayı reddeder.

Anahtar değişirse herkesin oturumu kapanır, yeniden giriş yapmak gerekir. Başka bir etkisi yoktur.

---

## 3. Canlıya çıkış, adım adım

Başlamadan önce: canlıya çıkacak kodun GitHub'da `main` dalında olması gerekir (Render ve Cloudflare varsayılan olarak `main`'i yayınlar).

Aşağıdaki adımlarda not alacağın değerler:

| Not | Nereden | Nerede kullanılacak |
|---|---|---|
| Neon bağlantı adresi | 3.1 | Render: `ConnectionStrings__Default` |
| Brevo Login, SMTP anahtarı, gönderen adresi | 3.2 | Render: `Email__Smtp__Username`, `Email__Smtp__Password`, `Email__From` |
| JWT anahtarı | Bölüm 2 | Render: `Jwt__Key` |
| Render adresi | 3.3 | Cloudflare: `VITE_API_URL` |
| Cloudflare Pages adresi | 3.4 | Render: `App__FrontendBaseUrl` |

### 3.1 Neon: veritabanı

Belge: https://neon.tech/docs/connect/connect-from-any-app

1. https://neon.tech adresinde hesap aç (GitHub ile giriş yapılabilir). Ücretsiz plan (Free) yeterli.
2. **Create project** (yeni proje):
   - **Project name:** `plantobee`
   - **Postgres version:** önerileni bırak.
   - **Region:** Render'da seçeceğin bölgeye yakın olsun. Öneri: **AWS Europe Central (Frankfurt)**, Render'da da **Frankfurt** seçilir.
   - **Database name:** `neondb` kalabilir (ya da `plantobee`).
3. Proje açılınca **Dashboard**'da **Connect** düğmesine tıkla. Açılan pencerede:
   - **Branch:** `main`, **Database:** oluşturduğun veritabanı, **Role:** `neondb_owner` (varsayılan).
   - **Connection pooling** anahtarını **KAPAT**. Adresteki sunucu adında `-pooler` **olmamalı**.
     Neden: Havuzlu (pooled) bağlantı PgBouncer üzerinden geçer; API'nin açılışta çalıştırdığı migration adımları ve oturum düzeyindeki özellikler doğrudan bağlantıda güvenilir çalışır. PlanToBee tek sunucuyla çalıştığı için havuza ihtiyaç yok. (Havuzlu adres girilirse API açılır ama logda uyarı verir.)
   - Biçim olarak **Connection string** (ya da `psql`/URI) seçili olsun. Şuna benzer bir satır görürsün:
     ```
     postgresql://neondb_owner:<şifre>@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   - Şifreyi göstermek için **Show password**'e tıkla ve satırın **tamamını** kopyala. Bu, Render'daki `ConnectionStrings__Default` değeridir. **Gizlidir.**
4. Tabloları elle oluşturma; API ilk açılışta kendisi oluşturur.

Bağlantı biçimi hakkında:
- API `postgres://` ve `postgresql://` adreslerini doğrudan kabul eder. Başka bir biçime çevirmen gerekmez.
- Şifrede `@ : / # ?` gibi özel karakterler varsa URL-kodlu olmalıdır (Neon'un kopyaladığı adres zaten doğru biçimdedir).
- Üretimde SSL zorunludur: `sslmode=require` (ya da parametre hiç yoksa) API bağlantıyı **sertifika ve sunucu adı doğrulamalı** SSL'e (`verify-full`) yükseltir. `sslmode=disable` yazılırsa API açılmaz. Neon'un sertifikası genel kabul görmüş bir kök sertifikayla imzalı olduğu için ek bir şey yapman gerekmez.

### 3.2 Brevo: e-posta

Belge: https://help.brevo.com/hc/en-us/articles/7924908994450 (SMTP ayarları), https://help.brevo.com/hc/en-us/articles/208836149 (gönderen doğrulama)

1. https://www.brevo.com adresinde ücretsiz hesap aç. Ücretsiz plan günde **300 e-posta** gönderir; bu aşama için yeterli.
2. **Gönderen adresini doğrula:** Sağ üstte hesap menüsü > **Senders, Domains & Dedicated IPs** > **Senders** > **Add sender**.
   - **From name:** `PlanToBee`
   - **From email:** e-postaların gönderileceği adres (ör. kendi adresin).
   - Brevo bu adrese bir doğrulama e-postası (ya da kod) gönderir; onayla.
   - Doğrulanmamış adresle gönderim **reddedilir** ya da e-postalar **spam'e düşer**.
   - Not: Gmail/Hotmail gibi ücretsiz bir adresi gönderen olarak kullanmak çalışır ama e-postalar alıcıda spam'e düşebilir. Kalıcı çözüm kendi alan adını Brevo'da doğrulamaktır (**Domains** sekmesi, SPF/DKIM kayıtları); bu adım şimdilik kapsam dışı.
3. **SMTP anahtarı oluştur:** Hesap menüsü > **SMTP & API** > **SMTP** sekmesi > **Generate a new SMTP key**.
   - İsim: `plantobee-render`. Oluşan anahtarı (`xsmtpsib-...`) **hemen kopyala**; Brevo bir daha göstermez. Bu `Email__Smtp__Password` değeridir. **Gizlidir.**
4. Aynı ekranda şunları not al:
   - **SMTP Server:** `smtp-relay.brevo.com` (varsayılan, girmen gerekmez)
   - **Port:** `587` (Render'da `2525` gireceğiz, bkz. 3.3)
   - **Login:** `...@smtp-brevo.com` biçiminde bir değer. Bu `Email__Smtp__Username` değeridir. (Brevo'ya giriş yaptığın e-posta adresi değildir.)

API, 587 portuna düz bağlanır ve **STARTTLS** komutuyla bağlantıyı şifreler; kullanıcı adı ve anahtar yalnızca şifreli bağlantı kurulduktan sonra gönderilir. 465 portu (doğrudan SSL) **desteklenmez**; 587 ya da 2525 kullan.

### 3.3 Render: API

Belge: https://render.com/docs/docker, https://render.com/docs/health-checks, https://render.com/docs/configure-environment-variables

1. https://render.com adresinde hesap aç (**GitHub ile** giriş yap; repoya erişim izni vermek için).
2. **Dashboard** > **New** > **Web Service**.
3. **Source Code / Git Provider:** GitHub reposunu (`Programmeko`) seç. Liste boşsa **Configure account** ile Render'a bu repoya erişim izni ver.
4. Ayarlar:
   - **Name:** `plantobee-api` (adres buna göre oluşur: `https://plantobee-api.onrender.com`; ad alınmışsa Render sonuna ek koyar, gerçek adresi 8. adımda göreceksin).
   - **Language / Runtime:** **Docker**
   - **Branch:** `main`
   - **Region:** **Frankfurt (EU Central)** (Neon ile aynı bölge).
   - **Root Directory:** `backend/PlanToBee.API`
   - **Dockerfile Path:** `./Dockerfile` (kök klasöre göre; yani `backend/PlanToBee.API/Dockerfile`)
   - **Docker Build Context Directory:** `.` (kök klasörün kendisi). Render bu alanları kök klasöre göre değil repo köküne göre isterse: Dockerfile Path `backend/PlanToBee.API/Dockerfile`, Build Context `backend/PlanToBee.API`.
   - **Instance Type:** **Free**
5. **Environment Variables** bölümünde (sonradan: servis > **Environment** sekmesi) **Add Environment Variable** ile şunları tek tek ekle:

   | Key | Value |
   |---|---|
   | `ConnectionStrings__Default` | Neon'dan kopyaladığın adres (3.1) |
   | `Jwt__Key` | Ürettiğin anahtar (Bölüm 2) |
   | `Email__Smtp__Username` | Brevo **Login** (3.2) |
   | `Email__Smtp__Password` | Brevo SMTP anahtarı (3.2) |
   | `Email__From` | Brevo'da doğruladığın gönderen adresi (3.2) |
   | `App__FrontendBaseUrl` | Şimdilik `https://plantobee.pages.dev` yaz; 3.5'te Cloudflare'in verdiği gerçek adresle değiştireceksin. |
   | `Email__Smtp__Port` | `2525` (Render'ın ücretsiz planı giden 587 portunu engelleyebilir; Brevo 2525'te de STARTTLS destekler. E-posta sorunsuz gidiyorsa böyle bırak.) |

   Diğer değişkenlerin varsayılanları doğrudur; ekleme. **`PORT`'u ekleme**, Render kendisi verir.
6. **Advanced** (ya da servis oluştuktan sonra **Settings** > **Health Checks**) altında:
   - **Health Check Path:** `/health`
7. **Auto-Deploy:** `On Commit` (Yes) kalsın.
8. **Create Web Service** (ya da **Deploy Web Service**) ile ilk dağıtımı başlat. İlk derleme birkaç dakika sürer.
9. **Logs** sekmesinden açılışı izle. Başarılı açılışta sırayla şunları görürsün:
   ```
   Ortam: Production, e-posta: Smtp, forwarded header: açık (ForwardLimit=1)
   Veritabanı migration'ları uygulanıyor: ..._InitialCreate, ..._FamilyAccounts, ..._DataProtectionKeys
   Applying migration '...'
   Veritabanı hazır.
   Now listening on: http://0.0.0.0:10000
   ```
   - Boş veritabanında ilk açılışta `fail: ... Failed executing DbCommand ... "__EFMigrationsHistory"` satırları görünür. Bu **normaldir**: tablo henüz yoktur, hemen ardından oluşturulur.
   - `warn: ... Overriding HTTP_PORTS` ve `warn: ... No XML encryptor configured` satırları da **normaldir**: port Render'ın verdiği `PORT`'tan alınır, link imzalama anahtarları veritabanında saklanır.
   - `PlanToBee API başlatılamadı ... ayar hatası` görürsen hangi ayarın eksik olduğu satır satır yazar; Bölüm 4'e bak.
10. Servis sayfasının üstündeki adresi (ör. `https://plantobee-api.onrender.com`) not al. Tarayıcıda `https://plantobee-api.onrender.com/health` aç; şunu görmelisin:
    ```json
    {"status":"ok","api":"ok","database":"ok"}
    ```

Sağlık adresleri:
- `/health`: API ve veritabanı. Veritabanına ulaşılamazsa **503** ve `"database":"unreachable"` döner. Render bu adresi dağıtım ve çalışma sırasında kontrol eder.
- `/health/live`: yalnızca API (veritabanına dokunmaz).
- İkisi de giriş gerektirmez, istek sınırına takılmaz ve bağlantı bilgisi, sunucu adı ya da hata ayrıntısı içermez.

Render ücretsiz plan notları:
- 15 dakika istek gelmezse servis **uyur**. Sonraki ilk istekte uyanması **30-60 saniye** sürebilir; bu sırada site "Sunucuya ulaşılamadı" gösterebilir, biraz bekleyip yenilemek yeterli.
- Uyanınca konteyner sıfırdan başlar. Şifre sıfırlama ve e-posta doğrulama linklerini imzalayan anahtarlar bu yüzden veritabanında saklanır; uyku sonrası linkler geçerli kalır. Oturumlar `Jwt__Key` ile imzalandığı için uykudan etkilenmez. İstek sınırı sayaçları ise bellekte tutulduğu için yeniden başlatmada sıfırlanır.
- Neon ücretsiz planda veritabanı da 5 dakika boşta kalınca uyur; ilk sorguda saniyeden kısa sürede uyanır.

### 3.4 Cloudflare Pages: site

Belge: https://developers.cloudflare.com/pages/configuration/build-configuration/, https://developers.cloudflare.com/pages/configuration/serving-pages/

1. https://dash.cloudflare.com adresinde ücretsiz hesap aç.
2. **Workers & Pages** > **Create** > **Pages** sekmesi > **Connect to Git** (Import an existing Git repository).
3. GitHub hesabını bağla ve `Programmeko` reposunu seç > **Begin setup**.
4. **Set up builds and deployments** ekranında:
   - **Project name:** `plantobee` (adres buna göre olur: `https://plantobee.pages.dev`; ad alınmışsa farklı olur).
   - **Production branch:** `main`
   - **Framework preset:** `Vite` (ya da `None`; aşağıdaki alanları elle doldur)
   - **Root directory (advanced):** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variables (advanced)** > **Add variable**:
     - `VITE_API_URL` = `https://plantobee-api.onrender.com/api` (3.3'teki Render adresi + `/api`)
     - `NODE_VERSION` = `22`
5. **Save and Deploy**. Build bittiğinde Cloudflare sitenin adresini gösterir (ör. `https://plantobee.pages.dev`). **Not al.**

Bilmen gerekenler:
- `VITE_API_URL` **build sırasında** koda gömülür. Değeri değiştirirsen yeniden dağıtım gerekir (**Deployments** > son dağıtım > **Retry deployment**, ya da yeni bir commit). Yalnızca değişkeni kaydetmek yetmez.
- Değişkenler Settings > **Variables and Secrets** (eski adıyla Environment variables) altında **Production** için girilir. Yalnızca Production'a girilirse **önizleme (preview) build'leri bilerek hata verir** ("VITE_API_URL tanımlı değil"). Bu normaldir; önizleme adresleri zaten API'ye bağlanamaz (CORS yalnızca üretim adresine izin verir).
- Site SPA (tek sayfalık uygulama) olarak sunulur: `/invite?token=...`, `/verify-email?...`, `/reset-password?...` gibi adresler doğrudan açıldığında ya da yenilendiğinde `index.html` gelir. Cloudflare bunu, çıktıda `404.html` dosyası **olmadığında** kendiliğinden yapar.
  **`_redirects` dosyası EKLEME.** Açık kurallar `/invite?token=..` isteğini köke yönlendirip adresi bozar; genel `/* /index.html 200` kuralını da Cloudflare döngü sayıp yok sayar. Build, `dist/404.html` bulursa bilerek hata verir.

### 3.5 Birbirine bağlama

1. **Render** > `plantobee-api` > **Environment** > `App__FrontendBaseUrl` değerini Cloudflare'in verdiği adresle değiştir. Biçim: `https://plantobee.pages.dev` (`https://` ile, **sonunda `/` yok**, yol yok).
   **Save Changes** (ya da **Save, rebuild, and deploy**). Render API'yi yeniden başlatır; Cloudflare tarafında bir şey yapmana gerek yok.
2. **Cloudflare Pages** > `plantobee` > **Settings** > **Variables and Secrets**: `VITE_API_URL` Render'ın **gerçek** adresiyle aynı mı kontrol et (`https://<render-adı>.onrender.com/api`). Farklıysa düzelt, sonra **Deployments** > **Retry deployment** ile siteyi yeniden derle.

Hangi değişiklikten sonra ne yapılır:

| Değiştirdiğin | Yeniden dağıtılacak taraf |
|---|---|
| Render'da herhangi bir ortam değişkeni (ör. `App__FrontendBaseUrl`, SMTP bilgisi) | Render (kaydedince kendisi yeniden başlatır). Cloudflare'e dokunma. |
| Cloudflare'de `VITE_API_URL` | Cloudflare Pages (Retry deployment). Render'a dokunma. |
| Render servis adı/adresi | Cloudflare'de `VITE_API_URL` güncelle + Cloudflare yeniden dağıt. |
| Cloudflare proje adı/adresi ya da ileride özel alan adı (ör. `https://plantobee.com`) | Render'da `App__FrontendBaseUrl` güncelle (tek ayar yeter; e-posta linkleri ve CORS birlikte değişir). |

### 3.6 Test

Sırayla dene; hepsi geçerse kurulum tamamdır.

1. **Sağlık:** `https://<render-adı>.onrender.com/health` > `{"status":"ok","api":"ok","database":"ok"}`. (Uykudaysa ilk açılış 30-60 sn sürebilir.)
2. **Kayıt:** `https://<proje>.pages.dev` aç > kayıt ol (kendi e-posta adresinle).
3. **Doğrulama e-postası:** Gelen kutuna (yoksa spam klasörüne) "PlanToBee: E-posta adresini doğrula" gelmeli. Linke tıkla; site açılmalı ve doğrulama başarılı olmalı. Link `https://<proje>.pages.dev/verify-email?...` ile başlamalı.
4. **Aile kurma:** Aileni oluştur.
5. **Davet:** Başka bir e-posta adresine (ör. ikinci adresin) davet gönder. Davet e-postasındaki linke tıkla; davet ekranı açılmalı, şifre belirleyip katıl.
6. **Şifre sıfırlama:** Çıkış yap > "Şifremi unuttum" > e-postadaki linkle yeni şifre belirle > yeni şifreyle giriş yap.
7. **Plan kaydı:** Bir güne ders kaydı ekle; sayfayı yenile, kayıt duruyor olmalı.
8. **Yenileme / 404:** `/invite-code`, `/forgot-password` gibi bir sayfadayken tarayıcıda yenile (F5 / Cmd+R); 404 değil aynı sayfa gelmeli.
9. **İstemci IP kontrolü (bir kez):** Bölüm 5'teki adımlarla rate limit'in gerçek IP'ne göre çalıştığını doğrula.

---

## 4. Sorun giderme

**API açılışta duruyor: "PlanToBee API başlatılamadı (Production): N ayar hatası bulundu"**
Render > Logs'ta hemen altında eksik/hatalı her ayar ayrı satırda yazar (değerler güvenlik için yazılmaz). Render > Environment'ta adı **birebir** kontrol et (`__` iki alt çizgi, büyük/küçük harf). Sık olanlar:
- `Jwt:Key ... 32 karakterden kısa`: Bölüm 2'deki komutla yeni anahtar üret.
- `Jwt:Key repo geçmişinde açıkça yer almış eski anahtar`: Eski anahtarı kopyalamışsın; yenisini üret.
- `Email:Provider üretimde 'Smtp' olmalı`: `Email__Provider` değişkenini sil ya da `Smtp` yap.
- `Email:Smtp:Username/Password ... ayarlı değil`: Brevo Login ve SMTP anahtarını gir.
- `App:FrontendBaseUrl ... geçerli değil`: `https://` ile başlamalı, sonunda `/` ya da yol olmamalı.
- `ConnectionStrings:Default SSL'i kapatıyor`: Adresten `sslmode=disable`'ı sil.

**API açılışta duruyor: "veritabanına bağlanılamadı veya migration uygulanamadı"**
- `ConnectionStrings__Default`'u Neon > Connect'ten yeniden kopyala (şifre dahil, tamamı).
- Neon projesi silinmiş/askıya alınmış olabilir: Neon Dashboard'da projenin durumuna bak.
- `SSL connection requested ... No SSL enabled connection`: Başka bir (SSL'siz) veritabanına bağlanıyorsun; Neon adresini kullan.
- `Exception while performing SSL handshake`: Sertifika doğrulanamadı. Neon'un adresindeki sunucu adını değiştirme; IP adresi yazma.
- `/health` 503 ve `"database":"unreachable"` diyorsa: API ayakta, veritabanına ulaşılamıyor; aynı kontroller.
- Logda `-pooler` uyarısı: Neon > Connect'te **Connection pooling**'i kapatıp adresi yeniden kopyala.

**E-posta gelmiyor ya da spam'e düşüyor**
- Önce spam klasörüne bak.
- Render > Logs'ta `SMTP gönderimi başarısız` satırını ara. Yanında durum ve neden yazar (şifre ya da link yazılmaz):
  - `Authentication` / `5.7.8` / `535`: `Email__Smtp__Username` (Brevo **Login**, giriş e-postan değil) ya da `Email__Smtp__Password` (SMTP anahtarı, hesap şifren değil) yanlış.
  - Gönderen reddedildi (`sender`/`not verified`): `Email__From` Brevo > Senders'ta doğrulanmamış.
  - `SMTP gönderimi 30 sn içinde tamamlanamadı` ya da bağlantı hatası: Render'dan SMTP portuna çıkılamıyor olabilir. Render'ın ücretsiz planında giden SMTP portlarına kısıt uygulanabiliyor (Render'ın güncel belgesine bak). `Email__Smtp__Port` = `2525` yapıp kaydet (Brevo 2525'te de STARTTLS destekler).
- Brevo > **Transactional** > **Logs** (ya da Statistics) ekranında e-postanın Brevo'ya ulaşıp ulaşmadığı ve teslim durumu görünür.
- Günlük 300 e-posta sınırı dolmuş olabilir (Brevo panelinde görünür).
- Kalıcı spam sorunu için kendi alan adını Brevo'da doğrula (SPF/DKIM).
- E-posta gönderilemese bile kayıt/davet kaydı oluşur; kullanıcı "doğrulama e-postasını yeniden gönder" ya da yönetici "Yeniden gönder" ile tekrar deneyebilir.

**Cloudflare build "VITE_API_URL tanımlı değil" hatasıyla duruyor**
Cloudflare Pages > Settings > Variables and Secrets'ta `VITE_API_URL` yok ya da yanlış ortama (Preview/Production) girilmiş. Production'a ekle ve **Retry deployment** yap. Önizleme build'lerindeki bu hata beklenen davranıştır.

**Site açılıyor ama her işlemde "Sunucuya ulaşılamadı"**
- Render uykuda olabilir: 30-60 sn bekleyip yenile; `/health` adresini açıp uyandırabilirsin.
- `VITE_API_URL` yanlış olabilir: sonunda `/api` olmalı, `https://` olmalı, Render adı doğru olmalı. Tarayıcıda Geliştirici Araçları (F12 / Cmd+Opt+I) > **Network** sekmesinde isteğin hangi adrese gittiğine bak. Düzeltince Cloudflare'de yeniden dağıt.
- CORS olabilir (aşağıda).

**Tarayıcı konsolunda CORS hatası ("blocked by CORS policy")**
- Render'daki `App__FrontendBaseUrl`, sitenin adres çubuğundaki adresle **birebir** aynı olmalı: `https://` dahil, sonunda `/` yok. `https://plantobee.pages.dev` ile `https://www...` ya da önizleme adresi (`https://abc123.plantobee.pages.dev`) farklı sayılır; yalnızca üretim adresi çalışır.
- Değiştirince Render kendini yeniden başlatır; birkaç dakika bekle.

**E-postadaki linke tıklayınca ya da yenileyince 404**
- Linkin adresi yanlışsa (ör. `localhost` ya da eski adres): Render'da `App__FrontendBaseUrl`'i düzelt. Bu, yalnızca bundan sonra gönderilen e-postaları düzeltir.
- Site tarafında 404 ise: Cloudflare Pages'te **Root directory** `frontend`, **Build output directory** `dist` olmalı. Çıktıda `404.html` ya da `_redirects` dosyası olmamalı.

**İlk açılış çok yavaş**
Render ücretsiz planda 15 dakika boşta kalan servis uyur; ilk istek 30-60 sn bekletebilir. Normaldir. (Uykuyu engellemek bu aşamada kapsam dışı.)

**"Çok fazla istek gönderildi" hatası**
- Sınırlar: giriş/kayıt IP başına dakikada 20, davet linki/kodu IP başına 5 dakikada 10, davet gönderme kullanıcı başına saatte 20. Birkaç dakika bekleyince açılır.
- Farklı kişiler, farklı evlerden birbirini engelliyorsa IP tespiti yanlış olabilir: Bölüm 5'teki kontrolü yap.
- Gerekirse Render'da `RateLimits__Auth` gibi değerleri artır.

---

## 5. Proxy arkasında istemci IP'si (bir kez kontrol et)

Neden önemli: Giriş denemesi ve davet kodu sınırları IP başına uygulanır. Render'da istek API'ye proxy üzerinden gelir. API proxy'nin IP'sini görürse bütün kullanıcılar aynı sınırı paylaşır; istemcinin gönderdiği başlığa körü körüne güvenirse de saldırgan sahte `X-Forwarded-For` başlığıyla her denemede farklı IP'den geliyormuş gibi görünüp sınırları atlatır.

Seçilen yaklaşım:
- Render'ın proxy IP aralığı sabit/yayınlanmış olmadığı için belirli adreslere güvenmek (`KnownProxies`) mümkün değil. Bunun yerine konteynere bağlanan her adres proxy kabul edilir; Render'da konteynere internetten doğrudan ulaşılamaz, tek giriş Render'ın proxy'sidir.
- `ForwardLimit=1`: `X-Forwarded-For` listesinde yalnızca **en sağdaki** değer, yani Render proxy'sinin **kendi eklediği** (ona bağlanan istemcinin) adresi kullanılır. İstemcinin kendi gönderdiği değerler listenin soluna düşer ve yok sayılır. Böylece sahte başlıkla IP değiştirilemez.
- `X-Forwarded-Proto` da işlenir: HTTPS ile gelen istek uygulamada HTTPS olarak tanınır. Uygulama kendi içinde HTTP'den HTTPS'e yönlendirme yapmaz (bunu Render yapar), bu yüzden yönlendirme döngüsü oluşmaz.
- IPv6 adresleri `/64` bloklarına göre gruplanır (bir ev genelde bütün bir bloğa sahiptir; blok içinde adres değiştirerek sınır atlatılamasın diye).

Kurulumdan sonra doğrulama (5 dakika):
1. Render > Environment > `ForwardedHeaders__LogDiagnostics` = `true` ekle, kaydet (servis yeniden başlar).
2. Kendi IP'ni öğren: tarayıcıda https://ifconfig.me aç.
3. Terminal'de sahte bir başlıkla istek at:
   ```bash
   curl -H "X-Forwarded-For: 1.2.3.4" https://<render-adı>.onrender.com/health/live
   ```
4. Render > Logs'ta `Forwarded tanı:` satırını bul:
   - `çözümlenen=` **senin IP'in** ve `https=True` ise her şey doğru. (`XFF=` kısmında `1.2.3.4, <senin IP'in>` görürsün; sahte değer yok sayılmıştır.)
   - `çözümlenen=1.2.3.4` ise sahte başlık işe yarıyor demektir: `ForwardLimit` fazla yüksek; `1` yap.
   - `çözümlenen=` senin IP'in değil de Render/Cloudflare'e ait bir adres (ör. `10.x.x.x`) ve senin IP'in listede onun hemen solundaysa, Render isteğe birden fazla katman ekliyor demektir. Bu durumda `ForwardLimit`'i, senin IP'ine ulaşacak kadar (genellikle `2`) artır ve 3. adımı tekrarla; `çözümlenen=1.2.3.4` görünmeye başlarsa bir geri al.
5. Kontrol bitince `ForwardedHeaders__LogDiagnostics` değişkenini **sil** (IP adresleri kişisel veri sayılır; kalıcı loglanmasın).

Kalan risk: Güvenlik, Render'ın konteynere yalnızca kendi proxy'si üzerinden erişim vermesine ve en sağdaki değeri kendisinin eklemesine dayanır. Render bu davranışı değiştirirse (ör. ek bir katman eklerse) sınırlar yeniden paylaşılmaya başlayabilir; o yüzden yukarıdaki kontrolü Render'da büyük bir değişiklik duyurulursa tekrarla. API'yi Render dışında, internete doğrudan açık bir sunucuda çalıştıracaksan `ForwardedHeaders__Enabled=false` yap ya da `KnownProxies`'i doldur.

---

## 6. Güncelleme (yeni sürüm yayına nasıl çıkar)

- Kod `main` dalına geldiğinde (merge ya da push) iki servis de **otomatik** yayınlar:
  - **Render:** Auto-Deploy açıksa, `backend/PlanToBee.API` altında değişiklik varsa imajı yeniden derler ve yeni sürümü yayına alır. Sağlık kontrolü (`/health`) tanımlı olduğu için Render yeni sürüm sağlıklı cevap verene kadar bekler; açılamazsa dağıtım başarısız görünür ve Logs'ta nedeni yazar. Yeni migration'lar açılışta kendiliğinden uygulanır.
  - **Cloudflare Pages:** Her `main` commit'inde `frontend`'i yeniden derler ve yayınlar. Diğer dallar önizleme build'i üretir (bu build'ler `VITE_API_URL` yoksa bilerek hata verir).
- Elle yeniden dağıtmak için: Render > **Manual Deploy** > **Deploy latest commit**; Cloudflare > **Deployments** > **Retry deployment**.
- Veritabanı şemasını değiştiren bir sürüm çıkmadan önce Neon'da yedek almak istersen: Neon > **Branches** > **Create branch** (o anki verinin kopyası).

---

## 7. Yerel geliştirme (değişmedi)

- Backend: `backend/PlanToBee.API` içinde `dotnet run` (port 5002, `Development` ortamı). Yerel bağlantı dizesi `appsettings.Development.json`'da, e-postalar `dev-emails/` klasörüne yazılır, JWT anahtarı `dotnet user-secrets` ile verilir. Üretimdeki sıkı ayar kontrolleri geliştirmede uygulanmaz.
- Frontend: `frontend` içinde `npm run dev` (port 5173, API varsayılanı `http://localhost:5002/api`).
- Docker imajını yerelde denemek için (Docker Desktop kuruluysa):
  ```bash
  cd backend/PlanToBee.API
  docker build -t plantobee-api .
  docker run --rm -p 10000:10000 -e PORT=10000 \
    -e ConnectionStrings__Default='postgresql://...' -e Jwt__Key='...' \
    -e Email__Smtp__Username='...' -e Email__Smtp__Password='...' -e Email__From='...' \
    -e App__FrontendBaseUrl='https://plantobee.pages.dev' plantobee-api
  # sonra: curl http://localhost:10000/health
  ```
