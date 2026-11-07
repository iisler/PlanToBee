# Backend kod incelemesi (07.11.2026)

**Kapsam:** `backend/PlanToBee.API`, migration'lar hariç yaklaşık 6.200 satır. Program ve altyapı, kimlik doğrulama, yetki, gün ve tekrarlayan aktivite uç noktaları, bildirimler, e-posta, kişisel veri şifrelemesi, açılış doğrulaması, Dockerfile, CI ve e2e testleri.

**Yöntem:** kodu okuyarak inceleme. Bulgular çalıştırılarak doğrulanmadı. Yerelde PostgreSQL olmadığı için saldırı senaryoları denenmedi.

## Genel değerlendirme
Kod, küçük bir ekip için olağanın üstünde özenli. Güvenlik kararları bilinçli verilmiş ve yorumlarla açıklanmış:
- Hesap varlığı kayıt, giriş ve şifre sıfırlamada ele verilmiyor.
- Yenileme belirteci her kullanımda değişiyor; tekrar kullanılırsa bütün oturumlar kapanıyor.
- Belirteç ve kodların yalnızca özeti saklanıyor.
- E-posta adresleri AES-GCM ile şifreli, aramalar anahtarlı özetle (HMAC) yapılıyor.
- Bildirim adresleri izin listesinden geçiyor, yönlendirmeler kapalı (SSRF koruması).
- Üretim ayarları açılışta doğrulanıyor; repoya sızmış eski JWT anahtarı reddediliyor.
- Veritabanı bağlantısında SSL zorunlu, yedekler şifreli, konteyner root olmayan kullanıcıyla çalışıyor.

Yetki kontrollerinde başka ailenin verisine erişim (IDOR) açığı bulunmadı. Her uç nokta aileyi istekte veritabanından çözüyor; kayıt başka ailedeyse 404, düzenleme yetkisi yoksa 403 dönüyor.

Aşağıdaki bulgular önem sırasına göre.

## Yüksek

### Y1. Giriş isteğinde uzunluk sınırı yok: sunucu belleği doldurularak düşürülebilir
**Durum:** düzeltildi (07.11, `guvenlik-giris-sinirlari` dalı).
- `LoginDto`, `VerifyEmailDto` ve `ResetPasswordDto` alanlarına uzunluk sınırı eklendi.
- Kestrel gövde sınırı 1 MB yapıldı; aşan istek 413 `request_too_large` dönüyor.
- e2e testine `test_request_limits` eklendi.

- **Nerede:** `backend/PlanToBee.API/DTOs/AuthDtos.cs:15` (`LoginDto`), `Controllers/AuthController.cs:103` ve `Infrastructure/MissingAccountLockout.cs:35`.
- **Sorun:** `LoginDto.Email` ve `Password` alanlarında uzunluk sınırı yok. Olmayan bir hesaba giriş denendiğinde gelen e-posta, `MissingAccountLockout` sözlüğünde anahtar olarak en az 1 gün bellekte tutuluyor. Kestrel'in varsayılan gövde sınırı yaklaşık 30 MB.
- **Etki:** Bir saldırgan IP başına dakikada 20 istekle her biri onlarca MB'lık farklı "e-postalar" gönderip belleği dakikalar içinde doldurabilir. Render'daki küçük bir sunucu bundan çöker.
- **Öneri:**
  - `LoginDto.Email` alanına `[StringLength(256), EmailAddress]`, `Password` alanına `[StringLength(128)]` ekle.
  - Kestrel'de genel gövde sınırını yaklaşık 1 MB yap (`MaxRequestBodySize`). Program yükleme gerekirse uç nokta bazında daha yüksek tutulabilir.
  - `VerifyEmailDto` ve `ResetPasswordDto` alanlarına da makul sınırlar ekle.
- **Boyut:** küçük, birkaç satır.

## Orta

