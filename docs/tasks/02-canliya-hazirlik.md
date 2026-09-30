# Görev: Canlıya Hazırlık (1. adım: kod hazırlığı)

## Özellik Özeti

PlanToBee (backend `backend/PlanToBee.API`, frontend `frontend/`) şu an yalnızca yerel geliştirme ortamında çalışıyor. Bu görevde kod, ücretsiz katmanlı barındırma servislerinde canlıya çıkabilecek hale getirilecek. Hedef ortam:

| Parça | Servis | Önemli özellikler |
|---|---|---|
| Veritabanı | **Neon** (yönetilen PostgreSQL) | SSL zorunlu. Bağlantı bilgisi genellikle `postgres://kullanici:sifre@host/veritabani?sslmode=require` biçiminde verilir. |
| API | **Render** (Docker ile web servisi) | Dinlenecek portu `PORT` ortam değişkeniyle verir. TLS'i önündeki proxy sonlandırır, uygulamaya istek HTTP olarak gelir. Ücretsiz planda bir süre istek gelmezse uykuya geçer. |
| Frontend | **Cloudflare Pages** | Vite build çıktısı statik olarak yayınlanır. |
| E-posta | **Brevo SMTP** | Port 587, STARTTLS. |

Bu görevin kapsamı yalnızca **kodun ve belgelerin hazırlanmasıdır**. Servislerde hesap açma ve gerçek dağıtım sonraki adımlardır.

Verilmiş kararlar:
- Firebase verisi aktarılmayacak. Canlıda herkes sıfırdan hesap açacak.
- Kökteki `index.html` (GitHub Pages'teki eski Firebase sürümü) değiştirilmeyecek.
- Maliyet önemli, ücretsiz katmanlar tercih ediliyor.

Başlıca ihtiyaçlar:
1. API'nin Docker ile paketlenmesi ve Render'ın verdiği porta uyması.
2. Kimlik doğrulama gerektirmeyen bir sağlık kontrolü adresi.
3. Proxy arkasında gerçek istemci IP'sinin güvenli biçimde belirlenmesi (IP bazlı rate limit'ler bütün kullanıcılar arasında paylaşılmamalı, sahte başlıkla atlatılamamalı).
4. Neon bağlantısının kabul edilmesi, SSL'in zorunlu olması, boş veritabanında açılış migration'ının sorunsuz çalışması.
5. Gizli bilgilerin repodan uzak tutulması, eksik ayarda API'nin anlaşılır hatayla durması.
6. Üretimde e-postanın gerçekten SMTP (Brevo) ile gönderilmesi.
7. Frontend'in Cloudflare Pages'te SPA olarak doğru çalışması.
8. Ilker için sade Türkçe, adım adım bir `docs/DEPLOY.md` rehberi.

---

## Kullanıcı Hikayeleri

Bu görevde "kullanıcı" çoğunlukla **Ilker (operatör)**, yani uygulamayı canlıya çıkaracak ve işletecek kişidir.

- **H1.** Operatör olarak, API'yi Render'a Docker ile tek adımda kurabilmek istiyorum, böylece sunucu yönetimiyle uğraşmam.
- **H2.** Operatör olarak, API'nin ve veritabanının ayakta olup olmadığını tek bir adresi açarak görmek istiyorum. Render da bu adresi sağlık kontrolü olarak kullanabilmeli.
- **H3.** Aile üyesi olarak, başka kullanıcıların yoğun kullanımı yüzünden giriş veya davet ekranında "çok fazla istek" hatası almak istemiyorum. Sınırlar benim kendi IP'me göre işlemeli.
- **H4.** Operatör olarak, kötü niyetli birinin sahte başlıklar göndererek giriş denemesi ve davet kodu sınırlarını atlatamayacağından emin olmak istiyorum.
- **H5.** Operatör olarak, Neon'un bana verdiği bağlantı bilgisini ya doğrudan yapıştırabilmek ya da belgede tarif edilen biçime kolayca çevirebilmek istiyorum. Bağlantı her zaman şifreli (SSL) olmalı.
- **H6.** Operatör olarak, API'yi boş bir veritabanına ilk kez bağladığımda tabloların kendiliğinden oluşmasını istiyorum.
- **H7.** Operatör olarak, girmem gereken bütün ayarları tek bir belgede, ne olduklarını ve örnek değerleriyle görmek istiyorum. Bir ayarı unutursam ya da yanlış girersem API neyin eksik olduğunu açıkça söyleyerek dursun.
- **H8.** Operatör olarak, hiçbir şifrenin veya anahtarın GitHub reposunda bulunmadığından emin olmak istiyorum.
- **H9.** Aile üyesi olarak, kayıt doğrulama, şifre sıfırlama ve davet e-postalarının canlıda gerçekten gelen kutuma ulaşmasını istiyorum.
- **H10.** Aile üyesi olarak, e-postadaki davet, doğrulama veya şifre sıfırlama linkine tıkladığımda doğrudan doğru sayfanın açılmasını istiyorum, "sayfa bulunamadı" hatası görmemeliyim.
- **H11.** Operatör olarak (dağıtım konusunda deneyimli değilim), Neon, Brevo, Render ve Cloudflare Pages'i sırayla kurup birbirine bağlamamı ve sonunda her şeyin çalıştığını test etmemi sağlayan adım adım bir rehber istiyorum.

---

## Kabul Kriterleri

### Docker ve port (H1)
- API, repodaki bir Dockerfile ile imaj olarak derlenebilir ve çalıştırılabilir.
- İmaj, Render'ın `PORT` ortam değişkeninde verdiği porttan dinler. `PORT` verilmezse makul bir varsayılan porttan dinler ve bu varsayılan belgede yazar.
- Bir `.dockerignore` dosyası vardır. Derleme çıktıları, yerel gizli dosyalar, `dev-emails/` gibi geliştirme artıkları ve frontend imaja girmez.
- İmaj, üretim ortamı (Production) ayarlarıyla açılır.
- Dockerfile'ın konumu ve Render'da hangi klasörün "kök" olarak seçileceği DEPLOY.md'de yazar.

### Sağlık kontrolü (H2)
- Kimlik doğrulama gerektirmeyen bir sağlık adresi vardır (ör. `GET /health`).
- API ayaktaysa ve veritabanına erişilebiliyorsa başarılı (200) döner.
- Veritabanına erişilemiyorsa başarısız (ör. 503) döner ve cevaptan hangi parçanın sorunlu olduğu anlaşılır.
- Cevap gizli bilgi (bağlantı dizesi, sunucu adı, şifre, hata yığını) içermez.
- Sağlık adresi rate limit'e takılmaz ya da Render'ın düzenli kontrolünü engellemeyecek kadar geniş bir sınıra tabidir.
- **Varsayım:** Sağlık adresi hafif tutulur. Veritabanı kontrolü basit bir erişim denemesidir, ağır sorgu çalıştırmaz.

