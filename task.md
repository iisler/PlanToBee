# Görev 03: Genel kod taraması, tasarım kontrolü ve QA

## Özet

PlanToBee canlıya çıkmadan önce genel bir kalite turu:
- **Backend:** Kod taraması. Hata (bug), güvenlik açığı ve performans iyileştirmesi aranır, bulunanlar düzeltilir.
- **Frontend:** Tasarım kontrolü. Görsel tutarlılık, mobil görünüm, erişilebilirlik ve kullanım kolaylığı; düzenlenmesi gereken yerler düzenlenir.
- **QA:** Backend ve frontend bitince projenin genel kontrolü ve testleri; düzeltme raporu.

Önceki görevler: `docs/tasks/01-aile-hesabi.md`, `docs/tasks/02-canliya-hazirlik.md`.

## Projenin şu anki durumu (dal: `feature/aile-hesabi`, PR #1)

- **Yapı:** Backend `backend/PlanToBee.API` (.NET 10, EF Core, PostgreSQL, ASP.NET Identity, JWT). Frontend `frontend/` (React 19, Vite, react-router 7, axios). Kökteki `index.html` eski tek dosyalık Firebase sürümüdür.
- **Ortak aile planı (yeni):** Günler (`Days`) ve ders listesi (`Subjects`) üyeye değil aileye (`FamilyId`) bağlıdır. Migration: `20260929224213_SharedFamilyPlan`.
  - Ailedeki herkes kayıt ekler.
  - Ebeveyn tüm kayıtları, çocuk yalnızca kendi eklediklerini düzenleyip siler (`MemberContext.CanEdit`).
  - Her kayıt DTO'su kendi `canEdit` bayrağını taşır.
  - Kayıtlarda ekleyen kişi görünür (`AuditTag`). Hafta özeti ailenin toplamıdır.
  - Aileden ayrılan üyenin kayıtları ailede kalır ("Eski üye: Ad").
  - Davetle başka aileye katılan tek kişilik ailenin planı yeni aileye birleştirilir (`FamilyService.MergeFamilyPlanAsync`).
- **Arayüz:**
  - Kişi seçici kaldırıldı. Sağ üstteki ad menüsünde (`UserMenu`) "Ailem" ve "Çıkış yap" var.
  - Sekmeler: Gün, Hafta Planı.
  - Tema her zaman açık bej (koyu mod yok). Marka: bal sarısı `#F6B51E` + siyah `#1E1A14`. Logo `frontend/public/favicon.svg`.
- **Yayın:** Site GitHub Pages'te `/PlanToBee/app/` alt yolunda yayınlanacak: `VITE_BASE_PATH`, router `basename`, `.github/workflows/pages.yml`, derin linkler için `404.html`. API Render'da (`render.yaml`), veritabanı Neon'da, e-posta Brevo (port 2525). Rehber: `docs/DEPLOY.md`.
- **Hedef:** İleride Capacitor ile App Store / Google Play. Bileşenler sade kalmalı.

## Çalışma kuralları (herkes için, ZORUNLU)

1. **Commit, push, merge yapma.** Değişiklikleri çalışma alanında bırak; ana oturum inceleyip commit edecek.
2. **Kullanıcının yerel ortamına dokunma:**
   - `plantobee` veritabanına yazma. Test için kendi kopyanı ya da boş veritabanını kullan.
   - 5002 portundaki API'yi ve 5173 portundaki Vite sunucusunu durdurma, yeniden başlatma.
   - Kendi süreçlerini ayrı portlarda çalıştır:
     - Backend: API 5101, veritabanı `plantobee_be`
     - Frontend: Vite 5175, gerekirse API 5103 ve veritabanı `plantobee_fe`
     - QA: API 5102, Vite 5176, veritabanı `plantobee_qa`
   - İşin bitince kendi süreçlerini kapat, kendi veritabanlarını sil.
3. **Postgres araçları:** `/Applications/Postgres.app/Contents/Versions/latest/bin/` (`createdb`, `dropdb`, `psql`, `pg_dump`). Yerel kullanıcı: `ilkerisler`, şifre yok.
4. **Test API'sini çalıştırma örneği** (`backend/PlanToBee.API` içinde; önce `dotnet build`):
   ```
   ASPNETCORE_ENVIRONMENT=Development App__FrontendBaseUrl=http://localhost:<vite-port> \
   ConnectionStrings__Default="Host=localhost;Database=<db>;Username=ilkerisler" \
   RateLimits__Auth=1000 RateLimits__InvitePublic=1000 \
   dotnet run --no-launch-profile --no-build --urls http://localhost:<api-port>
   ```
   - Geliştirmede e-postalar gönderilmez, API'nin konsol loguna yazılır (`[E-POSTA] Kime: ...`). Doğrulama ve davet linkleri oradan alınır.
   - Frontend'i test API'sine bağlamak için: `VITE_API_URL=http://localhost:<api-port>/api npx vite --port <vite-port> --strictPort`
5. **Hazır test araçları** (ana oturumun geçici klasörü; kopyalayıp uyarlayabilirsin):
   - `/private/tmp/claude-501/-Users-ilkerisler-Projects-PlanToBee/168fdbf4-abb7-4353-b66b-aaf117968578/scratchpad/e2e.py`: Uçtan uca API senaryosu (kayıt, doğrulama, aile, davet, ortak plan yetkileri; 35 kontrol). Kullanım: `python3 e2e.py <api-log-dosyası>`. Dosyadaki `BASE` adresini ve linklerdeki portu kendi portlarına göre değiştir.
   - `.../scratchpad/cdp.mjs`: Node'un yerleşik WebSocket'iyle Chrome'u yönetip giriş yapmış kullanıcı olarak ekran görüntüsü alır. Chrome yolu: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Uzaktan hata ayıklama portu için 9333 dışında bir port seç.
   - `.../scratchpad/seed.py`: Test ailesi ve kayıtları oluşturur.
6. **Kapsam sınırları:**
   - Kökteki `index.html`, `favicon.svg` ve `apple-touch-icon.png`'e dokunma.
   - Firebase'e ya da internetteki canlı servislere istek atma.
   - `render.yaml` ve `.github/workflows/pages.yml`'de değişiklik gerekiyorsa yapma, sadece raporla.
7. **Ürün davranışını değiştirme:** Yetki kuralları, ortak plan ve menü yapısı kullanıcının verdiği kararlardır. Davranış değişikliği gerektiren bir bulgu varsa düzeltme, raporla.
8. **API sözleşmesi:** Backend, frontend'in kullandığı istek ve cevap biçimlerini bozmamalı. Zorunlu bir değişiklik olursa "Backend Çıktısı"nda açıkça yaz.
9. **`task.md`'ye yazarken** önce dosyayı yeniden oku, sonra yalnızca kendi bölümünü güncelle. Backend ve frontend aynı anda çalışıyor.
10. Türkçe yaz. Kod ve isimlendirme İngilizce, yorumlar Türkçe; mevcut stile uy.

## Backend Gereksinimleri

Tüm `backend/PlanToBee.API` kodunu tara:
- **Hatalar:** Yanlış yetki kontrolü, boş değer, eşzamanlılık/yarış durumu, transaction eksikliği, yanlış HTTP durum kodu, tarih/saat dilimi, migration tutarlılığı.
- **Güvenlik:** Başka ailenin verisine erişim, IDOR, girdi doğrulama, rate limit, token ve davet kodu işleme, bilgi sızdırma.
- **Performans:** N+1 sorgu, gereksiz `Include`, eksik indeks, izlenmeyen (`AsNoTracking`) okumalar, fazla veritabanı gidiş-dönüşü.
  - Örnek: Hafta görünümü şu an 7 ayrı `GET /api/days/{date}` isteği atıyor. Tek istekte haftanın ayrıntılarını dönen bir uç nokta eklenebilir. Eklersen eski uç noktalar kalsın, frontend'e nasıl kullanılacağını yaz.
- **Kod kalitesi:** Ölü kod, yinelenen mantık, tutarsız hata mesajları.

Bulduğunu düzelt. `dotnet build` uyarısız ve hatasız olmalı. Değişikliklerini test API'si ve `e2e.py` ile doğrula; yeni bir davranış eklersen senaryoya kontrol ekle.

## Frontend Gereksinimleri

