# PlanToBee UX/UI Değerlendirmesi

30 Ekim 2026 · Kapsam: React ön yüzü, telefon genişliği 390 ve 360 px ·
Hazırlayan: Claude (ana oturum: akış, yerleşim ve görsel inceleme) + frontend-developer (kod incelemesi) + qa (tarayıcıda
ölçüm). Dosya yolları aksi yazılmadıkça `frontend/src` köklüdür. Yöntem ve sınırlar en sonda.

## Özet

- **Temel sağlam.** Görsel kimlik tutarlı, erişilebilirlik altyapısı özenli. Hiçbir ekranda yatay taşma, metin kontrastı
  ihlali ya da konsol hatası yok. Sorunlar daha çok **ilk ekran**, **bekleme** ve **verinin güncelliği** tarafında.
- **İki P1 var:**
  - **Veri kendiliğinden tazelenmiyor (UX-1).** Bildirime dokununca, uygulamaya geri dönünce ya da ertesi sabah eski plan
    görünüyor.
  - **"Yükleniyor" katmanı ekranı kilitliyor (UX-2).** Sunucu uyurken ilk açılışta 30–60 sn sürüyor; hafta değişiminde
    dokunuşları yutuyor. `render.yaml` hâlâ `plan: free`.
- **Ana ekran ağır.** İlk ekranın yalnızca alt %30'u günün içeriği (UX-3). Okul bloğu okul sonrasını ekran dışına itiyor
  (UX-4).
- **iPhone'a özgü iki hızlı kazanım:**
  - PIN alanı 14 px kaldığı için her PIN girişinde sayfa yakınlaşıyor (UI-1).
  - Safari'de "Ana Ekrana Ekle" yönlendirmesi yok, bu yüzden bildirimler hiç keşfedilmiyor (UX-5).
- **Erişilebilirlik ölçümü.** Metin kontrastı temiz. Sorunlu olanlar:
  - Alan çerçeveleri (1,4–1,7:1) ve seçili durumlar (1,6–1,8:1) 3:1'in altında (UI-3).
  - 360 px'te birçok dokunma hedefi 44 px'ten küçük (UI-2).
- **Sıra:**
  1. Görev 12 (yapıldı, 30 Ekim): Önizlemesi onaylanan ana ekran ve form değişiklikleri.
  2. Görev 13: P1'ler ve görsel karar gerektirmeyen düzeltmeler.
  3. Görev 14: Mağaza hazırlığı.

## Korunması gerekenler

- **Kimlik:** Bal sarısı, mürekkep ve bej; Bricolage + Figtree; petek motifi. Dış bağımlılık yok.
- **Ölçümde temiz çıkanlar (qa):**
  - 360 ve 390 px'te, uzun metinle bile yatay taşma yok.
  - Metin kontrastı ihlali yok; en düşük oran 5,17:1.
  - Adı olmayan düğme ya da alan yok; konsolda hata veya uyarı yok.
- **Klavye ve ekran okuyucu:**
  - Tab sırası mantıklı; `:focus-visible` her yerde görünür (siyah zeminde sarı, 9,5:1).
  - Alt sayfalarda odak tuzağı var, Esc çalışıyor, odak açan öğeye dönüyor; sekmeler ok tuşlarıyla geziliyor.
  - `aria-label`'lar zengin: "Cuma 30 Ekim, bugün: 4 dersten 1'i tamam; …".
- **iPhone tuzakları bilinçli çözülmüş:** 16 px alanlar (PIN hariç, bkz. UI-1), bildirim izninin dokunuşun içinde
  istenmesi, Safari'nin odak/blur farkları.
- **İyimser güncelleme + "Geri al":** Yarış ve çift gönderim korumaları var; onay penceresi yalnızca kalıcı işlerde.
- **Türkçe dil özeni:** Ek uyumu doğru ("1'i", "2027'ye"); tekrar menüsünde sonucu anlatan alt satırlar var. Hata
  metinleri tek kaynaktan geliyor ve her hatada "Tekrar dene" var.
- **Çalışan akışlar:** Ders ekleme, durum döngüsü, tekrarlı aktivite, "yalnızca bu gün" düzenleme, çocuk profilinde salt
  okunur kayıtlar.

## Öncelik listesi

P1: önce yap (güveni ya da her kullanıcıyı her gün etkiliyor) · P2: yakında (belirgin sürtünme, WCAG AA ihlali) ·
P3: fırsat buldukça. Efor: S küçük (birkaç kural/tek bileşen) · M orta (birkaç bileşen + test) · L büyük (akış değişikliği).