### O1. Kalıcı hesap kilidi kötüye kullanılabilir
**Durum:** kalıcı kilit korundu; kilitlendiği anda hesap sahibine uyarı, kilit açma kodu ve bağlantı e-postayla gidiyor (07.11, `kilit-epostasi` dalı). Kilit ekranı doğrudan kod adımıyla açılıyor. Kilit ve "Şifremi unuttum" e-postaları artık arka planda gidiyor; böylece cevap süresi hesabın var olup olmadığını ele vermiyor (önceden "Şifremi unuttum"da SMTP süresi farkı vardı).

- **Nerede:** `backend/PlanToBee.API/Program.cs:72`.
- **Sorun:** 5 hatalı şifreden sonra hesap kalıcı olarak kilitleniyor ve yalnızca "Şifremi unuttum" ile açılıyor. E-posta adresini bilen herkes, başkasının hesabını 5 denemeyle kilitleyebilir.
- **Not:** Bu, 06.11'de bilerek verilmiş bir karar. Kilidi açma yolu var, yani zarar can sıkıcılıkla sınırlı.
- **Öneri** (biri seçilebilir):
  - Artan süreli kilit: 15 dk, 1 sa, 24 sa, sonra kalıcı.
  - Kalıcı kilit kalır, ama kilitlenince hesap sahibine "hesabın kilitlendi, sen değilsen…" e-postası gider.

### O2. 4 haneli profil PIN'i deneme yoluyla bulunabilir
- **Nerede:** `backend/PlanToBee.API/Services/PinService.cs:12`.
- **Sorun:** Her 5 hatalı denemede profil hep 5 dakika kilitleniyor ve sayaç sıfırlanıyor. Saatte yaklaşık 60 deneme yapılabiliyor; 10.000 olasılık birkaç günde taranır.
- **Etki:** Aile şifresini bilen biri (örneğin bir çocuk) bir betikle ebeveyn PIN'ini bulup ebeveyn yetkileri alabilir: her kaydı silme, profil yönetimi.
- **Öneri:**
  - Kilit süresi her seferinde artsın (5 dk, 30 dk, 2 sa, 24 sa).
  - Birkaç kilitten sonra hesap sahibine e-posta gitsin.
  - İsteğe bağlı olarak 6 haneli PIN desteklensin.

### O3. Genel istek boyutu sınırı yok
- **Sorun:** Kestrel'in varsayılan sınırı (~30 MB) bütün uç noktalarda geçerli. Liste alanlarındaki `MaxLength` kontrolleri, gövde okunup ayrıştırıldıktan sonra çalışıyor.
- **Öneri:** Y1'deki 1 MB genel sınır bu sorunu da çözer.

### O4. `/health` herkese açık ve her çağrıda veritabanına bağlanıyor
- **Nerede:** `backend/PlanToBee.API/Infrastructure/HealthEndpoints.cs:26`.
- **Sorun:** Kimlik doğrulama ve istek sınırı yok. Dışarıdan sürekli çağrılırsa Neon'u uyanık tutar (maliyet) ve bağlantı harcar.
- **Öneri (düzeltildi):** Önbellek ya da IP sınırı yetmez: birkaç dakikada bir gelen tek bir istek de Neon'u uyanık tutar.
  Veritabanı kontrolü yalnızca gizli anahtarla yapılmalı.
- **Durum:** düzeltildi (07.11, `saglik-anahtari` dalı). Veritabanı yalnızca `Health__Key` anahtarıyla (`X-Health-Key`
  başlığı ya da `?key=`) kontrol ediliyor; anahtarsız istek `"database":"unchecked"` dönüyor ve veritabanına dokunmuyor.
- **Not:** Giriş, kayıt gibi oturumsuz uç noktalar da veritabanına bakmak zorunda. Kötü niyetli seyrek istekler Neon'u yine
  uyanık tutabilir; bunu gerçek kullanıcıdan ayırmanın pratik yolu yok. Neon panelinden aylık işlem süresi izlenmeli.

## Düşük

1. **JWT içinde e-posta ve ad açık duruyor**
   - Nerede: `backend/PlanToBee.API/Services/AuthTokenService.cs:141`.
   - Belirteç tarayıcıda localStorage'da saklanıyor; veri azaltımı (KVKK) açısından bu iki alan gereksiz.
   - Öneri: kaldırılabilir. Sunucu kullanıcıyı zaten kimlikten okuyor.