Tüm `frontend/src` arayüzünü tasarım açısından gözden geçir:
- **Mobil:** 360-430 px genişlikte her ekran: giriş, kayıt, doğrulama, davet, aile kurma, Gün, Hafta (tablo ve liste), Ailem, ad menüsü. Taşan, üst üste binen ya da kesilen öğe olmamalı. Örnek: hafta tablosundaki kayıt çiplerinde metin harf harf kırılıyor ("Matemat ik").
- **Görsel tutarlılık:** Bej tema ve sarı-siyah marka ile uyum. Eski mavi tonlu ya da koyu temadan kalan renkler, tutarsız boşluk, köşe yarıçapı ve tipografi.
- **Erişilebilirlik:** Kontrast (WCAG AA), dokunma hedefleri (en az yaklaşık 40 px), klavye odağı, `aria` etiketleri, form hata mesajları.
- **Durumlar:** Boş, yükleniyor ve hata durumları; "Sunucuya ulaşılamadı" (Render uykudan uyanırken 30-60 sn) gibi durumların anlaşılır olması.
- **Kullanım:** Başkasının eklediği kaydın düzenlenemediği anlaşılıyor mu? Ekleyen bilgisi okunaklı mı? Ad menüsü keşfedilebilir mi?

Düzenlenmesi gereken yerleri düzenle. `npm run lint` hatasız olmalı; yeni uyarı ekleme, mevcut 8 uyarı önceden var. Şu iki derleme de hatasız olmalı:
- `VITE_API_URL=https://example.onrender.com/api npm run build`
- `VITE_API_URL=https://example.onrender.com/api VITE_BASE_PATH=/PlanToBee/app/ npm run build`

Önce ve sonra ekran görüntüleri al (`cdp.mjs`) ve dosya yollarını çıktıya yaz. Backend koduna dokunma.

## Kabul Kriterleri

- **K1.** `dotnet build` uyarısız ve hatasız; `npm run lint` hatasız ve yeni uyarı yok; iki frontend derlemesi başarılı.
- **K2.** Boş veritabanında tüm migration'lar sorunsuz uygulanıyor. Mevcut veriyle (`plantobee`'nin kopyası) de açılış sorunsuz.
- **K3.** Uçtan uca API senaryosu (kayıt, e-posta doğrulama, aile kurma, davet, katılma, ortak plan yetkileri, ders listesi, üye çıkarma, başka aile izolasyonu) tamamen geçiyor.
- **K4.** Ortak plan yetkileri:
  - Çocuk, ebeveynin kaydını değiştiremiyor ve silemiyor (403).
  - Başka ailenin kaydına erişim 404.
  - Arayüzde düzenleme ve silme düğmeleri yalnızca `canEdit` olan kayıtlarda görünüyor.
- **K5.** Arayüz:
  - 390 px genişlikte Gün, Hafta (tablo ve liste), Ailem, ad menüsü, giriş ve davet ekranlarında taşma ve kırık düzen yok.
  - Tarayıcı konsolunda hata yok.
- **K6.** GitHub Pages alt yolu: `/PlanToBee/app/` ile derlenen site, derin linkle (`/PlanToBee/app/invite?token=...`) açıldığında doğru sayfayı gösteriyor. `pages.yml`'deki `404.html` adımı taklit edilerek kontrol edilebilir.
- **K7.** Backend'in bulup düzelttiği her hata ve iyileştirme gerekçesiyle "Backend Çıktısı"nda listelenmiş; frontend değişiklikleri "Frontend Çıktısı"nda listelenmiş.
- **K8.** Kullanıcı kararlarıyla çelişen bir davranış değişikliği yapılmamış (bkz. çalışma kuralı 7).

## Backend Çıktısı

Kapsam: `backend/PlanToBee.API` altındaki tüm controller, servis, DTO, model, altyapı dosyaları ve migration'lar tarandı. Satır numaraları taramadaki (HEAD `2e2ad84`) haliyle verilmiştir. Ürün kuralları (ortak aile planı, ebeveyn/çocuk yetkileri, ayrılanın kayıtlarının ailede kalması) değiştirilmedi. Mevcut cevap biçimleri korundu.

### Düzeltilen bulgular

**Hatalar**

1. **Eşzamanlı ilk ders listesi isteği varsayılan dersleri çoğaltıyor.** `Controllers/SubjectsController.cs:33-40`
   - Sorun: Ailenin ders listesi boşsa `GET /api/subjects` varsayılan 10 dersi ekliyor. Aynı anda gelen istekler (ör. ekran açılışında iki bileşen, iki aile üyesi) listeyi her biri ayrı ayrı ekliyordu.
   - Etkisi: Eski kodla 6 eşzamanlı istekte 60 ders oluştu (test ederek doğrulandı). Ders listesinde her ders birkaç kez görünüyordu.
   - Düzeltme: Ekleme bir transaction içinde ve aile bazlı PostgreSQL danışma kilidi (`pg_advisory_xact_lock`) altında yapılıyor. Liste kilit alındıktan sonra yeniden okunuyor. Yeni dosya `Services/PlanLocks.cs`.
2. **Aynı ders eşzamanlı iki istekle iki kez eklenebiliyor.** `SubjectsController.cs:57-62`
   - Sorun: "Bu ders var mı" kontrolü ile ekleme arasında kilit yoktu. Veritabanında (FamilyId, Name) için benzersiz indeks de yok, çünkü Türkçe büyük/küçük harf kuralı SQL'de birebir uygulanamıyor.
   - Düzeltme: Kontrol ve ekleme aynı kilit altında yapılıyor. `FamilyService.MergeFamilyPlanAsync` hedef ailenin ders listesine yazarken aynı kilidi alıyor.
3. **Davet koduyla eşzamanlı hatalı denemeler 500 hatası veriyor ve deneme sayacı eksik artıyor.** `Services/InvitationService.cs:92-94`
   - Sorun: `FailedCodeAttempts` bellekte artırılıp `SaveChanges` ile yazılıyordu. `Invitation.Version` (xmin) eşzamanlılık belirteci olduğu için eşzamanlı istekler `DbUpdateConcurrencyException` fırlatıyordu.
   - Etkisi: Eski kodla 8 eşzamanlı hatalı denemenin 6'sı 500 döndü (doğrulandı). Ezilen artışlar kod kilidine kadar fazladan deneme hakkı da verebilirdi, yani kaba kuvvet korumasını zayıflatıyordu.
   - Düzeltme: Sayaç veritabanında atomik artırılıyor (`ExecuteUpdate ... SET "FailedCodeAttempts" = "FailedCodeAttempts" + 1`). Kilit kararı güncel değerle veriliyor.
4. **Uç hafta tarihinde 500.** `Controllers/DaysController.cs:54`
   - Sorun: `GET /api/days/week/9999-12-31` isteğinde `AddDays` taşıp `ArgumentOutOfRangeException` fırlatıyordu.
   - Düzeltme: Tarihler 1900-2999 aralığında kabul ediliyor. Aralık dışı istek 400 `invalid_date` alıyor.
5. **Tarih ayrıştırma sunucunun kültür ayarına bağlı.** `DaysController.cs:25, 50, 83, 144, 189`
   - Sorun: `DateOnly.TryParse` kullanılıyordu. `2026-9-28` ya da kültüre göre `1/2/2026` gibi belirsiz biçimler kabul ediliyordu. `GET /days/{date}` gelen metni olduğu gibi geri yansıtıyordu; bu durumda cevaptaki `date` frontend'in anahtarıyla (`yyyy-MM-dd`) eşleşmeyebiliyordu.
   - Düzeltme: Yalnızca `yyyy-MM-dd` kabul ediliyor (`InvariantCulture`), cevaptaki tarih her zaman bu biçimde üretiliyor. Frontend zaten bu biçimi kullanıyor (`dkey`). Yeni dosya `Infrastructure/PlanText.cs`.
6. **Güncelleme ve silme uç noktaları rotadaki tarihi yok sayıyor.** `DaysController.cs:96-225, 231-245`
   - Sorun: `PUT/PATCH/DELETE /days/{date}/.../{id}` başka bir günün kaydını da değiştiriyordu. Aile kontrolü olduğu için güvenlik açığı değildi, ama istemci hatalarını gizliyordu.
   - Düzeltme: Rotadaki tarih geçersizse 400, kaydın günü değilse 404 dönüyor. Frontend her zaman kaydın gün anahtarını gönderdiği için etkilenmiyor.
7. **Gün oluşturma yarışında her `DbUpdateException` yakalanıyor.** `DaysController.cs:292`
   - Sorun: Benzersiz indeks çakışması dışındaki veritabanı hataları da yutulup yanlış yola sapılıyordu.
   - Düzeltme: Yalnızca PostgreSQL `23505` (unique violation) yakalanıyor.