| # | Konu | Öncelik | Efor | Kaynak |
|---|---|---|---|---|
| UX-1 | Veri kendiliğinden tazelenmiyor | P1 | S | kod |
| UX-2 | "Yükleniyor" katmanı ekranı kilitliyor | P1 | M | gözlem, kod, ölçüm |
| UI-1 | PIN alanı 14 px: iPhone'da yakınlaştırma | P2 | S | ölçüm |
| UX-3 | Ana ekranda içerik geç başlıyor | P2 | M | gözlem, ölçüm |
| UX-4 | Uzun kayıtlar (Okul) Bee'yi kaplıyor | P2 | M | gözlem |
| UX-5 | iPhone'da "Ana Ekrana Ekle" yönlendirmesi yok | P2 | S | gözlem, kod |
| UX-6 | Hata ve klavye durumlarında veri kaybı | P2 | S | kod |
| UX-7 | "Geri al" kısa ve alt sayfa açıkken çalışmıyor | P2 | S | kod, ölçüm |
| UX-8 | Beklerken düğmeler geri bildirim vermiyor | P2 | S | kod, ölçüm |
| UI-2 | 44 px altı dokunma hedefleri | P2 | S–M | kod, ölçüm |
| UI-3 | Alan çerçevesi ve seçili durum kontrastı | P2 | S | ölçüm |
| UI-4 | "Şu an" çizgisi metni üstü çizili gösteriyor | P2 | S | gözlem |
| UI-5 | Çakışan kayıtlar kırpılıyor | P2 | M | gözlem, ölçüm |
| UX-9 | Üç farklı ekleme deseni | P3 | M–L | gözlem · karar |
| UX-10 | Plan'daki tür ikonları filtre gibi görünüyor | P3 | S | gözlem |
| UX-11 | Bildirim izni kartı erken ve ağır | P3 | S–M | gözlem |
| UX-12 | Dersi tamamlamak iki dokunuş | P3 | S | gözlem · karar |
| UX-13 | Boşluktan eklerken süre boş geliyor | P3 | S | gözlem |
| UX-14 | Sekme adları marka öncelikli | P3 | S | gözlem · karar |
| UX-15 | Geri tuşu, derin bağlantı, kaydırma | P3 (Capacitor öncesi P2) | M | kod |
| UX-16 | Metin ve dil tutarlılığı | P3 | S | gözlem, kod, ölçüm |
| UX-17 | Küçük sürtünmeler | P3 | S | gözlem, ölçüm |
| UI-6 | Mono yazı tipi kelimelere taşmış | P3 | S | gözlem |
| UI-7 | Bal sarısı çok yerde birincil | P3 | S | gözlem |
| UI-8 | Seçili durum renkleri tutarsız | P3 | S | gözlem · karar |
| UI-9 | Küçük yazı boyutları | P3 | M | gözlem, ölçüm · karar |
| UI-10 | İkon ve etiket tutarlılığı | P3 | S | gözlem, ölçüm |
| UI-11 | Formlarda görünür etiket yok | P3 | S | gözlem |
| UI-12 | Dokunmatik geri bildirim eksik | P3 | S | kod |
| UI-13 | Hesap ekranları ve Hafta paneli | P3 | S | gözlem, ölçüm |
| T | Teknik borç (CSS, performans, service worker, Capacitor) | P3 | M | kod |

## UX bulguları

### UX-1 · Veri kendiliğinden tazelenmiyor · P1 · S
- **Sorun:**
  - Uygulama açıkken bildirime dokununca aynı gün seçiliyse gün de hafta da yeniden çekilmiyor (`pages/PlanShell.jsx:100-110`,
    `pages/DayPage.jsx:66-72`).
  - Uygulamaya geri dönünce tazeleme yok; tek `visibilitychange` dinleyicisi yalnızca bekleyen silmeyi gönderiyor
    (`api/deferred.js:47`).
  - Seçili gün açılışta sabitleniyor; arka planda açık kalan uygulama ertesi sabah dünü gösteriyor.
- **Etkisi:** "Ela ders ekledi" bildirimine dokunan ebeveyn yeni kaydı görmüyor; diğer cihazlardaki değişiklikler
  görünmüyor. Ortak plan uygulamasında güveni doğrudan zedeler.
- **Öneri:**
  - PlanShell'de bir `refreshKey` tut. Bildirim mesajında ve sayfa yeniden görünür olunca (son yüklemeden en az 30 sn
    geçtiyse) gün ve hafta yeniden çekilsin.
  - Takvim günü değiştiyse ve seçili gün eski "bugün"se bugüne geç.

### UX-2 · "Yükleniyor" katmanı ekranı kilitliyor · P1 · M
- **Sorun:**
  - Gün verisi gelene kadar, 300 ms sonra bütün ekranı karartan ve tıklanamayan bir katman açılıyor
    (`pages/DayPage.jsx:259-261`, `components/Loading.jsx`).
  - Sunucu uykudayken (`render.yaml:9` hâlâ `plan: free`) bu 30–60 sn sürüyor; metin hep aynı, axios'ta zaman aşımı yok
    (`api/client.js:21-23`).
  - Katman bildirimlerin üstünde duruyor (z-index 60 > 50); bu sürede çıkan hatalar görünmüyor.
  - qa ölçümü: 1 sn gecikmede › düğmesine art arda 3 dokunuşta ikinci dokunuş katmana gitti ve 3 yerine 2 hafta
    ilerlendi. Katman kapanınca odak sayfa gövdesine düşüyor.
- **Etkisi:** İlk açılışta kullanıcı bir dakikaya kadar hiçbir şey yapamıyor ve nedenini bilmiyor. Hafta gezinmesi her
  seferinde takılıyor.
- **Öneri:**
  1. Yüklemeyi kart alanında göster (`.sheet-loading` kalıbı); hafta alanı, sekmeler ve ad menüsü kullanılabilir kalsın.
     Hafta değişiminde eski içerik soluk dursun.
  2. 5 sn sonra "Sunucu uyanıyor, 1 dakika kadar sürebilir" yaz (`useSlow` hazır).
  3. axios'a zaman aşımı ver (ör. 75 sn); süre dolunca mevcut "Tekrar dene" kutusu çıksın.
  4. En büyük kazanç: son hafta yanıtını cihazda sakla, açılışta hemen göster, arkada tazele.
  5. 28 Ekim'deki Starter kararı `render.yaml`'a yansımamış. Panelden geçildiyse dosya da güncellenmeli; yoksa Blueprint
     eşitlemesi planı geri alabilir.

### UX-3 · Ana ekranda içerik geç başlıyor · P2 · M
- **Sorun:** Üst başlık (logo + ad), bildirim kartı (146 px), siyah hafta alanı, iki satırlı 52 px sekmeler ve gün başlığı
  üst üste. qa ölçümü: 360×780'de ilk çizelge satırı y=545'te, yani ekranın yalnızca alt %30'u içerik. 390×844'te %32;
  kart kapatılınca %42 ve %46.
- **Etkisi:** Her açılışta asıl planı görmek için kaydırmak gerekiyor.
- **Öneri:**
  - Üst başlığı hafta alanıyla birleştir: küçük logo, profil avatarı siyah alanın sağ üstünde.
  - Sekmeleri tek satıra indir (ad + ikon, ~40 px).
  - "Bugüne dön"ü aralık satırında küçük bir çipe çevir.
  - Bildirim kartını UX-11'deki gibi ertele.
  - Hedef: 360×780'de içerik ekranın ilk %35'inde başlasın.