2. **Bekleyen bildirimler açık metin saklanıyor**
   - Nerede: `Services/Notifications/NotificationService.cs:34`.
   - Ad, ders ve aktivite başlıkları, sessiz saat boyunca saatlerce şifresiz duruyor. E-posta adresleri ise şifreli.
   - Kayıtlar kısa ömürlü olduğu için risk düşük; istenirse aynı şifreleme kullanılabilir.
3. **Tek sunucu varsayımı**
   - Giriş ve sıfırlama kodları, e-posta gönderim sınırları, olmayan hesap kilidi ve bildirim toplama bellekte tutuluyor.
   - Sunucu yeniden başlayınca hepsi sıfırlanıyor; ikinci bir sunucu eklenirse paylaşılan bir depo (Redis ya da veritabanı) gerekir.
   - Yorumlarda zaten belirtilmiş; şimdilik sorun değil.
4. **Doğrulama e-postasında kullanıcının yazdığı ad var**
   - Nerede: `Services/Email/EmailTemplates.cs:12`.
   - Biri başkasının adresiyle kayıt olup ad alanına bir metin ya da bağlantı yazarsa, bu metin PlanToBee'den gelen gerçek bir e-postada görünür. HTML'den kaçışlanıyor ve 50 karakterle sınırlı.
   - Öneri: doğrulanmamış adrese giden e-postada genel bir selam kullanılsın.
5. **Bildirim aboneliği adresle başka aileye taşınabiliyor**
   - Nerede: `Controllers/PushController.cs:64`.
   - Uç nokta adresini bilen biri aboneliği kendi ailesine alabilir. Adres tahmin edilemediği için risk düşük.
   - Öneri: aynı uç nokta başka bir ailedeyse eskisini silip yenisini aç.
6. **Eşzamanlı düzenleme**
   - Kayıtlarda sürüm alanı (xmin) yok; iki kişi aynı kaydı aynı anda düzenlerse son yazan kazanır. Aile ölçeğinde kabul edilebilir.
7. **Açılışta migration**
   - Nerede: `backend/PlanToBee.API/Program.cs:204`.
   - Tek sunucuda sorun değil. Birden fazla sunucuya geçilirse migration ayrı bir adımda çalıştırılmalı.

## Kod kalitesi ve test
- **Birim testi yok:**
  - Saf mantık hızlı birim testleriyle korunmalı: `SeriesSchedule`, `Holidays`, `QuietHours`, `PlanText`, `NotificationText.Accusative`, `NotificationDispatcher.Compose`.
  - e2e (14 senaryo) yalnızca backend dosyası değişen PR'larda çalışıyor ve yavaş.
  - Öneri: küçük bir xUnit projesi.
- **Analizör yok:**
  - Derlemede uyarılar hata sayılmıyor (`TreatWarningsAsErrors`) ve .NET analizörleri açık değil.
  - Öneri: CI'da açılabilir.
- **Controller'lar büyük ve birbirine bağlı:**
  - `DaysController` (379 satır) ve `SeriesController` (331 satır).
  - `SeriesController`, `DaysController.Map` yöntemini kullanıyor (`Controllers/DaysController.cs:367`).
  - Öneri: eşleme ve kayıt kuralları ayrı sınıflara alınabilir.
- **Her istekte kullanıcı satırı okunuyor:**
  - Nerede: `Program.cs:162`.
  - Şifre değişince oturumların hemen kapanması için bilinçli bir tercih.
  - Trafik artarsa birkaç saniyelik önbellek düşünülebilir.

## Önerilen sıra
1. ~~**Y1:** uzunluk sınırları ve 1 MB gövde sınırı.~~ Yapıldı.
2. **O2:** artan PIN kilidi.
3. ~~**O1:** kilit politikası.~~ Kalıcı kilit ve kilitlenince otomatik e-posta seçildi, yapıldı.
4. ~~**O4:** `/health`.~~ Veritabanı kontrolü anahtara bağlandı.
5. Düşük bulgular ve birim testleri, zaman buldukça.
