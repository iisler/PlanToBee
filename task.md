# Görev 10: Bee · To-do · Plan — ana ekranda üç bölüm (Ajanda, Dersler, Aktiviteler) ve derse başlangıç saati

Önceki görev: `docs/tasks/09-saat-cizelgesi.md`.

Durum: Ürün: Tamamlandı · Tasarım: Tamamlandı · Backend: Tamamlandı · Frontend: Tamamlandı · QA: Onaylandı (backend e2e bu ortamda çalıştırılamadı; bkz. QA Sonuçları)

> **Sıra güncellemesi (kullanıcı kararı, 2026-10-11):** Seçici sırası soldan sağa **Plan (Aktiviteler) · To-do (Dersler) · Bee (Ajanda)** — marka sırası. Uygulama açılınca herkes için **Bee** seçili gelir. Belgedeki "1) Bee 2) To-do 3) Plan" sırası bu notla geçersizdir; maket: /tmp/ptb-ux-preview/67-plan-todo-bee.png.


---

## Özellik Özeti

Bugün gün ekranı uzun: Çalışma Planı en üstte, altında Görev 09'un saat çizelgesi var. Dersin saati olmadığı için
çizelgedeki boşluklar dersleri hesaba katmıyor. Bu görevle:

1. **Hero'nun (hafta şeridi) altında 3 bölümlü seçici** gelir. Aynı anda tek bölüm görünür:
   **Bee** (Ajanda) · **To-do** (Dersler) · **Plan** (Aktiviteler).
2. **Derse isteğe bağlı başlangıç saati** eklenir. Bitiş = başlangıç + dakika (otomatik, ayrıca girilmez).
3. **Bee (Ajanda):** Görev 09 çizelgesi; saatli dersler de mavi blok olarak görünür, boşluklar ders + aktiviteye
   göre hesaplanır. 📅 Hafta ızgarasında saatli dersler ince mavi blok olur.

Maketler: `/tmp/ptb-ux-preview/61-yerlesim-y.png` (Y yerleşimi), `62-isim-a-b.png`, `63-cocuk-360.png`,
`50-gun-secenekler.png` (A′: ajandada saatli ders mavi blok), `51-ekleme.png` (ders formunda başlangıç),
`53-hafta-dersler.png` (hafta ızgarasında dersler). **Not:** maketlerdeki isim eşleşmesi ve sıra kullanıcı kararıyla
değişti (aşağıda Karar 2); maketlerdeki "çocuk Plan ile açılır" kuralı da yok (Karar 3).

### Kararlar

**Kullanıcı kararları (kesin)**
1. Yerleşim **Y**: hero'nun altında 3 bölümlü seçici; seçilen bölümün kartı altında görünür.
2. Sıra ve adlar: **1) Bee — "Ajanda"**, **2) To-do — "Dersler"**, **3) Plan — "Aktiviteler"**.
3. Uygulama açılınca **herkes için (çocuk dahil) Bee** açılır.
4. Bee: Görev 09 çizelgesi + saatli dersler mavi blok; saatsiz ders ve aktiviteler "Saati yok" şeridinde; 📅 Hafta
   ızgarasında saatli dersler ince mavi blok.
5. To-do: günün tüm dersleri kontrol listesi + ilerleme, "+ Ders ekle"; ders formunda "Başlangıç (isteğe bağlı)".
6. Plan: aktivite türü ikonları + bugünün tüm aktiviteleri (saat aralığıyla, saatsizler dahil), ⋯ menüsü.
7. Kart başlıkları seçicideki adı tekrar etmez (maket notu; kartta yalnızca özet bilgi kalır).

**Varsayılan kararlar (ana oturum kararı; kullanıcı değiştirebilir)**
8. Seçicideki açıklama yazıları ("Ajanda", "Dersler", "Aktiviteler") **kalıcıdır** (ilk kullanımdan sonra kaybolmaz).
9. Ders **hem To-do'dan hem Bee'deki çizelgeden** işaretlenebilir; aynı kayıttır, durum iki yerde senkron.
10. Seçilen bölüm **hatırlanmaz**: her açılışta Bee; oturum içinde bölüm değiştirilebilir, gün değiştirince seçili
    bölüm korunur (Varsayım).
11. Bildirimden gelen derin bağlantı (`?date=`) uygulamayı **Bee ile o günde** açar.
12. Bee'deki boşluktan "+ Ekle" **Ders / Aktivite** seçimi açar; **varsayılan Ders** (maket 51; boşluk doldurmanın en
    sık nedeni ders koymak). Başlangıç boşluğun başıyla dolar.
13. Dersin dakikası yoksa çizelgede Görev 09 kuralıyla 60 dk "süre belirsiz" gösterilir (Varsayım). Başlangıç +
    dakika gece yarısını aşarsa Görev 09'daki "↷ ertesi gün" kuralı uygulanır.

---

## Kullanıcı Hikayeleri

1. **Ebeveyn olarak**, uygulamayı açınca günün tamamını (ders + aktivite) tek çizelgede görmek istiyorum; böylece
   gerçekten boş olan saatleri bilirim.
2. **Ebeveyn olarak**, derse başlangıç saati verebilmek istiyorum (Matematik 15:00, 40 dk); böylece ders ajandada
   yerini alır.
3. **Ebeveyn olarak**, ajandadaki bir boşluğa dokunup oraya ders ya da aktivite koyabilmek istiyorum.
4. **Ebeveyn olarak**, haftanın hangi gününde ne zaman ders olduğunu 📅 Hafta ızgarasında görmek istiyorum.
5. **Çocuk olarak**, uygulamayı açınca bugünün ajandasını görmek ve dersimi oradan da "bitti" diye işaretleyebilmek
   istiyorum.
6. **Çocuk olarak**, To-do'ya geçince yalnızca derslerimi kısa bir listede görmek ve ilerlememi bilmek istiyorum.
7. **Aile üyesi olarak**, Plan'a geçip aktivite türünü seçerek hızlıca aktivite eklemek ve günün aktivitelerini
   görmek istiyorum.
8. **Aile üyesi olarak**, saatli bir ders eklendiğinde bildirimde saatini görmek istiyorum ("📚 Matematik · 15:00–15:40").

---

## Kabul Kriterleri

Örnek gün (QA verisi): **Pazar 11.10.2026**: ✦ Kurs 09:00–13:00, 📚 Matematik 15:00 · 40 dk, 📚 Fizik 16:00 · 30 dk,
saatsiz 📚 Türkçe 30 dk (tamam), 🏅 Antrenman 20:00–21:30, saatsiz ✦ Veteriner randevusu.

### Seçici ve açılış
1. Gün ekranında hero'nun altında sırasıyla **Bee / Ajanda**, **To-do / Dersler**, **Plan / Aktiviteler** bölümleri
   olan seçici vardır; seçili bölüm sarı zemin + siyah yazı, aynı anda tek bölüm görünür.