8. **Yakalanmamış hatalarda tutarsız gövde.** `Program.cs`
   - Sorun: Genel hata işleyici yoktu. Geliştirmede HTML/yığın izi, üretimde boş 500 dönüyordu. Frontend "Bir hata oluştu" dışında bir şey gösteremiyordu.
   - Düzeltme: `UseExceptionHandler` eklendi. 500 cevabı `{ "code": "server_error", "message": "..." }`, `DbUpdateConcurrencyException` için 409 `{ "code": "concurrency_conflict", ... }`. Ayrıntı yalnızca sunucu loguna yazılıyor. CORS başlıkları korunuyor.

**Güvenlik**

9. **Plan ve aile uç noktalarında istek sınırı yok.** `Infrastructure/RateLimitPolicies.cs`
   - Sorun: `Days`, `Subjects` ve `Family` controller'larında hiç rate limit yoktu. Tek bir hesap ya da çalınmış bir token API'yi ve Neon veritabanını sınırsız istekle meşgul edebiliyordu.
   - Düzeltme: Kullanıcı başına dakikada 300 istek sınırı olan `Api` politikası eklendi. Ayar `RateLimits:Api` ile değiştirilebiliyor, `StartupValidation` bu ayarı doğruluyor. Aşılırsa mevcut biçimde 429 `rate_limited` dönüyor.
   - Normal kullanım bu sınıra yaklaşmıyor. Eski hafta ekranı bile gezinme başına yaklaşık 9 istek atıyor.
   - Davet gönderme uç noktaları kendi `InviteSend` sınırlarını kullanmaya devam ediyor.
   - Doğrulandı: `RateLimits__Api=5` ile 6. istek 429 aldı; başka kullanıcı ve `/auth/me` etkilenmedi.
10. **Gönderim sınırlayıcıda bellek sızıntısı.** `Infrastructure/SendThrottle.cs:9`
    - Sorun: Her kullanıcı ve aile için açılan kuyruklar hiç silinmiyordu, bellek süreç boyunca büyüyordu.
    - Düzeltme: Her 500 çağrıda bir, son kaydı 1 günden (en uzun pencere) eski olan anahtarlar temizleniyor.

**Performans**

11. **Hafta görünümü 7 ayrı istek atıyor.** Çözüm için yeni uç nokta eklendi, sözleşmesi aşağıda.
12. **Hafta özeti tüm kayıtları belleğe yüklüyor.** `DaysController.cs:55-61`
    - Sorun: Özet (dakika ve sayılar) için haftanın tüm ders, antrenman ve etkinlik satırları `Include` ile çekiliyordu.
    - Düzeltme: Toplamlar SQL'de hesaplanıyor (tek sorgu, `SUM`/`COUNT` alt sorguları). `dates.Contains(...)` yerine indeks dostu tarih aralığı (`Date >= start AND Date <= end`) kullanılıyor. Cevap biçimi aynı.
13. **Gün sorgusunda kartezyen çarpım.** `DaysController.cs:30-35`
    - Sorun: Üç koleksiyon tek sorguda `Include` ediliyordu. Satır sayısı ders × antrenman × etkinlik kadar oluyordu.
    - Düzeltme: `AsSplitQuery` kullanılıyor. Gün ve hafta ayrıntısı aynı yardımcıyı (`LoadDaysAsync`) kullanıyor.
14. **Her yazma işleminden sonra fazladan sorgu.** `DaysController.cs:259-262`, `SubjectsController.cs:63`
    - Sorun: Kayıt ekleme ve düzenleme cevabındaki `createdBy`/`updatedBy` için her seferinde `FamilyMembers` sorgulanıyordu.
    - Düzeltme: `AuditLookup.LoadAsync` artık istek sahibini (zaten yüklü) doğrudan kullanıyor. Yalnızca başka üyeler için sorgu atılıyor. Okumalarda da istek sahibi sorgudan çıkarılıyor.
15. **`FamilyMembers.FamilyId` üzerinde kullanılabilir indeks yok.** `Data/AppDbContext.cs:59`
    - Sorun: Tek indeks kısmi (`WHERE "IsAdmin"`) olduğu için ailenin üyelerini listeleyen sorgular tabloyu baştan sona tarıyordu. Bu sorgular Ailem ekranında, davet kontrollerinde, "başka üye var mı" kontrolünde ve aile silinirken FK taramasında çalışıyor.
    - Düzeltme: `(FamilyId, Status)` indeksi eklendi. Yeni migration `20260929232454_FamilyMemberFamilyIndex` yalnızca indeks ekliyor.
16. **Küçük performans iyileştirmeleri.**
    - `FamilyController.ListInvitations` (`:81`) takip edilmeden okuyor (`AsNoTracking`).
    - `Leave` (`:271`) yeni aileyi ayrıca sorgulamıyor, `CreateFamilyAsync`'in bağladığı nesneyi kullanıyor.

**Kod kalitesi**

17. **Yinelenen kod ve yersiz tanımlar.**
    - `TurkishIgnoreCase` iki yerde tanımlıydı (`SubjectsController`, `FamilyService`); `PlanText`'e taşındı.
    - Aile davet kotası kodu üç kez tekrarlanıyordu; `TryAcquireFamilyInviteQuota` yardımcısına alındı.
    - `InviteResultDto` controller dosyasındaydı; `DTOs/FamilyDtos.cs`'e taşındı. JSON biçimi aynı.
    - Tarih hatası mesajı tek yerde tanımlı (`InvalidDate()`).
18. **E-posta düğmesi eski mavi renkte.** `Services/Email/EmailTemplates.cs:61`
    - Düğme `#4f46e5` renkteydi. Marka rengine çevrildi: bal sarısı `#F6B51E` zemin, `#1E1A14` kalın yazı. Kontrast AA'yı geçiyor.

### Yeni uç nokta: hafta ayrıntıları

- **Yol:** `GET /api/days/week/{monday}/details`
  - `monday` biçimi `yyyy-MM-dd`. Pazartesi olması zorunlu değil; o tarihten başlayan 7 gün döner.
  - Kimlik doğrulama ve doğrulanmış e-posta gerekir. Aile yoksa 403 `family_required`, tarih geçersizse 400 `invalid_date`.
- **Cevap:** `{ "days": [DayDto × 7] }`. Tarihe göre sıralı. Her eleman `GET /api/days/{date}` cevabıyla birebir aynı:
  ```
  { "date": "2026-09-28",
    "studyEntries":    [{ id, subject, topic, minutes, status, canEdit, createdBy, createdAt, updatedBy, updatedAt, isImported }],
    "trainingEntries": [{ id, type, minutes, note, canEdit, createdBy, ... }],
    "events":          [{ id, title, time, note, canEdit, createdBy, ... }] }
  ```
  - Kayıtsız günler boş listelerle döner.
  - `canEdit`, `createdBy.isFormerMember` gibi alanlar istek sahibine göre hesaplanır, yetki kuralları aynı.
  - Sunucuda 5 sorgu çalışır: gün, 3 koleksiyon, gerekirse kayıt izi. Eskiden 7 istek × 3-4 sorgu gerekiyordu.
- **Frontend'de kullanım** (`frontend/src/pages/WeekPage.jsx:36`): 7 ayrı `client.get('/days/${k}')` yerine tek istek yeterli.
  ```js
  const res = await client.get(`/days/week/${dkey(weekStart)}/details`);
  const byKey = Object.fromEntries(res.data.days.map(d => [d.date, d]));
  ```
  Ekleme, düzenleme ve silme uç noktaları değişmedi. Eski `GET /api/days/{date}` ve özet `GET /api/days/week/{monday}` yerinde duruyor.

### API sözleşmesine etkisi

Mevcut cevap biçimlerinde değişiklik yok. Sıkılaştırılan davranışlar şunlar; frontend bunlardan etkilenmiyor:

- Tarih yalnızca `yyyy-MM-dd` biçiminde kabul ediliyor.
- `PUT/PATCH/DELETE` istekleri rotadaki tarih kaydın günü değilse 404 alıyor.
- Kullanıcı başına dakikada 300 istekten sonra 429 dönüyor.
- Yakalanmamış hata artık `{code, message}` JSON gövdesiyle dönüyor.

### Çalıştırılan testler

- **Derleme:** `dotnet build --no-incremental` sonucu 0 uyarı, 0 hata.
  - Kullanıcının 5002'deki API'si repo `bin/` klasöründen çalıştığı için derleme ve testler projenin geçici bir kopyasında yapıldı.
  - `dotnet ef migrations has-pending-model-changes` "No changes" döndü.
- **K2:**
  - Boş `plantobee_be` veritabanında 6 migration'ın tamamı sorunsuz uygulandı.
  - `plantobee`'nin kopyasında (`pg_dump plantobee | psql plantobee_be_copy`) açılışta yalnızca yeni migration uygulandı, `/health` ok döndü, `IX_FamilyMembers_FamilyId_Status` oluştu.
  - Kopyadaki gerçek veriyle uç nokta denemesi yapılmadı. Bunun için kopyadaki bir hesabın şifresini sıfırlamak gerekiyordu; kişisel veri kısıtı nedeniyle izin verilmedi.