- **Dosyalar:** `pages/PlanShell.jsx:205-227`, `pages/DayPage.jsx:231-248`, `index.css` (`header.top`, `.dayhero`, `.sect`,
  `.dayhead`, `.push-prompt`)

### UX-4 · Uzun kayıtlar (Okul 08:00–15:00) Bee ekranını kaplıyor · P2 · M
- **Sorun:** Çizelgede saat 32 px; 7 saatlik Okul bloğu ~224 px. Uzun boşluklar sıkıştırılıyor ama uzun kayıtlar
  sıkıştırılmıyor. Okul serisi her hafta içi aynı görünümü üretiyor.
- **Etkisi:** Okul günlerinde ilk ekranda okul sonrası, yani asıl planlanan kısım hiç görünmüyor.
- **Öneri:** 3 saati aşan kayıtları boşluklar gibi sıkıştır: en çok ~100 px, ortada mevcut kırılma işareti, eksen etiketleri
  korunur.
- **Dosyalar:** `utils/timeline.js:146-224` (`layoutDay`), `components/Timeline.jsx`

### UX-5 · iPhone'da "Ana Ekrana Ekle" yönlendirmesi yok · P2 · S
- **Sorun:**
  - iOS Safari sekmesinde Push API yok. `pushSupported()` false dönüyor ve "Aileden haberdar ol" kartı hiç çıkmıyor
    (`utils/push.js:17-21`, `components/PushPrompt.jsx:13`).
  - Kurulum bilgisi yalnızca ad menüsü → Bildirimler sayfasında; o menü de ailede ikinci profil yoksa görünmüyor.
- **Etkisi:** Kullanıcıların çoğu iPhone'da. Safari'den kullanan kişi bildirimlerden habersiz kalıyor; gerçek kullanıcı
  testinde ölçülecek ana değerlerden biri bu.
- **Öneri:**
  - iOS Safari'de ve `display-mode: standalone` değilken tek seferlik, kapatılabilir bir kart göster: "Bildirimler için
    PlanToBee'yi ana ekrana ekle: Paylaş → Ana Ekrana Ekle".
  - Kart kapatılınca PushPrompt'taki karar anahtarıyla bir daha gösterilmesin.
  - Capacitor sürümünde bu kart çıkmasın.

### UX-6 · Hata ve klavye durumlarında veri kaybı ya da yanlış sonuç · P2 · S
- **Klavyenin return tuşu yarım aktivite ekliyor.**
  - Sorun: Tür seçip adı yazan ve klavyeyi kapatmak için return'e basan kullanıcı, saatsiz bir aktivite ekliyor ve form
    kapanıyor (`components/EventForm.jsx:203-208`). Projede hiçbir alanda `enterKeyHint` yok.
  - Öneri: Ad ve Konu alanlarında `enterKeyHint="next"` kullan; Enter'da gönderme yerine odak Başlangıç'a geçsin.
- **Plan kartında düzenleme hata verince girilenler kayboluyor.**
  - Sorun: Form, kaydın eski değerleriyle yeniden kuruluyor (`components/EventCard.jsx:65-73, 105`). To-do bunu doğru
    yapıyor (`editForm`).
  - Öneri: Gönderilen değeri sakla, hata olunca formu onunla aç.
- **Ders listesi yüklenemeyince "Önce derslerini ekle" çıkıyor.**
  - Sorun: Hata, boş listeyle aynı görünüyor (`pages/PlanShell.jsx:149-158`, `components/StudyCard.jsx:172-183`). Kullanıcı
    derslerinin silindiğini sanıyor. Öneri düğmelerinde çift dokunma koruması da yok, mükerrer ders eklenebiliyor.
  - Öneri: Hata durumunu ayrı tut; `.load-error` ile "Tekrar dene" göster ve öneri düğmelerine busy koruması ekle.

### UX-7 · "Geri al" kısa ve alt sayfa açıkken çalışmıyor · P2 · S
- **Sorun:**
  - Silmenin tek geri dönüş yolu 5 sn'de kapanıyor; seride 6 sn. Dokununca ya da odaklanınca durmuyor (qa: 5026 ms,
    WCAG 2.2.1). Düğme 65×40 px.
  - Bildirim `#root` içinde. Alt sayfa açıkken kök `inert` olduğundan bildirim tıklanamıyor ve ekran okuyucu onu okumuyor.
    Alt sayfadaki kayıt hataları da yalnızca bu bildirimle gösteriliyor.
- **Öneri:**
  - Bildirimi `createPortal` ile `document.body`'ye taşı.
  - Süreyi 8–10 sn yap; dokunuşta ve odakta duraklat.
  - "Geri al" düğmesini 44 px yap; kalıcı bir canlı bölgeye yaz.
  - Alt sayfadaki hatayı sayfanın içinde `inline-error` olarak da göster.
- **Dosyalar:** `hooks/useMutation.js:6`, `context/NoticeContext.jsx:17, 31-41`, `components/Sheet.jsx:22`,
  `index.css:236`

### UX-8 · Beklerken düğmeler geri bildirim vermiyor · P2 · S
- **Sorun:**
  - Uygulama içindeki Ekle/Kaydet düğmeleri istek sürerken yalnızca soluklaşıyor. qa: 3 sn gecikmede düğme metni "Ekle"
    kalıyor, liste "Bu gün için ders yok." diyor. Giriş ve PIN ekranlarında ise "Giriş yapılıyor…" ve "Açılıyor…"
    gösteriliyor.
  - Bee'deki aktivite düzenleme formuna `busy` hiç geçirilmiyor.
  - "Tekrar dene" düğmeleri istek sürerken değişmiyor.
- **Öneri:** Giriş ekranlarındaki `BusyLabel` kalıbını bu düğmelere uygula.
- **Dosyalar:** `components/StudyForm.jsx:120`, `components/EventForm.jsx:261`, `components/AgendaSheet.jsx:76`,
  `pages/FamilyPage.jsx:55, 209, 247, 277`, `App.jsx:33`, `pages/PlanShell.jsx:232`, `components/WeekSheet.jsx:30`

