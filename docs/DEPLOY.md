# PlanToBee: Canlıya Çıkış Rehberi

Bu rehber PlanToBee'nin yeni sürümünü (React + .NET) ücretsiz servislerle internete açmak için adım adım yol gösterir. Sırayla ilerle; her adım bir öncekinde not aldığın bilgileri kullanır.

> Servislerin ekranları ve düğme adları zamanla değişebilir. Bir düğmeyi bulamazsan menü yolunu ve alan adını takip et, gerekirse ilgili servisin belgesine bak (bağlantılar her bölümün başında).

> Kökteki `index.html` (eski Firebase sürümü) `https://iisler.github.io/PlanToBee/` adresinde eskisi gibi yayında kalır. Yeni sürüm onun yanında, `https://iisler.github.io/PlanToBee/app/` adresinde açılır.

İki aşama var:
- **Aşama 1 (bu rehberin ana kısmı):** Alan adı olmadan, tamamen ücretsiz kurulum. Bölüm 1-7.
- **Aşama 2:** `plantobee.com` alan adına geçiş. Bölüm 8. Aşama 1'de kurulan veritabanı ve API aynen kalır; yalnızca adresler değişir.

---

## 1. Genel bakış

| Parça | Servis | Ne yapar |
|---|---|---|
| Veritabanı | **Neon** (yönetilen PostgreSQL) | Kullanıcılar, aileler, planlar burada durur. |
| API (backend) | **Render** (Docker web servisi) | `backend/PlanToBee.API`. Tarayıcıdan gelen istekleri işler, veritabanına bağlanır, e-posta gönderir. Repodaki `render.yaml` (Blueprint) ile kurulur. |
| Site (frontend) | **GitHub Pages** | `frontend/`. Kullanıcının tarayıcısına inen React uygulaması. `.github/workflows/pages.yml` her `main` güncellemesinde derleyip yayınlar. |
| E-posta | **Brevo** (SMTP) | E-posta doğrulama ve şifre sıfırlama e-postalarını gönderir. Gönderen adres bu iş için açılan Gmail hesabıdır. |

Nasıl konuşurlar:

```
Tarayıcı ──(1) siteyi indirir──> GitHub Pages  (https://iisler.github.io/PlanToBee/app/)
   │
   └──(2) API istekleri (VITE_API_URL)──> Render proxy ──> PlanToBee API konteyneri
                                                              │
                                   (3) SSL ile ──> Neon PostgreSQL
                                   (4) SMTP 2525 + STARTTLS ──> Brevo ──> kullanıcının gelen kutusu
```

