# Görev 04: Görev 03 raporundaki açık maddeler

Önceki görev: `docs/tasks/03-kod-taramasi-ve-qa.md` (kod taraması, tasarım turu, QA). O raporun "ürün kararı gerektiren"
10 maddesinin hepsi kullanıcı onayıyla yapıldı. Dal: `feature/aile-hesabi` (PR #1).

## Durum: Tamamlandı

## Backend

1. **Kayıtta hesabın varlığı belli olmuyor.** (`AuthController.Register`, `Infrastructure/MissingAccountLockout.cs`)
   - `POST /auth/register` artık **oturum açmaz** ve her durumda aynı cevabı döner:
     `200 { message, email }` ("Kaydını tamamlamak için e-posta adresine bir bağlantı gönderdik…").
     - Yeni adres: hesap oluşur, doğrulama e-postası gider.
     - Kayıtlı ama doğrulanmamış adres: doğrulama e-postası yeniden gider (şifre değişmez).
     - Kayıtlı ve doğrulanmış adres: adresin sahibine "Bu adresle zaten bir hesabın var" e-postası gider
       (giriş ve şifremi unuttum bağlantılarıyla; saatte en fazla 3).
   - Şifre kuralları hesap aranmadan önce kontrol edilir; hata mesajları iki durumda aynıdır.
   - Cevap süresi farkını azaltmak için var olan hesap yolunda da şifre özeti hesaplanır.
   - **Giriş kilidi:** Olmayan hesaplarda da aynı kilit taklit edilir (5 hatalı deneme → 5 dk `429 locked_out`).
     Önceden yalnızca var olan hesaplar kilitlendiği için 429 hesabın varlığını ele veriyordu.
   - Davet önizlemesindeki `accountExists` bilgisi değişmedi: yalnızca geçerli davet belirteci ya da kodu olan kişi görür.
2. **Davet e-postasında Türkiye saati.** (`Infrastructure/TurkeyTime.cs`)
   "… 07.10.2026 01:15 (Türkiye saati) tarihine kadar". Sistemde saat dilimi verisi yoksa sabit UTC+3.
3. **Kısa ömürlü oturum + yenileme.** (`Services/AuthTokenService.cs`, `Models/RefreshToken.cs`, migration `RefreshTokens`)
   - Erişim belirteci (JWT) 15 dk (`Jwt:AccessTokenMinutes`), yenileme belirteci 30 gün (`Jwt:RefreshTokenDays`).
     JWT saat toleransı 5 dk'dan 30 sn'ye indi.
   - Yenileme belirteci veritabanında yalnızca SHA-256 özetiyle tutulur ve **her kullanımda değişir** (rotation).
     - Kullanılmış bir belirteç 30 sn'den sonra tekrar gelirse çalınmış sayılır: kullanıcının bütün oturumları kapanır.
     - 30 sn içinde gelirse (iki sekme aynı anda yeniledi) `401 refresh_retry`: istemci güncel belirteçle devam eder.
     - Eşzamanlı yenilemelerden yalnızca biri kazanır (koşullu güncelleme).
   - Yeni uç noktalar: `POST /auth/refresh { refreshToken }` → giriş cevabıyla aynı biçim;
     `POST /auth/logout { refreshToken }` → 204 (bu cihazın oturumu sunucuda da kapanır).
   - Giriş/davet/şifre sıfırlama cevaplarına `refreshToken` ve `expiresIn` (sn) eklendi.
   - Şifre sıfırlanınca bütün yenileme belirteçleri iptal edilir.
   - Kısa ömre geçmeden önce verilmiş 30 günlük JWT'ler reddedilir (kullanıcı bir kez yeniden giriş yapar).
   - `HttpOnly` çerez seçilmedi: site (github.io) ve API (onrender.com) farklı alan adlarında; tarayıcılar
     üçüncü taraf çerezleri engelliyor. Belirteçler `localStorage`'da kalıyor; risk kısa ömür ve rotation ile azaltıldı.
4. **Data Protection anahtarları şifreli.** (`Infrastructure/KeyEncryption.cs`)
   Doğrulama ve şifre sıfırlama linklerini imzalayan anahtarlar veritabanına AES-256-GCM ile şifrelenmiş yazılır.
   Şifreleme anahtarı `DataProtection__KeyEncryptionKey` ortam değişkeninde (Render üretir, `render.yaml`);
   yoksa `Jwt__Key`'den HKDF ile türetilir. API yeniden başlatıldıktan sonra eski linklerin çalıştığı doğrulandı.

## Frontend

5. **Silmede "Geri al".** (`api/deferred.js`, `hooks/useMutation.js`, `context/NoticeContext.jsx`)
   Kayıt silinince ekrandan hemen kalkar, altta 5 sn "… silindi · Geri al" bildirimi çıkar. Silme isteği ancak
   süre dolunca gider. Şu durumlarda hemen gönderilir: başka bir silme, sunucuya giden başka bir istek
   (sonraki okuma silinen kaydı geri getirmesin), uygulamanın arka plana alınması. Gün kartları ve hafta
   (tablo + liste) görünümünde çalışır.
6. **"Sen ekledin".** Ailede birden fazla hesap varsa gün kartlarında kendi kayıtlarında da "Sen ekledin" yazar
   (`context/AuditContext.js`). Tek kişilik ailede yazmaz.
7. **Hafta görünümünde baş harf.** "Aslı ekledi" yerine ×'in altında küçük bir "A" rozeti; tam metin
   `title` ve `aria-label`'da. Kendi kayıtlarında hafta görünümünde iz gösterilmez.
8. **Son sekme.** "‹ Plana dön" son açık sekmeye (Gün / Hafta Planı) döner. Seçilen sekme uygulama yeniden
   açılınca da hatırlanır (`localStorage: plantobee:view`).
9. **Yerel yazı tipleri.** Google Fonts isteği kaldırıldı. Figtree, Bricolage Grotesque ve JetBrains Mono'nun
   latin + latin-ext (Türkçe) alt kümeleri `src/assets/fonts/` altında (toplam ~190 KB, `src/fonts.css`).

Ayrıca: kayıttan sonra "E-postanı kontrol et" ekranı (Giriş yap / E-postayı tekrar gönder); oturum yenileme
`api/client.js`'te (401 → tek seferlik yenileme → isteği tekrarla; başarısızsa çıkış).

## Testler

10. **Uçtan uca API testi repoda:** `backend/tests/e2e.py` (yalnızca Python standart kütüphanesi). Kullanımı
    dosyanın başında. Sonuç: **43 geçti, 0 kaldı** (boş veritabanında). Kapsam: kayıt gizliliği, giriş kilidi
    eşitliği, yenileme/rotation/eşzamanlılık/çıkış, şifre sıfırlamanın oturumları kapatması, Türkiye saati,
    davet, ortak plan yetkileri (403/404), hafta ayrıntısı, ders listesi.

- `dotnet build --no-incremental`: 0 uyarı, 0 hata. `dotnet ef migrations has-pending-model-changes`: değişiklik yok.
- `npm run lint`: 0 hata, 8 uyarı (hepsi önceden vardı). İki derleme (`VITE_BASE_PATH` ile ve olmadan) başarılı.
- Tarayıcı testi (Chromium, 390 ve 360 px, erişim belirteci 1 dk): 27 kontrol geçti. Kayıt ekranı, doğrulama,
  "Sen ekledin", geri al (DELETE gitmiyor / 5 sn sonra gidiyor / başka güne geçince önce gidiyor), baş harf,
  son sekme, yerel fontlar, süre dolunca sessiz yenileme, çıkışta belirteç iptali, konsolda hata yok.
- Veri tabanında `DataProtectionKeys.Xml` içinde `encryptedSecret` (AES-GCM) görüldü; yeniden başlatma sonrası
  eski doğrulama linki çalıştı.

## Canlıya çıkarken

- Render Blueprint'i senkronlayınca `DataProtection__KeyEncryptionKey` otomatik üretilir.
- Bu sürüme geçişte açık oturumlar bir kez kapanır (eski 30 günlük belirteçler kabul edilmez).