### UX-9 · Aynı iş için üç farklı ekleme deseni · P3 · M–L · karar gerektirir
- **Sorun:** To-do'da kart içi form; Plan'da tür ikon sırası ve kart içi form; Bee'de alt sayfa (Ders/Aktivite seçimiyle).
- **Etkisi:** Kullanıcı eklemeyi her bölümde yeniden öğreniyor; üç kod yolu bakım maliyeti getiriyor.
- **Öneri:**
  - Bee'deki alt sayfayı (`AgendaSheet`) tek ekleme yüzeyi yap: To-do'da Ders, Plan'da Aktivite seçili açılsın.
  - To-do'nun "gün değişince form açık kalsın" davranışı alt sayfada "Ekle ve yenisini gir" ile korunsun.

### UX-10 · Plan'daki tür ikonları filtre gibi görünüyor · P3 · S
- **Sorun:** Kartın üstündeki 7 ikon aslında ekleme düğmesi; üzerlerinde "ekle" ifadesi ya da + işareti yok. Liste
  üstündeki ikon sırası "türe göre süz" diye okunuyor.
- **Öneri:** Satırın üstüne "Aktivite ekle" etiketi koy (mevcut `.sub-lb` stili). Ya da tek bir "+ Aktivite ekle" düğmesi
  kullan ve tür seçimini formun içine al.
- **Dosyalar:** `components/EventCard.jsx:98`, `components/EventForm.jsx:192-200`

### UX-11 · Bildirim izni kartı erken ve ağır · P3 · S–M
- **Sorun:** Kart profil seçilir seçilmez, en üstte, siyah ve 146 px çıkıyor; altındaki siyah hafta alanıyla iki ağır blok
  oluşturuyor. "Şimdi değil"den sonra bir daha gelmiyor.
- **Öneri:**
  - Kartı ilk anlamlı andan sonra göster: kullanıcı ilk kaydını eklediğinde ya da ailede başkası kayıt eklediğinde.
  - Açık yüzeyli bir kart ya da ince bant yap.
  - "Şimdi değil"den sonra bir kez daha sor (ör. 7 gün sonra).
- **Dosyalar:** `pages/PlanShell.jsx:227`, `components/PushPrompt.jsx`, `index.css:351`

### UX-12 · Dersi "Tamamlandı" yapmak iki dokunuş · P3 · S · karar gerektirir
- **Sorun:** Daire Yapılacak → Devam Ediyor → Tamamlandı → Yapılacak döngüsünde. En sık iş iki dokunuş; üçüncü dokunuş durumu
  sıfırlıyor. `touch-action: manipulation` yok; iOS'ta hızlı çift dokunuş yakınlaştırmaya dönüşebilir (doğrulanmadı).
- **Öneri:**
  - Tek dokunuş Yapılacak/Devam ↔ Tamamlandı arasında geçsin; "Devam ediyor" uzun basmayla ya da ⋯ menüsünden seçilsin.
  - Durum adları ve renkleri aynen kalır.
- **Dosyalar:** `utils/format.js:116-120`, `components/StudyCard.jsx:156`, `components/Timeline.jsx:54`

### UX-13 · Boşluktan ders eklerken süre boş, aralık üç kez yazılıyor · P3 · S
- **Sorun:** Boşluktan açılan sayfada başlangıç dolu, süre boş. "07:00–08:00" başlıkta, "Boşluk" kutusunda ve özet
  satırında tekrar ediyor.
- **Öneri:** Süreyi boşluğa göre doldur: boşluk 60 dk'dan kısaysa boşluk kadar, değilse 60 dk. "Boşluk: …" kutusunu kaldır.
- **Dosya:** `components/AgendaSheet.jsx:20, 86-88`

### UX-14 · Sekme adları marka öncelikli (Plan · To-do · Bee) · P3 · S · karar gerektirir
- **Sorun:** Ana gezinmede "Plan" Aktiviteler, "To-do" (İngilizce) Dersler, "Bee" Ajanda demek; anlam küçük alt satırda.
  "Plan" ile "Ajanda" anlamca örtüşüyor.
- **Öneri:** Değiştirmeden önce test kullanıcılarına sor: "Aktiviteyi nereye eklersin?". Zorlanırlarsa anlamı öne al
  (Ajanda · Dersler · Aktiviteler), marka logoda kalsın.
- **Dosya:** `components/SectionTabs.jsx:7-11`

### UX-15 · Geri tuşu, derin bağlantı ve kaydırma · P3 (Capacitor öncesi P2) · M
- **Android geri tuşu:** Ailem, Bildirimler, Hesabı sil ve bütün alt sayfalar yalnızca React durumunda; geçmiş kaydı yok.
  Android'de (ileride Capacitor'da) form açıkken geri tuşu uygulamayı kapatıyor ve girilenler gidiyor.
  - Görünümleri rotaya taşı: `/family`, `/notifications`.
  - Alt sayfa açılınca `pushState`, `popstate` gelince kapat.
  - Dosyalar: `pages/PlanShell.jsx:55, 191-200`, `components/Sheet.jsx`, `App.jsx:48`
- **Yenileme ve derin bağlantı:**
  - Sayfa yenilenince Ailem'den Plan'a dönülüyor.
  - Oturum yokken `/?date=…` bağlantısının tarihi girişte kayboluyor (`App.jsx:25`).
- **Kaydırma:** Gün/hafta değiştirmek için yatay kaydırma yok; telefonda beklenen bir hareket.

### UX-16 · Metin ve dil tutarlılığı · P3 · S
- **Başlık ve boş durum metinleri:**
  - "3 bugün" (Plan kartı başlığı) anlaşılmıyor; hemen altında bir de "BUGÜN" etiketi var. "Bugün 3 aktivite" ya da
    "3 aktivite" olmalı. `components/EventCard.jsx:91, 100`
  - Boş durumlar iki kez yazılıyor: "Ders yok" + "Bu gün için ders yok.", "Aktivite yok" + "Bu gün için aktivite yok.",
    Bee'de iki kez "tüm gün boş". `components/StudyCard.jsx:142, 147`, `components/EventCard.jsx:91, 101`,
    `components/AgendaCard.jsx:58`, `components/Timeline.jsx:113`