2. Ebeveyn ve çocuk profiliyle uygulama açılınca (yeni sekme, yenileme, PWA açılışı) **Bee** seçilidir.
3. Bölüm değiştirildikten sonra başka güne geçilince seçili bölüm korunur; sayfa yenilenince yine Bee açılır.
4. Bildirimdeki bağlantı (`?date=2026-10-11`) uygulamayı Bee seçili ve o gün açık olarak açar.
5. Seçici erişilebilir sekme yapısındadır (seçili olan duyurulur, klavyeyle oklarla gezilir); her bölüm en az
   44 px yüksekliğindedir. 360 px'te üç bölüm ve açıklamaları tek satırda sığar, yatay kaydırma yoktur.
6. Kart başlığında seçicideki ad tekrar etmez; kartın üst satırında yalnızca özet bilgi vardır (ör. "8 sa 20 dk boş",
   "1/3 · 100 dk", "3 bugün").

### Bee (Ajanda)
7. **Örnek gün:** Bee kart özeti **"8 sa 20 dk boş"**. Çizelgede sırasıyla: "07:00–09:00 boş · 2 sa", Kurs bloğu,
   "**13:00–15:00** boş · 2 sa", Matematik mavi bloğu (15:00–15:40 · 40 dk), Fizik mavi bloğu (16:00–16:30 · 30 dk),
   "**16:30–20:00** boş · 3 sa 30 dk", Antrenman bloğu. 15:40–16:00 (20 dk) ve 21:30–22:00 (30 dk) etiketlenmez.
8. "Saati yok" şeridinde **Türkçe** (✓, üstü çizili, "30 dk") ve **Veteriner randevusu** görünür.
9. Ders bloğu mavi renk + ders ikonu/daire + metinle aktiviteden ayırt edilir (renk tek başına bilgi taşımaz).
10. Ders bloğundaki daireye dokununca ders tamamlanır/geri alınır; To-do'daki aynı ders anında aynı durumu gösterir
    (ve tersi). Bloğun geri kalanına dokununca ⋯ menüsü (Düzenle/Sil) açılır.
11. Boşluktaki "+ Ekle" "13:00–15:00 arasına ekle" başlıklı formu **Ders** seçili açar; Aktivite'ye geçilebilir.
    Ders seçiliyken başlangıç 13:00 dolu gelir, bitiş seçilen dakikaya göre gösterilir (40 dk → 13:40).
12. Saatli ders ekleyince/düzenleyince/silince boşluklar ve özet yeniden hesaplanır (ör. 13:00 Matematik 40 dk
    eklenince "13:40–15:00 boş · 1 sa 20 dk").
13. Ekran okuyucu ders bloğunu "Matematik, ders, 15:00–15:40, 40 dakika, yapılmadı" gibi okur.

### To-do (Dersler)
14. Günün tüm dersleri (saatli + saatsiz) kontrol listesi olarak görünür; özet "1/3 · 100 dk" biçimindedir.
15. Saatli derste sağda "15:00 · 40 dk", saatsizde yalnızca "30 dk" yazar. Sıra: saatliler başlangıca göre, sonra
    saatsizler eklenme sırasıyla (Varsayım).
16. "+ Ders ekle" formunda Ders, Konu (isteğe bağlı), Süre çipleri, **Başlangıç (isteğe bağlı)** ve salt okunur
    **Bitiş** vardır; bitiş = başlangıç + dakika ("Bitiş 13:40 · ajandada 13:00–13:40 görünür").
17. Başlangıç boş bırakılabilir; formda "Saat seçmezsen ders ajandada 'Saati yok' bölümünde görünür." bilgisi çıkar.
18. Saatli ders bir kayıtla çakışırsa "⚠ Kurs (09:00–13:00) ile çakışıyor. Yine de ekleyebilirsin." uyarısı görünür;
    ekleme engellenmez.
19. Düzenlemede başlangıç dolu gelir, silinip kaydedilebilir (ders saatsiz olur).

### Plan (Aktiviteler)
20. Üstte aktivite türü ikonları (Spor, Müzik, Konser, Buluşma, Sınav, Diğer); birine dokununca Görev 09 aktivite
    formu açılır.
21. Altında "Bugün" listesi: **Kurs 09:00–13:00**, **Antrenman 20:00–21:30**, **Veteriner randevusu · saati yok**;
    sıra saatliler başlangıca göre, sonra saatsizler. Her satırda ⋯ menüsü (Düzenle/Sil). Dersler bu listede yoktur.
22. Seçili gün bugün değilse liste başlığı o günü yazar (Varsayım: "Bugün" yerine "Pazartesi").

### 📅 Hafta ızgarası
23. Saatli dersler ince mavi blok olarak gerçek aralığıyla çizilir; renk açıklamasında "Ders (saatli)" vardır.
24. Saatsiz dersler ızgarada yer almaz; alttaki özette sayıyla yazar ("3 ders saatsiz").
25. Sütunun erişilebilir adı saatli dersleri de okur; "En uzun boşluk" dersleri hesaba katar.

### Eski kayıtlar, eski istemci, bildirim
26. Başlangıcı olmayan mevcut dersler değişmeden görünür (To-do'da listede, Bee'de "Saati yok" şeridinde).
27. Eski istemci başlangıç göndermeden dersi düzenlerse (ör. durum değiştirirse) mevcut başlangıç **silinmez**.
28. Saatli ders bildirimi "📚 Matematik · 15:00–15:40" bilgisini taşır; saatsizde bugünkü metin değişmez.

### Genel
29. 360 ve 390 px'te yatay kaydırma yok; tüm dokunma alanları ≥ 44 px. Çocuk profilinde de üç bölüm görünür,
    yetkiler (düzenleme/silme) mevcut kurallarla aynıdır.
30. Bir aile başka ailenin derslerini çizelgede ya da hafta ızgarasında göremez.

---

## Backend Gereksinimleri

1. **Veri modeli:** StudyEntry'ye isteğe bağlı **StartTime** ("SS:dd" metin, Event.Time ile aynı biçim).
   Migration **yalnızca boş bırakılabilir sütun ekler**; mevcut satırlara dokunmaz.
2. **API:** Ders ekleme ve düzenlemede StartTime kabul edilir; gün ve hafta ayrıntı okumalarında (`GET /api/days/{date}`,
   `GET /api/days/week/{monday}/details`) döner. Görev 09 EndTime kuralı aynen: alan yok/`null` → düzenlemede
   **mevcut değer korunur**; `""` → silinir; "SS:dd" → yazılır. Durum değiştirme uç noktası StartTime'a dokunmaz.