- Site, API'nin adresini **build sırasında** `VITE_API_URL` değişkeninden öğrenir (GitHub'da repo değişkeni).
- API, sitenin adresini `App__FrontendBaseUrl` ayarından öğrenir. Bu adres iki iş görür: e-postalardaki linkler bu adresle başlar ve API yalnızca bu adresin alan adından gelen tarayıcı isteklerine izin verir (**CORS**: tarayıcının, bir sitenin başka bir adresteki API'yi çağırmasına izin verilip verilmediğini kontrol etmesi).
- API ilk açılışta veritabanında tabloları kendisi oluşturur (**migration**: veritabanı şemasını koddaki modele getiren adımlar). Elle SQL çalıştırman gerekmez.

**Neden Gmail ile doğrudan değil de Brevo ile gönderiyoruz?** Render'ın ücretsiz planı, Eylül 2025'ten beri giden e-posta portlarını (25, 465, 587) engelliyor. Gmail yalnızca bu portlarla çalışır. Brevo ise 2525 portunu da destekler; bu port açıktır.

**Terimler:**
- **Ortam değişkeni (environment variable):** Servisin ayar ekranına girilen `AD = değer` çifti. Şifreler koda değil buraya yazılır.
- **Gizli (secret):** Başkası görürse zarar verecek değer (şifre, anahtar). Hiçbir zaman GitHub'a, ekran görüntüsüne ya da sohbete yapıştırılmaz.
- **Proxy:** Render'da isteği internetten alıp konteynere ileten ara sunucu. HTTPS'i (şifreli bağlantıyı) o çözer; konteynere istek düz HTTP olarak gelir.
- **Blueprint:** Render'ın, repodaki `render.yaml` dosyasını okuyup servisi o ayarlarla kendisi kurması.

---

## 2. Ortam değişkenleri

Render'daki değişken adlarında `__` (iki alt çizgi) bir alt bölümü gösterir: `Email__Smtp__Password` = `Email > Smtp > Password` ayarı. Adları **birebir** yaz (büyük/küçük harf dahil).

Blueprint ile kurulumda (Bölüm 3.3) Render yalnızca **sana sorulması gerekenleri** sorar; diğerleri `render.yaml`'da ya da `appsettings.Production.json`'da hazırdır.

### Render (API)

| Değişken | Ne işe yarar | Blueprint'te | Örnek biçim | Değer nereden | Gizli mi |
|---|---|---|---|---|---|
| `ConnectionStrings__Default` | Veritabanı bağlantısı. Neon'un verdiği `postgresql://` adresi olduğu gibi yapıştırılır. | **Sorulur** | `postgresql://neondb_owner:<şifre>@ep-xxx-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Neon > Connect (havuz kapalı) | **Evet** |
| `Email__Smtp__Username` | Brevo SMTP kullanıcı adı. | **Sorulur** | `8a1b2c001@smtp-brevo.com` | Brevo > SMTP & API > SMTP sekmesi > **Login** | Evet (hassas) |
| `Email__Smtp__Password` | Brevo SMTP anahtarı (Brevo hesap şifren **değil**). | **Sorulur** | `xsmtpsib-...` | Brevo > SMTP & API > SMTP > Generate a new SMTP key | **Evet** |
| `Email__From` | E-postaların gönderen adresi. Brevo'da **doğrulanmış** olmalı. | **Sorulur** | `plantobee.app@gmail.com` | Brevo > Senders'ta doğruladığın adres | Hayır |
| `Jwt__Key` | Oturum belirteçlerini (giriş anahtarlarını) imzalayan anahtar. | Render **kendisi üretir** | 44 karakterlik rastgele metin | Render | **Evet** |
| `PersonalData__Key` | E-posta adreslerini veritabanında **şifreleyen** anahtar. Kaybolursa adresler kurtarılamaz; değiştirilirse kimse giriş yapamaz. Üretimde zorunlu. | Render **kendisi üretir** | 44 karakterlik rastgele metin | Render | **Evet, yedeğini al (3.3, 8. adım)** |
| `DataProtection__KeyEncryptionKey` | E-posta doğrulama ve şifre sıfırlama linklerini imzalayan anahtarları veritabanında **şifreli** tutan anahtar. Yoksa `Jwt__Key`'den türetilir (açılışta uyarı yazılır). | Render **kendisi üretir** | 44 karakterlik rastgele metin | Render | **Evet** |
| `App__FrontendBaseUrl` | Sitenin adresi: e-posta linkleri ve CORS izni. `https://` ile başlar, sonunda `/` yok. Site bir alt yoldaysa yol da yazılır. | Hazır | `https://iisler.github.io/PlanToBee/app` | `render.yaml` | Hayır |
| `Email__FromName` | Gönderen adı (gelen kutusunda görünen). | Varsayılan `PlanToBee` | `PlanToBee` | - | Hayır |
| `Email__Smtp__Host` | SMTP sunucusu. | Varsayılan `smtp-relay.brevo.com` | `smtp-relay.brevo.com` | - | Hayır |
| `Email__Smtp__Port` | SMTP portu (STARTTLS). | Varsayılan `2525` | `2525` | - | Hayır |
| `Email__Smtp__EnableSsl` | STARTTLS ile şifreli bağlantı. Üretimde `false` kabul edilmez. | Varsayılan `true` | `true` | Değiştirme | Hayır |
| `Email__Provider` | E-posta sağlayıcısı. Üretimde yalnızca `Smtp` kabul edilir. | Varsayılan `Smtp` | `Smtp` | Değiştirme | Hayır |
| `ASPNETCORE_ENVIRONMENT` | Ortam adı. Docker imajı zaten `Production` ile açılır. | Varsayılan `Production` | `Production` | Değiştirme | Hayır |
| `PORT` | API'nin dinlediği port. **Render kendisi verir, girme.** | Otomatik | `10000` | Render | Hayır |
| `Jwt__Issuer` / `Jwt__Audience` | Belirteç düzenleyici / hedef adı. | Varsayılan `plantobee` | `plantobee` | Değiştirme | Hayır |
| `Jwt__AccessTokenMinutes` | Erişim belirtecinin ömrü (dakika). Dolunca uygulama yenileme belirteciyle sessizce yenisini alır. | Varsayılan `15` (1-1440) | `15` | - | Hayır |
| `Jwt__RefreshTokenDays` | Yenileme belirtecinin ömrü (gün). Her kullanımda yenilenir; bu kadar gün hiç açılmayan cihazda yeniden giriş gerekir. | Varsayılan `30` (1-365) | `30` | - | Hayır |
| `ForwardedHeaders__Enabled` | Proxy'nin eklediği gerçek istemci IP'si ve HTTPS bilgisini kullan. | Varsayılan `true` | `true` | Değiştirme | Hayır |
| `ForwardedHeaders__ForwardLimit` | `X-Forwarded-For` listesinde sağdan kaç girişe güvenileceği (Render için **1**). | Varsayılan `1` | `1` | Bölüm 5'teki kontrolle doğrulanır | Hayır |
| `ForwardedHeaders__KnownProxies` | Güvenilen proxy IP'leri (virgülle). Render'da boş kalır. | Boş | `10.0.0.5` | - | Hayır |
| `ForwardedHeaders__KnownNetworks` | Güvenilen proxy ağları (CIDR). Render'da boş kalır. | Boş | `10.0.0.0/8` | - | Hayır |
| `ForwardedHeaders__LogDiagnostics` | Her isteğin ham `X-Forwarded-For` başlığını ve bulunan IP'yi loglar. Yalnızca kontrol için kısa süre aç. | Varsayılan `false` | `true` | - | Hayır |
| `RateLimits__Auth` | Giriş/kayıt/şifre işlemleri: IP başına dakikada en fazla istek. | Varsayılan `20` | `20` | - | Hayır |
| `RateLimits__Pin` | Profil seçimi (PIN denemesi): aile hesabı başına 5 dakikada en fazla istek. Ayrıca her profil 5 hatalı PIN'de 5 dk kilitlenir. | Varsayılan `20` | `20` | - | Hayır |
| `RateLimits__Session` | Oturum bilgisi (`/auth/me`): kullanıcı başına dakikada en fazla istek. | Varsayılan `120` | `120` | - | Hayır |

> Kullanma: `ASPNETCORE_FORWARDEDHEADERS_ENABLED`. Bu, .NET'in kendi kısayolu; PlanToBee kendi `ForwardedHeaders__*` ayarlarını kullanır, ikisi birlikte kafa karıştırır.

> **JWT anahtarı hakkında:** Repo geçmişinde (ilk backend commit'i `664694a`, `appsettings.json`) eski bir JWT anahtarı açık metin olarak bulunuyor. O anahtar herkese açık sayılır ve API onunla açılmayı reddeder. Blueprint yeni, rastgele bir anahtar ürettiği için ek bir şey yapman gerekmez. Anahtarı elle değiştirmek istersen Mac'te Terminal'de `openssl rand -base64 48` çalıştır ve çıkan satırı Render > Environment > `Jwt__Key` değerine yapıştır. Anahtar değişirse açık erişim belirteçleri geçersiz olur; uygulama yenileme belirteciyle yenisini alır. `DataProtection__KeyEncryptionKey` ayarlı değilse bekleyen doğrulama ve şifre sıfırlama linkleri de geçersiz olur (yenisi istenebilir).

> **Data Protection anahtar şifrelemesi hakkında:** `DataProtection__KeyEncryptionKey` değiştirilirse eski anahtarlar çözülemez; o ana kadar gönderilmiş doğrulama ve şifre sıfırlama linkleri çalışmaz, yeni linkler çalışır. Bu değer değiştirilmemeli. Bu özellikten önce oluşturulmuş anahtarlar (varsa) veritabanında şifresiz kalır ve 90 gün içinde kendiliğinden kullanımdan düşer.

### GitHub (site)

| Ayar | Nerede | Değer |
|---|---|---|
| `VITE_API_URL` | Repo > Settings > Secrets and variables > Actions > **Variables** sekmesi | Render adresi + `/api`, ör. `https://plantobee-api.onrender.com/api`. Gizli değildir (tarayıcıya gider). |
| Pages kaynağı | Repo > Settings > Pages > Build and deployment > **Source** | **GitHub Actions** |

`VITE_API_URL` tanımlı değilken iş akışı yalnızca eski `index.html`'i yayınlar ve React sürümünü atlar (Actions sayfasında sarı bir uyarı görünür). Eski sürüm hiçbir durumda bozulmaz.

---

## 3. Canlıya çıkış, adım adım

Başlamadan önce: canlıya çıkacak kodun GitHub'da `main` dalında olması gerekir (Render ve GitHub Pages `main`'i yayınlar).

Aşağıdaki adımlarda not alacağın değerler:

| Not | Nereden | Nerede kullanılacak |
|---|---|---|
| Neon bağlantı adresi | 3.1 | Render: `ConnectionStrings__Default` |
| Gmail adresi | 3.2 | Brevo gönderen adresi, Render: `Email__From` |
| Brevo Login ve SMTP anahtarı | 3.2 | Render: `Email__Smtp__Username`, `Email__Smtp__Password` |
| Render adresi | 3.3 | GitHub: `VITE_API_URL` |

### 3.1 Neon: veritabanı

Belge: https://neon.tech/docs/connect/connect-from-any-app

1. https://neon.tech adresinde hesap aç (**Sign up with GitHub**). Ücretsiz plan (Free) yeterli.
2. **Create project** (yeni proje):
   - **Project name:** `plantobee`
   - **Postgres version:** önerileni bırak.
   - **Region:** **AWS Europe Central 1 (Frankfurt)**. Render'da da Frankfurt kullanılıyor; aynı bölgede olmaları hızı artırır.
   - **Database name:** `neondb` kalabilir.
3. Proje açılınca **Dashboard**'da **Connect** düğmesine tıkla. Açılan pencerede:
   - **Branch:** `main`, **Database:** oluşturduğun veritabanı, **Role:** `neondb_owner` (varsayılan).
   - **Connection pooling** anahtarını **KAPAT**. Adresteki sunucu adında `-pooler` **olmamalı**.
     Neden: Havuzlu (pooled) bağlantı PgBouncer üzerinden geçer; API'nin açılışta çalıştırdığı migration adımları doğrudan bağlantıda güvenilir çalışır. PlanToBee tek sunucuyla çalıştığı için havuza ihtiyaç yok. (Havuzlu adres girilirse API açılır ama logda uyarı verir.)
   - Biçim olarak **Connection string** seçili olsun. Şuna benzer bir satır görürsün:
     ```
     postgresql://neondb_owner:<şifre>@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   - Şifreyi göstermek için **Show password**'e tıkla ve satırın **tamamını** kopyala. Bu, Render'daki `ConnectionStrings__Default` değeridir. **Gizlidir.**
4. Tabloları elle oluşturma; API ilk açılışta kendisi oluşturur.

Bağlantı biçimi hakkında:
- API `postgres://` ve `postgresql://` adreslerini doğrudan kabul eder. Başka bir biçime çevirmen gerekmez.
- Şifrede `@ : / # ?` gibi özel karakterler varsa URL-kodlu olmalıdır (Neon'un kopyaladığı adres zaten doğru biçimdedir).
- Üretimde SSL zorunludur: `sslmode=require` (ya da parametre hiç yoksa) API bağlantıyı **sertifika ve sunucu adı doğrulamalı** SSL'e (`verify-full`) yükseltir. `sslmode=disable` yazılırsa API açılmaz.

### 3.2 Gmail ve Brevo: e-posta

Belge: https://help.brevo.com/hc/en-us/articles/7924908994450 (SMTP ayarları), https://help.brevo.com/hc/en-us/articles/208836149 (gönderen doğrulama)

**Gmail hesabı (gönderen adres):**
1. Yalnızca bu iş için yeni bir Gmail hesabı aç, ör. `plantobee.app@gmail.com`. Görünen ad: **PlanToBee**. Kişisel hesabını kullanma.
2. Gmail'de uygulama şifresi ya da iki adımlı doğrulama **gerekmez**; e-postayı Brevo gönderecek.

**Brevo hesabı:**
1. https://www.brevo.com adresinde yeni Gmail adresinle ücretsiz hesap aç. Ücretsiz plan günde **300 e-posta** gönderir; bu aşama için yeterli.
2. **Gönderen adresini doğrula:** Sağ üstte hesap menüsü > **Senders, Domains & Dedicated IPs** > **Senders** > **Add sender**.
   - **From name:** `PlanToBee`
   - **From email:** yeni Gmail adresin.
   - Brevo bu adrese bir doğrulama e-postası (ya da kod) gönderir; onayla.
   - Doğrulanmamış adresle gönderim **reddedilir** ya da e-postalar **spam'e düşer**.
   - Not: Gmail gibi ücretsiz bir adresi gönderen olarak kullanmak çalışır ama e-postalar alıcıda spam'e düşebilir. Test aşamasında doğrulama e-postası gelmezse spam klasörüne bakman yeterli. Kalıcı çözüm Aşama 2'de kendi alan adını Brevo'da doğrulamaktır (Bölüm 8).
3. **SMTP anahtarı oluştur:** Hesap menüsü > **SMTP & API** > **SMTP** sekmesi > **Generate a new SMTP key**.
   - İsim: `plantobee-render`. Oluşan anahtarı (`xsmtpsib-...`) **hemen kopyala**; Brevo bir daha göstermez. Bu `Email__Smtp__Password` değeridir. **Gizlidir.**
4. Aynı ekranda **Login** değerini not al: `...@smtp-brevo.com` biçimindedir. Bu `Email__Smtp__Username` değeridir. (Brevo'ya giriş yaptığın e-posta adresi değildir.)

API, 2525 portuna düz bağlanır ve **STARTTLS** komutuyla bağlantıyı şifreler; kullanıcı adı ve anahtar yalnızca şifreli bağlantı kurulduktan sonra gönderilir.

### 3.3 Render: API (Blueprint ile)

Belge: https://render.com/docs/infrastructure-as-code, https://render.com/docs/docker, https://render.com/docs/health-checks

Servisin ayarları (Docker, Frankfurt, ücretsiz plan, `/health` sağlık kontrolü, `main` dalından otomatik yayın) repodaki `render.yaml` dosyasında hazır. Sen yalnızca gizli değerleri girersin.

1. https://render.com adresinde hesap aç (**Sign up with GitHub**). GitHub erişim izni sorarsa **Only select repositories** seç ve yalnızca `PlanToBee`'yi işaretle.
2. **Dashboard** > **New** > **Blueprint**.
3. `PlanToBee` reposunu seç. **Blueprint Name:** `plantobee`. **Branch:** `main`.
4. Render `render.yaml`'ı okur ve `plantobee-api` servisini gösterir. Aşağıdaki değerleri sorar; not aldıklarını yapıştır:

   | Key | Value |
   |---|---|
   | `ConnectionStrings__Default` | Neon'dan kopyaladığın adres (3.1) |
   | `Email__Smtp__Username` | Brevo **Login** (3.2) |
   | `Email__Smtp__Password` | Brevo SMTP anahtarı (3.2) |
   | `Email__From` | Brevo'da doğruladığın Gmail adresi (3.2) |

   `Jwt__Key`, `PersonalData__Key` ve `DataProtection__KeyEncryptionKey`'i Render kendisi üretir; `App__FrontendBaseUrl` hazırdır.
5. **Apply** (ya da **Deploy Blueprint**). İlk derleme birkaç dakika sürer.
6. Servis sayfasında **Logs** sekmesinden açılışı izle. Başarılı açılışta sırayla şunları görürsün:
   ```
   Ortam: Production, e-posta: Smtp, forwarded header: açık (ForwardLimit=1)
   Veritabanı migration'ları uygulanıyor: ..._InitialCreate, ..._FamilyAccounts, ...
   Applying migration '...'
   Veritabanı hazır.
   Now listening on: http://0.0.0.0:10000
   ```
   - Boş veritabanında ilk açılışta `fail: ... Failed executing DbCommand ... "__EFMigrationsHistory"` satırları görünür. Bu **normaldir**: tablo henüz yoktur, hemen ardından oluşturulur.
   - `warn: ... Overriding HTTP_PORTS` ve `warn: ... No XML encryptor configured` satırları da **normaldir**.
   - `PlanToBee API başlatılamadı ... ayar hatası` görürsen hangi ayarın eksik olduğu satır satır yazar; Bölüm 4'e bak.
7. Servis sayfasının üstündeki adresi (ör. `https://plantobee-api.onrender.com`) not al. Ad alınmışsa Render sonuna ek koyar; gerçek adres burada yazandır. Tarayıcıda `<adres>/health` aç; şunu görmelisin:
   ```json
   {"status":"ok","api":"ok","database":"ok"}
   ```

8. **E-posta şifreleme anahtarını yedekle (önemli):** Render > `plantobee-api` > **Environment** > `PersonalData__Key` satırında değeri göster ve kopyala. Bir parola yöneticisine (ör. iCloud Anahtar Zinciri, 1Password) "PlanToBee PersonalData__Key" adıyla kaydet.
   - Veritabanındaki e-posta adresleri bu anahtarla şifrelidir. Render servisi silinir ya da değer kaybolursa adresler **kurtarılamaz**.
   - Değeri **değiştirme**: değişirse mevcut kullanıcılar giriş yapamaz.
   - Yönetici komutları (Bölüm 7) bu anahtarla çalışır.

Sağlık adresleri:
- `/health`: API ve veritabanı. Veritabanına ulaşılamazsa **503** ve `"database":"unreachable"` döner. Render bu adresi dağıtım ve çalışma sırasında kontrol eder.
- `/health/live`: yalnızca API (veritabanına dokunmaz).
- İkisi de giriş gerektirmez, istek sınırına takılmaz ve bağlantı bilgisi, sunucu adı ya da hata ayrıntısı içermez.

Render ücretsiz plan notları:
- 15 dakika istek gelmezse servis **uyur**. Sonraki ilk istekte uyanması **30-60 saniye** sürebilir; bu sırada site "Sunucuya ulaşılamadı" gösterebilir, biraz bekleyip yenilemek yeterli.
- Uyanınca konteyner sıfırdan başlar. Şifre sıfırlama ve e-posta doğrulama linklerini imzalayan anahtarlar bu yüzden veritabanında saklanır; uyku sonrası linkler geçerli kalır. Oturumlar `Jwt__Key` ile imzalandığı için uykudan etkilenmez. İstek sınırı sayaçları ise bellekte tutulduğu için yeniden başlatmada sıfırlanır.
- Neon ücretsiz planda veritabanı da 5 dakika boşta kalınca uyur; ilk sorguda saniyeden kısa sürede uyanır.

### 3.4 GitHub Pages: site

Belge: https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site, https://docs.github.com/actions/learn-github-actions/variables

1. GitHub'da repo > **Settings** > **Secrets and variables** > **Actions** > **Variables** sekmesi > **New repository variable**:
   - **Name:** `VITE_API_URL`
   - **Value:** 3.3'teki Render adresi + `/api`, ör. `https://plantobee-api.onrender.com/api`
2. Repo > **Settings** > **Pages** > **Build and deployment** > **Source**: **GitHub Actions** seç. (Önceden "Deploy from a branch" seçiliydi; eski `index.html` artık iş akışıyla yayınlanır, adresi değişmez.)
3. Repo > **Actions** > **GitHub Pages** iş akışı > **Run workflow** > `main` > **Run workflow**. Birkaç dakikada biter.
4. `https://iisler.github.io/PlanToBee/app/` adresini aç; PlanToBee giriş ekranı gelmeli. `https://iisler.github.io/PlanToBee/` eski sürüm olarak açılmaya devam etmeli.

Bilmen gerekenler:
- `VITE_API_URL` **build sırasında** koda gömülür. Değeri değiştirirsen iş akışını yeniden çalıştır (3. adım). Yalnızca değişkeni kaydetmek yetmez.
- E-posta doğrulama ve şifre sıfırlama linkleri (`/PlanToBee/app/verify-email?...` gibi) GitHub Pages'te doğrudan açıldığında sunucu 404 döner. İş akışı bunun için uygulamanın bir kopyasını `404.html` olarak yayınlar; tarayıcı uygulamayı açar ve doğru sayfayı gösterir. Adres ve linkteki bilgiler korunur.

### 3.5 Birbirine bağlama

Blueprint `App__FrontendBaseUrl`'i `https://iisler.github.io/PlanToBee/app` olarak kurar; bu adres doğruysa bir şey yapman gerekmez. Kontrol et:

1. **Render** > `plantobee-api` > **Environment** > `App__FrontendBaseUrl` = `https://iisler.github.io/PlanToBee/app` (`https://` ile, **sonunda `/` yok**).
2. **GitHub** > Settings > Secrets and variables > Actions > Variables > `VITE_API_URL` Render'ın **gerçek** adresiyle aynı mı (`https://<render-adı>.onrender.com/api`). Farklıysa düzelt ve iş akışını yeniden çalıştır.

Hangi değişiklikten sonra ne yapılır:

| Değiştirdiğin | Yeniden dağıtılacak taraf |
|---|---|
| Render'da herhangi bir ortam değişkeni (ör. `App__FrontendBaseUrl`, SMTP bilgisi) | Render (kaydedince kendisi yeniden başlatır). GitHub'a dokunma. |
| GitHub'da `VITE_API_URL` | GitHub Pages iş akışını yeniden çalıştır. Render'a dokunma. |
| Render servis adı/adresi | GitHub'da `VITE_API_URL` güncelle + iş akışını yeniden çalıştır. |
| Sitenin adresi (ör. Aşama 2'de `https://plantobee.com`) | Render'da `App__FrontendBaseUrl` güncelle (tek ayar yeter; e-posta linkleri ve CORS birlikte değişir). |

### 3.6 Test

Sırayla dene; hepsi geçerse kurulum tamamdır.

1. **Sağlık:** `https://<render-adı>.onrender.com/health` > `{"status":"ok","api":"ok","database":"ok"}`. (Uykudaysa ilk açılış 30-60 sn sürebilir.)
2. **Kayıt:** `https://iisler.github.io/PlanToBee/app/` aç > kayıt ol (kendi e-posta adresinle).
3. **Doğrulama e-postası:** Gelen kutuna (yoksa spam klasörüne) "PlanToBee: E-posta adresini doğrula" gelmeli. Linke tıkla; site açılmalı ve doğrulama başarılı olmalı. Link `https://iisler.github.io/PlanToBee/app/verify-email?...` ile başlamalı.
4. **Aile kurma:** Aileni oluştur.
5. **Profiller:** Ailem ekranından bir çocuk profili (PIN'siz) ve bir ebeveyn profili (PIN'li) ekle. Başka bir cihazda (ya da gizli pencerede) aile hesabıyla giriş yap: "Kim kullanıyor?" ekranı gelmeli; çocuk profili doğrudan, ebeveyn profili PIN ile açılmalı.
6. **Ortak plan:** İki hesaptan aynı güne kayıt ekle; ikisi de her iki kaydı görmeli. Çocuk hesabı ebeveynin kaydını düzenleyememeli.
7. **Şifre sıfırlama:** Çıkış yap > "Şifremi unuttum" > e-postadaki linkle yeni şifre belirle > yeni şifreyle giriş yap.
8. **Yenileme / 404:** `/PlanToBee/app/forgot-password` gibi bir sayfadayken tarayıcıda yenile (Cmd+R); aynı sayfa gelmeli.
9. **Telefonda ana ekran:** iPhone'da Safari > Paylaş > **Ana Ekrana Ekle**; simgeden açınca tarayıcı çubukları olmadan açılmalı.
10. **İstemci IP kontrolü (bir kez):** Bölüm 5'teki adımlarla rate limit'in gerçek IP'ne göre çalıştığını doğrula.

---

## 4. Sorun giderme

**API açılışta duruyor: "PlanToBee API başlatılamadı (Production): N ayar hatası bulundu"**
Render > Logs'ta hemen altında eksik/hatalı her ayar ayrı satırda yazar (değerler güvenlik için yazılmaz). Render > Environment'ta adı **birebir** kontrol et (`__` iki alt çizgi, büyük/küçük harf). Sık olanlar:
- `Jwt:Key ... 32 karakterden kısa`: Bölüm 2'deki JWT notundaki komutla yeni anahtar üret.
- `Jwt:Key repo geçmişinde açıkça yer almış eski anahtar`: Eski anahtarı kopyalamışsın; yenisini üret.
- `Email:Provider üretimde 'Smtp' olmalı`: `Email__Provider` değişkenini sil ya da `Smtp` yap.
- `Email:Smtp:Username/Password ... ayarlı değil`: Brevo Login ve SMTP anahtarını gir.
- `App:FrontendBaseUrl ... geçerli değil`: `https://` ile başlamalı; sorgu (`?`) ya da `#` içermemeli.
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
  - `SMTP gönderimi 30 sn içinde tamamlanamadı` ya da bağlantı hatası: Render'dan SMTP portuna çıkılamıyor. Render'ın ücretsiz planı 25, 465 ve 587 portlarını engeller. `Email__Smtp__Port` değişkeni tanımlıysa `2525` olduğundan emin ol (varsayılan zaten 2525).
- Brevo > **Transactional** > **Logs** (ya da Statistics) ekranında e-postanın Brevo'ya ulaşıp ulaşmadığı ve teslim durumu görünür.
- Günlük 300 e-posta sınırı dolmuş olabilir (Brevo panelinde görünür).
- Kalıcı spam sorunu için kendi alan adını Brevo'da doğrula (SPF/DKIM).
- E-posta gönderilemese bile hesap oluşur; "E-postayı tekrar gönder" ile yeniden denenebilir.

**`/PlanToBee/app/` 404 veriyor ya da GitHub Actions'ta "VITE_API_URL tanımlı değil" uyarısı var**
GitHub > Settings > Secrets and variables > Actions > **Variables** sekmesinde `VITE_API_URL` yok (Secrets sekmesine değil, Variables sekmesine girilmeli). Ekle ve iş akışını yeniden çalıştır (3.4). Pages kaynağının **GitHub Actions** olduğunu da kontrol et.

**Site açılıyor ama her işlemde "Sunucuya ulaşılamadı"**
- Render uykuda olabilir: 30-60 sn bekleyip yenile; `/health` adresini açıp uyandırabilirsin.
- `VITE_API_URL` yanlış olabilir: sonunda `/api` olmalı, `https://` olmalı, Render adı doğru olmalı. Tarayıcıda Geliştirici Araçları (F12 / Cmd+Opt+I) > **Network** sekmesinde isteğin hangi adrese gittiğine bak. Düzeltince GitHub Pages iş akışını yeniden çalıştır.
- CORS olabilir (aşağıda).

**Tarayıcı konsolunda CORS hatası ("blocked by CORS policy")**
- Render'daki `App__FrontendBaseUrl`'in alan adı, sitenin adres çubuğundakiyle **birebir** aynı olmalı: `https://iisler.github.io/...`. CORS yalnızca alan adına bakar (yol önemli değil); `https://plantobee.com` ile `https://www.plantobee.com` farklı sayılır.
- Değiştirince Render kendini yeniden başlatır; birkaç dakika bekle.

**E-postadaki linke tıklayınca ya da yenileyince 404**
- Linkin adresi yanlışsa (ör. `localhost` ya da eski adres): Render'da `App__FrontendBaseUrl`'i düzelt. Bu, yalnızca bundan sonra gönderilen e-postaları düzeltir.
- Site tarafında 404 ise: GitHub Pages iş akışının son çalışması başarılı mı bak (Actions sekmesi) ve Pages kaynağının **GitHub Actions** olduğunu kontrol et. Uygulama sayfası yerine GitHub'ın kendi 404 sayfası geliyorsa `404.html` yayınlanmamış demektir; iş akışını yeniden çalıştır.

**İlk açılış çok yavaş**
Render ücretsiz planda 15 dakika boşta kalan servis uyur; ilk istek 30-60 sn bekletebilir. Normaldir. (Uykuyu engellemek bu aşamada kapsam dışı.)

**"Çok fazla istek gönderildi" hatası**
- Sınırlar: giriş/kayıt IP başına dakikada 20, profil seçimi (PIN) aile hesabı başına 5 dakikada 20. Birkaç dakika bekleyince açılır. Bir profil 5 hatalı PIN'de 5 dakika kilitlenir.
- Farklı kişiler, farklı evlerden birbirini engelliyorsa IP tespiti yanlış olabilir: Bölüm 5'teki kontrolü yap.
- Gerekirse Render'da `RateLimits__Auth` gibi değerleri artır.

---

## 5. Proxy arkasında istemci IP'si (bir kez kontrol et)

Neden önemli: Giriş denemesi sınırları IP başına uygulanır. Render'da istek API'ye proxy üzerinden gelir. API proxy'nin IP'sini görürse bütün kullanıcılar aynı sınırı paylaşır; istemcinin gönderdiği başlığa körü körüne güvenirse de saldırgan sahte `X-Forwarded-For` başlığıyla her denemede farklı IP'den geliyormuş gibi görünüp sınırları atlatır.

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
  - **GitHub Pages:** Her `main` commit'inde iş akışı `frontend`'i yeniden derler ve eski `index.html` ile birlikte yayınlar.
- Elle yeniden dağıtmak için: Render > **Manual Deploy** > **Deploy latest commit**; GitHub > Actions > **GitHub Pages** > **Run workflow**.
- Veritabanı şemasını değiştiren bir sürüm çıkmadan önce Neon'da yedek almak istersen: Neon > **Branches** > **Create branch** (o anki verinin kopyası).

### 6.1 Geri dönüş: "Aktiviteler" sürümünden önceki sürüme

"Etkinlik/Antrenman" yerine ikonlu "Aktiviteler" (Spor, Müzik, Konser, Buluşma, Sınav, Diğer) gelen sürümden önceki
hali git'te `rollback-oncesi-aktiviteler` etiketiyle saklanır. Bu sürüm şema değiştirmez (tür alanı zaten metin),
ama eski kod yeni türleri (`Music`, `Concert`, `Meeting`, `Exam`) tanımaz ve o kayıtları okurken hata verir.
Bu yüzden geri dönüşte **önce veri, sonra kod**:

1. Neon > **SQL Editor**'da yeni türleri "etkinlik"e çevir (ad, saat ve not korunur):
   ```sql
   UPDATE "Events" SET "Kind" = 'Event' WHERE "Kind" IN ('Music', 'Concert', 'Meeting', 'Exam');
   ```
2. Kodu etiketteki hale döndür ve yayınla (iki servis de otomatik yayınlar):
   ```bash
   git revert --no-edit rollback-oncesi-aktiviteler..main
   git push origin main
   ```
3. Bilinen fark: yeni sürümde adla girilen spor kayıtları (ör. "Voleybol kuvvet çalışması") eski sürümde
   "Antrenman" adıyla görünür; adları veritabanında (`Title`) durur, yeniden ileri geçince geri gelir.

### 6.2 Geri dönüş: "Bildirimler" sürümünden önceki sürüme

Bildirimlerden (Web Push) önceki hal git'te `rollback-oncesi-bildirimler` etiketiyle saklanır. Bu sürüm yalnızca
**yeni tablolar** ekler (`PushSubscriptions`, `NotificationPreferences`, `PendingNotifications`); mevcut tablolara
dokunmaz. Eski kod bu tabloları bilmez ve görmezden gelir, bu yüzden geri dönüşte veri adımı gerekmez:

```bash
git revert --no-edit rollback-oncesi-bildirimler..main
git push origin main
```

İstenirse tablolar sonra Neon > SQL Editor'da silinebilir (abonelikler şifreli olduğu için içlerinde okunur bilgi yoktur):
```sql
DROP TABLE "PendingNotifications"; DROP TABLE "NotificationPreferences"; DROP TABLE "PushSubscriptions";
DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" LIKE '%_PushNotifications';
```

Bildirimleri kodu geri almadan **kapatmak** için: Render > Environment'ta `WebPush__Key` silinir. Uygulama bildirim
kartlarını göstermez, hiçbir bildirim gitmez.

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
    -e App__FrontendBaseUrl='https://iisler.github.io/PlanToBee/app' plantobee-api
  # sonra: curl http://localhost:10000/health
  ```

---

## 7b. Yönetici komutları: kullanıcıların e-postasını görmek

E-posta adresleri veritabanında şifreli durur. DBeaver ya da Neon'un SQL ekranında `e1:...` (şifreli adres) ve `h1:...` (arama özeti) görürsün; bu normaldir. Adresleri görmek için kendi bilgisayarında, `backend/PlanToBee.API` klasöründe şu komutları çalıştır. İnternete açık bir yönetici sayfası yoktur; okumak için hem veritabanı adresi hem şifreleme anahtarı gerekir.

| Komut | Ne gösterir |
|---|---|
| `dotnet run -- admin users` | Tüm kullanıcılar: ad, e-posta, doğrulandı mı, ailesi |
| `dotnet run -- admin find ela@ornek.com` | Bu e-postayla kayıtlı kullanıcı var mı |

- **Yerel veritabanı için:** Komutu olduğu gibi çalıştır.
- **Canlı veritabanı (Neon) için:** Neon bağlantı adresini ve yedeklediğin `PersonalData__Key`'i gizli girişle ver. Bu yöntemde değerler ekranda görünmez ve Terminal geçmişine kaydedilmez:
  ```bash
  read -s "NEON?Neon adresi: "; echo; read -s "PDKEY?PersonalData anahtarı: "; echo
  ConnectionStrings__Default="$NEON" PersonalData__Key="$PDKEY" dotnet run -- admin users
  unset NEON PDKEY
  ```
- Çıktı kişisel veri içerir; ekran görüntüsünü paylaşma, dosyaya kaydetme.
- Yanlış anahtar girilirse "Şifreli e-posta adresi çözülemedi" hatası çıkar; veri bozulmaz.

---

## 8. Aşama 2: plantobee.com alan adına geçiş

Aşama 1'deki test başarılı olunca yapılır. Veritabanı (Neon) ve API (Render) aynen kalır; kullanıcılar ve planları taşınmaz, olduğu gibi devam eder. Değişen adreslerdir:

| Adres | Ne var | Nerede |
|---|---|---|
| `https://plantobee.com` | Site | Cloudflare Pages |
| `https://api.plantobee.com` | API | Render (özel alan adı) |
| `noreply@plantobee.com` | Gönderen adres | Brevo (alan adı doğrulamalı) |

Kabaca adımlar (zamanı gelince ayrıntılandırılacak):
1. **Alan adı:** Cloudflare hesabı aç, **Domain Registration > Register Domains** ile `plantobee.com`'u al (Cloudflare maliyetine satar, `.com` yılda yaklaşık 10-11 $). Adres ayarları (DNS) Cloudflare'de kalır.
2. **Site:** Cloudflare > **Workers & Pages** > **Create** > **Pages** > **Connect to Git** > `PlanToBee`:
   - **Root directory:** `frontend`, **Build command:** `npm run build`, **Build output directory:** `dist`
   - Değişkenler: `VITE_API_URL` = `https://api.plantobee.com/api`, `NODE_VERSION` = `22`. `VITE_BASE_PATH` **girilmez** (site kök adreste çalışır).
   - Projeye **Custom domains** > `plantobee.com` ekle.
   - Cloudflare, çıktıda `404.html` yoksa bilinmeyen adresleri kendisi uygulamaya yönlendirir; `_redirects` dosyası ekleme. Build `dist/404.html` bulursa bilerek hata verir.
3. **API:** Render > `plantobee-api` > **Settings** > **Custom Domains** > `api.plantobee.com`. Render'ın gösterdiği CNAME kaydını Cloudflare DNS'e ekle (proxy kapalı, gri bulut).
4. **Bağla:** Render'da `App__FrontendBaseUrl` = `https://plantobee.com`. Mobil uygulama da aynı API'yi kullanacağı için `api.plantobee.com` kalıcı adres olur.
5. **E-posta:** Brevo > **Senders, Domains & Dedicated IPs** > **Domains** > `plantobee.com` ekle; Brevo'nun verdiği SPF/DKIM kayıtlarını Cloudflare DNS'e gir. Doğrulanınca Render'da `Email__From` = `noreply@plantobee.com`. E-postaların spam'e düşme ihtimali azalır.
6. **Gelen e-posta (isteğe bağlı):** Cloudflare > **Email Routing** ile `info@plantobee.com`'a gelenleri Gmail'e yönlendir.
7. **GitHub Pages:** Yeni adres çalışınca eski `/PlanToBee/app/` adresini yeni adrese yönlendirecek küçük bir değişiklik yapılır; kullanıcıların ana ekran kısayolları kırılmaz.