- **Süre ve tarih biçimi:**
  - Süre karışık yazılıyor: "160 dk" (To-do), "640 dk ders" (Hafta), "4 sa 20 dk" (Bee). Her yerde `formatDuration`
    kullanılmalı. `components/StudyCard.jsx:142`, `components/WeekSheet.jsx:111`
  - Aynı gün üç biçimde yazılıyor: "Cumartesi, 10 Ekim", "Cumartesi 10 Ekim", "20 Ekim Salı". Tek bir `dayLabel()` olmalı.
    `utils/format.js:40-43`, `pages/DayPage.jsx:225`, `utils/recurrence.js:59`
- **Hitap ve fiiller:**
  - "Yükleniyor, lütfen bekleyiniz…" "siz" hitabı; uygulama "sen" diliyle konuşuyor. "Yükleniyor, biraz bekle…" olmalı.
    `components/Loading.jsx:9`, `components/WeekSheet.jsx:37`
  - Vazgeçme fiili üç türlü: formlarda "İptal", menü ve diyaloglarda "Vazgeç", alt sayfalarda "Kapat". Tek fiil seç
    (öneri: "Vazgeç"; alt sayfa başlığında "Kapat" kalabilir).
- **Hata metinleri:**
  - Bazı hatalarda ham tarayıcı mesajı gösteriliyor. `components/PushPrompt.jsx:37`, `components/NotificationsCard.jsx:88`
  - Kayıt hatası hangi işlemin başarısız olduğunu söylemiyor; "Aktivite eklenemedi: …" gibi bir önek eklenmeli.
- **Tipografi ve tanıtım:**
  - Düz tırnak ("Profil değiştir") ile Türkçe tırnak (“Saati yok”) karışık; “ ” kullanılmalı.
    `pages/ProfilePickerPage.jsx:109`, `pages/CreateFamilyPage.jsx:70, 90`, `components/NotificationsCard.jsx:12`
  - Giriş alt başlığı "Haftalık plan ve takip platformu" genel kalıyor; değer önerisi söylemiyor (ör. "Ailenin haftası tek
    ekranda").

### UX-17 · Küçük sürtünmeler · P3 · S
- **Çocuk profili:** Düzenlenemeyen kayıtlarda da "⋯" görünüyor, menü yalnızca "değiştiremezsin" diyor. İşaret gizlensin ya
  da dokununca yalnızca ayrıntı açılsın.
- **Açıklanmayan işaretler:**
  - "E", "D" rozetlerinin (kaydı kim ekledi) anlamı ekranda yok; ilk görülüşte tek seferlik bir ipucu gösterilmeli.
  - Şeritteki sarı tatil noktası Hafta paneli lejantında yok; "● Tatil / özel gün" eklenmeli. `components/WeekSheet.jsx:100-108`
- **Bildirimler sayfası:** "Bu cihazda bildirimler: Kapalı" iken alttaki ayarlar etkin görünüyor. Kapalıyken "Bu cihaza
  bildirim gelmesi için aç" satırı göster; alt ayarları "Profil ayarları" başlığıyla ayır.
- **Tekrar formu:** Bitiş tarihi boş geliyor ve zorunlu olduğu yazmıyor. Hata çıkınca odak alana gitmiyor.
  `components/EventForm.jsx:40, 171-172`
- **Odak kaybı:** "Şimdi değil"den sonra ve Plan'da Enter ile ekledikten sonra odak sayfa gövdesine düşüyor.
  `components/PushPrompt.jsx:41-44`, `components/EventCard.jsx:55-62`
- **Silme ve çıkış:**
  - Ders listesinden ders silmede ne onay ne "Geri al" var. `components/StudyCard.jsx:201`
  - "Çıkış yap" tek dokunuşla çalışıyor; çocuğun cihazında tekrar giriş aile şifresini istiyor. `components/UserMenu.jsx:47`

## UI bulguları

### UI-1 · PIN alanı 14 px: iPhone'da odaklanınca sayfa yakınlaşıyor · P2 · S
- **Sorun:**
  - `.auth-card input` (`index.css:186`) ve `.stack-form input` (`index.css:252`) kuralları özgüllükte `.pin-input`'u
    eziyor (`index.css:295`, 24 px).
  - iOS'taki 16 px kuralı PIN alanını bilerek dışarıda bırakıyor (`index.css:391-393`).
  - qa, PIN ekranında, Aile oluştur'da ve Ailem → Profil ekle'de 14 px ölçtü.
- **Etkisi:** iPhone'da her PIN girişinde sayfa yakınlaşıyor; tasarlanan iri PIN görünümü de hiç uygulanmıyor.
- **Öneri:** Seçiciyi güçlendir (`input.pin-input` ya da `.auth-card .pin-input, .stack-form .pin-input`).

### UI-2 · 44 px altı dokunma hedefleri · P2 · S–M
- **Sorun:** 360 px'te en kötü ekran Plan + form + "Her hafta tekrarla" (24 öğe; 390'da 17). Öne çıkanlar:
  - **Çizelge ve şerit:** Hafta şeridi günleri 40×98 (`index.css:81-82`); durum daireleri 40×44 ve 36×44
    (`index.css:602, 618`).
  - **Aktivite formu:** Tür düğmeleri 39×54; "Buluşma" yazısı düğmeye sığmıyor (`index.css:314-315`). Tekrar günleri 39×44
    (`index.css:681`). Süre çipleri ve Hafta içi / Her gün 42 px (`index.css:503-504, 677-678`).
  - **Taban sınıflar:** `.btn` ve `.btn-ghost` 42 px, `.btn-ghost.small` 40 px (`index.css:143, 222, 224`).
  - **Giriş ekranı:** Giriş sekmeleri 41 px, `.auth-link` 40 px, yasal bağlantılar 38 px (`index.css:183, 190, 670`).
  - **Silme bağlantıları:** Ailem'de profil "Sil" 14×44, Bildirimler'de "Kaldır" 34×44 (`pages/FamilyPage.jsx:101`,
    `components/NotificationsCard.jsx:179`).