3. **Doğrulama:** biçim SS:dd (00:00–23:59), aksi 400 (`validation`, Türkçe mesaj). Bitiş sunucuda saklanmaz;
   gerekirse okumada başlangıç + dakikadan türetilir (karar backend'in; tek yerde).
4. **Hafta özeti:** saatsiz ders sayısı (ya da istemcinin sayabileceği alanlar) ve saatli derslerin aralığı ızgara
   için yeterli olmalı. Ders toplam dakikası değişmez.
5. **Bildirim metni:** saatli ders eklenince/toplu bildirimde "📚 Matematik · 15:00–15:40"; saatsizde bugünkü gibi.
6. Uçtan uca testler (`backend/tests/e2e.py`): ekle/düzenle/temizle, biçim hatası, eski istemci gövdesiyle düzenlemede
   ve durum değiştirmede StartTime korunur, hafta ayrıntısında alan döner, bildirim metni, aile izolasyonu.

## Frontend Gereksinimleri

1. **Bölüm seçici** (hero altında, sekme yapısı): Bee/Ajanda · To-do/Dersler · Plan/Aktiviteler; açılışta ve
   derin bağlantıda Bee; oturum içinde seçim korunur, kalıcı saklanmaz.
2. **Bee:** Görev 09 Timeline'ı dersleri de içerecek şekilde genişlet (mavi blok, daire ile işaretleme, ders
   ⋯ menüsü), boşluk hesabı ders + aktivite, "Saati yok" şeridinde saatsiz dersler, "+ Ekle" → Ders/Aktivite
   seçimli form (varsayılan Ders).
3. **To-do:** mevcut Çalışma Planı listesi; saatli ders metni "15:00 · 40 dk"; ders formuna Başlangıç (isteğe bağlı),
   salt okunur Bitiş ve özet metni, çakışma uyarısı. Düzenlemede `startTime` her zaman gönderilir (boşsa `""`).
4. **Plan:** tür ikonları + günün aktivite listesi (saat aralığı, saati yok, ⋯ menüsü); çizelge burada yok.
5. **📅 Hafta:** saatli ders blokları, "Ders (saatli)" açıklaması, saatsiz ders sayısı, erişilebilir adlar.
6. Ders durumu iki bölüm arasında tek kaynaktan senkron; 360/390 px, 44 px, ekran okuyucu metinleri (Kabul 5, 13, 29).

---

## Tasarım Notları (ux-ui-designer için)

1. Maketler 61/62/63'teki **isim eşleşmesini ve sırayı güncelle**: seçici soldan sağa **Bee (Ajanda) · To-do (Dersler)
   · Plan (Aktiviteler)**. Makette "Plan = Dersler, To-do = Aktiviteler, Bee üçüncü" idi; artık geçersiz.
2. "Çocuğun varsayılanı Plan" sütunu kalkar; çocuk da Bee ile açılır (63 güncellenmeli).
3. Bee'de seçili bölüm ikonu (⬡) ve renkleri uygun bölüme taşı; kart başlıkları seçiciyi tekrar etmesin.
4. Ders bloğu (50 A′): mavi soft zemin + sol şerit + daire; tamamlanmış ders bloğu görünümü (✓, üstü çizili) tanımla.
5. "+ Ekle" sayfası (51-1): üstte Ders/Aktivite seçimi, varsayılan Ders, "Boşluk: 13:00–15:00 · 2 sa" bilgisi.
6. Hafta ızgarası (53 "Öneri"): ince mavi ders blokları, ikon/metin yok, açıklama satırında "Ders (saatli)".
7. 360 px'te seçici etiketleri tek satır; ders formunda Başlangıç ve Bitiş yan yana sığmalı (51, 360 sütunu).

---

## Kapsam Dışı

- Son seçilen bölümün kalıcı hatırlanması; profile göre farklı açılış bölümü.
- Derse ayrı bitiş saati girme (bitiş her zaman başlangıç + dakika).
- Tekrarlayan ders/aktivite, sürükle-bırak ile saat değiştirme.
- Hafta ızgarasında "Dersleri göster/gizle" anahtarı.
- Zaman tabanlı hatırlatma ("Matematik'e 10 dk kaldı").
- Mevcut derslere toplu saat atama/veri taşıma.

---

## Açık Riskler

1. **Alışkanlık değişimi:** çocuk akışı "önce derslerim" idi; artık Bee açılıyor. Çocuk dersleri ajandada bulamazsa
   To-do'ya geçmek bir dokunuş daha; kullanıcı geri bildirimiyle izlenmeli.
2. **İsim anlaşılırlığı:** "To-do = Dersler", "Plan = Aktiviteler" sezgisel olmayabilir; kalıcı açıklama yazıları
   (Karar 8) bunu azaltır.
3. **Hafta ızgarası kalabalığı:** 30–40 dk dersler 10–13 px; 360 px'te seçilmez ama sütun bütünüyle hedef (Görev 09).
4. **Eski istemci:** StartTime gönderilmeyen düzenlemede ya da durum değişiminde alanın korunması şart (Backend 2).
5. **Çift işaretleme yeri:** aynı dersin iki yerde işaretlenmesi durum çakışmasına yol açmamalı (tek kaynak, Kabul 10).
6. **Saat dilimi:** saatler Türkiye saatiyle metin olarak girilir (Görev 09 ile aynı bilinçli kabul).

---

## Geri Dönüş Notu

- Migration yalnızca boş bırakılabilir **StartTime** sütunu ekler; geriye uyumludur, eski istemci ve eski kod etkilenmez.
- Canlıya almadan önce **Neon yedeği (branch/PITR noktası)** alınır; geri dönüş etiketi `docs/DEPLOY.md`'ye eklenir.
- Geri dönüşte önce kod geri alınır; sütun kalabilir (eski kod okumaz). Sütun kaldırılırsa ters migration ile yapılır
  ve girilmiş ders saatleri kaybolur (gerekirse yedekten geri alınır).

---

## Backend Çıktısı

### Sözleşme (frontend-developer için)

**StudyEntryDto** (gün, hafta ayrıntısı ve ekleme/düzenleme/durum cevaplarında) sona iki alan aldı:
- `startTime`: `"SS:dd"` ya da `null` (saatsiz ders).
- `endTime`: **salt okunur**, sunucu `startTime + minutes`'tan türetir; saklanmaz. Gece yarısını aşarsa ertesi günün
  saatidir (`endTime < startTime` → "↷ ertesi gün"). `startTime` null ise ya da süre 1440 dk ise `null`.

| Uç nokta | `startTime` davranışı |
|---|---|
| `POST /api/days/{date}/entries` | yok / `null` / `""` → saatsiz; `"SS:dd"` → yazılır |
| `PUT /api/days/{date}/entries/{id}` | yok / `null` → **mevcut korunur** (eski istemci); `""` → silinir; `"SS:dd"` → yazılır |
| `PATCH /api/days/{date}/entries/{id}/status` | dokunmaz |
| `GET /api/days/{date}`, `GET /api/days/week/{monday}/details` | `startTime`, `endTime` döner |

Hata: biçim SS:dd (00:00–23:59) değilse **400** `{"code":"validation","message":"Başlangıç saati SS:dd biçiminde olmalı (örn. 15:00)."}`;
21+ karakter 400 (model doğrulaması). Yetki değişmedi: çocuk başkasının dersinde PUT → 403 `plan_read_only`; başka aile → 404.