- **Uçtan uca senaryo:** `e2e.py` 5101 portuna uyarlandı. Kopyası: `/private/tmp/claude-501/-Users-ilkerisler-Projects-PlanToBee/168fdbf4-abb7-4353-b66b-aaf117968578/scratchpad/be/e2e.py`, kullanım `python3 e2e.py <api-log>`.
  - Sonuç: **59 geçti, 0 kaldı**. Eski 35 kontrolün hepsi ve 24 yeni kontrol geçti.
  - Senaryo sırasında API logunda hiç 500 yok.
  - Yeni kontroller:
    - Hafta ayrıntısı: 7 gün, tarihler, 0. günün `GET /days/{date}` ile birebir aynı olması, boş gün biçimi, çağırana göre `canEdit`, `createdBy`, başka aileye boş dönmesi, 401.
    - Hafta özetinin değerlerinin korunması.
    - Geçersiz tarihler (`2026-9-28`, `28.09.2026`, `abc`, `0001-01-01`) için 400, `9999-12-31` hafta için 400 (500 değil).
    - Yanlış rota tarihiyle `PUT` ve `DELETE` için 404.
    - `PATCH` sonrası `updatedBy`.
    - 6 eşzamanlı aynı ders eklemede 1×200 + 5×409.
    - Yeni ailede 6 eşzamanlı ilk `GET /subjects` sonrası tam 10 ders.
    - 8 eşzamanlı hatalı davet kodunda 500 olmaması ve ardından doğru kodla 429 `invite_code_locked` dönmesi.
- **Eski kodla karşılaştırma:** Aynı eşzamanlılık kontrolleri HEAD sürümünde çalıştırıldı.
  - Varsayılan dersler 60 kez eklendi.
  - Hatalı kod denemelerinin 6'sı `DbUpdateConcurrencyException` ile 500 döndü.
- **Rate limit:** `RateLimits__Api=5` ile ayrıca denendi, sonuç yukarıdaki 9. maddede.
- **Temizlik:** 5101'deki süreç kapatıldı. `plantobee_be`, `plantobee_be_copy` ve geçici `plantobee_be_old` veritabanları silindi. `plantobee`'ye yazılmadı. 5002 ve 5173 süreçlerine dokunulmadı.
- **Denenmeyen:** Yeni genel hata işleyici (8. madde) doğrudan tetiklenemedi; senaryoda 500 üreten bir yol kalmadı.

### Düzeltilmeyen, ürün kararı gerektiren bulgular

1. **Kayıtta hesap varlığı belli oluyor.** `AuthController.cs:34-35`: `POST /auth/register` "'x' ile zaten bir hesap var." diyor. `Login` kilitlenmesi (`:52`) de yalnızca var olan hesaplarda 429 `locked_out` döndüğü için hesabın varlığını ele veriyor. Kullanım kolaylığıyla çelişen yaygın bir ödünleşim. Gizlemek için kayıt akışının "doğrulama e-postası gönderdik" biçimine çevrilmesi gerekir; bu ürün kararı.
2. **Davet e-postasındaki son geçerlilik zamanı UTC.** `EmailTemplates.cs:40`: "... (UTC)" yazıyor. Türkiye saatine çevirmek için konteynerde saat dilimi verisi (`Europe/Istanbul`) olduğundan emin olunmalı. İstenirse sabit UTC+3 ile yapılabilir.
3. **Data Protection anahtarları veritabanında şifresiz duruyor.** Açılış logunda "No XML encryptor configured" uyarısı çıkıyor. Doğrulama ve şifre sıfırlama bağlantılarını imzalayan anahtarları veritabanına erişen biri okuyabilir. Veritabanı erişimi zaten tam erişim anlamına geldiği için risk düşük. İstenirse bir sertifikayla `ProtectKeysWithCertificate` eklenebilir.
4. **JWT 30 gün geçerli ve frontend'de `localStorage`'da.** Security stamp kontrolü sayesinde şifre değişince iptal ediliyor. Yine de XSS durumunda token çalınabilir. Daha kısa ömür ve yenileme akışı ya da `HttpOnly` çerez ayrı bir iş.
5. **Boş aile satırları birikiyor.** `accept-existing` ile başka aileye katılan tek kişilik ailenin `Families` satırı (ve `Left` üye satırı) silinmeden kalıyor. Ayrılan üyeler de "Eski üye" gösterimi için tutuluyor. Zararsız, ama ileride bir temizlik işi düşünülebilir.
6. **Bazı sınırlar bellek içinde.** `SendThrottle` ve rate limit sayaçları süreç içinde tutuluyor. Render ücretsiz planındaki tek örnek için yeterli. Yeniden başlatmada sıfırlanıyor; birden fazla örnekte Redis benzeri paylaşılan bir depo gerekir.
7. **Ders listesi boşalınca varsayılanlar geri geliyor.** Aile tüm dersleri silerse bir sonraki `GET /subjects` varsayılan dersleri yeniden ekliyor. Bu mevcut davranış ve değiştirilmedi.
8. **`render.yaml` değişikliği gerekmiyor.** Yeni `RateLimits__Api` ayarı isteğe bağlı, varsayılanı 300.

### Değişen dosyalar (`backend/PlanToBee.API/`)

- Controller'lar: `Controllers/DaysController.cs`, `Controllers/SubjectsController.cs`, `Controllers/FamilyController.cs`
- DTO'lar: `DTOs/DayDtos.cs` (`WeekDetailsDto`), `DTOs/FamilyDtos.cs` (`InviteResultDto` taşındı)
- Veri: `Data/AppDbContext.cs`
- Altyapı: `Infrastructure/RateLimitPolicies.cs`, `Infrastructure/SendThrottle.cs`, `Infrastructure/StartupValidation.cs`, `Program.cs`
- Servisler: `Services/AuditLookup.cs`, `Services/FamilyService.cs`, `Services/InvitationService.cs`, `Services/Email/EmailTemplates.cs`
- Yeni dosyalar: `Infrastructure/PlanText.cs`, `Services/PlanLocks.cs`
- Migration: `Migrations/20260929232454_FamilyMemberFamilyIndex.cs`, `Migrations/20260929232454_FamilyMemberFamilyIndex.Designer.cs`, `Migrations/AppDbContextModelSnapshot.cs`

## Frontend Çıktısı

Tasarım turu `frontend/src` üzerinde yapıldı. Ürün kararları (ortak plan, ad menüsü, Gün + Hafta Planı sekmeleri, açık bej tema, sarı-siyah logo) korundu. Yeni bağımlılık eklenmedi. Backend'e dokunulmadı.

### Düzenlemeler

**Hafta tablosu (`pages/WeekPage.jsx`, `index.css`)**
- **Harf harf kırılma ("Matemat ik").**
  - Sorun: Çip `inline-flex` idi ve `overflow-wrap: anywhere` kullanıyordu. "Aslı ekledi" etiketi ve × düğmesi aynı satırdaydı, bu yüzden ders adı birkaç piksele sıkışıyordu.
  - Tablodaki çip artık hücre genişliğini kaplıyor. Ad ve × üst satırda, "ekleyen" bilgisi alt satırda.
  - Kırılma kuralı `overflow-wrap: break-word` + `hyphens: auto`. Çip yazı tipi mono yerine Figtree, daha dar.
  - "· 45 dk" parçası bölünmez boşlukla bağlandı; satır yalnızca addan sonra kırılıyor.
  - 380 px altında gün sütunu 34 px. Tablonun `min-width` değeri 340 px'ten 300 px'e indi; 360 px'te Etkinlik sütunu kesiliyordu.
- **Tek istekli hafta yükleme.**
  - 7 ayrı `GET /days/{date}` yerine `GET /days/week/{pazartesi}/details` kullanılıyor.
  - `res.data.days`, `date` alanına göre eşleniyor. `[{ key, data }]` biçimi korundu, iyimser güncellemeler aynı.
  - Düzenleme/silme istekleri satırın kendi tarihiyle gidiyor. Ağ kaydında doğrulandı: `PATCH /days/2026-09-28/entries/1/status`.