- **Öneri:**
  - Taban sınıflarda `min-height: 44px`.
  - Şerit, çip ve daireleri görünmez `::before` katmanıyla büyüt; komşu öğeyle çakışmamalı.
  - "Sil" ve "Kaldır"a iç boşluk ver.
  - `button, a, input, select, label { touch-action: manipulation; }` ekle.

### UI-3 · Alan çerçevesi ve seçili durum kontrastı 3:1'in altında · P2 · S (görünüm değişir, önizleme)
- **Sorun (WCAG 1.4.11):**
  - Alan çerçevesi `--line-strong` #D3C6AB kartta 1,65:1, alt sayfada 1,43:1.
  - Seçili durum yalnızca bal sarısı dolguyla gösteriliyor: sekmeler, süre çipleri, Ders/Aktivite ve Hafta içi/Her gün
    1,77:1; tür düğmeleri 1,63:1. Yazı kalınlığı seçili ve seçisiz durumda aynı.
  - Kapalı anahtar alt sayfada 2,86:1.
- **Öneri:**
  - Alanlar için ayrı bir çerçeve rengi kullan: #8C826E kartta 3,7:1, zeminde 3,2:1. `:root`'a anlamlı bir adla eklenmeli.
  - Seçili durumda sarıya ek olarak `box-shadow: inset 0 0 0 1.5px var(--ink)` ya da kalın yazı kullan. Bu, UI-8'i de
    çözer.
  - Kapalı anahtarın izini koyulaştır.
- **Dosyalar:** `index.css:14, 186, 252, 309, 317, 364, 375, 505, 594, 638, 679, 683`

### UI-4 · "Şu an" çizgisi metni üstü çizili gösteriyor · P2 · S
- **Sorun:** `.tl-now` blokların üstünde (`z-index: 2`). 17:51'de çizgi "Fizik 17:00–18:00" satırını kesiyor. Aynı ekranda
  üstü çizili metin "tamamlandı" demek.
- **Öneri:** Çizgiyi blokların arkasına al ya da blok içinde yarı saydam yap; eksende ve boşluklarda koyu kalsın.
- **Dosya:** `index.css:490-491`

### UI-5 · Çakışan kayıtlar yarım genişlikte, ad ve saat kırpılıyor · P2 · M
- **Sorun:**
  - 19:00–21:00 Doğum günü partisi ile 20:30–21:00 İngilizce iki eşit şeride bölünüyor. İlk 90 dk sağ şerit boş kaldığı
    halde ad kesiliyor.
  - qa ölçümü (360 px): "Doğum gün…" 120 px metin / 87 px alan, "20:30–21:…" 76 / 74 px.
- **Öneri:** Takvim uygulamalarındaki gibi ilk kayıt tam genişlik olsun; sonradan başlayan çakışan kayıt girintili ve üstte
  dursun.
- **Dosyalar:** `utils/timeline.js` (`layoutDay` şerit hesabı), `components/Timeline.jsx:165`, `index.css:473-474`

### UI-6 · Mono yazı tipi kelimelere taşmış · P3 · S
- **Sorun:** Tasarım kararı "sayılar ve saatler JetBrains Mono" diyor. Oysa şunların tamamı mono:
  - kart başlıkları ("4 sa 20 dk boş", "1/4 · 160 dk", "3 bugün"),
  - "Hesap sahibi" rozeti,
  - rol etiketleri (Ebeveyn, Çocuk),
  - bölüm etiketleri (SAATİ YOK, BUGÜN, YALNIZCA BU GÜN).

  Açık harf aralıklı kelimeler kod gibi duruyor ve zor okunuyor; "modern, profesyonel" hedefine ters.
- **Öneri:** Bu metinleri Figtree'ye al; mono yalnızca rakam ve saat parçasında kalsın (ör. `<b className="mono">160</b> dk`).
- **Dosya:** `index.css:264, 289, 454, 597, 630, 692`

### UI-7 · Bal sarısı çok yerde birincil · P3 · S
- **Sorun:** Bee ekranında aynı anda dört sarı "+ Ekle" var. Seçili gün, seçili sekme, "bugün" rozeti ve bildirim kartı
  düğmesi de sarı; ekranın asıl eylemi seçilemiyor.
- **Öneri:** Boşluk düğmelerini ikincil yap (çerçeveli ya da yalnızca "+"). Sarıyı seçili durum ve ekrandaki tek birincil
  eylemle sınırla.
- **Dosya:** `index.css:489, 555` (`.tl-gap .pl`)

### UI-8 · Seçili durum renkleri tutarsız · P3 · S · karar gerektirir
- **Sorun:** Tasarım kuralı "seçili seçenekler sarı zemin".
  - Siyah seçili: Giriş/Kayıt sekmeleri, Ailem'deki Çocuk/Ebeveyn seçicisi.
  - Sarı seçili: Ders/Aktivite seçimi ve gün bölümleri.
  - "Profili ekle" düğmesi siyah, diğer "Ekle" düğmeleri sarı.