### Proxy arkasında istemci IP'si, HTTPS ve linkler (H3, H4)
- Render arkasında IP bazlı rate limit'ler (`/api/auth/*`, `/api/invitations/*`, oturumsuz `session` isteği) proxy'nin değil **gerçek istemcinin IP'sine** göre işler. Farklı IP'lerden gelen iki kullanıcı birbirinin sınırını tüketmez.
- İstemcinin kendisi `X-Forwarded-For` gibi bir başlık göndererek IP'sini değiştiremez ve sınırları atlatamaz. Yalnızca güvenilen proxy'nin eklediği bilgi dikkate alınır.
- Forwarded header işleme **konfigürasyonla açılıp kapatılabilir**. Kapalıyken davranış bugünkü gibidir (doğrudan bağlantı IP'si). Yerel geliştirmede kapalıdır.
- Güvenilen proxy kapsamı (ör. kaç proxy katmanına güvenileceği ya da hangi adreslere güvenileceği) ayarla belirlenebilir ve DEPLOY.md'de Render için hangi değerin girileceği yazar.
- Proxy arkasında HTTPS yönlendirmesi sonsuz döngüye girmez. Proxy'ye HTTPS ile gelen istek uygulamada da HTTPS olarak tanınır.
- API'nin ürettiği adresler (varsa) `https://` ile ve doğru alan adıyla üretilir. E-postalardaki linkler zaten `App:FrontendBaseUrl` ayarından geldiği için frontend adresini gösterir.
- **Varsayım:** Render'da API'nin önünde tek bir proxy katmanı olduğu kabul edilir. Backend, Render'ın belgelerine bakarak bu varsayımı doğrular ve DEPLOY.md'ye doğru değeri yazar.
- **Varsayım:** Render ücretsiz planı tek sunucu örneğiyle çalıştığı için bellek içi rate limit ve gönderim sınırları (aile hesabı görevindeki bilinen sınırlama) bu adımda yeterli sayılır.

### Veritabanı bağlantısı ve migration (H5, H6)
- Neon'un verdiği `postgres://` (veya `postgresql://`) URI biçimi doğrudan kabul edilir **ya da** hangi biçimin girileceği ve Neon'un bilgisinin bu biçime nasıl çevrileceği DEPLOY.md'de örnekle açıkça anlatılır. Backend hangi yolu seçtiğini Backend Çıktısı'nda belirtir.
- **Varsayım:** Tercih edilen yol URI biçiminin doğrudan kabul edilmesidir. Böylece Ilker Neon ekranından kopyaladığı değeri olduğu gibi yapıştırabilir.
- Üretimde veritabanı bağlantısı SSL olmadan kurulmaz. Bağlantı bilgisinde SSL kapalı ya da belirtilmemiş olsa bile üretimde SSL zorunlu tutulur veya API anlaşılır bir hatayla durur.
- Yerel geliştirmedeki mevcut bağlantı biçimi çalışmaya devam eder.
- Açılıştaki otomatik migration **tamamen boş** bir PostgreSQL veritabanında hatasız çalışır. Tüm migration'lar (aile hesabı geçişi dahil) sırayla uygulanır ve API açılır. Mevcut kullanıcıları dönüştüren geçiş adımı boş veritabanında sorunsuz atlanır.
- Bu doğrulama gerçekten yapılır: boş bir veritabanı oluşturulur, API açılır, ardından kayıt, doğrulama, aile kurma, davet ve plan kaydı ekleme akışı çalıştırılır.
- Aynı veritabanında API ikinci kez açıldığında migration yeniden uygulanmaya çalışılmaz ve hata vermez.
- **Varsayım:** Neon'un "pooled" (havuzlu) bağlantı adresi yerine doğrudan bağlantı adresi önerilir, çünkü migration'lar havuzlu bağlantıda sorun çıkarabilir. Backend bunu doğrular ve DEPLOY.md'de hangi adresin kullanılacağını açıkça yazar.

### Üretim ayarları ve gizli bilgiler (H7, H8)
- Repoda hiçbir gerçek gizli bilgi bulunmaz: JWT anahtarı, veritabanı şifresi, SMTP şifresi, API anahtarı. Mevcut ayar dosyalarında gizli bilgi varsa kaldırılır. Üretim ayar dosyasında gizli alanlar boş bırakılır ya da hiç yer almaz.
- Mevcut repo geçmişinde gizli bilgi bulunursa bu Backend Çıktısı'nda raporlanır (geçmişi temizlemek bu görevde yok, ancak ilgili anahtarın canlıda farklı olması DEPLOY.md'de vurgulanır).
- Tüm üretim ayarları ortam değişkeniyle verilebilir.
- `docs/DEPLOY.md` içinde girilmesi gereken **tüm** ortam değişkenleri tek bir tabloda listelenir. Her satırda şunlar bulunur:
  - Değişkenin tam adı (Render'a yazılacak biçimde, ör. `Email__Smtp__Password`)
  - Ne işe yaradığı (sade Türkçe)
  - Zorunlu mu, isteğe bağlı mı; isteğe bağlıysa varsayılan değeri
  - Örnek değer biçimi (gerçek değer değil)
  - Nereye girileceği (Render, Cloudflare Pages) ve değerin nereden alınacağı (Neon, Brevo ekranı vb.)
  - Gizli olup olmadığı
- Listede en az şunlar bulunur: ortam adı (Production), JWT imzalama anahtarı ve gerekiyorsa diğer JWT ayarları, veritabanı bağlantısı, e-posta sağlayıcısı, SMTP sunucusu, portu, kullanıcı adı, şifresi ve gönderen adresi/adı, frontend adresi (e-posta linkleri ve CORS), forwarded header ayarları, rate limit ayarları (`RateLimits:*`, isteğe bağlı), port, frontend için `VITE_API_URL`.
- JWT anahtarının nasıl üretileceği (yeterli uzunlukta rastgele bir değer) DEPLOY.md'de basit bir yöntemle anlatılır.
- Üretimde zorunlu bir ayar eksik ya da açıkça hatalıysa API **açılışta durur** ve hangi ayarın eksik/hatalı olduğunu anlaşılır bir mesajla loglar. Mesaj gizli değerin kendisini içermez. En az şu durumlar yakalanır:
  - JWT anahtarı yok ya da çok kısa
  - Veritabanı bağlantısı yok ya da okunamıyor
  - E-posta sağlayıcısı SMTP değil ya da SMTP ayarlarından biri (sunucu, port, kullanıcı, şifre, gönderen adresi) eksik
  - Frontend adresi yok ya da geçerli bir `https://` adresi değil
- Geliştirme ortamında bu sıkı kontroller geliştiriciyi engellemez; mevcut yerel çalışma şekli bozulmaz.

### E-posta (H9)
- Üretimde e-posta sağlayıcısı **SMTP** olmak zorundadır. Üretimde `Log` sağlayıcısı seçilirse API bugünkü gibi yalnızca uyarı vermez, **açılışta durur**.
- SMTP gönderimi Brevo ile uyumludur: port 587 ve STARTTLS ile bağlanır. Bunun için hangi ayar değerlerinin girileceği DEPLOY.md'de yazar.
- Gönderen adresi ve görünen gönderen adı ayarla belirlenir.
- DEPLOY.md'de Brevo'da gönderen adresinin (veya alan adının) doğrulanması gerektiği, aksi halde e-postaların gitmeyeceği ya da spam'e düşeceği belirtilir.
- SMTP'ye bağlanılamazsa ya da gönderim başarısız olursa bu durum loglanır ve kullanıcıya mevcut davranıştaki gibi anlaşılır bir sonuç döner. Log kaydı şifre veya e-posta içindeki link/kod gibi gizli bilgileri içermez.
- **Varsayım:** Brevo ücretsiz planının günlük gönderim sınırı (şu an günde 300 e-posta) bu aşama için yeterlidir. DEPLOY.md'de bu sınır bilgi olarak anılır.

### Frontend: Cloudflare Pages (H10)
- `/invite?token=...`, `/invite-code`, `/verify-email?...`, `/reset-password?...`, `/forgot-password` ve uygulamanın diğer tüm rotaları, tarayıcıya doğrudan yazıldığında veya e-postadan tıklandığında 404 vermeden açılır. Sayfa yenilemede de aynı geçerlidir.
- Statik dosyalar (JS, CSS, logo, favicon) bu yönlendirmeden etkilenmez ve doğru yüklenir.
- `frontend/` altında örnek bir ortam dosyası (ör. `.env.example`) vardır. `VITE_API_URL` değişkeninin ne olduğunu ve örnek değerini (`https://<render-servis-adi>.onrender.com/api` gibi) gösterir. Gerçek `.env` dosyaları git'e girmez.
- `VITE_API_URL` verilmeden üretim derlemesi yapılırsa bu fark edilir (ör. build uyarısı ya da belgede açık uyarı). Canlı sitenin sessizce `localhost` adresine istek atması önlenir.
- DEPLOY.md'de Cloudflare Pages için şunlar yazar: kök klasör (`frontend`), build komutu, çıktı klasörü, Node sürümü (gerekiyorsa) ve `VITE_API_URL` ortam değişkeninin nereye girileceği.
- **Varsayım:** Render ücretsiz planda uykudan uyanmak 30-60 saniye sürebilir. Bu sürede frontend'in mevcut "Sunucuya ulaşılamadı" davranışı kabul edilir. İlk açılışta bekleme olabileceği DEPLOY.md'de bilgi olarak yazar. Uyanma sırasında özel bir yükleniyor ekranı bu görevde istenmiyor.

### CORS
- API, yalnızca ayarda verilen frontend adresinden (Cloudflare Pages adresi) gelen tarayıcı isteklerine izin verir.
- **Varsayım:** Cloudflare Pages'in her dal için ürettiği önizleme adresleri (preview) CORS'a eklenmez. Yalnızca üretim adresi çalışır. İleride özel alan adı eklenirse yalnızca bu ayarın güncellenmesi yeterli olur ve bu DEPLOY.md'de not edilir.

### DEPLOY.md: canlıya çıkış rehberi (H11)
- `docs/DEPLOY.md` dosyası oluşturulur. Dil sade Türkçedir, teknik terimler ilk geçtiği yerde kısaca açıklanır.
- Belgede şu bölümler bulunur:
  1. **Genel bakış:** Hangi parçanın hangi serviste çalıştığı ve birbirleriyle nasıl konuştuğu (kısa bir şema ya da liste).
  2. **Ortam değişkenleri tablosu** (yukarıdaki kriterlere göre).
  3. **Canlıya çıkış, adım adım.** Sıra şöyledir:
     1. **Neon:** Proje ve veritabanı oluşturma, bağlantı bilgisini kopyalama (hangi seçenekle ve hangi biçimde).
     2. **Brevo:** Hesap açma, gönderen adresini doğrulama, SMTP anahtarı oluşturma, SMTP sunucusu, port ve kullanıcı adını not alma.
     3. **Render:** GitHub reposunu bağlama, Docker ile web servisi oluşturma, kök klasör ve Dockerfile yolunu seçme, ücretsiz planı seçme, ortam değişkenlerini girme, sağlık kontrolü adresini tanımlama, ilk dağıtımı başlatma ve loglardan başarılı açılışı kontrol etme.
     4. **Cloudflare Pages:** GitHub reposunu bağlama, kök klasör, build komutu ve çıktı klasörünü girme, `VITE_API_URL`'i girme, yayınlama.
     5. **Birbirine bağlama:** Cloudflare Pages adresini Render'daki frontend adresi ayarına girme, gerekirse Render'ın adresini Cloudflare'deki `VITE_API_URL`'e girme, her iki tarafı yeniden dağıtma. Hangi değişiklikten sonra hangi tarafın yeniden dağıtılması gerektiği açıkça yazar.
     6. **Test:** Sağlık adresini açma, kayıt olma, doğrulama e-postasının gelmesi ve linkin açılması, aile kurma, davet gönderme ve davet linkinin açılması, şifre sıfırlama, bir plan kaydı ekleme, sayfa yenilemede 404 olmaması.
  4. **Sorun giderme:** En olası hatalar ve çözümleri. En az şunlar: API açılışta "ayar eksik" hatasıyla duruyor, veritabanına bağlanamıyor, e-posta gelmiyor ya da spam'e düşüyor, tarayıcıda CORS hatası, linke tıklayınca 404, ilk açılış çok yavaş (uyku), "çok fazla istek" hatası.
  5. **Güncelleme:** Kod değişince yeni sürümün nasıl yayına çıktığı (otomatik dağıtım varsa belirtilir).
- Her adımda **hangi ekrana, hangi alana, hangi değerin** girileceği yazar (ör. "Environment sekmesinde Add Environment Variable'a tıkla, Key: `...`, Value: Neon'dan kopyaladığın bağlantı").
- **Varsayım:** Servislerin ekran ve düğme adları zamanla değişebilir. Belge, adımları mümkün olduğunca menü yolu ve alan adıyla anlatır ve servislerin güncel belgelerine bağlantı verir.
- Rehberde gerçek şifre, anahtar veya bağlantı dizesi bulunmaz; yalnızca örnek biçimler kullanılır.
- Kökteki `index.html`'in (GitHub Pages) bu kurulumdan etkilenmediği ve ona dokunulmayacağı belgede bir cümleyle belirtilir.

### Genel
- Yerel geliştirme ortamı (mevcut `appsettings.Development.json`, `Log` e-posta sağlayıcısı, `npm run dev`) bu değişikliklerden sonra eskisi gibi çalışır.
- Mevcut işlevlerde (aile hesabı, davet, yetki, plan) davranış değişikliği olmaz.
- Kökteki `index.html` dosyasına dokunulmaz.

---

## Backend Gereksinimleri

- **Dockerfile ve .dockerignore:** API için üretim imajı. Render'ın `PORT` değişkenine uyum. Gereksiz dosyaların imaja girmemesi.
- **Sağlık kontrolü:** Kimliksiz bir sağlık adresi. API ve veritabanı durumunu döner, gizli bilgi sızdırmaz, Render sağlık kontrolüyle uyumludur.
- **Forwarded header desteği:**
  - Gerçek istemci IP'si ve isteğin HTTPS olduğu bilgisi yalnızca güvenilen proxy'den alınır.
  - Ayarla açılıp kapatılır, güvenilen proxy kapsamı ayarla belirlenir.
  - Mevcut IP bazlı rate limit politikaları (`Infrastructure/RateLimitPolicies.cs`) proxy arkasında gerçek istemci IP'sini kullanır.
  - HTTPS yönlendirmesi proxy arkasında döngüye girmez.
- **Veritabanı:**
  - Neon URI biçiminin kabul edilmesi (tercih edilen) ya da biçimin belgelenmesi.
  - Üretimde SSL zorunluluğu.
  - Boş veritabanında açılış migration'ının doğrulanması (gerçekten çalıştırılarak).
- **Ayar doğrulama:** Üretimde zorunlu ayarların açılışta kontrol edilmesi, eksik veya hatalıysa anlaşılır bir mesajla durma. Geliştirme ortamı etkilenmez.
- **Gizli bilgiler:** Repodaki ayar dosyalarında gizli bilgi kalmaması. Tüm ayarların ortam değişkeniyle verilebilmesi.
- **E-posta:** Üretimde SMTP zorunluluğu, `Log` sağlayıcısı seçilirse açılışta durma. Brevo (587, STARTTLS) ile uyum. Gönderen adresi ve adı ayarı. Gönderim hatalarının gizli bilgi içermeden loglanması.
- **CORS:** Yalnızca ayardaki frontend adresine izin.
- **Belge:** `docs/DEPLOY.md` dosyasının backend ile ilgili tüm bölümleri (ortam değişkenleri, Neon, Brevo, Render adımları, sorun giderme). Frontend geliştirici Cloudflare Pages bölümünü ve `VITE_API_URL` satırını ekler ya da doğrular.
- **Backend Çıktısı'nda raporlanacaklar:** Seçilen veritabanı bağlantı biçimi, Render için forwarded header değeri ve dayanağı, boş veritabanı testinin sonucu, repoda veya geçmişte bulunan gizli bilgi varsa listesi.

---

## Frontend Gereksinimleri

- **SPA yönlendirmesi:** Cloudflare Pages'te tüm uygulama rotaları doğrudan açıldığında ve yenilendiğinde `index.html` üzerinden uygulamaya gelir. Statik dosyalar etkilenmez.
- **Ortam dosyası örneği:** `frontend/.env.example` (veya eşdeğeri) ile `VITE_API_URL` belgelenir. Gerçek `.env` dosyaları git'e girmez.
- **Yanlış API adresine karşı koruma:** Üretim derlemesinde `VITE_API_URL` verilmemişse bu fark edilir; canlı site sessizce `localhost`'a istek atmaz.
- **Build bilgisi:** Build komutu, çıktı klasörü, gerekiyorsa Node sürümü DEPLOY.md'ye yazılır.
- **Belge:** `docs/DEPLOY.md` içindeki Cloudflare Pages adımı, `VITE_API_URL` satırı ve frontend kaynaklı sorun giderme maddeleri (404, CORS, yanlış API adresi).
- **Doğrulama:** Üretim build'i yerelde statik olarak sunulup (Cloudflare Pages'e benzer biçimde) `/invite?token=...`, `/reset-password?...` gibi adreslerin doğrudan açıldığı denenir.
- Mevcut ekran ve davranışlarda değişiklik yapılmaz.

