# Görev 15: Programı içe aktarma (Excel, CSV, fotoğraf)

Önceki görev: `docs/tasks/14-alt-menu.md`.

Durum: Tasarım: Onaylandı · Backend: Tamamlandı · Frontend: Tamamlandı · QA: Ana oturum (aşağıda), telefonda denenmedi

## Karar (kullanıcı, 03.11)
- Öğrenci ya da velinin Excel'de ya da kâğıtta hazırladığı haftalık program uygulamaya **toplu** yüklenir.
- Kaynaklar: **Excel (.xlsx) / CSV** ve **fotoğraf**.
- Fotoğraf **cihazda OCR** ile okunur (**Tesseract.js**, seçenek A). Fotoğraf sunucuya gitmez. Görev 13'teki "cihazda çöz"
  kararıyla aynı gerekçe: ücret yok, API anahtarı yok, aile verisi üçüncü tarafa gitmez.
- Yapay zekâ ile okuma (Claude vision, seçenek B) **şimdi yok**; ileride ücretli pakette isteğe bağlı olarak düşünülebilir.
  Akış buna hazır olmalı: kaynak ne olursa olsun çıktı aynı satır listesi ve aynı önizleme.
- Bağımlılık istisnası: kullanıcı Tesseract.js'i açıkça onayladı. Excel okuma için paket eklenmez (aşağıda).

- **15b (kullanıcı, 03.11):**
  - Program yükleme **her profilde** açık (ebeveyn ve çocuk). Yetki tek seri eklemedeki gibi: herkes ekler, çocuk yalnızca
    kendi eklediğini değiştirir/geri alır.
  - Okul ders programında **her ders ayrı kayıt** (önizlemedeki gibi). Art arda aynı ders tek kayıt olur ("2 ders saati").