- **Öneri:** `.seg button.active` ve `.auth-tabs button.active` sarı olsun (UI-3'teki koyu çerçeveyle). Siyah bilinçli bir
  tercihse tasarım diline istisna olarak yaz.
- **Dosya:** `index.css:184, 257, 659`

### UI-9 · Küçük yazı boyutları · P3 · M · karar gerektirir
- **Sorun:** Gövde 14 px. Birçok ikincil metin 10–11,5 px:
  - hafta şeridinde gün adı ve sayaç 10 px,
  - tür etiketleri 10 px,
  - "Saati yok" ve "BUGÜN" 10,5 px,
  - çizelge saatleri 11,5 px,
  - Hafta ızgarası 9,5–10 px,
  - rozetler 10 px.

  Kullanıcıların önemli bir kısmı ebeveyn.
- **Öneri:** En küçük metin 12 px olsun (Hafta ızgarası etiketleri 11 px), gövde 15 px. 360 px'te sığma yeniden
  denenmeli.
- **Dosya:** `index.css:84, 87, 315, 474` ve diğerleri

### UI-10 · İkon ve etiket tutarlılığı · P3 · S
- **Takvim emojisi:** "📅 Hafta" düğmesindeki emoji iPhone'da sabit "17 Temmuz" gösteriyor; tarih uygulamasında yanıltıcı.
  Petek ikonuyla aynı çizgide satır içi bir SVG takvim kullanılmalı. `pages/DayPage.jsx:237`
- **Sekme ikonları:** Yalnızca Bee'de ikon var; ya üçüne ikon konmalı ya hiçbirine. `components/SectionTabs.jsx:47`
- **Bölüm etiketleri:** İki stil var: mono büyük harf (SAATİ YOK, BUGÜN) ve sans büyük harf (KİMİN GİRİŞLERİ?, NELER?). Tek
  stil seçilmeli. `index.css:363` ile `454, 630, 692`
- **Görünen ad ve erişilebilir ad uyumsuz (WCAG 2.5.3):**
  - Tekrar günleri "Pzt" görünüyor, erişilebilir adları "Pazartesi".
  - "Hafta" düğmesinin erişilebilir adı "Haftanın tamamını gör".
  - Sesli komutla kullanım için erişilebilir ad görünen metni içermeli. `components/EventForm.jsx:166-167`,
    `pages/DayPage.jsx:236-237`

### UI-11 · Formlarda görünür etiket yok · P3 · S
- **Sorun:** Aktivite adı, Konu, Not ve Ders adı alanlarında etiket yalnızca yer tutucu; yazmaya başlayınca alanın ne olduğu
  kayboluyor. Başlangıç ve Bitiş'te görünür etiket var.
- **Öneri:** Küçük görünür etiket ekle (mevcut `.fl` stili).
- **Dosyalar:** `components/EventForm.jsx:207, 255`, `components/StudyForm.jsx:72`

### UI-12 · Dokunmatik geri bildirim eksik · P3 · S
- **Sorun:** CSS'te 18 `:hover` var, hiç `:active` yok. Hover kuralları `@media (hover: hover)` içinde değil; iPhone'da
  dokunulan düğmenin hover zemini takılı kalıyor. Uzun basınca metin seçiliyor.
- **Öneri:**
  - Hover kurallarını `@media (hover: hover)` içine al.
  - `:active` durumu ekle.
  - Etkileşimli öğelerde `-webkit-tap-highlight-color: transparent` ve `user-select: none` kullan.
- **Ek:** Alt sayfa tutamacı sürüklenmiyor ama sürüklenecekmiş gibi görünüyor. Ya sürükleyerek kapatma eklenmeli ya
  tutamaç kaldırılmalı (`components/Sheet.jsx:60`).

### UI-13 · Hesap ekranları ve Hafta paneli · P3 · S
- **Giriş:** Telefonda kart içinde kart düzeni her yanda ~32 px boşluk bırakıyor; 390 px'te form tam genişlik olabilir.
- **Profil seçimi:**
  - Büyük "PlanToBee" başlığı her seferinde tekrar ediyor, aile adı ise küçük alt yazıda; aile adı başlık yapılmalı.
  - Uzun adda kutu yükseklikleri eşitsiz (159 ve 138 px).
- **Hafta paneli:** Lejant 3 satırlık açıklama; "Simgeler ne demek?" diye katlanabilir yapılmalı.

## Teknik borç (kullanıcıya dolaylı yansıyan) · P3

- **CSS ölçekleri:**
  - z-index sırası tutarsız: bildirim yükleniyor katmanının, onay diyaloğu alt sayfanın altında kalıyor.
  - ~12 farklı köşe yarıçapı ve sabit renkler var (`#968B74`, `#fff`).
  - Ölü kurallar: `.tl-outlb`, `.tl-hl`, `.wg-cut`. Yinelenen kurallar: `.entry .ico`, `.tl-many`, `.auth-card input`.
  - Öneri: `--z-*`, `--scrim` değişkenleri.
- **Performans:**
  - JS 432 kB tek parça (gzip ~135 kB); fontlar ~181 kB ve ön yükleme yok.
  - Her değişiklikten sonra iki GET gidiyor (gün + hafta), oysa hafta yanıtı günü de içeriyor.
  - `NoticeContext` değeri memo'lanmadığı için her bildirim tüm planı yeniden çiziyor.
  - Ailem, Bildirimler ve giriş sayfaları `React.lazy` ile ayrılabilir.
- **Service worker:** Önbellek ve sürüm akışı yok. Çevrimdışı açılışta hata sayfası çıkıyor; günlerce açık kalan PWA eski
  sürümde kalıyor (`public/sw.js`).
- **Yarışlar:**
  - Geç gelen yanıt yeni değeri ezebiliyor (`pages/DayPage.jsx:74-81`, `hooks/useMutation.js`).
  - Bildirim ayarlarında saat tekerleği her durakta istek gönderiyor; istekler ~400 ms geciktirilerek birleştirilmeli.
- **Ertelenmiş silme:** 5 sn içinde çıkış yapılırsa silme isteği belirteç silindikten sonra gidiyor; kayıt geri gelebilir
  (doğrulanmadı, `api/deferred.js:46-50`).
- **Capacitor hazırlığı:**
  - `localStorage` try/catch'siz kullanılıyor; depolama kapalıysa açılışta beyaz ekran olur (`api/client.js`,
    `context/AuthContext.jsx:14-31`).
  - Hukuki bağlantılar aynı pencerede açılıyor.
  - `100vh` iOS Safari'de taşıyor; `dvh` kullanılmalı (`index.css:178, 656`).
- **Doğrulama kalıpları:** Giriş formları tarayıcı baloncuğu, uygulama formları satır içi hata kullanıyor. Hatalar alana
  `aria-describedby` ile bağlı değil.
- **Lint:** oxlint 0 hata, 15 uyarı (çoğu yanlış pozitif).

## Cihazda doğrulanacaklar (gerçek iPhone)