- **Diğer düzenlemeler.**
  - Durum yalnızca renkle anlatılmıyor: devam eden kayıtta ◐, tamamlananda ✓ işareti var. Ekran okuyucu için gizli durum metni eklendi.
  - Ekleme çubuğunda hatalı alan artık yalnızca kırmızı çerçeveyle gösterilmiyor: yazılı hata mesajı (`role="alert"`) ve `aria-invalid` eklendi.
  - Dokunma hedefleri büyütüldü:
    - `+` düğmesi 24×22 → 34×30 px; dokunmatik ekranda tam görünür.
    - Çip × düğmesi 18 → 26-28 px.
    - Tablo/Liste, tür seçici ve hafta gezinme düğmeleri en az 36-40 px.
  - Eklenen etiketler: `+` düğmesi "Salı için ders ekle", gün hücresi "Salı 29 gününe git", × düğmesi "Fizik kaydını sil".
  - Liste görünümündeki hızlı ekleme alanları 30 → 40 px.
  - "bugün" işareti ve bugün satırının vurgusu mavi yerine bal sarısı.

**Düzenlenemeyen kayıt (`components/ReadOnlyMark.jsx` yeni; `StudyCard.jsx`, `TrainingCard.jsx`, `EventCard.jsx`, `WeekPage.jsx`)**
- Sorun: `canEdit=false` olan kayıtta düğmeler sessizce kayboluyordu; neden düzenlenemediği anlaşılmıyordu.
- Çözüm: Düğmelerin yerinde kilit simgesi gösteriliyor. `aria-label` ve `title`: "Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir."
- Yetki mantığı aynı. Düğmeler hâlâ yalnızca `canEdit` olan kayıtlarda görünüyor (K4).

**Gün kartları (`StudyCard.jsx`, `TrainingCard.jsx`, `EventCard.jsx`)**
- **Ders satırı sıkışıyordu.** Solda durum rozeti, sağda dakika ve iki düğme vardı; konu metni ~60 px'e sıkışıyordu. Rozet ve "ekleyen" bilgisi artık adın altındaki satırda; solda diğer kartlarla aynı renk şeridi var.
- **Dokunma hedefleri.** Düzenle/sil düğmeleri 28 → 38×40 px; simge rengi daha koyu (`--ink-soft`).
- **Erişilebilir adlar.** Düğme etiketleri kayda göre: "Matematik kaydını düzenle", "Top antrenmanını sil" vb. Rozetin etiketi durumu ve dokununca değişeceğini söylüyor.
- **Formlar.**
  - Etiketsiz alanlara `aria-label` eklendi.
  - Sayı alanlarına `inputMode="numeric"` eklendi.
  - Etkinlik formundaki "Ekle" düğmesi tek başına alt satıra düşüyordu, "Etkinlik (ör. deneme sı…" yer tutucusu da kesiliyordu. Şimdi başlık tam satır; saat, not ve Ekle ikinci satırda.
- **Açılır bölümler.** "Dersleri düzenle" ve "Davet geçmişi" düğmelerine `aria-expanded` eklendi. Ders silme × düğmesi 20 → 30 px.

**Renk ve kontrast (`index.css`)**
- Eski ve yeni değerler, ölçülen kontrastlar:

| Renk | Eski → yeni | Kontrast | Not |
|---|---|---|---|
| `--ink-faint` | `#A0967F` → `#72695A` | ~2.9:1 → ~4.6:1 | Karttaki soluk metin (ipuçları, notlar, "ekleyen", tablo başlıkları). Eski ton `--line-faint` olarak yalnızca süs çizgilerinde kaldı. |
| `--warn` | `#B7791F` → `#8A5A0F` | ~3.1:1 → ~5:1 | "Devam Ediyor" rozeti |
| `--event` | `#D9502F` → `#C4461F` | beyaz yazıyla AA | Buton rengi. Yazı için `--event-deep` (`#A8361A`) eklendi. |
| `--sport` | `#17936A` → `#13805C` | beyaz yazıyla ~3.9:1 → ~4.9:1 | |
| `--danger` | `#C4372B` → `#B3301F` | açık kırmızı zeminde AA | |

- **Mavi kalıntılar markaya çevrildi:**
  - Odak halkası artık siyah; koyu panelde bal sarısı.
  - Giriş alanı odağı: siyah çerçeve ve bal sarısı hale.
  - Bağlantılar (`.auth-link`, `.link`, "Güne git") siyah metin ve bal sarısı alt çizgiyle gösteriliyor. `a.auth-link` alt çizgiyi kaldırıyordu, düzeltildi.
  - Ad menüsü ve Ailem avatarları bal sarısı zemin üzerine siyah harf.
  - Gün ekranındaki "bugün" rozeti yeşil yerine bal sarısı.
  - Onay penceresi arka planındaki lacivert ton (`rgba(12,16,32)`) sıcak siyahla değiştirildi.
- **Mavi bilinçli olarak kaldı:** "Ders" kategorisinin rengi (çip, şerit, Ekle düğmesi) kategori kodlaması olduğu için değişmedi.
- **Diğer:**
  - Yer tutucu metin rengi AA'ya uygun hale getirildi.
  - Giriş alanlarının çerçevesi `--line-strong`; alanlar en az 42 px yüksekliğinde.
  - `.sr-only` yardımcı sınıfı eklendi.

**Ad menüsü (`components/UserMenu.jsx`, `index.css`)**
- **Görünüm:** Ad mono 11 px yerine Figtree 13 px kalın yazılıyor; düğme 40 px yüksekliğinde, avatar sarı. Uzun adlar üç noktayla kısalıyor (en fazla 170 px).
- **Klavye ve ekran okuyucu:**
  - Menü açılınca odak ilk seçeneğe geçiyor. Oklarla seçenekler arasında geziliyor.
  - Esc menüyü kapatıyor ve odağı düğmeye geri veriyor.
  - `li` öğelerinde `role="none"` var.
  - Düğme etiketi: "Ilker: hesap menüsü (Ailem, Çıkış yap)".
- **Dokunma hedefi:** Menü seçenekleri 44 px.

**Ailem (`pages/PlanShell.jsx`, `pages/FamilyPage.jsx`)**
- Ailem açıkken hiçbir sekme seçili görünmüyordu; kullanıcı nerede olduğunu anlamıyordu. Üste "‹ Plana dön" düğmesi ve "Ailem" başlığı eklendi. Menü yapısı değişmedi.
- Aile bilgisi yüklenemediğinde hata kutusunun altında sonsuz "Yükleniyor…" da görünüyordu. Artık yalnızca "Tekrar dene" düğmeli hata kutusu görünüyor.
- Üye işlem bağlantıları 2 px dolgulu küçük metinlerdi; artık 38 px yüksekliğinde. Rol seçicide `aria-pressed` var.

**Yükleniyor ve hata durumları (`components/Loading.jsx` yeni, `hooks/useSlow.js` yeni, `api/errors.js`, `LoginPage.jsx`, tüm sayfalar)**
- **Ortak `Loading` bileşeni.** Dönen bal sarısı gösterge ve `role="status"` içeriyor. 5 saniyeden uzun sürerse "Sunucu uykudan uyanıyor olabilir; ilk açılışta bu 1 dakikaya kadar sürebilir." der.
  - Kullanıldığı yerler: hesap yükleme, gün, hafta, Ailem, davet geçmişi, davet kontrolü, e-posta doğrulama.
- **Giriş/kayıt butonu.** Uzun beklemede aynı açıklama gösteriliyor.
- **`errorText` iyileştirmeleri.**
  - Yanıt yoksa mesaj Render uykusunu da anıyor.
  - 502/503/504 için anlaşılır bir mesaj var.
  - Düz metin hata gövdesi yalnızca kısa ve HTML değilse gösteriliyor. Önceden ağ geçidinin HTML hata sayfası bildirim olarak ekrana basılabiliyordu.
- Hata kutularına `role="alert"` eklendi. Alttaki bildirimin kapatma düğmesi 36 px ve iPhone'un güvenli alanını (safe-area) dikkate alıyor.

**Erişilebilirlik (diğer)**
- **Segment düğmeleri.** Sekmeler, Tablo/Liste, Giriş/Kayıt, tür seçici ve rol seçicide `aria-pressed` var.
- **Hafta şeridi (`WeekTrail.jsx`).**
  - `aria-pressed` eklendi; bugün için `aria-current="date"`.
  - Etiket örneği: "Çarşamba 30, ders var, antrenman var". Noktalar ekran okuyucudan gizlendi.
- **Hesap ekranları.** Giriş, Davet, Şifremi unuttum ve Şifre sıfırlama sayfalarında yalnızca yer tutucusu olan alanlara `aria-label` eklendi.
- **Tablo başlıkları.** Boş başlık hücresine "Gün" (gizli metin) eklendi; "Top." kısaltmasına `abbr title="Toplam"` eklendi.
- **Dokunma hedefleri.**