---

## Kapsam Dışı (bu görevde yok)

- Neon, Brevo, Render ve Cloudflare hesaplarının açılması ve gerçek dağıtım (sonraki adım).
- Özel alan adı (ör. plantobee.com) bağlama ve DNS ayarları. E-posta için alan adı doğrulaması (SPF/DKIM) yalnızca DEPLOY.md'de bilgi olarak anılır.
- Firebase verisinin aktarımı (iptal edildi).
- Kökteki `index.html` ve GitHub Pages yayını.
- Otomatik test ve dağıtım hattı (CI/CD) kurulumu. Render ve Cloudflare'in kendi GitHub bağlantısıyla otomatik dağıtımı dışında ek bir hat kurulmaz.
- Birden fazla sunucu örneği için paylaşılan rate limit deposu (Redis vb.).
- Veritabanı yedekleme stratejisi, izleme ve uyarı servisleri (Neon'un kendi olanakları dışında).
- Render uykusunu önleme (düzenli ping vb.) ve uyanma sırasında özel yükleniyor ekranı.
- Repo geçmişindeki gizli bilgilerin geçmişten temizlenmesi (yalnızca raporlanır).
- Mobil uygulama.

---

## Frontend Çıktısı

### Değişen / eklenen dosyalar
- `frontend/vite.config.js`: Üretim build'inde (`vite build`, mode `production`) `VITE_API_URL` denetimi.
  - Tanımlı değilse build **hata verip durur** (Türkçe mesajla, Cloudflare'de nereye girileceğini söyler).
  - `http(s)://` ile başlayan geçerli bir adres değilse build durur.
  - Adres `localhost`/`127.0.0.1` ise, `https` değilse ya da `/api` ile bitmiyorsa build **uyarı** verir (durmaz; yerelde üretim build'ini denemek mümkün kalsın diye).
  - Değer hem ortam değişkeninden hem `.env*` dosyalarından okunur (ortam değişkeni önceliklidir).
  - Build sonunda `dist/404.html` varsa build durur (aşağıdaki SPA notuna bakın).
- `frontend/src/api/client.js`: `http://localhost:5002/api` varsayılanı artık **yalnızca `npm run dev`** için. Üretim paketinde localhost adresi hiç yer almaz (derlenmiş JS'te `localhost:5002` aranarak doğrulandı: 0 eşleşme). Sondaki `/` temizlenir (`.../api/` girilse de çift `//` oluşmaz). Ekran/davranış değişikliği yok.
- `frontend/.env.example` (yeni): `VITE_API_URL` açıklaması ve örnek değeri (`https://<render-servis-adi>.onrender.com/api`).
- `frontend/.gitignore`: `.env`, `.env.*` yok sayılır, `!.env.example` hariç. (Önceden yalnızca `*.local` yok sayılıyordu; düz `.env` git'e girebilirdi.)
- `frontend/.node-version` (yeni, içerik `22`) ve `package.json` içine `engines.node: "^20.19.0 || >=22.12.0"` (Vite 8, plugin-react ve oxlint'in istediği sürüm).

### SPA yönlendirmesi: seçilen yol ve nedeni
- `_redirects` / `_headers` dosyası **eklenmedi**. Cloudflare Pages, çıktı klasörünün kökünde `404.html` yoksa projeyi SPA sayar ve eşleşmeyen her yolu `index.html` ile 200 olarak döner. Projede `404.html` yok; `vite.config.js` build sonunda bunu denetler, biri ileride eklerse build durur.
- Önce açık kurallar denendi (`/invite /index.html 200` vb.) ve **bozuk olduğu görüldü**: Pages `/index.html` adresini `/`'e 308 ile yönlendirdiği için `/invite?token=abc` → `/?token=abc` oluyor, yol kayboluyor ve davet sayfası açılmıyordu. Genel `/* /index.html 200` kuralı da Cloudflare tarafından sonsuz döngü sayılıp yok sayılır. Bu yüzden DEPLOY.md'de **`_redirects` eklenmesi önerilmemeli**; 404 sorun gidermesinde "çıktıda 404.html ya da `_redirects` kuralı var mı" kontrolü yazılabilir.

### DEPLOY.md için Cloudflare Pages bilgileri (karşılaştırma için)
| Alan | Değer |
|---|---|
| Framework preset | `Vite` (ya da None; aşağıdaki değerler elle girilir) |
| Root directory (kök klasör) | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` (kök klasöre göre; yani `frontend/dist`) |
| Node sürümü | 22 (`frontend/.node-version` dosyası var; Cloudflare okumazsa `NODE_VERSION=22` ortam değişkeni eklenir). En az 20.19 / 22.12 gerekir. |
| Ortam değişkeni | `VITE_API_URL` = `https://<render-servis-adi>.onrender.com/api` (Settings > Environment variables, **Production** için; gizli değildir, tarayıcıya giden JS'e gömülür) |

- `VITE_API_URL` **build sırasında** koda gömülür. Değeri değiştirince Cloudflare Pages'te yeniden dağıtım (Deployments > Retry deployment ya da yeni commit) gerekir; yalnızca değişkeni kaydetmek yetmez.
- Değişken yalnızca Production'a girilirse **önizleme (preview) build'leri bilerek hata verir** ("VITE_API_URL tanımlı değil"). Önizleme istenmiyorsa bu normaldir; istenirse Preview'a da aynı değer girilebilir (CORS önizleme adreslerine izin vermediği için yine de API'ye bağlanamaz).
- Frontend kaynaklı sorun giderme maddeleri önerisi:
  - **Build "VITE_API_URL tanımlı değil" ile düşüyor:** Değişken Pages'te yok ya da yanlış ortamda (Preview/Production) girilmiş.
  - **Sayfa açılıyor ama her işlemde "Sunucuya ulaşılamadı":** `VITE_API_URL` yanlış (sonunda `/api` yok, http/https karışık, Render adı hatalı), Render uykuda (30-60 sn bekle) ya da CORS. Tarayıcı geliştirici araçları > Network sekmesinde isteğin hangi adrese gittiğine bakılır.
  - **CORS hatası:** Render'daki frontend adresi ayarı Pages adresiyle birebir aynı olmalı (`https://`, sonda `/` yok). Önizleme adresleri (`<hash>.<proje>.pages.dev`) çalışmaz.
  - **Linke tıklayınca 404:** Çıktıda `404.html` ya da `_redirects` olmamalı; Root directory `frontend`, output `dist` olmalı.

### Doğrulama (yerelde gerçekten yapılanlar)
- `npm run lint`: 0 hata, 8 uyarı (hepsi önceden var olan `set-state-in-effect`/`only-export-components` uyarıları; değişen dosyalarda uyarı yok).
- `npm run build` senaryoları: değişkensiz → build durdu; `VITE_API_URL=foo` → durdu; `http://localhost:5002/api/` → uyarıyla derlendi; `https://plantobee-api.onrender.com/api` → uyarısız derlendi; `.env.local` dosyasından okuma → çalıştı; `public/404.html` eklendiğinde → build durdu (dosya sonra silindi).
- `dist`, Cloudflare'in kendi yerel emülatörü **`wrangler pages dev`** (wrangler 4, geçici klasöre kuruldu, repoya eklenmedi) ile sunuldu:
  - `/invite?token=...`, `/invite/`, `/invite-code`, `/verify-email?userId=..&token=..`, `/reset-password?userId=..&token=..`, `/forgot-password`, `/login`, `/family`, `/some/unknown/deep/path` → hepsi 200 ve gövde birebir `dist/index.html`; adres ve sorgu parametreleri korunuyor (yönlendirme yok).
  - JS, CSS, `favicon.svg`, `apple-touch-icon.png`, `icons.svg` → 200 ve doğru içerik tipi.
  - Başsız Chrome ile render edildi: `/invite?token=..` davet ekranını, `/invite-code` kod ekranını, `/verify-email` doğrulama ekranını, `/reset-password` yeni şifre formunu, `/forgot-password` sıfırlama ekranını, bilinmeyen yol giriş ekranını gösterdi (API bilerek erişilemez adrese yönlendirildiği için "Sunucuya ulaşılamadı" mesajları beklenen davranış).

### Bilinen sınırlamalar
- Gerçek Cloudflare Pages'te denenmedi; `wrangler pages dev` Cloudflare'in kendi aracı olsa da canlı ortamla birebir aynı olduğu garanti değildir. Canlıya çıkışta DEPLOY.md test adımındaki "linki aç / sayfayı yenile" kontrolü yapılmalı.
- SPA modunda olmayan bir dosya (ör. silinmiş eski `/assets/eski.js`) da 404 yerine `index.html` döner (Cloudflare'in SPA davranışı). Normal kullanımda sorun değil.
- Cloudflare Pages'in `.node-version` dosyasını kök klasörden (`frontend`) okuduğu varsayıldı; doğrulanamadı. Bu yüzden `NODE_VERSION` değişkeni yedek olarak önerildi.
- `docs/DEPLOY.md`'ye dokunulmadı (backend yazıyor); yukarıdaki tablo ve maddeler oradaki Cloudflare Pages bölümüyle karşılaştırılmalı.

---

## Backend Çıktısı

### Değişen / eklenen dosyalar (`backend/PlanToBee.API/` altında)
- `Dockerfile` (yeni): iki aşamalı imaj (sdk:10.0 ile `dotnet publish`, aspnet:10.0 ile çalışma). `ASPNETCORE_ENVIRONMENT=Production`, varsayılan port 8080, yetkisiz `app` kullanıcısı.
- `.dockerignore` (yeni): `bin/`, `obj/`, `dev-emails/`, `.env*`, `*.pfx/*.pem/*.key`, `appsettings.Development.json`, `launchSettings.json`, `*.http`, `.git`, `node_modules`, `frontend/`.
- `Program.cs`: açılış ayar doğrulaması (hata varsa mesaj + çıkış kodu 1), `PORT` desteği (Development dışında), Data Protection anahtarlarının DB'de saklanması, forwarded header, HSTS (yalnızca HTTPS isteklere), `/health`, migration hatasının anlaşılır mesajla durdurulması.
- `Infrastructure/StartupValidation.cs` (yeni): Development dışındaki her ortamda zorunlu ayar kontrolü. Tüm hatalar tek listede; mesajlar ayar adını söyler, değeri yazmaz.
- `Infrastructure/DatabaseConnection.cs` (yeni): `postgres://` / `postgresql://` URI'sini Npgsql biçimine çevirir (sslmode, channel_binding, sslrootcert, connect_timeout, application_name, options), üretimde SSL zorunluluğu.
- `Infrastructure/ForwardedHeadersSetup.cs` (yeni): `ForwardedHeaders:*` ayarları ve tanı logu.
- `Infrastructure/HealthEndpoints.cs` (yeni): `GET /health`, `GET /health/live`.
- `Infrastructure/RateLimitPolicies.cs`: IP bölümleme anahtarı normalize edildi (IPv4-mapped -> IPv4, IPv6 -> /64 önek).
- `Services/Email/SmtpEmailSender.cs`: 30 sn gönderim zaman aşımı, gizli bilgi içermeyen hata logu (sunucu:port, SMTP durum kodu, hata türü, konu), STARTTLS açıklaması.
- `Data/AppDbContext.cs` + `Migrations/20260926180002_DataProtectionKeys*.cs` + snapshot: `DataProtectionKeys` tablosu (yalnızca yeni tablo; mevcut tablolara dokunmaz).
- `PlanToBee.API.csproj`: `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` 10.0.12.
- `appsettings.json`: yerel bağlantı dizesi, `Email:Provider=Smtp` ve `Email:From` varsayılanı çıkarıldı (üretim yanlışlıkla localhost'a ya da doğrulanmamış gönderene düşmesin). `ForwardedHeaders` varsayılanı kapalı.
- `appsettings.Development.json`: yerel bağlantı dizesi buraya taşındı (yerel çalışma aynı).
- `appsettings.Production.json` (yeni, gizli bilgi yok): `ForwardedHeaders:Enabled=true`, `ForwardLimit=1`, `Email:Provider=Smtp`, Brevo sunucusu/587/SSL, EF komut logları Warning.
- `backend/.gitignore`: `.env`, `.env.*`, `*.pfx` eklendi.
- `docs/DEPLOY.md` (yeni): rehberin tamamı (genel bakış, iki ortam değişkeni tablosu, JWT anahtarı üretimi, Neon/Brevo/Render/Cloudflare Pages adımları, bağlama, test, sorun giderme, proxy IP doğrulama prosedürü, güncelleme). Cloudflare Pages bölümü Frontend Çıktısı'ndaki değerlerle yazıldı (`_redirects` önerilmiyor).

### Eklenen uç noktalar
- `GET /health`: 200 `{"status":"ok","api":"ok","database":"ok"}`; DB'ye ulaşılamazsa 503 `{"status":"unhealthy","api":"ok","database":"unreachable"}`. Kimliksiz, rate limit yok, `Cache-Control: no-store`, bağlantı/sunucu/hata ayrıntısı yok. DB kontrolü `CanConnect` (sorgu yok, 5 sn zaman aşımı).
- `GET /health/live`: yalnızca süreç (DB'ye dokunmaz).

### Kararlar ve Backend'in raporlaması istenenler
- **Veritabanı bağlantı biçimi:** URI doğrudan kabul ediliyor. Neon ekranındaki `postgresql://...?sslmode=require&channel_binding=require` olduğu gibi `ConnectionStrings__Default`'a yapıştırılır. Npgsql anahtar=değer biçimi de çalışır (yerel geliştirme). Üretimde `sslmode=disable` -> açılış hatası; belirtilmemiş/`allow`/`prefer`/`require` -> `VerifyFull`'a (şifreleme + sertifika + sunucu adı doğrulaması) yükseltilir. Havuzlu (`-pooler`) adres girilirse uyarı loglanır; DEPLOY.md doğrudan adresi öneriyor.
- **Render forwarded header değeri:** `ForwardedHeaders__Enabled=true` (appsettings.Production.json'da hazır), `ForwardLimit=1`, `KnownProxies`/`KnownNetworks` boş (Render proxy IP aralığı sabit değil, varsayılan loopback güven listesi temizleniyor). Dayanak: ForwardLimit=1 ile yalnızca `X-Forwarded-For`'un en sağdaki girişi, yani konteynere bağlanan proxy'nin eklediği değer kullanılır; istemcinin gönderdiği sol girişler yok sayılır. Render'da konteynere tek erişim yolu Render proxy'sidir. `X-Forwarded-Host` işlenmez. Uygulama içi HTTPS yönlendirmesi yok (Render kenarda yapıyor; Render sağlık kontrolü düz HTTP ile gelir), dolayısıyla döngü yok.
- **Kalan risk (forwarded):** Render'ın tam olarak bir katman eklediği (en sağdaki değerin istemci IP'si olduğu) Render belgelerinden/canlıdan **doğrulanamadı** (bu ortamda internet erişimi/Render hesabı yok). Render önünde Cloudflare gibi ikinci bir katman XFF'e ekleme yapıyorsa en sağdaki değer altyapı IP'si olur ve IP sınırları kullanıcılar arasında paylaşılır (güvenlik açığı değil, işlevsel sorun). Bunun için `ForwardedHeaders__LogDiagnostics=true` ile çalışan bir tanı logu ve DEPLOY.md Bölüm 5'te adım adım doğrulama prosedürü var; gerekirse `ForwardLimit` ayarla değiştirilir. ForwardLimit'i gereğinden büyük yapmak sahte başlığa kapı açar; prosedür bunu da kontrol ediyor. Uygulama internete doğrudan açık bir sunucuda `Enabled=true` ile çalıştırılırsa sahte başlık işe yarar (belgede yazıyor).
- **E-posta:** Üretimde `Email:Provider` Smtp değilse ya da Host/Port/Username/Password/From eksik/hatalıysa veya `EnableSsl=false` ise API açılmaz. `System.Net.Mail.SmtpClient` + `EnableSsl=true` = 587'de STARTTLS (explicit TLS), sertifika doğrulanır, AUTH yalnızca TLS sonrası gönderilir. 465 (implicit TLS) desteklenmez; belgede 587 ve yedek 2525 yazıyor.
- **Data Protection anahtarları DB'de:** Şifre sıfırlama ve e-posta doğrulama belirteçleri Data Protection ile imzalanıyor; konteynerde anahtarlar dosya sisteminde kalsaydı Render her uyku/yeniden başlatmada (15 dk boşluk) anahtarları kaybedecek ve e-postadaki linkler geçersiz olacaktı. Bu yüzden `DataProtectionKeys` tablosu eklendi. Anahtarlar DB'de şifrelenmemiş XML olarak durur (DB erişimi olan anahtarları görür; DB zaten tüm veriyi içerdiği için kabul edildi).

### Gerçekten test edilenler
- **Docker:** Bu makinede Docker (ve podman/colima vb.) **yok**; `docker build` ve konteyner çalıştırma **yapılamadı**. Yerine: `.dockerignore` kurallarıyla temiz bir bağlam kopyalandı, Dockerfile'daki aynı `dotnet restore` + `dotnet publish -c Release /p:UseAppHost=false` komutları çalıştırıldı (uyarısız), çıktı `ASPNETCORE_ENVIRONMENT=Production` ve `PORT=18080` ile `dotnet PlanToBee.API.dll` olarak açıldı: `0.0.0.0:18080` dinlendi, `/health` 200. Development'ta `PORT` yok sayıldığı doğrulandı. Dockerfile'ın base imaj adımları (`USER $APP_UID`, `ASPNETCORE_HTTP_PORTS`) denenmedi.
- **Boş veritabanı + SSL + URI (Production modu):** Geçici bir PostgreSQL 18 kümesi (port 55432, yalnızca `hostssl`, scram, kendi CA'mızla imzalı sertifika) açıldı. `postgresql://neon_user:p%40ss%3Aw%2Frd%231@localhost:55432/...?sslmode=require&channel_binding=require&sslrootcert=...` ile: 3 migration (InitialCreate, FamilyAccounts, DataProtectionKeys) hatasız uygulandı, `/health` 200. İkinci açılışta "No migrations were applied". Küme durdurulunca `/health` 503 + `database:unreachable`, `/health/live` 200; küme açılınca tekrar 200. `sslrootcert` verilmeden (sistem güveni) bağlantı sertifika hatasıyla reddedildi (VerifyFull gerçekten doğruluyor). SSL'siz sunucuya sslmode'suz URI -> "SSL connection requested" ile durdu. Anahtar=değer + `SSL Mode=Disable` -> ayar hatası.
- **Uçtan uca akış (Development modu, `postgres://` URI, yerel 5432'de yeni boş DB):** kayıt -> doğrulanmadan aile kurma 403 -> e-posta doğrulama -> aile kurma -> davet -> davet linki çözme -> davetle yeni hesap -> çocuk plana kayıt ekleme ve okuma -> ebeveynin çocuğun planını görmesi -> şifre sıfırlama isteği -> **API yeniden başlatıldı** -> eski sıfırlama linkiyle şifre değiştirme -> yeni şifreyle giriş ve `/auth/me`. Hepsi başarılı; ikinci açılışta migration tekrar uygulanmadı.
- **Production modunda kısmi akış (SSL DB):** giriş, aile kurma (doğrulama SQL ile işaretlendi), plan kaydı ekleme/okuma, davet oluşturma, şifremi unuttum: hepsi 200; SMTP başarısız olduğu için e-postalar gitmedi ve bu, akışı bozmadan loglandı.
- **Forwarded header / rate limit (Production, `RateLimits__Auth=3`):** Aynı XFF IP'si ile 4. istek 429; aynı kullanıcı sola sahte değerler ekleyince (`1.2.3.4, <gerçek>`) ve iki ayrı XFF başlığıyla da 429 (atlatılamadı); farklı XFF IP'si olan ikinci kullanıcı etkilenmedi (401); aynı /64 içinde 4 farklı IPv6 adresi -> 4. istek 429. `X-Forwarded-Proto: https` ile HSTS başlığı eklendi (istek HTTPS tanındı), düz HTTP'de yönlendirme yok. Tanı logu `XFF='6.6.6.6, 203.0.113.9' çözümlenen=203.0.113.9 https=True` verdi.
- **CORS:** İzinli kökene preflight `Access-Control-Allow-Origin` döndü, başka kökene dönmedi.
- **Ayar doğrulama:** Hiç ayar yokken 6 hata, hatalı değerlerle 8 hata tek listede basıldı (JWT kısa, SSL kapalı, Provider=Log, From yok, frontend http/localhost, ForwardLimit=0, RateLimits geçersiz, PORT geçersiz), çıkış kodu 1. Geçmişte sızan JWT anahtarı reddedildi. Pooler ve bilinmeyen URI parametresi uyarıları loglandı. Hiçbir çıktıda şifre/bağlantı dizesi/test anahtarı geçmedi (grep ile kontrol edildi).
- **SMTP (STARTTLS, 587 yolu):** Python `aiosmtpd` ile STARTTLS ve AUTH zorunlu, TLS'siz AUTH'u reddeden sahte sunucu kuruldu. (1) API Production modunda bu sunucuya bağlandı: EHLO -> STARTTLS -> TLS el sıkışması; sertifika macOS'ta güvenilir olmadığı için .NET reddetti (sertifika doğrulaması çalışıyor), AUTH TLS öncesi gönderilmedi, hata `SMTP gönderimi başarısız (sunucu ..., durum GeneralFailure, AuthenticationException ...)` olarak gizli bilgi olmadan loglandı, kayıt/davet 200 döndü. (2) Uygulamanın `SmtpEmailSender` sınıfı, yalnızca test sunucusunun sertifika parmak izini kabul eden küçük bir test programıyla çalıştırıldı: EHLO (TLS yok) -> STARTTLS -> EHLO (TLS) -> AUTH LOGIN (TLS, başarılı) -> DATA; e-posta alındı (UTF-8 konu, text + html). Yanlış anahtarla sahte sunucu cevap vermeden bağlantıyı açık tuttu ve 30 sn zaman aşımı devreye girdi (sahte sunucunun tuhaflığı; gerçek sunucular 535 döner). Not: .NET `AUTH login` (küçük harf) gönderiyor; RFC'ye göre sorun değil ama aiosmtpd için yama gerekti.
- Yerel çalışma: 5002'deki süreç ve `plantobee` veritabanı kullanılmadı; testler için ayrı çıktı klasörleri, geçici küme ve `plantobee_deploytest_dev` veritabanı kullanıldı, hepsi silindi. (Not: ilk derleme bir kez `bin/Debug`'a yazıldı; 5002'deki süreç etkilenmeden cevap vermeye devam etti.)

### Repo ve geçmişte bulunan gizli bilgiler (yalnızca rapor, geçmiş temizlenmedi)
- **JWT anahtarı:** `664694a` commit'inde `backend/PlanToBee.API/appsettings.json` içinde `Jwt:Key` açık metin (`plantobee-super-secret-...` ile başlayan değer); `f7d4073`'te kaldırılmış. Herkese açık sayılmalı. Canlıda yeni anahtar zorunlu; API bu değeri (SHA-256 özetiyle karşılaştırarak) her ortamda reddediyor. DEPLOY.md'de vurgulandı.
- **Firebase web yapılandırması:** Kökteki `index.html`'de Firebase `apiKey` (`AIza...`), proje kimliği ve veritabanı adresi. Firebase web anahtarları tasarım gereği istemciye açıktır, güvenlik Firebase kurallarına dayanır; `index.html` görev gereği değiştirilmedi. Eski Firebase veritabanının kurallarının hâlâ kısıtlı olduğu kontrol edilmeli.
- Yerel bağlantı dizesi (`Username=ilkerisler;Password=` boş) geçmişte ve şimdi Development ayarında: gizli değil.
- Başka SMTP/Brevo anahtarı, özel anahtar, parola bulunmadı (tüm commit'lerde `git log -p` desen taraması + her ayar dosyasının tüm sürümleri).

### Bilinen sınırlamalar
- Docker imajı gerçek Docker ile derlenmedi/çalıştırılmadı (Docker yok). İlk Render dağıtımı bu açıdan ilk gerçek test olacak.
- Render'ın XFF katman sayısı ve ücretsiz planda giden SMTP portlarına (587) kısıt olup olmadığı doğrulanamadı. İkincisi için DEPLOY.md'de `Email__Smtp__Port=2525` alternatifi var; o da engelliyse Brevo HTTP API'sine geçmek gerekir (kapsam dışı).
- Gerçek Neon ve Brevo'ya bağlanılmadı. Neon sertifikasının konteynerde `VerifyFull` ile doğrulanacağı varsayımı (Let's Encrypt kökü, aspnet imajındaki ca-certificates) canlıda doğrulanmalı; olmazsa log "SSL handshake" hatası verir.
- Boş DB'de EF, `__EFMigrationsHistory` henüz olmadığı için iki `fail: Failed executing DbCommand` satırı loglar; zararsız, DEPLOY.md'de not edildi.
- Rate limit sayaçları ve gönderim sınırları hâlâ bellekte (tek örnek varsayımı); Render uyku/yeniden başlatmada sıfırlanır.
- `/health` her çağrıda DB'ye bağlanır; Render'ın sağlık kontrolleri servis uyanıkken Neon'u da uyanık tutar (Neon ücretsiz işlem saatini biraz daha fazla harcar). Gerekirse Render'da `/health/live` kullanılabilir.
- `AllowedHosts` `*` kaldı (uygulama Host başlığıyla adres üretmiyor).

---

## Durum: Frontend: Tamamlandı, Backend: Tamamlandı, QA: Onaylandı

---

## QA Sonuçları

Test ortamı: `feature/aile-hesabi` dalı, commit edilmemiş değişiklikler. Derlemeler ve testler kaynak klasörün dışında yapıldı (scratchpad `qa-deploy/`). Gerçek `plantobee` veritabanına ve 5002/5173 süreçlerine dokunulmadı. Test için yalnızca `hostssl` + scram kabul eden, kendi CA'mızla imzalanmış sertifikalı geçici bir PostgreSQL kümesi (port 55433) açıldı. Testler bitince küme, veritabanları, derleme çıktıları ve başlatılan tüm süreçler (API, wrangler) kapatılıp silindi.

### A. Gerçekten çalıştırılarak doğrulananlar

**Docker ve port (H1)**
- Dockerfile taklidi: `.dockerignore` kurallarıyla temiz bir bağlam kopyalandı, ardından Dockerfile'daki `dotnet restore` ve `dotnet publish -c Release --no-restore /p:UseAppHost=false` komutları çalıştırıldı. İkisi de uyarısız geçti. Yayın çıktısında `appsettings.Development.json`, `launchSettings.json`, `dev-emails/`, `.http` ve `.env` **yok**. Yalnızca `appsettings.json` ve `appsettings.Production.json` var. **GEÇTİ**
- `ASPNETCORE_ENVIRONMENT=Production` ve `PORT=18181` ile `0.0.0.0:18181` dinlendi. `PORT` verilmeyince `ASPNETCORE_HTTP_PORTS=8080` ile `[::]:8080` dinlendi ve `/health` 200 döndü. Development ortamında `PORT=18184` yok sayıldı, yalnızca `ASPNETCORE_URLS` kullanıldı. **GEÇTİ**

**Üretim ayarları ve gizli bilgiler (H7, H8)**
- Hiç ayar verilmeyince çıkış kodu 1 oldu ve 6 hata tek listede yazıldı: JWT, bağlantı, SMTP kullanıcı, SMTP şifre, From, FrontendBaseUrl. **GEÇTİ**
- Geçmişte sızan JWT anahtarı `664694a:appsettings.json` içinden çıkarıldı. SHA-256 özeti koddaki sabitle aynı. Bu anahtar verilince "repo geçmişinde açıkça yer almış eski anahtar" hatasıyla API açılmadı. **GEÇTİ**
- Aşağıdaki hatalı değerlerin tamamı yakalandı ve çıkış kodu 1 oldu:
  - `sslmode=disable` (URI ve anahtar=değer biçimi)
  - `Email__Provider=Log`
  - Boş SMTP Host, `Port=abc`, `EnableSsl=false`, eksik SMTP şifresi, geçersiz From
  - `http://localhost` ve yol içeren frontend adresi
  - `ForwardLimit=0`, `RateLimits__Auth=-1`, `PORT=99999`
  - Kısa JWT, okunamayan bağlantı dizesi, bozuk URI, tanınmayan `sslmode`

  **GEÇTİ**
- Sızıntı kontrolü: bütün hata çıktılarında test şifreleri (`SECRETPW`, `p@ss`/`p%40ss`, `xsmtpsib-...`) ve sızan JWT anahtarı grep ile arandı. Eşleşme 0. **GEÇTİ**

**Veritabanı ve migration (H5, H6)**
- Production modunda `postgresql://neon_user:p%40ss%3Aw%2Frd%231@localhost:55433/qa_empty?sslmode=require&channel_binding=require&sslrootcert=...` kullanıldı. Tamamen boş veritabanında 3 migration (InitialCreate, FamilyAccounts, DataProtectionKeys) hatasız uygulandı. `pg_stat_ssl`, API bağlantısının `ssl=t` (TLSv1.2) olduğunu gösterdi. **GEÇTİ**
- İkinci açılışta "No migrations were applied" yazdı, hata olmadı. **GEÇTİ**
- SSL zorunluluğu:
  - `sslrootcert` verilmeyince sistem güveniyle bağlanmaya çalıştı ve "SSL handshake" hatasıyla durdu. VerifyFull gerçekten sertifikayı doğruluyor.
  - SSL'siz sunucuya `sslmode` içermeyen URI verilince "SSL connection requested" hatasıyla durdu.

  **GEÇTİ**
- Bağlantı hatalarında (yanlış şifre, erişilemeyen host, SSL hatası) çıktı anlaşılır ve şifre içermiyor. Yalnızca kullanıcı adı ve host:port görünüyor (aşağıda Bilgi 3). **GEÇTİ**
- `-pooler` adresi ve bilinmeyen URI parametresi için uyarı yazıldı. Parametrenin değeri loglanmadı. **GEÇTİ**

**Sağlık kontrolü (H2)**
- `/health`: 200 `{"status":"ok","api":"ok","database":"ok"}`, `Cache-Control: no-store`. Kimlik doğrulama istemiyor; geçersiz `Authorization` başlığıyla da 200 dönüyor. Aynı istek anında `/api/family` 401 döndü. **GEÇTİ**
- Veritabanı kümesi durdurulunca `/health` 503 `{"status":"unhealthy","api":"ok","database":"unreachable"}` döndü, `/health/live` 200 kaldı. Küme yeniden açılınca `/health` 200'e döndü. Cevapta ve logda sunucu adı, bağlantı dizesi veya hata yığını yok; log yalnızca "veritabanına bağlanılamadı" diyor. **GEÇTİ**
- 40 art arda `/health` isteğinin hepsi 200 döndü, rate limit yok. **GEÇTİ**

**Proxy, istemci IP'si ve rate limit (H3, H4)**

Proxy'yi gerçekçi taklit etmek için istekler loopback değil LAN IP'sinden (192.168.1.103) gönderildi. .NET'in varsayılan güven listesi yalnızca loopback olduğu için bu, `KnownProxies`/`KnownIPNetworks` temizlenmesinin gerçekten çalıştığını da gösteriyor. `RateLimits__Auth=3` ile:
- XFF `203.0.113.9`: 401, 401, 401, **429**. Aynı istemci sola sahte değerler ekleyince (`9.9.9.x, 203.0.113.9`) yine 429 aldı, sınır atlatılamadı. **GEÇTİ**
- Farklı istemci (XFF `198.51.100.7`): 401, etkilenmedi. **GEÇTİ**
- IPv6: aynı /64 içindeki 4 adresten 4. istek 429 aldı, farklı /64 etkilenmedi. `::ffff:198.51.100.77` ile `198.51.100.77` aynı sayaçta sayıldı. `/api/invitations/resolve` (InvitePublic=2) için de IP bazlı sınır aynı biçimde çalıştı. **GEÇTİ**
- `X-Forwarded-Proto: https` gelince istek HTTPS sayıldı (HSTS başlığı eklendi). Düz HTTP'de yönlendirme ya da HSTS yok, dolayısıyla döngü yok. Tanı logu `çözümlenen=203.0.113.50 https=True` gösterdi. **GEÇTİ**
- `ForwardedHeaders__Enabled=false` iken XFF tamamen yok sayıldı: her istekte farklı sahte XFF olmasına rağmen 4. istek 429 aldı. Açılışta "Render'da true olmalı" uyarısı yazıldı. Development'ta varsayılan kapalı. **GEÇTİ**

**CORS**
- Preflight sonuçları:
  - `https://plantobee-qa.pages.dev` (ayardaki adres): `Access-Control-Allow-Origin` döndü.
  - `https://evil.example.com`, önizleme alt alan adı `https://abc.plantobee-qa.pages.dev`, `http://` varyantı ve `https://plantobee-qa.pages.dev.evil.com`: ACAO **dönmedi**.

  **GEÇTİ**

**Data Protection / linklerin yeniden başlatmada geçerli kalması (H9, H10)**
- İlk açılışta `DataProtectionKeys` tablosuna 1 anahtar yazıldı. API'nin HOME dizininde `.aspnet/DataProtection-Keys` oluşmadı; anahtarlar yalnızca veritabanında. **GEÇTİ**
- Şifre sıfırlama ve e-posta doğrulama linkleri üretildi, API durdurulup yeniden başlatıldı. Eski sıfırlama linki 200 döndü ve yeni şifreyle giriş 200 oldu. Eski doğrulama linki de 200 döndü. **GEÇTİ**

**E-posta (H9)**
- Production'da `Log` sağlayıcısı açılışta durdu (yukarıda). **GEÇTİ**
- Production'da SMTP sunucusuna ulaşılamayınca kayıt yine 200 döndü. Log `SMTP gönderimi başarısız (sunucu 127.0.0.1:2526, durum GeneralFailure, SocketException: Connection refused). Konu: ...` biçiminde. Logda SMTP şifresi, doğrulama linki ya da token yok (grep 0). **GEÇTİ**

**Frontend (H10)**
- `npm run build` kaynak klasörün kopyasında denendi:
  - Değişken yok, boş ya da yalnızca boşluk: build durdu (exit 1, Türkçe mesaj).
  - `foo` ve `ftp://...`: build durdu.
  - localhost, http ya da sonu `/api` olmayan adres: uyarıyla derlendi.
  - Doğru adres: uyarısız derlendi.
  - `.env.production.local` dosyasından okuma çalıştı.

  **GEÇTİ**
- Derlenmiş JS'te `localhost:5002` / `5002` eşleşmesi 0. Doğru `VITE_API_URL` gömülü. (`http://localhost` metni react-router ve axios'un kendi URL ayrıştırma yedeklerinden geliyor, API adresi değil.) **GEÇTİ**
- `public/404.html` eklenince build "dist/404.html bulundu" hatasıyla durdu. **GEÇTİ**
- `wrangler pages dev` 4.141.0 ile `dist` sunuldu:
  - `/invite?token=..`, `/invite/`, `/invite-code`, `/verify-email?userId=..&token=t%2Bx`, `/reset-password?..`, `/forgot-password`, `/login`, `/family`, `/week` ve `/a/b/c/d` adreslerinin hepsi 200 döndü, yönlendirme olmadı ve gövde birebir `dist/index.html`.
  - JS, CSS, `favicon.svg`, `apple-touch-icon.png` ve `icons.svg` 200 döndü, içerik tipleri doğru.

  **GEÇTİ**
- `git check-ignore`: `frontend/.env`, `.env.local` ve `.env.production` yok sayılıyor. `.env.example` izleniyor. `backend/**/.env` de yok sayılıyor. **GEÇTİ**
- `npm run lint`: 0 hata; yalnızca önceden var olan uyarılar.

**Regresyon: aile hesabı (Genel)**

Development modunda, yayın çıktısıyla, boş SSL veritabanına `postgres://` URI ile bağlanıldı. Adımların hepsi beklenen sonucu verdi:
1. Kayıt: 200.
2. Doğrulanmadan aile kurma: 403 `email_not_verified`.
3. Doğrulama linki `http://localhost:5173/verify-email?...` biçiminde geldi, doğrulama 200.
4. Aile kurma: 200.
5. Davet gönderme: 200. Davet linki çözme: 200. Davetle hesap açma: 200.
6. Çocuğun plan kaydı eklemesi: 200.
7. Yetki reddi:
   - Çocuk davet gönderemedi: 403 `admin_only`.
   - Çocuk ebeveynin planına yazamadı: 403 `plan_read_only`.
8. Ebeveyn çocuğun planını görebildi: 200.
9. Şifremi unuttum: 200.

**GEÇTİ**

### B. Yalnızca kod okunarak değerlendirilenler

- **Dockerfile:**
  - İki aşamalı derleme var ve çalışma imajında SDK yok.
  - `ASPNETCORE_ENVIRONMENT=Production` ve `ASPNETCORE_HTTP_PORTS=8080` tanımlı. Render'ın verdiği `PORT`'u uygulama `UseUrls` ile uyguluyor.
  - Uygulama `USER $APP_UID` ile resmi aspnet:10.0 imajındaki root olmayan `app` kullanıcısıyla çalışıyor.
  - Çalışma dizini `WORKDIR /app`, giriş noktası `ENTRYPOINT ["dotnet","PlanToBee.API.dll"]`. Ayar dosyaları ContentRoot `/app` içinde bulunuyor.
  - Restore katmanı önbelleğe uygun kurulmuş.

  Gerçek `docker build` ve konteyner çalıştırma **yapılamadı**, çünkü makinede Docker yok. `USER $APP_UID` satırı ve base imaj davranışı ilk Render dağıtımında doğrulanacak. **Kod açısından GEÇTİ**
- **.dockerignore:** `bin/obj`, `dev-emails/`, `.env*`, `*.pfx/pem/key`, `appsettings.Development.json`, `launchSettings.json`, `*.http`, `.git` ve `frontend/` dışarıda bırakılıyor. Derleme bağlamı zaten `backend/PlanToBee.API`. **GEÇTİ**
- **SMTP 587 + STARTTLS:**
  - `System.Net.Mail.SmtpClient` ile `EnableSsl=true` kullanılıyor. Bu ayar düz bağlantı + EHLO + STARTTLS (explicit TLS) anlamına geliyor. Kimlik bilgisi TLS kurulduktan sonra gönderiliyor.
  - Sertifika doğrulaması kapatılmamış.
  - Brevo varsayılanları `appsettings.Production.json`'da (`smtp-relay.brevo.com`, 587, `EnableSsl=true`).
  - 30 sn zaman aşımı var.
  - Gönderen adresi ve adı `Email__From` / `Email__FromName` ile ayarlanıyor.

  Gerçek Brevo'ya bağlanılmadı. **GEÇTİ**
- **DEPLOY.md:**
  - Ortam değişkeni adları koddakilerle birebir aynı: `ConnectionStrings__Default`, `Jwt__Key/Issuer/Audience`, `Email__Provider/From/FromName`, `Email__Smtp__Host/Port/EnableSsl/Username/Password`, `App__FrontendBaseUrl`, `ForwardedHeaders__Enabled/ForwardLimit/KnownProxies/KnownNetworks/LogDiagnostics`, `RateLimits__Auth/InvitePublic/InviteSend/Session`, `PORT`, `VITE_API_URL`. Bu adlar `EmailOptions`, `AppOptions`, `StartupValidation`, `ForwardedHeadersSettings` ve `RateLimitPolicies` ile karşılaştırıldı.
  - Tablo istenen bütün sütunları içeriyor.
  - Adım sırası istenen gibi: Neon (3.1) → Brevo (3.2) → Render (3.3) → Cloudflare Pages (3.4) → Birbirine bağlama (3.5) → Test (3.6).
  - Cloudflare değerleri Frontend Çıktısı ile tutarlı: `frontend`, `npm run build`, `dist`, `NODE_VERSION=22`, `VITE_API_URL` Production ortamında.
  - `_redirects` **önerilmiyor**; tersine "EKLEME" diye açıkça uyarılıyor.
  - Bunlar da belgede var: pooled yerine doğrudan bağlantı, JWT üretimi (`openssl rand -base64 48`), sızmış anahtar uyarısı, Brevo gönderen doğrulaması, günlük 300 e-posta sınırı, uyku notu, `index.html` cümlesi, istenen bütün sorun giderme maddeleri, güncelleme bölümü, hangi değişiklikten sonra hangi tarafın yeniden dağıtılacağı tablosu.
  - Gerçek gizli bilgi yok.

  Deneyimsiz bir kullanıcı takip edebilir. **GEÇTİ**
- Kökteki `index.html` değişmemiş (`git diff` boş). **GEÇTİ**

### C. Bulgular (hiçbiri engelleyici değil)

**Bulgu 1 (Düşük, Frontend): `VITE_API_URL` sonunda boşluk varsa build sessizce geçiyor, canlı site bozuk adrese istek atıyor.**
- Kriter: "Frontend: Cloudflare Pages". `VITE_API_URL` hatalıysa bu fark edilmeli.
- Tekrar üretme:
  1. `VITE_API_URL="https://plantobee-api.onrender.com/api " npm run build` komutunu çalıştır. Build exit 0 ile biter ve uyarı vermez.
  2. `dist/assets/*.js` içinde `onrender.com/api \`` görünür: sondaki boşluk koda gömülmüş.
  3. axios istekleri `.../api%20/auth/login` adresine gider ve 404 alır. Kullanıcı yalnızca "Sunucuya ulaşılamadı" görür.
- Neden: `vite.config.js` denetimi `.trim()` edilmiş değeri kontrol ediyor. `client.js` ise ham değeri kullanıyor ve yalnızca sondaki `/` işaretini siliyor.
- Öneri (Frontend): `client.js`'te değeri `.trim()` et ya da build'de ham değer trim edilmiş değerden farklıysa hata ver. Cloudflare panelinden kopyala-yapıştırda sona boşluk kaçabileceği için küçük ama gerçekçi bir durum.

**Bulgu 2 (Orta, risk ve belge; Backend/DEPLOY.md): Render ücretsiz planında giden SMTP 587 portu engelli olabilir.**
- Kriter: "E-posta (H9)" ve "DEPLOY.md".
- Bilgi: Render, ücretsiz web servislerinde giden SMTP portlarını (25/465/587) kısıtladığını duyurmuştu. Bu ortamda internet erişimi olmadığı için doğrulanamadı.
- Durum: Belge, 2525 portuna geçişi yalnızca Bölüm 4'te (sorun giderme) anlatıyor. Kullanıcı takılı kalmaz ama canlıya ilk çıkışta test adımı 3 (doğrulama e-postası) büyük olasılıkla başarısız olur.
- Öneri (Backend, yalnızca belge):
  - 3.2 veya 3.3 adımında Render ücretsiz planı için doğrudan `Email__Smtp__Port=2525` girilmesini önerin, ya da en azından "e-posta gelmezse önce bunu dene" notunu adımın içine taşıyın.
  - Kod değişikliği gerekmez; 2525 de STARTTLS ile aynı kod yolundan çalışır.

**Bilgi 3 (Düşük, Backend, düzeltme zorunlu değil): Migration/bağlantı hatası mesajında kullanıcı adı ve host görünüyor.**
- Kriter: "Üretim ayarları".
- Örnek çıktılar: `28P01: password authentication failed for user "neon_user"` ve `Failed to connect to 127.0.0.1:59999`.
- Şifre ve bağlantı dizesi sızmıyor. Render logları yalnızca operatöre açık olduğu için kabul edilebilir; kodda da bilerek yapıldığı yazıyor.

**Bilgi 4 (Düşük, DEPLOY.md iyileştirmesi):** İlk Render açılışında şu iki `warn:` satırı da görünüyor:
- `Overriding HTTP_PORTS '8080' ... Binding to values defined by URLS instead 'http://0.0.0.0:10000'`
- `No XML encryptor configured ... unencrypted form`

İkisi de zararsız. Belgenin 3.3/9 adımında yalnızca `__EFMigrationsHistory` fail satırı "normal" diye anılıyor. Deneyimsiz kullanıcı telaşlanmasın diye bu iki satır da not edilebilir.

### D. Doğrulanamayanlar (ilk canlı dağıtımda kontrol edilmeli)

- Gerçek `docker build` ve konteyner çalıştırma: `USER $APP_UID` satırı ve Render'ın `PORT`'u.
- Render'ın XFF katman sayısı: DEPLOY.md Bölüm 5'teki prosedür bunun için yeterli.
- Neon sertifikasının konteynerde VerifyFull ile doğrulanması.
- Brevo'ya gerçek gönderim ve Render'ın SMTP port kısıtı (Bulgu 2).
- Gerçek Cloudflare Pages'te SPA davranışı. `wrangler pages dev` ile doğrulandı.

### Sonuç

Kabul kriterlerinin tamamı karşılanıyor. Engelleyici hata yok. Bulgu 1 (frontend, düşük) ve Bulgu 2 (belge, orta) canlıya çıkıştan önce kısa düzeltmeler olarak önerilir; onayı engellemez.