- **15c (kullanıcı, 03.11):** Önizlemede yalnızca **Başlangıç** ve **Bitiş** ("Her hafta, şu tarihe kadar" kalktı).
  - Bitiş varsayılanı **bir hafta** (başlangıç + 6 gün): program bir kez eklenir. Başlangıç değişince bitiş de kayar
    (bitiş elle seçilmediyse).
  - Kullanıcı başka bitiş seçebilir (iki haftalık program, dönem boyu); aralık bir haftadan uzunsa program her hafta tekrar
    eder ("5 Kasım – 18 Kasım (2 hafta, her hafta tekrar)"). En fazla 1 yıl.
  - Aralık bir haftadan kısaysa aralığa düşmeyen günün kayıtları soluk görünür ("Seçilen tarihlerde Pazartesi yok ·
    eklenmez") ve eklenmez.

## Kullanıcı hikâyeleri
- Veli olarak, okulun verdiği ders programı Excel'ini yükleyip bütün yılın okul saatlerini tek seferde eklemek istiyorum.
- Öğrenci olarak, kâğıda yazdığım haftalık programın fotoğrafını çekip uygulamaya aktarmak istiyorum.
- Kullanıcı olarak, eklemeden önce okunanları görüp düzeltmek, hatalı satırı kaldırmak ve yanlışlıkla eklediğimi tek
  dokunuşla geri almak istiyorum.

## Akış (önizleme: 4 ekran)
1. **+ menüsü:** Plan · To-do · **Program yükle** ("Excel, CSV ya da fotoğraf", bal sarısı yükleme ikonu).
2. **Kaynak seç** (alt panel, "Program yükle"):
   - **Excel ya da CSV** → dosya seçici (`accept=".xlsx,.csv"`).
   - **Fotoğraf** → `accept="image/*"` (telefonda kamera ya da galeri).
   - 🔒 "Dosya ve fotoğraf telefonunda okunur, sunucuya gönderilmez."
   - "Nasıl hazırlamalı?": ızgara örneği + liste örneği; **Örnek ders programı** ve **Örnek liste** (CSV) indirme.
3. **Fotoğraf okunuyor:** fotoğraf küçük resmi, ilerleme çubuğu ve yüzde; "İlk kullanımda Türkçe metin tanıma dosyası
   indirilir"; çekim ipucu; **Vazgeç** OCR'ı durdurur (worker sonlandırılır).
4. **Önizleme:**
   - Özet: dosya adı · kayıt sayısı · "⚠ N kontrol et".
   - Ayarlar: **Tür** (Okul / Aktivite; ızgarada varsayılan Okul, listede satırdaki tür ya da Aktivite) · **Başlangıç**
     (varsayılan bugün) · **Bitiş** (varsayılan bir hafta, 15c). Art arda aynı ders her zaman birleşir.
   - Günlere göre gruplu satırlar: saat aralığı (mono) · ad · × kaldır. Satıra dokununca düzenlenir (gün, başlangıç,
     bitiş, ad).
   - Sorunlu satır sarı zeminde, nedeni yazılı: "Saat okunamadı", "Gün bulunamadı", "'ingilizce' okundu · doğru mu?"
     (ailenin ders listesine yakın ama birebir olmayan ad).
   - Alt sabit: **Vazgeç** · **"N kaydı ekle"** (bal sarısı). Altında: "Saati eksik X kayıt eklenmez · Her şey 'Geri al' ile
     tek seferde silinebilir".
5. **Ekle:** tek istek; bitince panel kapanır, bildirim: "17 kayıt eklendi" + **Geri al**.

## Ayrıştırma (`frontend/src/utils/importSchedule.js`)
Bütün kaynaklar aynı ara biçime çevrilir: `{ day: 1..7, start: 'SS:dd' | null, end: 'SS:dd' | null, title, kind?, issue? }`.
- **Excel okuma, paketsiz:** .xlsx bir zip'tir. Tarayıcının `DecompressionStream('deflate-raw')` ile küçük bir zip okuyucu
  yazılır; `xl/sharedStrings.xml` ve `xl/worksheets/sheet1.xml` `DOMParser` ile okunur. Birden çok sayfa varsa ilk sayfa
  (ileride seçim). Excel'in saat değeri (gün kesri, ör. 0,354 = 08:30) SS:dd'ye çevrilir. Birleştirilmiş hücreler
  (`mergeCells`) ilk hücrenin değeriyle doldurulur.
- **CSV:** ayırıcı `,` ya da `;` (Türkçe Excel `;` kaydeder) otomatik; tırnaklı alanlar; UTF-8 BOM ve Windows-1254
  (Türkçe karakter bozuksa 1254 ile yeniden çözülür).
- **Biçim tanıma:**
  - **Izgara:** başlık satırında en az 2 gün adı → sütunlar gün, ilk sütun saat ("08:30", "08:30-09:10", iki satırlı hücre).
  - **Liste:** başlıkta Gün / Başlangıç / Bitiş / Ad / Tür sütunları (sıra serbest, büyük-küçük harf ve Türkçe karakter
    duyarsız) ya da başlıksız `Gün, Başlangıç, Bitiş, Ad[, Tür]`.
- **Gün adları:** Pazartesi, Pzt, Pts, P.tesi, Salı, Sal, Çarşamba, Çar, Çrş, Perşembe, Per, Prş, Cuma, Cum, Cumartesi,
  Cmt, Pazar, Paz; Türkçe karakterli ve karaktersiz yazımlar (Carsamba, Persembe).
- **Saat:** 8:30, 08.30, 8,30, 830 → 08:30; aralık "08:30-09:10", "08:30 – 09:10", "8.30/9.10". Bitiş yoksa ızgarada bir
  sonraki dersin başlangıcı değil, boş bırakılır (Plan'da bitişsiz aktivite).
- **Birleştirme:** aynı gün, aynı ad ve arası en fazla 15 dk olan ardışık satırlar tek kayıt (başlangıç ilk, bitiş son).
- **Boş / "-" / "Öğle arası" / "Teneffüs"** hücreleri atlanır.
- **Fotoğraf (OCR):** Tesseract `tur` diliyle satır satır metin; her satır `quickAdd.js` saat ve gün çözücüleriyle okunur.
  Gün adı tek başına olan satır sonraki satırların günüdür ("Pazartesi" başlığı). Tablo fotoğrafında sütunlar
  kelime konumlarından (bbox x) gün başlıklarına göre atanır. Okunamayan parça satırı `issue` ile gelir, atılmaz.
- **Ad düzeltme:** ailenin ders listesindeki adla büyük-küçük harf / Türkçe karakter farkı varsa listedeki ad kullanılır;
  1–2 harf farkı (Levenshtein ≤ 2) varsa öneri olarak sorulur. Kısaltmalar (Mat, Fen Bil., İng) listeyle eşleşirse açılır.
- Üst sınır: 200 satır. Aşılırsa "En fazla 200 kayıt yüklenebilir" ve ilk 200 gösterilir.

## Tesseract.js
- Yalnızca Fotoğraf seçilince **dinamik import** ile yüklenir (ana paket büyümez).
- Worker, çekirdek (wasm) ve `tur.traineddata` **kendi sunucumuzdan** verilir (`frontend/public/ocr/`), CDN'e istek
  atılmaz (Capacitor'da çevrimdışı da çalışır, gizlilik notu doğru kalır). İlk indirmeden sonra tarayıcı önbelleğinde.
- Fotoğraf okumadan önce cihazda küçültülür (uzun kenar en fazla 2000 px) ve griye çevrilir.
- Güven puanı düşük (< 60) kelimeler satırı `issue` yapar.

## Backend
- `POST /api/series/bulk` — gövde `{ items: AddSeriesDto[] }` (en fazla 200).
  - Her öğe `SeriesController.Create` ile aynı kurallarla doğrulanır (ortak doğrulama bir yardımcıya taşınır).
  - Hepsi tek transaction'da eklenir; bir öğe hatalıysa hiçbiri eklenmez, cevap `400` ve
    `{ code: "bulk_invalid", message, items: [{ index, message }] }`.
  - Başarıda `{ importId, series: SeriesDto[] }`.
  - Yetki: ekleyebilen profiller (tek aktivite eklemedeki kural); `RequireVerifiedEmail`; hız sınırı (yeni politika, ör.
    dakikada 5 istek).
- `DELETE /api/series/bulk/{importId}` — "Geri al": o içe aktarmada eklenen ve profilin değiştirebildiği serileri siler.
  - `EventSeries`'e boş bırakılabilir `ImportId` (Guid?) sütunu; migration. Eski kod sütunu yazmaz, NULL kalır.
- Bildirimler: toplu eklemede her seri için ayrı bildirim gönderilmez; tek özet bildirim ("Deniz 17 aktivite ekledi").

## Kapsam dışı (bu görevde yok)
- Tarihli tek seferlik plan (ör. "12 Kasım 19:00 Matematik çalış") ve To-do'ya (StudyEntry) toplu ders yükleme.
  Gerekirse Görev 15b.
- PDF, Google Sheets bağlantısı, birden çok Excel sayfası seçimi.
- Yapay zekâ ile okuma (seçenek B).

## Uygulama (tasarımdan sapmalar)
- **Birleştirme anahtarı yok:** art arda aynı ders her zaman birleşir (ekran sade kalsın; ayrı istenirse satır düzenlenir).
- **Başlangıç varsayılanı bugün** (gelecek pazartesi değil). Bitiş varsayılanı bir hafta (15c), en fazla başlangıç + 1 yıl.
- **Geri al:** o yüklemede eklenen ve profilin değiştirebildiği serilerin hepsi silinir (sonradan düzenlenmiş olsa da).
  Ayrılmış günler normal aktivite olduğundan kalır.
- **Tür:** ızgarada satırda tür yoksa önizlemedeki Tür seçimi (Okul / Diğer, varsayılan Okul). Listede: tür sütunu, yoksa
  bilinen ders adı → Okul, anahtar kelime (yüzme → Spor, piyano → Müzik), o da yoksa Diğer. Satırdan değiştirilebilir.
- **Sorunlu satır:** "Gün bulunamadı", "Ad yok", "Saat okunamadı", "Bitiş saati başlangıçtan önce" eklenmez (sarı, dokununca
  düzenlenir). "… okundu · X mi?" ve "Okunuşu belirsiz" eklenir, yalnızca uyarıdır; öneri düğmesi adı düzeltir.
- **+ Kayıt ekle:** önizlemede elle satır eklenebilir.
- **Örnek dosyalar** istemcide CSV olarak üretilir (sunucu dosyası yok).

### Dosyalar
- Backend:
  - `Controllers/SeriesController.cs`: `POST /api/series/bulk` (en fazla 200, tek transaction, satır bazlı hata
    `400 { code: "bulk_invalid", message, items: [{ index, message }] }`, yükleme başına tek bildirim),
    `DELETE /api/series/bulk/{importId}` (`{ deleted }`, idempotent; değiştirilebilen seri yoksa 403).
  - `Models/EventSeries.cs` `ImportId` (Guid?), indeks; migration `SeriesImportId`.
  - `Infrastructure/RateLimitPolicies.cs`: `import` politikası (kullanıcı başına dakikada 10, `RateLimits:Import`).
  - `DTOs/SeriesDtos.cs`: `BulkAddSeriesDto`, `BulkAddSeriesResultDto`, `BulkErrorDto`, `BulkDeleteResultDto`.
- Frontend:
  - `components/ImportSheet.jsx` (panel: kaynak seç → okunuyor → önizleme), `components/TabBar.jsx` (+ menüsünde üçüncü
    seçenek), `pages/PlanShell.jsx` (panel, "N kayıt eklendi · Geri al").
  - `utils/sheetFile.js`: paketsiz .xlsx (zip + XML; ilk sayfa, paylaşılan metin, saat biçimli hücre, birleştirilmiş hücre)
    ve CSV (`;` `,` sekme; UTF-8 / Windows-1254).
  - `utils/importSchedule.js`: ızgara / yan yatmış ızgara / liste tanıma, gün ve saat çözme, ders adı düzeltme (aile listesi
    + yaygın ders adları, kısaltma, 1–2 harf öneri), birleştirme, satır denetimi, `/series/bulk` gövdesi.
  - `utils/ocr.js`: Tesseract.js (dinamik import), fotoğraf küçültme + gri ton + kontrast, PSM 3 (otomatik bölümleme),
    Tesseract satırlarından tablo (eğik fotoğrafta da), gün başlıklarına göre sütun yerleşimi.
  - `utils/quickAdd.js`: `guessKind` dışa açıldı.
  - `vite.config.js`: `/ocr/` dosyaları (worker, LSTM çekirdekleri, `tur.traineddata.gz` best_int) node_modules'tan
    sunulur / `dist/ocr`'a kopyalanır. Yeni paketler: `tesseract.js@7.0.0`, `@tesseract.js-data/tur@1.0.0`.
  - `index.css`: "Program yükleme" bölümü.

## QA (ana oturum, 03.11)
Yerel PostgreSQL + API + Vite, Chromium (390 ve 360 px, dokunmatik). Konsolda uygulama hatası yok (Tesseract'ın
"Estimating resolution" günlüğü dışında).
- [x] API: hatalı satırda hiçbir şey eklenmez, `items` doğru sıra; boş liste 400; 201 kayıt 400; başarıda hafta okumasında
      seriler görünür; `DELETE bulk` hepsini siler, ikinci çağrı `deleted: 0`.
- [x] Okul programı .xlsx (birleştirilmiş başlık, iki saate birleştirilmiş "Matematik" hücresi, "-" ve boş hücre, "Mat",
      "Fen Bil.", "Bilişim" kısaltmaları): 25 kayıt, kısaltmalar açıldı, art arda dersler birleşti; eklendi, Gün ve hafta
      şeridinde görünür.
- [x] Liste .xlsx (Excel saat biçimli hücreler, tür sütunu kısmen boş): türler doğru (Spor, Müzik, Okul).
- [x] Windows-1254 kodlu, `;` ayırıcılı CSV: Çarşamba / Perşembe doğru.
- [x] Fotoğraf (1,5° eğik basılı tablo, JPG): 16 kaydın hepsi doğru gün ve saatte; yalnızca kendi sitemizden istek
      (`/ocr/worker.min.js`, `/ocr/tesseract-core-relaxedsimd-lstm.wasm.js`, `/ocr/tur.traineddata.gz`), API'ye yalnızca
      `/series/bulk`.
- [x] Fotoğraf (el yazısı benzeri satır listesi, gün başlıkları ayrı satırda): 4 kaydın 4'ü doğru; biri "kontrol et".
- [x] Sorunlu satır düzenlenip eklendi; "Geri al" yüklemeyi sildi, şerit sayıları geri döndü.
- [x] 360 px'te yatay kaydırma yok.
- [x] 15c: varsayılan 3–9 Kasım; 5–7 Kasım seçilince Pzt/Sal/Çar kayıtları "eklenmez" (12 / 25); 5–18 Kasım "2 hafta,
      her hafta tekrar", 25 seri `StartDate 2026-11-05`, `UntilDate 2026-11-18` ile eklendi.
- [ ] iPhone Safari'de kamera/galeri seçimi, gerçek kâğıt ve gerçek el yazısı fotoğrafı denenmeli (el yazısında başarı
      düşük olabilir; önizleme düzeltmeye izin verir).
- [ ] Ana ekrana eklenmiş uygulamada örnek CSV indirme davranışı denenmeli.

## Kabul kriterleri
- [ ] + menüsünde "Program yükle" var; panel 390 ve 360 px'te yatay kaydırmasız.
- [ ] Örnek ders programı (ızgara) ve örnek liste (CSV) indirilip hiç değiştirilmeden yüklenince bütün satırlar sorunsuz okunur.
- [ ] Türkçe Excel'den `;` ayırıcılı ve Windows-1254 kaydedilmiş CSV doğru okunur (ş, ğ, İ bozulmaz).
- [ ] Birleştirilmiş hücreli ve iki satırlı saat hücreli okul programı okunur.
- [ ] Fotoğraf: düzgün çekilmiş, bilgisayarda yazılmış programda satırların en az %90'ı sorunsuz okunur; okunamayanlar sarı
      satır olarak görünür, atılmaz.
- [ ] Fotoğraf ve dosya sunucuya gönderilmez (ağ sekmesinde yalnızca `/api/series/bulk` ve OCR dosyaları, kendi alanımızdan).
- [ ] Vazgeç OCR'ı durdurur; panel kapanınca worker kapanır.
- [ ] Önizlemede satır düzenlenir ve kaldırılır; sorunlu satır düzeltilmeden eklenmez; düğmedeki sayı doğru.
- [ ] Ekle tek istek atar; hata olursa hiçbir şey eklenmez ve satır bazlı hata önizlemede gösterilir.
- [ ] Geri al o yüklemede eklenen bütün serileri siler.
- [ ] Eklenen seriler Gün, Hafta ve ajandada tekrarlı aktivite olarak görünür; tek tek düzenlenebilir ("yalnızca bu gün" /
      "tüm tekrarlar").
- [ ] Dokunma alanları ≥ 44 px, yazı alanları ≥ 16 px, sorun rengi yanında metin var, düğmelerin aria-label'ı var.

## Önizleme
Statik maket (repoda değil): 1 · + menüsü, 2 · Kaynak seç, 3 · Fotoğraf okunuyor, 4 · Önizleme ve onay. Kullanıcı onayladı
(03.11).

## Tasarım İncelemesi (03.11)
Gerçek uygulamada 360 ve 390 px, bütün durumlar (+ menüsü, kaynak, hata, okunuyor, ızgara / liste önizleme, satır düzenleme,
yeni kayıt, tarih dışı, uyarılı ve hatalı satır, klavye odağı, eklendi bildirimi) ekran görüntüsüyle incelendi. Düzeltilenler:
1. **Önizleme başlığı:** "‹ Geri" sağdaydı (kapat düğmesinin yerinde). Geri oku sola alındı; sağdaki düğme kalktı (altta Vazgeç var).
2. **Tarih dışı günler:** "Seçilen tarihlerde Pazartesi yok · eklenmez" her satırda tekrar ediyordu. Artık gün başlığında bir
   kez yazar; satırlar soluk.
3. **Tarih aralığı bilgisi** alt satırdan tarihlerin altına taşındı: "1 hafta", "2 hafta · her hafta tekrar eder", "3 gün ·
   yalnızca Sal, Çar, Per". Alt satır tek satır kaldı: yalnızca eklenmeyenler ya da "Geri al" ipucu.
4. **Başlangıç ve Bitiş alanları** farklı genişlikteydi; eşitlendi (168 px), dokunma yüksekliği 44 px, odak halkası eklendi.
5. **Satır düzenleme:** "Bitiş (isteğe bağlı)" iki satıra bölünüp Bitiş alanını aşağı itiyordu; tek satır. Tür listesindeki
   "Okul (seçili tür)" dar ekranda kesiliyordu; ayrı seçenek kalktı, liste doğrudan "🏫 Okul" gösterir.
6. **Hatalı ve uyarılı satır** aynı görünüyordu. Eklenmeyecek satır: sarı zemin + solda koyu sarı şerit. Yalnızca uyarı: zeminsiz.
7. **Ad önerisi:** "\"ingilizse\" okundu · İngilizce mi?" + "İngilizce" düğmesi dar ekranda 3 satıra taşıyordu. Artık
   "⚠ İngilizce mi?" + **Evet** (ekran okuyucuda "Adı İngilizce yap").
8. **Klavye odağı:** satırın odak halkası liste kutusunda kırpılıyordu; halka içe alındı.
9. **Kaynak ekranı:** örnek satır ("Salı · 17:00 · 18:30 · Yüzme") ortadan bölünmüyor; indirme düğmelerinde ⬇ yerine çizgi ikon.
10. **Okunuyor:** indirme boyutu yanlıştı (~2 MB → yaklaşık 6 MB); yüzde düz rakamla (mono "0" Ø gibi görünüyordu).
11. **Program olmayan dosya** (günü ve saati olmayan satırlar) önizlemeye bütünüyle hatalı satırlarla geliyordu; artık
    kaynak ekranında "program bulunamadı" uyarısı çıkar.

Kontrast: uyarı metni (--warn) sarı zeminde ~5:1, soluk satır (--ink-faint) yüzeyde ~5:1. Yatay kaydırma yok.
Açık kalan (öneri): aynı program iki kez yüklenirse kayıtlar çift olur; önizlemede "zaten planda" uyarısı düşünülebilir.