| Öğe | Önce → sonra |
|---|---|
| Sekmeler | ~37 → ~40 px |
| Gün gezinme okları | 38 → 42 px |
| Hafta şeridi günleri | en az 44 px |
| Auth bağlantıları | 10 px dolgu |
| `.btn` / `.btn-ghost` / `.btn-danger` | en az 42 px |

### Ekran görüntüleri (390 px, deviceScaleFactor 2)
Klasör: `/private/tmp/claude-501/-Users-ilkerisler-Projects-PlanToBee/168fdbf4-abb7-4353-b66b-aaf117968578/scratchpad/fe/shots/`
- **Önce:** `before/before-*.png`
- **Sonra:** `after/after-*.png`
- **Ek kontrol (360 px):** `after360/after360-*.png`
- **Ekranlar:**
  - Hesap: `login`, `register`, `invite-code`, `invite-missing`, `invite`, `verify-error`, `verify-pending`, `create-family`.
  - Ebeveyn: `p1-day`, `p1-menu`, `p1-family`, `p1-week-table`, `p1-week-list`.
  - Çocuk: `child-day`, `child-week-table`, `child-family`.
- **En belirgin fark:** `before-p1-week-table.png` ve `after-p1-week-table.png` ("Matemat ik"); `before-child-day.png` ve `after-child-day.png` (kilit, satır düzeni).
- **Betik:** `scratchpad/fe/shots.mjs`.
  - Chrome uzaktan hata ayıklama portu 9341.
  - Her ekranda sayfa taşmasını ve görünür alanın sağına taşan öğeleri ölçüyor.
  - Tarayıcı konsolundaki hataları topluyor.
  - Ağ isteklerini sayıyor ve bir etkileşim testi yapıyor.

### Çalıştırılan kontroller
- **Test ortamı:** API 5103, veritabanı `plantobee_fe`, Vite 5175.
  - API, backend'in çalışma alanı dışındaki bir kopyasından (scratchpad) derlenip çalıştırıldı; repodaki `bin/` ve 5002'deki API'ye dokunulmadı.
  - Veritabanı ve süreçler iş sonunda kapatılıp silindi.
- **Test verisi:** `seed_fe.py` ile oluşturuldu.
  - Aile üyeleri: ebeveyn Ilker ve Aslı, çocuk Ela, davet bekleyen Deniz, hesapsız profil Can.
  - Hafta boyunca kayıtlar var; uzun konu metni de dahil.
  - Ayrıca ailesiz ve doğrulanmamış iki kullanıcı ve bir davet belirteci oluşturuldu.
- **Taşma:** 16 ekranın hepsinde 390 ve 360 px'te yok; tarayıcı konsolunda hata yok.
- **Etkileşim (ebeveyn, hafta tablosu):**
  - Hafta açılışında tek istek gidiyor: `GET /days/week/2026-09-28/details`. Geliştirme modunda StrictMode nedeniyle iki kez görünüyor.
  - Çipe dokununca `PATCH .../entries/1/status` gidiyor ve çipin sınıfı `status-inprogress` oluyor.
  - Ekleme `POST /days/2026-09-30/entries` isteğini atıyor.
  - Boş dakika ile eklemede "Süreyi dakika olarak girin." yazıyor.
- **`npm run lint`:** 0 hata, 8 uyarı. Hepsi önceden vardı: `only-export-components` ×2, `set-state-in-effect` ×6. Yeni uyarı yok.
- **Derlemeler:** `VITE_API_URL=https://example.onrender.com/api npm run build` başarılı. `... VITE_BASE_PATH=/PlanToBee/app/ npm run build` de başarılı.

### Yapılmayanlar / ürün kararı gerektiren öneriler
- **Silmede onay ya da geri alma yok.** × düğmesi büyüdüğü için yanlışlıkla dokunma riski arttı. "Geri al" bildirimi önerilir; davranış değişikliği olduğu için yapılmadı.
- **Kendi eklediğin kayıtta "ekleyen" bilgisi görünmüyor** (`auditTrail` tasarımı). Aile planında "Sen ekledin" göstermek istenebilir.
- **Tabloda ekleyen bilgisi yer kaplıyor.** Dar ekranda "Aslı ekledi" alt satırda olduğu için satırlar uzuyor. Yalnızca baş harf (ör. "A") gösterilebilir.
- **Ders kategorisi hâlâ mavi (`--study`).** Marka rengine çevrilmesi kategori kodlamasını bozar, bu yüzden karar ürün sahibinin.
- **Hafta tablosunda dar çip tasarımı.** 360 px'te "Matematik"ten uzun tek kelimelik adlar, Türkçe tireleme destekleniyorsa tireyle, desteklenmiyorsa kelime ortasından bölünür. Çok uzun ders adları için ders listesine kısa ad alanı eklenebilir.
- **Google Fonts dış isteği.** `index.css` ilk satırı Google Fonts'tan yükleniyor. Capacitor paketinde çevrimdışı açılış için fontların `public/` altına alınması önerilir (yeni bağımlılık gerektirmez).
- **Hafta özeti için ikinci istek.** Hafta sayfası `GET /days/week/{pazartesi}` özetini de ayrıca çağırıyor (gün şeridi ve istatistik için `PlanShell`). Özet ayrıntıdan hesaplanabilir; ileride tek isteğe indirilebilir.

## Durum: Backend: Tamamlandı · Frontend: Tamamlandı · QA: Onaylandı (H1-H3 ana oturumda düzeltildi)

## QA Sonuçları

**Özet:** K1-K8'in sekizi de geçti. Kritik ya da orta önemde hata bulunmadı. Üç düşük önemli frontend hatası var: ikisi klavye erişilebilirliği, biri sunucu uyanırken gösterilen mesaj. Hepsi küçük düzeltmeler; backend'de düzeltme gerekmiyor. Rol kuralı gereği durum "Düzeltme Gerekiyor" olarak işaretlendi. Bu üç madde canlıya çıkışı engellemiyor; ertelenip ertelenmeyeceği ana oturumun kararı.

QA dosyaları: `/private/tmp/claude-501/-Users-ilkerisler-Projects-PlanToBee/168fdbf4-abb7-4353-b66b-aaf117968578/scratchpad/qa/` (aşağıda kısaca `qa/`).