Headless Chrome'da kesinleştirilemeyen ama kodda riskli görünenler:
1. **Klavye alt sayfayı örtüyor mu?** Bee'den eklerken klavye açıkken "Ekle" düğmesi görünüyor mu? `.sheet` `bottom: 0` ile
   sabit. Örtüyorsa `visualViewport` ile düzeltilmeli; bu durumda **P2**.
2. **Güvenli alan:** `viewport-fit=cover` yok, `env(safe-area-inset-*)` 0 dönebilir. Ana ekrandan açılan uygulamada bildirim
   ve alt sayfanın son öğesi ana ekran çubuğuna yapışıyor mu? (`index.html:13`)
3. **Çift dokunuş:** Durum dairesine hızlı çift dokunuş yakınlaştırıyor mu? (UX-12, UI-2)
4. **Parola yöneticisi:** iOS PIN'i site parolası olarak kaydetmeyi öneriyor mu? (`components/PinInput.jsx:12`)
5. **Bildirim izni:** "Bildirimleri aç" izin akışı uçtan uca çalışıyor mu?

## Önerilen uygulama sırası

1. **Yapıldı · Görev 12 (30 Ekim).** Önizlemesi onaylanan ana ekran ve form değişiklikleri:
   - UX-3, UX-4, UX-10, UX-11, UX-13; UX-6'nın Enter kısmı ve UX-16'nın Plan başlığı kısmı
   - UI-3, UI-4, UI-5, UI-6, UI-7, UI-10 (Hafta ikonu, sekme ikonları, Hafta düğmesinin adı), UI-11
   - Ayrıntı ve test: `docs/tasks/12-ana-ekran-ux-ui.md`
2. **Görev 13 · Güven ve hızlı düzeltmeler.** Görsel karar gerektirmez, çoğu S:
   - UX-1, UX-2 (satır içi yükleme, 5 sn mesajı, zaman aşımı; önbellek isteğe bağlı), UX-5, UX-6'nın kalanı, UX-7, UX-8
   - UI-1, UI-2 (taban sınıflar ve `touch-action`)
   - UX-16 ve UX-17'nin kalanı, UI-12, UI-13
   - `render.yaml` planının kontrolü
3. **Kararını bekleyenler** (önerim):
   - **UX-9:** Tek ekleme yüzeyi olsun; To-do'nun art arda ekleme özelliği korunarak.
   - **UX-12:** Tek dokunuşla tamamlansın; "Devam ediyor" ⋯ menüsüne taşınsın.
   - **UX-14:** Önce test kullanıcılarına sor.
   - **UI-8:** Her yerde sarı ve koyu çerçeve.
   - **UI-9:** Gövde 15 px, en küçük metin 12 px; önizlemeyle.
4. **Görev 14 · Mağaza hazırlığı (Capacitor öncesi).** UX-15 (geri tuşu ve rotalar), teknik borçtaki service worker,
   güvenli alan, `localStorage` ve performans maddeleri.

## Yöntem ve sınırlar

- **Sahte API:** Uygulama yerelde gerçek backend'le çalıştırılamadı. Bilgisayarda PostgreSQL kurulu değil ve geçici
  PostgreSQL indirip çalıştırma izni otomatik modda reddedildi. Ön yüz, backend DTO'larını taklit eden bellek içi bir sahte
  API ile çalıştırıldı. Sunucu kuralları ve sunucunun hata metinleri bu incelemede denenmedi; onları e2e testleri kapsıyor
  (336 kontrol).
- **Tarayıcı:** Headless Chrome, mobil emülasyon (390×844 ve 360×780, DPR 2). Gerçek iPhone'da denenmedi; iOS'a özgü
  davranışlar yukarıdaki "Cihazda doğrulanacaklar" listesinde.
- **Araçlar:** Ekran görüntüleri, sahte API ve qa ölçüm betikleri oturumun geçici klasöründe; repoya eklenmedi.
- **Ölçüm özeti (qa):** taşma / 44 px altı öğe / 16 px altı alan (Chrome→iOS) / kontrast ihlali (metin+arayüz).

<details>
<summary>Ekran bazında tablo</summary>

| Ekran | 360 | 390 |
|---|---|---|
| Giriş | 0 / 5 / 2→0 / 0+2 | 0 / 5 / 2→0 / 0+2 |
| Kayıt | 0 / 4 / 3→0 / 0+3 | 0 / 4 / 3→0 / 0+3 |
| Profil seçimi | 0 / 1 / 0 / 0+0 | 0 / 1 / 0 / 0+0 |
| PIN | 0 / 2 / 1→1 / 0+0 | 0 / 2 / 1→1 / 0+0 |
| Bee (Ajanda) | 0 / 11 / 0 / 0+0 | 0 / 4 / 0 / 0+0 |
| To-do + Ders ekle formu | 0 / 10 / 0 / 0+3 | 0 / 3 / 0 / 0+3 |
| Plan (liste) | 0 / 14 / 0 / 0+0 | 0 / 7 / 0 / 0+0 |
| Plan + tür + Her hafta tekrarla | 0 / 24 / 0 / 0+4 | 0 / 17 / 0 / 0+4 |
| Hafta paneli | 0 / 0 / 0 / 0+0 | 0 / 0 / 0 / 0+0 |
| Boşluktan ekle: Aktivite | 0 / 5 / 0 / 0+5 | 0 / 5 / 0 / 0+5 |
| ⋯ menüsü, ad menüsü | 0 / 0 / 0 / 0+0 | 0 / 0 / 0 / 0+0 |
| Ailem | 0 / 9 / 2→1 / 0+2 | 0 / 9 / 2→1 / 0+2 |
| Bildirimler | 0 / 2 / 2→0 / 0+2 | 0 / 2 / 2→0 / 0+2 |
| Aile oluştur | 0 / 2 / 4→2 / 0+4 | 0 / 2 / 4→2 / 0+4 |
| Boş gün (Bee) | 0 / 7 / 0 / 0+0 | 0 / 0 / 0 / 0+0 |

</details>
