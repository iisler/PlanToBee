# Görev 15: Programı içe aktarma (Excel, CSV, fotoğraf)

Önceki görev: `docs/tasks/14-alt-menu.md`.

Durum: Tasarım: Önizleme hazır, onay bekliyor · Backend: Başlamadı · Frontend: Başlamadı · QA: Başlamadı

## Karar (kullanıcı, 03.11)
- Öğrenci ya da velinin Excel'de ya da kâğıtta hazırladığı haftalık program uygulamaya **toplu** yüklenir.
- Kaynaklar: **Excel (.xlsx) / CSV** ve **fotoğraf**.
- Fotoğraf **cihazda OCR** ile okunur (**Tesseract.js**, seçenek A). Fotoğraf sunucuya gitmez. Görev 13'teki "cihazda çöz"
  kararıyla aynı gerekçe: ücret yok, API anahtarı yok, aile verisi üçüncü tarafa gitmez.
- Yapay zekâ ile okuma (Claude vision, seçenek B) **şimdi yok**; ileride ücretli pakette isteğe bağlı olarak düşünülebilir.
  Akış buna hazır olmalı: kaynak ne olursa olsun çıktı aynı satır listesi ve aynı önizleme.
- Bağımlılık istisnası: kullanıcı Tesseract.js'i açıkça onayladı. Excel okuma için paket eklenmez (aşağıda).

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
     (varsayılan gelecek pazartesi, bugün pazartesiyse bugün) · **Her hafta, şu tarihe kadar** (varsayılan okul yılı sonu,
     en fazla başlangıç + 1 yıl) · **Art arda aynı dersi birleştir** (açık).
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
  - Hepsi tek transaction'da eklenir; bir öğe hatalıysa hiçbiri eklenmez, cevap `400` ve `{ errors: [{ index, message }] }`.
  - Başarıda `{ importId, series: SeriesDto[] }`.
  - Yetki: ekleyebilen profiller (tek aktivite eklemedeki kural); `RequireVerifiedEmail`; hız sınırı (yeni politika, ör.
    dakikada 5 istek).
- `DELETE /api/series/bulk/{importId}` — "Geri al": o içe aktarmada eklenen ve henüz düzenlenmemiş/ayrılmamış serileri siler.
  - `EventSeries`'e boş bırakılabilir `ImportId` (Guid?) sütunu; migration. Eski kod sütunu yazmaz, NULL kalır.
- Bildirimler: toplu eklemede her seri için ayrı bildirim gönderilmez; tek özet bildirim ("Deniz 17 aktivite ekledi").

## Kapsam dışı (bu görevde yok)
- Tarihli tek seferlik plan (ör. "12 Kasım 19:00 Matematik çalış") ve To-do'ya (StudyEntry) toplu ders yükleme.
  Gerekirse Görev 15b.
- PDF, Google Sheets bağlantısı, birden çok Excel sayfası seçimi.
- Yapay zekâ ile okuma (seçenek B).

## Açık sorular (kullanıcıya)
1. Okul ders programında her ders ayrı kayıt mı olsun (önizlemedeki gibi), yoksa günde tek "Okul 08:30–15:10" bloğu
   (dersler notta) mı? Ayrı kayıt ajandayı kalabalıklaştırabilir.
2. Program yükleme yalnızca ebeveyn profilinde mi açık olsun, çocuk profilinde de mi?

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
Statik maket (repoda değil): 1 · + menüsü, 2 · Kaynak seç, 3 · Fotoğraf okunuyor, 4 · Önizleme ve onay. Kullanıcı onayı
bekleniyor.