Örnek:
```
POST /api/days/2026-10-13/entries
{"subject":"Matematik","topic":"Türev","minutes":40,"startTime":"15:00"}
→ 200 {"id":812,"subject":"Matematik","topic":"Türev","minutes":40,"status":"todo","canEdit":true, ...,
       "isImported":false,"startTime":"15:00","endTime":"15:40"}

PUT /api/days/2026-10-13/entries/812
{"subject":"Matematik","topic":"Türev","minutes":45,"status":"todo","startTime":""}
→ 200 {..., "minutes":45, "startTime":null, "endTime":null}
```
Düzenlemede `startTime` her zaman gönderilmeli (boşsa `""`); aksi halde temizleme mümkün olmaz.

**Hafta ızgarası (Backend 4):** yeni uç yok. `GET /api/days/week/{monday}/details` her dersin `startTime/endTime`
alanını taşır; saatsiz ders sayısı istemcide `studyEntries.filter(e => !e.startTime).length`. `GET /api/days/week/{monday}`
(özet) değişmedi; `studyMinutes` saatli/saatsiz tüm dersleri sayar.

**Bildirim metni:** saatli ders gövdesi `📚 Matematik · 15:00–15:40 · Türev — Pazartesi 13 Eki` (aralık süreyi
anlattığı için "40 dk" yazılmaz; konu varsa aralıktan sonra). Saatsizde değişmedi: `📚 Matematik · Türev · 40 dk — …`.
Ekleme, değişiklik, "bitirdi" ve silme bildirimleri aynı metni kullanır.

### Varsayımlar
- Bitiş sunucuda tek yerde türetilir (`PlanText.StudyEndTime`); istemci kendi hesabı yerine `endTime`'ı kullanabilir.
- 1440 dk derste bitiş türetilmez (başlangıca eşit olurdu); istemci "tam gün" gibi gösterebilir.
- Aktivitedeki "eski serbest metin saat" istisnası derste yok (ders saati hiç serbest metin olmadı).

### Değişen dosyalar
- `backend/PlanToBee.API/Models/StudyEntry.cs`, `Data/AppDbContext.cs` (HasMaxLength 5), `DTOs/DayDtos.cs`,
  `Controllers/DaysController.cs`, `Infrastructure/PlanText.cs`, `Services/Notifications/NotificationService.cs`
- `backend/PlanToBee.API/Migrations/20261011161616_StudyEntryStartTime.cs` (+ Designer, snapshot)
- `backend/tests/e2e.py` (`test_study_start_time` + push testinde bildirim metni), `docs/DEPLOY.md` (6.4)

### Veri modeli ve migration
`StudyEntryStartTime`: yalnızca `AddColumn StudyEntries.StartTime character varying(5) NULL`; Down yalnızca
`DropColumn`. Satır satır okundu (yeniden adlandırma/veri adımı yok). plantobee_e2e'de Up → Down → Up uygulandı;
374 satırın mevcut sütun sağlaması (md5) üç adımda aynı, yeni sütun tüm satırlarda NULL.

### Doğrulama
`dotnet build` 0 uyarı · WebPushSelfTest geçti · has-pending-model-changes temiz · e2e 245 geçti, 0 kaldı (push
senaryosu ve `--psql` ile bildirim metni dahil).

### Bilinen sınırlamalar
- Çakışma (ders–aktivite üst üste) sunucuda engellenmez; uyarı istemcide.
- Site Render'dan önce çıkarsa eski API `startTime`'ı yok sayar (ders saatsiz kaydedilir).

### Canlıya alma
Önce Neon branch yedeği, etiket `rollback-oncesi-bee-todo-plan`; migration açılışta kendiliğinden uygulanır. Geri
dönüş: `docs/DEPLOY.md` 6.4 (veri adımı gerekmez, yalnızca kod geri alınır).

---

## Tasarım

Son önizleme: `/tmp/ptb-ux-preview/65-son-bee-todo-plan.png` (Bee, To-do, Plan, çocuk 360, ders formu, boşluktan
ekleme Ders/Aktivite, 360 px, ders bloğu durumları), `/tmp/ptb-ux-preview/66-hafta-dersli.png` (Hafta ızgarası).
Maket CSS'i `/tmp/ptb-ux-preview/mock65/m65.css` aday kuralların kaynağıdır (adlar aşağıda); index.css'e taşınırken
mevcut kurallarla birleştirilsin, tekrar yazılmasın. Yeni renk yok; hepsi mevcut değişkenler.

### 1. Sayfa sırası (DayPage)
hero (değişmez) → **bölüm seçici** → gün başlığı (`.dayhead`, değişmez) → seçili bölümün tek kartı. Yükleniyor/hata
durumu seçicinin altında, kartın yerinde (bugünkü `Loading` / `.load-error`); seçici yüklenirken de görünür ve
kullanılabilir. Açılışta ve `?date=` bağlantısında Bee; gün değişince seçim korunur (Karar 10–11).

### 2. Bölüm seçici `.sect`
- İşaretleme: `<div class="sect" role="tablist" aria-label="Gün bölümleri">`, içinde 3 `<button role="tab"
  aria-selected aria-controls="sect-panel-…" id="sect-tab-…" tabIndex={seçili ? 0 : -1}>`. Kart `role="tabpanel"
  aria-labelledby="sect-tab-…" tabIndex={-1}`.
- Sıra ve metin (b = ad, span = açıklama, ikisi de her zaman görünür):
  1. `<b>{petek svg}Bee</b><span>Ajanda</span>` 2. `<b>To-do</b><span>Dersler</span>` 3. `<b>Plan</b><span>Aktiviteler</span>`.
  Petek SVG yalnız Bee'de (marka işareti; m65 `HEX`, 15 px, `aria-hidden`). Erişilebilir ad: "Bee, Ajanda" vb.
- Ölçü: kap `display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; padding:4px; background:var(--surface);
  border:1px solid var(--line); border-radius:14px; margin:12px 0 14px`. Düğme `min-height:52px; border-radius:10px`;
  ad Bricolage 16,5 px 800 `--ink`; açıklama Figtree 11,5 px 600 `--ink-soft`, `white-space:nowrap`.
- Durumlar: seçili `background:var(--honey)`, ad ve açıklama `--ink` (kontrast ≥ 9:1); seçili değil zemin yok;
  hover `--surface-2`; odak halkası mevcut `:focus-visible` (açık zemin, siyah). Devre dışı durum yok.
- Klavye: ←/→ komşu sekmeye geçer ve seçer (sonda başa döner), Home/End ilk/son. Seçim değişince odak sekmede kalır,
  sayfa kaymaz (kart değişse de seçici yerinde kalır).
- 360 px: her sekme ~105 px; "Aktiviteler" 11,5 px'te sığar, kaydırma yok (önizleme 4. sütun).