**Test ortamı:**
- API 5102: repodaki kaynağın `bin`/`obj` hariç `qa/api` kopyası.
- Vite 5176. Pages taklidi için statik sunucu 8766. Chrome uzaktan hata ayıklama portu 9336.
- Veritabanları: `plantobee_qa` (boş) ve `plantobee_qa_copy` (`plantobee`'nin kopyası).
- İş sonunda süreçler kapatıldı, iki veritabanı silindi.
- `plantobee`'ye yazılmadı. 5002 ve 5173'teki süreçlere dokunulmadı; sonda ikisinin de çalıştığı doğrulandı.
- Repoda dosya değişmedi, yalnızca bu bölüm yazıldı.

### Kabul kriterleri

| Kriter | Sonuç | Kanıt |
|---|---|---|
| K1 | Geçti | `dotnet build --no-incremental` (`qa/api`): **0 uyarı, 0 hata**. `npm run lint`: çıkış kodu 0, **0 hata, 8 uyarı**; sekizi de önceden bilinenler (`only-export-components` ×2, `set-state-in-effect` ×6). İki derleme de başarılı: `vite build` (`qa/dist1`) ve `VITE_BASE_PATH=/PlanToBee/app/` ile (`qa/dist2`). Repodaki `dist`'e dokunulmadı. |
| K2 | Geçti | Boş `plantobee_qa`: 6 migration'ın tamamı uygulandı, `/health` → `{"status":"ok","api":"ok","database":"ok"}` (`qa/api.log`). Kopya `plantobee_qa_copy`: yalnızca `20260929232454_FamilyMemberFamilyIndex` uygulandı, `IX_FamilyMembers_FamilyId_Status` oluştu, `/health` ok (`qa/api_copy.log`). Kopyadaki veriye yazılmadı. Not: boş veritabanında EF, `__EFMigrationsHistory` tablosu henüz olmadığı için iki `fail: ... Failed executing DbCommand` satırı yazıyor. Bu EF'in bilinen, zararsız davranışı; migration'lar ardından sorunsuz uygulandı. |
| K3 | Geçti | `qa/e2e.py` (backend senaryosu, portları 5102/5176'ya uyarlandı): **59 geçti, 0 kaldı**. API logunda senaryo boyunca 500 yok. |
| K4 | Geçti | Ayrıntılar aşağıda (API ve arayüz). |
| K5 | Geçti | `qa/shots.mjs`, 16 ekran × 390 ve 360 px, sayfa ve öğe taşması ölçüldü: **hepsinde "taşma yok"**. Tarayıcı konsolunda JS hatası yok (`errors: []`). Ekran görüntüleri: `qa/shots390/`, `qa/shots360/`. Ek senaryolar (`t_child.mjs`, `t_parent.mjs`, `t_auth.mjs`, `t_menu.mjs`): hafta tablosunun kaydırma kutusu dahil taşma yok, konsol hatası yok. |
| K6 | Geçti | Kurulum: `VITE_BASE_PATH=/PlanToBee/app/` ile derlendi (`qa/dist_gh`). `pages.yml`'deki `_site` yapısı ve "Derin linkler için 404.html" `sed` adımı birebir uygulandı (`qa/_site`). `grep` kontrolü geçti. API, `App__FrontendBaseUrl=http://localhost:8766/PlanToBee/app` ile çalıştırıldı; böylece e-postadaki linkler de alt yollu üretildi. Sonuçlar (`t_gh.mjs`): e-postadaki `/PlanToBee/app/invite?token=…` linki davet önizlemesini açtı, katılma tamamlandı ve plan açıldı. `/verify-email?…` → "E-posta adresin doğrulandı". `/reset-password?…` → "Yeni şifre belirle". `/invite-code` doğru sayfayı açtı. Bilinmeyen uygulama yolu → `/PlanToBee/app/login`. Uygulama dışı `/PlanToBee/baska` → `/PlanToBee/` (eski sürüm). Giriş ve sayfa yenileme çalıştı, logo alt yoldan yüklendi. Ekran görüntüleri: `qa/shots_gh/`. |
| K7 | Geçti | `git status` ile karşılaştırıldı: backend'in değiştirdiği ve eklediği dosyaların tamamı "Backend Çıktısı"ndaki listede, her birinin gerekçesi yazılı. Frontend'deki 17 değişen ve 3 yeni dosyanın hepsi "Frontend Çıktısı"nda anlatılmış. Frontend'de ayrı bir dosya listesi yok, değişiklikler konu başlıklarına göre yazılmış. |
| K8 | Geçti | Kontrol edilen ürün kararları hiçbir yerde değişmemiş: yetki kuralları (ebeveyn her kaydı, çocuk yalnızca kendi kaydını düzenler), ortak plan, ad menüsünün içeriği (Ailem, Çıkış yap), Gün ve Hafta Planı sekmeleri, açık bej tema. Eklenen davranışlar mevcut kararlarla çelişmiyor: yalnızca `yyyy-MM-dd` tarih, rota tarihi uyuşmazsa 404, dakikada 300 istek sınırı, kilit simgesi, "‹ Plana dön". |

### K4 ayrıntıları
- **API (`qa/probes.py`):**
  - Çocuk, ebeveynin ders kaydında `PUT`, `PATCH /status` ve `DELETE` denedi: üçü de **403 `plan_read_only`**. Ebeveynin etkinliğinde `PUT` ve antrenmanında `DELETE` de aynı şekilde 403 aldı.
  - Başka ailenin kullanıcısı aynı kayıtlarda `PUT`, `PATCH` ve `DELETE` denedi (ders, etkinlik, antrenman): hepsi **404 `not_found`**.
  - Olmayan id: 404.
  - `PUT` ile yanlış rota tarihi: 404. Geçersiz rota tarihi: 400 `invalid_date`.
- **Arayüz, çocuk (Ela), 360 px (`t_child.mjs`):**
  - Hafta ayrıntısında 19 kayıt var: 7'si `canEdit`, 12'si salt okunur.
  - Hafta tablosunda 19 çip var. 7'sinde × var, 12'sinde kilit var. Yalnızca 6 kendi ders kaydı durum değiştirmek için tıklanabiliyor.
  - Liste görünümünde de aynı dağılım var (7 ×, 12 kilit).
  - Gün ekranında 8 kaydın 2'sinde düzenle/sil düğmeleri, 6'sında kilit var. Bu, API'deki 2 `canEdit` / 6 salt okunur ile birebir örtüşüyor.
  - Kilidin `aria-label` ve `title` metni: "Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir."
  - Salt okunur çipe dokununca istek gitmiyor.
  - Salt okunur kayıttaki durum rozeti `span`, düğme değil.
  - Ekran görüntüsü: `qa/shots390/s390-child-day.png`, `qa/shots360/s360-child-week-table.png`.
- **Arayüz, ebeveyn (Aslı) (`t_parent.mjs`):**
  - 8 kaydın 8'inde düzenle düğmesi var, kilit yok.
  - Ela'nın kaydını düzenledi (`PUT` 200) ve durumunu değiştirdi (`PATCH` 200).
  - Ders listesinde 10 dersin 10'u silinebilir. Çocuk görünümünde 0'ı silinebilir.

### Özellikle istenen kontroller
- **`GET /api/days/week/{monday}/details`:**
  - Çalışan durumlar: 7 gün sıralı dönüyor. Pazartesi olmayan başlangıç tarihi de (`2026-09-30`) çalışıyor. `2999-12-31` → 200 (3000-01-06'ya kadar), `1900-01-01` → 200.
  - Hata durumları: `1899-12-31`, `2026-02-30` ve başında boşluk olan tarih → 400 `invalid_date`. Ailesi olmayan kullanıcı → 403 `family_required`. E-postası doğrulanmamış kullanıcı → 403 `email_not_verified`.
  - Arayüz, hafta açılışında ve önceki/sonraki haftaya geçişte yalnızca tek bir `GET /days/week/{pzt}/details` isteği atıyor (`t_child.mjs`).
  - Hafta ekranındaki işlemler, çocuk olarak denendi:
    - Tabloda ekleme: `POST /days/2026-10-03/entries` 200.
    - Durum değiştirme: `PATCH .../18/status` 200, çip `status-inprogress` oldu.
    - Silme: `DELETE` 204, çip kalktı.
    - Liste görünümünde etkinlik ekleme: 200.
    - "Güne git" doğru güne (Perşembe 1) gidiyor.
- **Tarih biçimi (`yyyy-MM-dd`):** Frontend'deki bütün plan istekleri tarihi `dkey()` ile üretiyor (`utils/format.js:7`, `WeekTrail.jsx:13`): gün, hafta özeti, hafta ayrıntısı, ekleme, düzenleme, silme. Ağ kayıtlarında bütün tarihler `yyyy-MM-dd` biçiminde, 400 alan istek yok. **Bozulan yer yok.**
- **Ad menüsü ve "‹ Plana dön" (`t_menu.mjs`):**
  - Enter menüyü açıyor ve odak "Ailem"e geçiyor. ↓/↑ seçenekler arasında dönüyor. Esc menüyü kapatıp odağı ad düğmesine geri veriyor.
  - Menü dışına tıklayınca kapanıyor.
  - "Ailem" → Ailem başlığı ve "‹ Plana dön" görünüyor → Gün ekranına dönülüyor.
  - "Çıkış yap" → `/login`, token siliniyor.
  - Bulunan küçük sorunlar: H1, H2.
- **Davetle katılma, e-posta doğrulama, şifre sıfırlama (`t_auth.mjs`, 390 px):** Aşağıdakilerin hepsi geçti.
  - Arayüzden kayıt → doğrulama bekleniyor ekranı → e-postadaki link → "E-posta adresin doğrulandı" → aile kurma → plan.
  - Şifremi unuttum → link → yeni şifre → otomatik giriş.
    - Eski şifre 401, yeni şifre 200.
    - Eski oturum token'ı `/auth/me` isteğinde 401 alıyor, yani şifre değişince oturum düşüyor.
    - Aynı link ikinci kez açılınca "geçersiz, kullanılmış…" mesajı çıkıyor.
  - Davet linkiyle yeni hesap açma:
    - Katılma sonrası çocuk görünümünde 8 kilit görünüyor.
    - Aynı link tekrar açılınca "Bu davet zaten kullanılmış" deniyor.
  - Yedek kod (`/invite-code`) ile ebeveyn olarak katılma çalıştı.
  - Mevcut, tek kişilik ailesi olan hesabın davetle katılması ("Daveti kabul et") çalıştı. Eski planındaki kayıt (Kimya 33 dk) yeni ailenin planında, `canEdit=true` ve `createdBy=Selin` olarak görünüyor.
  - Konsolda yalnızca beklenen ağ kayıtları var: kullanılmış link için 400 ve 410. JS hatası yok.
- **360 ve 390 px, konsol:** K5'teki sonuçlarla aynı. Düzenleme formunda ve ders listesi panelinde de taşma yok.
- **Eşzamanlı ders listesi:**
  - Arayüzden yeni aile kuruldu. Açılışta StrictMode yüzünden 2 eşzamanlı `GET /subjects` gitti. Sonuçta 10 ders var, tekrar yok.
  - API'de 8 eşzamanlı ilk yazma aynı yeni güne yapıldı: 8×200 ve 8 kayıt, 500 yok.
  - Yeni ailede eşzamanlı `GET /subjects` ve `POST "Robotik"`: 409'lar döndü ve "Robotik" yalnızca bir kez eklendi. Ancak `POST` ilk `GET`'ten önce işlendiği için varsayılan 10 ders hiç eklenmedi.
    - Bu, "liste boşsa varsayılanlar eklenir" kuralının beklenen sonucu, hata değil.
    - Arayüzde gerçekleşmesi pek mümkün değil, çünkü plan açılır açılmaz `GET` gidiyor.
- **Genel hata işleyici:** Backend bu yolu tetikleyememişti. `plantobee_qa`'da `Subjects` tablosunun adı geçici olarak değiştirildi, ardından geri alındı.
  - `GET /subjects` → **500**, gövde `{"code":"server_error","message":"Beklenmeyen bir hata oluştu. Biraz sonra tekrar dene."}`. Yığın izi yok, `Cache-Control: no-store` var.
  - İzinli origin için `Access-Control-Allow-Origin: http://localhost:5176` korunuyor. İzinsiz origin başlığı almıyor.
- **Sunucu kapalıyken** (5102 durduruldu, `t_down.mjs`):
  - Giriş ekranı: "Sunucuya ulaşılamadı. Sunucu uykudan uyanıyor olabilir (30-60 sn)…" doğru çıkıyor.
  - Kayıtlı oturumla açılış: H3.

### Bulunan hatalar

**H1. Menü klavyeyle Tab'la terk edilince açık kalıyor.** Önem: düşük. Düzeltilecek taraf: **frontend**. Yer: `frontend/src/components/UserMenu.jsx:10-28`.
- İlgili gereksinim: Frontend "Erişilebilirlik: klavye odağı".
- Tekrar üretme:
  1. Girişli olarak ad düğmesine Tab ile gel ve Enter'a bas. Menü açılır.
  2. Tab'a üç kez bas.
  3. Odak "Hafta Planı" sekmesine geçer ama menü açık kalır ve içeriğin üstünü örtmeye devam eder.
- Beklenen: Odak menüden çıkınca menü kapanmalı (ör. listenin `focusout` olayında). Ya da Tab da Esc gibi menüyü kapatmalı.

**H2. Menüden "Ailem" seçilince odak kayboluyor.** Önem: düşük. Düzeltilecek taraf: **frontend**. Yer: `UserMenu.jsx:30-33` (`choose`), `PlanShell.jsx:117-122`.
- İlgili gereksinim: Frontend "Erişilebilirlik: klavye odağı".
- Tekrar üretme:
  1. Ad düğmesinde Enter'a bas, "Ailem" odaktayken tekrar Enter'a bas.
  2. `document.activeElement` `BODY` olur.
  3. Klavye ya da ekran okuyucu kullanıcısı sayfanın başına düşer ve yeni açılan "Ailem" başlığından haberi olmaz.
- Beklenen: Seçimden sonra odak ad düğmesine dönmeli ya da Ailem açılınca "‹ Plana dön" düğmesine veya `h2`'ye (`tabIndex=-1`) taşınmalı.

**H3. Kayıtlı oturumla açılışta sunucuya ulaşılamazsa uyanma açıklaması görünmüyor.** Önem: düşük. Düzeltilecek taraf: **frontend**. Yer: `frontend/src/context/AuthContext.jsx:66`.
- İlgili gereksinim: Frontend "Durumlar" ("Sunucuya ulaşılamadı" durumunun Render uyanırken anlaşılır olması).
- Frontend Çıktısı'nda "Yanıt yoksa mesaj Render uykusunu da anıyor" deniyor, ama bu yol kapsanmamış.
- Sorun: `refreshMe` `errorText` kullanmıyor, sabit bir metin yazıyor. Bu yüzden aynı durum için iki farklı mesaj var. Bu ekranı en çok, uygulamayı yeniden açan girişli kullanıcı görür. 5xx cevaplarında (ör. 502/503) da aynı yanıltıcı "Sunucuya ulaşılamadı" metni çıkıyor.
- Tekrar üretme:
  1. Geçerli bir token ile API'yi kapat.
  2. Uygulamayı aç.
  3. Ekranda "Hesap bilgileri: Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene." yazıyor, uyanma açıklaması yok.
  4. Aynı durumda giriş formu ise "Sunucu uykudan uyanıyor olabilir (30-60 sn)…" diyor.
- Beklenen: `setMeError(errorText(err))` kullanılmalı. İstek askıda kaldığı sürece `Loading` bileşeninin 5 saniyeden sonra gösterdiği açıklama zaten çalışıyor.

### Gözlemler (hata değil, bilgi)
- **Salt okunur ders adı:** Çocuğun "Dersleri düzenle" panelinde silemediği derslerde × yok, ama kayıtlardaki gibi kilit ya da açıklama da yok. Neden silinemediği anlaşılmıyor. Tutarlılık için kilit eklenebilir. Bu, frontend'in tasarım kararı.
- **Salt okunur durum rozeti:** Çocuk görünümünde, düzenlenemeyen kaydın durum rozeti (`span`) düğme olan rozetle aynı görünüyor. Kilit simgesi yanında olduğu için sorun küçük.
- **"‹ Plana dön" hedefi:** Hafta Planı'ndan Ailem'e geçildiğinde "‹ Plana dön" her zaman Gün sekmesine döndürüyor, önceki sekmeye değil. İstenirse son sekme hatırlanabilir.
- **404.html ve konsol:** GitHub Pages'te her derin link 404 durum koduyla sunuluyor (404.html yöntemi). Tarayıcı konsoluna "Failed to load resource: 404" ağ kaydı düşüyor; uygulama doğru açılıyor. Yöntemin doğal sonucu, JS hatası değil.
- **Doğrulama hatası gövdesi:** Model doğrulama hataları (ör. `minutes: 0`) hâlâ ASP.NET `ProblemDetails` biçiminde, `{code,message}` değil. Frontend'in `errorText`'i bu biçimi okuyup Türkçe mesajı gösteriyor, kullanıcıya etkisi yok. İleride tek biçime indirilebilir. Önem: düşük, backend.
- **Git durumu:** Çalışma alanında görevle ilgisiz, izlenmeyen bir `.claude/settings.json` var. Commit'e dahil edilip edilmeyeceğine ana oturum karar vermeli.

### Genel öneriler
1. H1 ve H2 aynı dosyada, H3 tek satırlık bir değişiklik. Üçü birlikte hızlıca düzeltilebilir. Sonra `t_menu.mjs` ve `t_down.mjs` yeniden çalıştırılarak doğrulanabilir.
2. Backend'in yeni eşzamanlılık kontrolleri ve hafta ayrıntısı kontrolleri `e2e.py`'de. Bu betik repoya (ör. `backend/tests/e2e.py`) alınırsa sonraki görevlerde tekrar kullanılabilir.
3. Canlıda ilk açılış (Render uyanması) gerçek ortamda bir kez elle denenmeli. 30-60 sn süren bekleyişte `Loading` açıklamasının göründüğü doğrulanmalı.
4. Backend'in listelediği ürün kararı gerektiren maddeler hâlâ açık: hesap varlığının belli olması, UTC saat, Data Protection şifrelemesi, JWT ömrü. Canlıya çıkıştan önce kullanıcıya sorulmalı.

## QA düzeltmeleri (ana oturum)

- **H1:** `UserMenu.jsx`: Odak menünün dışına çıkınca (`onBlur`, `relatedTarget` menü dışında) menü kapanıyor. Tarayıcıda denendi: menü açık, Tab ile "Çıkış yap"tan sonra "Gün" sekmesine geçildiğinde menü kapalı.
- **H2:** `PlanShell.jsx`: Ailem açılınca odak "Ailem" başlığına (`tabIndex=-1`) taşınıyor. Başlıkta odak çizgisi gösterilmiyor. Tarayıcıda denendi: odak `H2 Ailem`.
- **H3:** `AuthContext.jsx`: Açılıştaki `/auth/me` hatası sabit metin yerine `errorText(err)` ile gösteriliyor. Böylece "sunucu uykudan uyanıyor olabilir" ve 502/503/504 açıklamaları burada da çıkıyor.
- **Kontroller:** `npm run lint` 0 hata, 8 eski uyarı. `VITE_BASE_PATH=/PlanToBee/app/` derlemesi başarılı. Tarayıcı konsolunda hata yok.