### 3. Kart üst satırı (üç bölümde ortak)
Kart başlığı seçicideki adı tekrar etmez: ikon karosu ve "Çalışma Planı / Aktiviteler" başlığı kaldırılır.
`.card-head` içinde yalnız `<h2 class="sumh" tabIndex={-1}>` (mevcut `headingRef` buna bağlanır; silme sonrası odak
buraya döner): JetBrains Mono 13 px 600 `--ink`.
- Bee: `freeSummary` (ders + aktivite) → "8 sa 20 dk boş" / "tüm gün boş" / "boş saat yok".
- To-do: "1/3 · 100 dk"; ders yoksa "Ders yok". Altında ilerleme çubuğu `.prog` (6 px, `--surface-2` zemin,
  `--study` dolgu, `aria-hidden`; bilgi zaten metinde).
- Plan: bugün "3 bugün"; başka gün "3 aktivite"; hiç yoksa "Aktivite yok".

### 4. Bee (Ajanda) = Timeline'ın derslerle genişletilmesi
Timeline'a dersler `{ kind:'study', time:startTime, endTime }` olarak girer; boşluk, küme, şimdi çizgisi, sıkıştırma,
07 öncesi / 22 sonrası, ↷ kuralları aynen (Görev 09). Ders süresi her zaman var; "süre belirsiz" ders olmaz.
Kartta altta ekleme formu YOK (ekleme boşluktan; ayrıca To-do ve Plan'da).
- **Ders bloğu** (`li` içinde `<div class="tl-blk study">`, kendisi düğme değil; içinde iki düğme):
  - `.tl-blk.study`: `display:flex; align-items:stretch; padding:0; background-color:var(--study-soft);
    box-shadow:inset 4px 0 0 var(--study)`; yükseklik en az 44 px (MIN_BLOCK), köşe 10 px (mevcut).
  - Durum düğmesi `.tl-st`: genişlik 40 px, blok yüksekliği boyunca (≥ 44 px); içindeki daire `i` 24 px, 2 px
    `--study` kenar, `--surface` zemin. `st-inprogress`: `--warn` yarım dolgu; `st-done`: `--study` dolgu + beyaz ✓.
    Dokununca To-do ile aynı `cycleStatus` (Yapılacak → Devam Ediyor → Tamamlandı → Yapılacak); tek kaynak, iyimser.
  - Seçenek düğmesi `.tl-op` (kalan alan): ad (`.nm`), saat (`.tm` "15:00–15:40 · 40 dk"), sağda ⋯ (`.mo`).
    Dokununca EntryMenu `kind="study"` (Düzenle/Sil, canEdit kuralları aynı).
  - **Tamamlandı:** `.tl-blk.study.done` zemin `--surface-2` (şerit mavi kalır), ad üstü çizili `--ink-soft`, saat
    satırına ` · ✓ tamam` (`.ok`, `--study` 600). Renk tek başına değil: ✓ + üstü çizili + metin.
  - Yan yana kümede (n2/n3): daire kalır; n3'te ⋯ gizlenir (aktiviteyle aynı kural), ad kısalır (ellipsis).
  - 4+ liste kümesi (`.tl-many`): ders satırı `tl-row two` + başta 36 px daire düğmesi (aşağıdaki `.srow` gibi).
- **Saati yok şeridi:** önce saatsiz dersler (eklenme sırası), sonra saatsiz aktiviteler. Ders satırı
  `<div class="tl-row srow">`: `.tl-st` 36×44 (sol -6 px) + `.tl-op` (ad, konu yok, sağda "30 dk" `.mn` mono 12,5 px
  `--study`, ⋯). Tamamlanınca ad üstü çizili. Aktivite satırları değişmez.
- **Boşluk** `.tl-gap` görünümü aynı; aria-label "13:00–15:00 boş, 2 saat. Bu aralığa ders ya da aktivite ekle".
- **Boş gün:** `.tl-empty` metni "Bugün saatli ders ya da aktivite yok · **tüm gün boş**" + altında
  `.add-study` "+ Ekle" (44 px) → boşluk sayfası, başlık "Ekle", başlangıç boş, Ders seçili.
- **Ders ⋯ → Düzenle (Bee'de):** aynı alt sayfa (§7) "Dersi düzenle" başlığıyla, Ders/Aktivite seçimi olmadan, ders
  formu dolu; ek alan Durum. Aktivite ⋯ → Düzenle de Bee'de alt sayfada açılır (EventForm `mode="edit"`), çünkü
  Bee kartında form alanı yok. Kapanınca odak bloğa döner (`data-id`).
- **Ekran okuyucu:** `.tl-st` "Matematik: Yapılacak. Dokununca Devam Ediyor olur." (To-do ile aynı metin);
  `.tl-op` "Matematik, ders, 15:00–15:40, 40 dakika, Yapılacak: seçenekler" (+ "kim ekledi" mevcut kural).
  Saatsiz: "Türkçe, ders, saati yok, 30 dakika, Tamamlandı: seçenekler". Durum değişince mevcut `aria-live` duyurusu.

### 5. To-do (Dersler)
Mevcut StudyCard listesi; değişenler:
- Sıra: saatliler başlangıca göre, sonra saatsizler eklenme sırasıyla.
- Sağ metin `.mins`: saatli `<b>15:00</b> · 40 dk` (saat `--ink` 600, gerisi `--study`), saatsiz "30 dk". Tek satır;
  360 px'te ad/konu sarar, süre metni kısalmaz.
- "+ Ders ekle" ve boş durum ("Bu gün için ders yok.", ders listesi boşken onboarding) aynı.
- Satır içi düzenleme formu yerine ders formu (§6) satırın yerinde açılır; ek alan Durum (mevcut select).

### 6. Ders formu (ekleme ve düzenleme; To-do'da kart içinde, Bee'de alt sayfada) `.sform`
Sıra: Ders (select, "Ders seç") → Konu (input, placeholder "Konu (isteğe bağlı)") → **Süre** → **Başlangıç | Bitiş**
→ özet → çakışma uyarısı → hata → eylemler. Tüm alanlar ≥ 44 px, yazı 16 px.
- Süre: etiket "Süre"; satır `.durrow` = `.evchips` "30 dk · 40 dk · 60 dk" + sağda 76 px dk alanı
  (`type=number inputMode=numeric`, aria-label "Dakika", mono, ortalı). Çip alanı doldurur; değer bir çipe eşitse çip
  `on` (`aria-pressed`). Çiplerin dokunma alanı mevcut `::before` ile 44 px.
- Başlangıç | Bitiş: `.evtimes.two` (iki eşit sütun, 10 px ara). Sol: "Başlangıç (isteğe bağlı)" + `TimeInput`.
  Sağ: "Bitiş" + `<output class="endout">` salt okunur (kesik kenar, `--bg` zemin, mono 16 px); başlangıç yoksa "–"
  (`--ink-faint`). Odaklanılamaz, ekran okuyucu özet satırından duyar.
- Özet `.evsum` (`aria-live="polite"`): saatli "Bitiş **13:40** · ajandada 13:00–13:40 görünür"; gece yarısını aşarsa
  "Bitiş **00:20** · ↷ ertesi gün biter"; saatsiz "Saat seçmezsen ders ajandada “Saati yok” bölümünde görünür."
- Çakışma `.evwarn` (role=status, engellemez): "⚠ Kurs (09:00–13:00) ile çakışıyor. Yine de ekleyebilirsin." Birden
  çoksa "⚠ Kurs (09:00–13:00) ve 1 kayıt daha ile çakışıyor. Yine de ekleyebilirsin." Ders + aktiviteye bakar,
  düzenlenen kayıt hariç.
- Hatalar (mevcut `.inline-error`, role=alert): "Ders seç.", "Süreyi dakika olarak gir (1-1440).", sunucu 400 metni.
- Eylemler `.frm-act`: "Ekle"/"Kaydet" (sarı, siyah yazı, 44 px) · "İptal" (`.btn-ghost`) · To-do eklemede sağda
  "Dersleri düzenle". Gönderilirken Ekle `disabled`.
- Düzenlemede başlangıç dolu; silinip kaydedilirse `startTime: ""` (ders saatsiz olur).

### 7. Boşluktan ekleme alt sayfası (Bee)
Mevcut `Sheet` (`.sheet.addsheet`: `top:auto; max-height:92vh`), başlık "13:00–15:00 arasına ekle", sağda "Kapat".
- Üstte `.seg` `role="radiogroup" aria-label="Ne eklemek istersin?"`: "Ders" · "Aktivite"; varsayılan **Ders**.
  Bu sayfada seçili seçenek **sarı zemin, siyah yazı** (`.addsheet .seg button.active{background:var(--honey);
  color:var(--ink)}`; marka kuralı), seg zemini `--surface`, düğme ≥ 44 px.
- Altında `.tl-pre` bilgi satırı "Boşluk: **13:00–15:00** · 2 sa" (Vazgeç düğmesi yok; Kapat yeterli).
- Ders: ders formu, başlangıç 13:00 dolu, süre boş (kullanıcı çip seçince bitiş görünür; önizlemede 40 dk → 13:40).
- Aktivite: Görev 09 tür ikonları; türe dokununca EventForm aynı sayfada açılır, saatler 13:00–15:00 dolu.
  Ders ↔ Aktivite geçişinde girilen başlangıç korunur.
- Başarılı eklemede sayfa kapanır, odak yeni bloğa gider; özet ve boşluklar yeniden hesaplanır.
- 360 px: Başlangıç ve Bitiş yan yana, çipler + dk tek satır (önizleme 4. sütun alt sıra).

### 8. Plan (Aktiviteler)
- Kartta üstte tür ikonları (mevcut `.evform .acts`, 6 sütun; dar konteynerde mevcut 3×2 kuralı). Dokununca EventForm
  ikonların altında, bugünkü gibi açılır. Bu kartta boşluk/çizelge yok, `prefill` yok.
- Altında alt başlık `.sub-lb` (mono 10,5 px büyük harf, `--ink-soft`, `.tl-untimed .lb` ile aynı stil; tek kural):
  bugün "Bugün", başka gün tam gün adı ("Pazartesi").
- Liste: `.entry` satırları: `.ico` 34 px (spor `--sport-soft`, diğer `--event-soft`, tür emojisi) · ad (`.subj`) ·
  sağda `.when` mono 13 px `--ink` "09:00–13:00" (bitişsiz "15:00", ↷ "21:00–00:30 ↷"), saatsiz "saati yok"
  (Figtree, `--ink-soft`) · ⋯ (44 px, EntryMenu). Sıra: saatliler başlangıca göre, sonra saatsizler.
- Boş: "Bu gün için aktivite yok." (`.empty-note`). Düzenle: form satırın yerinde (EventForm edit).
- aria-label: "Kurs, 09:00–13:00, 4 saat: seçenekler" (`ariaEvent`), saatsiz "Veteriner randevusu, saati yok: seçenekler".

### 9. Hafta ızgarası (WeekSheet)
- Saatli dersler `<i class="wg-b study">` (`background:var(--study)`), gerçek aralık, en az 8 px; **ikon ve saat
  metni yok**. Kümeleme/şerit (lane) aktivitelerle ortak (`weekColumn` dersleri de alır).
- Açıklama `.wg-leg` en başa: `<i class="lg-study">` "Ders (saatli)".
- Alt toplam: "Bu hafta 470 dk ders · 3 ders saatsiz · 3 gün spor · 7 aktivite" (saatsiz 0 ise o parça yok).
- "En uzun boşluk" ve sütun aria-label'ı dersleri hesaba katar: "… Matematik 15:00–15:40, ders; Kurs 09:00–13:00 …"
  (dersler başlangıca göre aktivitelerle karışık sırada; "ders" sözcüğü ayırt eder). Saatsiz ders sütunda okunmaz,
  toplamda sayılır. Mavi #2F5BD8 sütun zemini üzerinde ≥ 3:1.

### 10. Metinler (özet)
Seçici: Bee/Ajanda, To-do/Dersler, Plan/Aktiviteler · Özet: "8 sa 20 dk boş", "1/3 · 100 dk", "3 bugün" ·
Form: "Başlangıç (isteğe bağlı)", "Bitiş", "Bitiş 13:40 · ajandada 13:00–13:40 görünür", "Saat seçmezsen ders ajandada
“Saati yok” bölümünde görünür." · Sayfa: "13:00–15:00 arasına ekle", "Boşluk: 13:00–15:00 · 2 sa", "Ders", "Aktivite",
"Dersi düzenle" · Blok: "✓ tamam" · Plan: "Bugün", "saati yok" · Hafta: "Ders (saatli)", "3 ders saatsiz".

### 11. Erişilebilirlik ve kabul (tasarım)
- 360 ve 390 px'te yatay kaydırma yok; tüm dokunma alanları ≥ 44 px (sekme 52, daire 40×≥44, ⋯ 44, çipler 36+4+4).
- Ders bloğundaki iki düğme çakışmaz: daire alanı 40 px sütun, kalan alan ⋯ menüsü.
- Seçili sekme `aria-selected` ile duyurulur; renk tek başına bilgi taşımaz (ders = daire + "ders" + mavi şerit;
  tamam = ✓ + üstü çizili + "tamam").
- Çocuk profili aynı ekran; düzenleme/silme görünürlüğü mevcut canEdit kurallarıyla.

### Kullanılmayacak / silinecek
- StudyCard ve EventCard başlık karosu + başlık metni (EVENT_ICON, STUDY_ICON) bu ekranda kalkar.
- Eski `.addform` ders formu `.sform`'a geçince kullanılmayan `.addform*` kuralları silinsin (başka yerde kullanılmıyorsa).

---

## Frontend Çıktısı

### Dosyalar
- Yeni: `frontend/src/components/SectionTabs.jsx` (seçici, sekme yapısı, ←/→ Home/End), `AgendaCard.jsx` (Bee kartı),
  `AgendaSheet.jsx` (boşluktan Ders/Aktivite ekleme, "Dersi düzenle", "Aktiviteyi düzenle" alt sayfası), `StudyForm.jsx`
  (`.sform`: Süre çipleri + dk, Başlangıç | Bitiş, özet, çakışma uyarısı, Durum).
- Değişen: `pages/PlanShell.jsx` (bölüm durumu, açılışta ve bildirim mesajında Bee), `pages/DayPage.jsx` (seçici, tek kart,
  ders/aktivite işlemleri tek yerde → Bee ve To-do aynı kaynaktan), `components/Timeline.jsx` (ders bloğu: daire + seçenek
  düğmesi; Saati yok / 4+ küme / pencere dışı ders satırları; boş günde "+ Ekle"), `StudyCard.jsx` (To-do: özet + ilerleme,
  sıralama, "15:00 · 40 dk", satır içi düzenleme StudyForm), `EventCard.jsx` (Plan: tür ikonları + gün listesi),
  `EventForm.jsx` (`hidePre`, `onTimeChange`, çakışmada dersler), `WeekSheet.jsx` (ince mavi ders blokları, "Ders (saatli)",
  "N ders saatsiz"), `EntryMenu.jsx` (ders başlığında saat aralığı), `utils/timeline.js` (`studyItem`, `agendaItems`,
  `itemKey`, ders süresi = dakika, `clashText`), `utils/events.js`, `index.css` (Görev 10 bloğu; kullanılmayan `.addform*`,
  `.edit-form*`, `.icon-tile`, `.card-title`, `.card-sum`, `.evadd` silindi).

### Kabul kriterleri (yerel API + headless Chrome, 390/360 px; görüntüler /tmp/ptb-fe10-shots/)
1–6 ✓ (sıra Plan · To-do · Bee, açılış/yenileme/`?date=` Bee, gün değişince korunur, sekmeler 52 px, 360'ta kaydırma yok) ·
7–13 ✓ ("8 sa 20 dk boş", boşluklar, 13:00 + 40 dk eklenince "13:40–15:00 boş · 1 sa 20 dk", daire ↔ To-do senkron, okunuş
metinleri) · 14–19 ✓ (çakışma: "Kurs (09:00–13:00) ve 1 kayıt daha…", düzenlemede başlangıç silinince saatsiz) · 20–22 ✓ ·
23–25 ✓ · 26 ✓ · 27–28 backend · 29 ✓ (çocuk Ece: Bee açılır, salt okunur menü, baş harf yok) · 30 backend.
Ek: 07:00 öncesi, 22:00 sonrası/↷ ve aktiviteyle yan yana (n2) ders denendi.

### Sapmalar / sınırlamalar
- Seçicide tabpanel kartın kendisi; `aria-controls` yalnızca seçili sekmede (diğer paneller DOM'da yok).
- Sunucu 400 metni form içinde değil, mevcut bildirim (toast) ile gösterilir (useMutation akışı).
- Hafta şeridi değişmedi (tasarımda değişiklik yok). Aktivite formundaki çakışma metni "… ve N kayıt daha" oldu (dersler de sayılıyor).
- Bee sayfasında ders listesi boşsa formun üstünde bilgi satırı çıkar (ders adı To-do'dan eklenir).

---

## QA Sonuçları

Tarih: 2026-10-14 · Commit: `a4bb79a` · Sonuç: **QA: Onaylandı** (engelleyici hata yok). **Koşul:** backend testleri bu
ortamda çalıştırılamadı (aşağıda); Kabul 27, 28, 30 kod incelemesi ve e2e senaryosunun okunmasıyla doğrulandı. Canlıya
almadan önce `dotnet build` + `backend/tests/e2e.py` (245 kontrol) bir kez çalıştırılmalı.

### Çalıştırılanlar
- **Backend:** `dotnet` yok; .NET 10 SDK kurulumu (`dot.net/v1/dotnet-install.sh`) kurum ağ politikasınca engellendi
  (builds.dotnet.microsoft.com → 403). `dotnet build`, `dotnet test`, WebPushSelfTest ve e2e **çalıştırılamadı**.
  `python3 -m py_compile backend/tests/e2e.py` geçti. (Not: `backend/tests` altında `dotnet test` ile çalışan bir test
  projesi yok; testler `e2e.py` + `WebPushSelfTest` konsol uygulaması.)
- **Frontend:** `npm ci` geçti · `npm run build` VITE_API_URL olmadan bilinçli olarak durur (vite.config korumalı);
  `VITE_API_URL=... npm run build` geçti (hata/uyarı yok) · `npm run lint` (oxlint) **0 hata, 15 uyarı** (yeni
  dosyalarda `only-export-components`: SectionTabs.jsx:7,13,14, StudyForm.jsx:8,11, StudyCard.jsx:13, EventCard.jsx:12;
  engelleyici değil). Projede test script'i yok.
- **Tarayıcı testi:** Üretim derlemesi + `vite preview`, Backend Çıktısı sözleşmesini (startTime/endTime, PUT'ta
  null=koru, ""=sil, PATCH dokunmaz) taklit eden yerel sahte API, Playwright Chromium; 390 ve 360 px, ebeveyn ve çocuk
  profili, saat `2026-10-11 10:30` (bugün) ve `?date=2026-10-11` (geçmiş gün). Örnek gün QA verisiyle kuruldu.
- **Saf işlev simülasyonu:** `utils/timeline.js` örnek günle Node'da çalıştırıldı (boşluklar, özet, çakışma, hafta sütunu).

### Kriter bazında
| # | Sonuç | Kanıt |
|---|---|---|
| 1 | Geçti | Sekmeler soldan sağa Plan/Aktiviteler · To-do/Dersler · Bee/Ajanda (Sıra güncellemesine uygun); seçili zemin rgb(246,181,30), yazı rgb(30,26,20); tek `tabpanel` kart; DOM sırası hero → seçici → gün başlığı. |
| 2 | Geçti | İlk açılış, `?date=` ve yenilemede `aria-selected=true` → `sect-tab-bee`; ebeveyn ve çocuk (Ece) profilinde aynı. PlanShell.jsx:58 `useState('bee')`, kalıcı saklama yok (localStorage/sessionStorage'da bölüm anahtarı yok). |
| 3 | Geçti | To-do seçiliyken şeritten Pazartesi 5 Ekim'e geçildi → To-do korundu; yenileme → Bee. |
| 4 | Geçti | `/?date=2026-10-11` → "Pazar, 11 Ekim", Bee seçili, adres temizlendi. SW mesajında `setSection('bee')` (PlanShell.jsx:107). |
| 5 | Geçti | `role=tablist/tab/tabpanel`, `aria-selected`, roving tabIndex; ←/→ (uçlarda döner), Home/End çalışıyor, odak sekmede. Sekme yüksekliği 52 px; 360 px'te sekme 103 px, açıklamalar taşmıyor, `scrollWidth = 360`. |
| 6 | Geçti | Kart başlığı yalnız özet: "8 sa 20 dk boş", "1/3 · 100 dk", "3 bugün" (bugün) / "3 aktivite" (başka gün). |
| 7 | Geçti | Özet "8 sa 20 dk boş"; sıra: 07:00–09:00 boş · 2 sa, Kurs, 13:00–15:00 boş · 2 sa, Matematik 15:00–15:40 · 40 dk, Fizik 16:00–16:30 · 30 dk, 16:30–20:00 boş · 3 sa 30 dk, Antrenman. 15:40–16:00 ve 21:30–22:00 etiketsiz. |
| 8 | Geçti | Saati yok: Türkçe (✓, `line-through`, "30 dk") ve Veteriner randevusu. |
| 9 | Geçti | Ders bloğu `--study-soft` zemin + 4 px mavi iç şerit + daire + "ders" metni (aria); ikon yerine daire. |
| 10 | Geçti | Bee dairesi → To-do'da aynı durum; To-do dairesi → Bee'de aynı durum (tek kaynak `study.cycle`, DayPage.jsx). Blok gövdesi ⋯ menüsü (Düzenle/Sil); çocukta salt okunur menü. Daire 40×44 px. |
| 11 | Geçti | "13:00–15:00 arasına ekle", Ders seçili (sarı, 44 px), "Boşluk: 13:00–15:00 · 2 sa", başlangıç 13:00 dolu; 40 dk → Bitiş 13:40. Aktivite'ye geçişte saatler 13:00–15:00, Ders'e dönüşte 13:00 korunuyor. |
| 12 | Geçti | 13:00 + 40 dk eklenince "13:40–15:00 boş · 1 sa 20 dk", özet "7 sa 40 dk boş"; sayfa kapanıp odak yeni bloğa gidiyor. Düzenleme/silme de aynı `shown` verisinden yeniden hesaplanıyor. |
| 13 | Geçti | `.tl-op` aria: "Matematik, ders, 15:00–15:40, 40 dakika, Yapılacak: seçenekler" (tasarımdaki "Yapılacak" metni); daire: "Matematik: Yapılacak. Dokununca Devam Ediyor olur." |
| 14 | Geçti | Saatli + saatsiz tüm dersler listede; özet "1/3 · 100 dk", ilerleme çubuğu. |
| 15 | Geçti | "15:00 · 40 dk" / "30 dk"; sıra saatliler başlangıca göre, sonra saatsizler eklenme sırasıyla (StudyCard.jsx `sortStudies`). |
| 16 | Geçti | Form: Ders, Konu, Süre çipleri + dk, "Başlangıç (isteğe bağlı)", salt okunur Bitiş; "Bitiş 13:40 · ajandada 13:00–13:40 görünür". Gece aşımı: 23:50 + 40 → "Bitiş 00:30 · ↷ ertesi gün biter". |
| 17 | Geçti | Başlangıç boşken "Saat seçmezsen ders ajandada “Saati yok” bölümünde görünür."; POST gövdesi `startTime: ""`. |
| 18 | Geçti | 12:00 + 40 dk → "⚠ Kurs (09:00–13:00) ile çakışıyor. Yine de ekleyebilirsin."; Ekle çalıştı. Birden çok: "… ve 1 kayıt daha ile çakışıyor." |
| 19 | Geçti | Düzenlemede başlangıç 12:00 dolu; silinip kaydedilince PUT `startTime: ""`, ders "40 dk" (saatsiz) oldu. Bee "Dersi düzenle" alt sayfası Ders/Aktivite seçimi olmadan açılıyor. |
| 20 | Geçti | Spor, Müzik, Konser, Buluşma, Sınav, Diğer; Spor'a dokununca aktivite formu açılıyor. |
| 21 | Geçti | Kurs 09:00–13:00, Antrenman 20:00–21:30, Veteriner randevusu · saati yok; her satırda ⋯; ders yok. |
| 22 | Geçti | Bugün: "BUGÜN" (büyük harf CSS); başka gün: "PAZAR". |
| 23 | Geçti | `.wg-b.study` mavi (rgb(47,91,216)), ikon/saat metni yok, 8–11 px; açıklamada ilk öğe "Ders (saatli)". |
| 24 | Geçti | Saatsiz dersler ızgarada yok; alt toplam "… 180 dk ders · 2 ders saatsiz · …". |
| 25 | Geçti | Sütun adı "… Kurs 09:00–13:00; Fizik 13:00–13:40, ders; Matematik 15:00–15:40, ders; …"; saatsiz ders sütunda okunmuyor. En uzun boşluk dersleri sayıyor (örnek günde 13–20 yerine 16:30–20). |
| 26 | Geçti | `startTime: null` dersler To-do'da "30 dk", Bee'de Saati yok şeridinde. Migration yalnızca `AddColumn StudyEntries.StartTime varchar(5) NULL` / Down `DropColumn` (20261011161616_StudyEntryStartTime.cs); snapshot uyumlu. |
| 27 | Geçti (kod + e2e okuma; çalıştırılmadı) | DaysController.cs:129 `TryParseStartTime(dto.StartTime, entry.StartTime, …)`: null → mevcut korunur; PATCH status (DaysController.cs:143–157) StartTime'a dokunmuyor. e2e.py:588–595 bu durumları kapsıyor. Frontend düzenlemede `startTime` her zaman gönderiyor. |
| 28 | Geçti (kod; çalıştırılmadı) | NotificationService.cs:109 saatli "📚 Matematik · 15:00–15:40 · Konu", saatsiz değişmedi; ekleme/değişiklik/silme aynı `Study()` metnini kullanıyor. Bitiş tek yerde (`PlanText.StudyEndTime`). |
| 29 | Geçti | 360 ve 390 px'te üç bölümde `scrollWidth = innerWidth`; sekme 52, daire 40×44, ⋯ 44, seg 44; süre çipleri 36 px + `::before` −4/−4 = 44 (tasarım kuralı). Çocuk profilinde üç bölüm, durum değiştirme serbest, ebeveyn dersinde düzenle/sil yok. |
| 30 | Geçti (kod + e2e okuma; çalıştırılmadı) | Yetki `AuthorizeEntry` ile değişmedi; e2e.py:617–629 başka ailenin gün/hafta okumasında ders görmemesini ve PUT/PATCH 404'ü kapsıyor. |

### Bulunan hatalar
Engelleyici ya da kabul kriterini bozan hata bulunmadı. Düşük öncelikli gözlemler (düzeltme zorunlu değil):
1. **(Düşük, frontend)** 1440 dk saatli derste çizelge "10:00–10:00 ↷ ertesi gün", form özeti "Bitiş 10:00 · ↷ ertesi gün
   biter" gösteriyor; sunucu bu durumda `endTime: null` döndürüyor (Backend Varsayımlar: "tam gün"). Tekrar: To-do →
   + Ders ekle → dk 1440, başlangıç 10:00. Kaynak: `frontend/src/utils/timeline.js:53-56` (`span`), `StudyForm.jsx:47`.
2. **(Düşük, frontend)** 360 px'te 80 dk'lık boşluk etiketi "13:40–15:00 boş · 1 sa 20 / dk" iki satıra kırılıyor
   (Görev 09 boşluk düğmesi, `index.css:486`); kabul kriteri ihlali değil, görsel.
3. **(Bilgi, frontend)** oxlint 15 uyarı (yeni bileşen dosyalarından sabit/işlev dışa aktarımı); derlemeyi etkilemiyor.
