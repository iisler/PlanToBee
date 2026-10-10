# Görev 07: Tek ekran plan (sekmesiz) ve sadeleştirme

Önceki görev: `docs/tasks/06-bildirimler.md`.

Durum: Tasarım: Tamamlandı · Ürün: Düzeltmeyle onaylandı (Frontend başlayabilir; "Ürün Onayı" bölümündeki düzeltmeler dahil) · Backend: Tamamlandı (değişiklik yok) · Frontend: Tamamlandı · Tasarım İncelemesi: Başlamadı · QA: Başlamadı

---

## Özellik Özeti

"Gün" ve "Hafta Planı" sekmeleri kalkıyor; tek bir plan ekranı kalıyor. Üstte siyah hafta alanında şerit var; her gün
hücresinde ders sayacı ve aktivite ikonları görünüyor. Altında seçili günün Çalışma Planı ve Aktiviteleri yer alıyor.
Haftanın tamamı görünür "📅 Hafta" düğmesiyle açılan bir alt sayfada. Ders satırları sadeleşiyor: durum dairesi ve ⋯ menüsü.
Kullanıcı bu tasarımı onayladı (`/tmp/ptb-ux-preview/20-son-oneri.png`).

Maketler (repoda değil):
- `/tmp/ptb-ux-preview/20-son-oneri.png`: onaylanan son hâl: Gün (ebeveyn), Hafta paneli, ⋯ menüsü, çocuk, 360 px
- `/tmp/ptb-ux-preview/19-serit-ikon-siniri.png`: şerit ikon sınırı ölçümleri (2 ikon ve 3 ikon, 390/360 px)
- `/tmp/ptb-ux-preview/13-once-sonra-ekleme-ve-menu.png`: "+ Ders ekle" formunun açık hâli
- Tek tek kareler: `/tmp/ptb-ux-preview/mock/S1-gun-390.png`, `S2-hafta-390.png`, `S3-menu-390.png`,
  `S4-cocuk-390.png`, `S5-gun-360.png`. HTML kaynakları ve CSS aynı klasörde (`gen4.py`, `mk.css`).

Değişmeyenler: Aktiviteler kartının ikon sırası ve ekleme biçimi (🏅 Spor · 🎵 Müzik · 🎤 Konser · 👥 Buluşma · 📝 Sınav ·
✦ Diğer), renkler, fontlar, ad menüsü, Ailem ve Bildirimler sayfaları, PushPrompt, silmede "Geri al" bildirimi,
bildirimden gelen `?date=` derin bağlantısı ve service worker mesajı (`plantobee:open`). Backend değişmez.

---

## Tasarım

### 1. PlanShell (kabuk) — `pages/PlanShell.jsx`
- **Kalkanlar:**
  - `.viewtabs` (Gün / Hafta Planı).
  - `view === 'week'` ve `WeekPage` importu.
  - `plantobee:view` ve `weekMode` tercihleri. Okunmaz; eski anahtarların silinmesi isteğe bağlı.
- **Görünümler:** `view` yalnızca `'plan' | 'family' | 'notifications'`. "‹ Plana dön" her zaman plana döner.
- **Haftalık veri:**
  - Şerit ve Hafta paneli seçili haftanın ayrıntılı verisini kullanır: mevcut `GET /days/week/{pzt}/details`, tek istek.
  - Her gün için türetilen değerler:
    - `done` = `status==='done'` olan ders sayısı
    - `total` = ders sayısı
    - `minutes` = ders dakikalarının toplamı
    - `events` = sunucu sırasıyla aktivite listesi
  - Her ekleme, değiştirme, silme ve durum değişikliğinden sonra yenilenir (bugünkü `loadWeek` gibi).
  - Mevcut `GET /days/week/{pzt}` özeti yeterli değilse kullanılmaz.
- **`?date=` ve `plantobee:open`:** bugünkü gibi `currentDate` olarak ayarlanır; şerit o tarihin haftasını gösterir.

### 2. Hero ve şerit — `DayPage.jsx` + `WeekTrail.jsx`
- **Kalkanlar:**
  - Gün okları (`.datenav`).
  - Büyük gün adı.
  - `StatsBar` (bileşen ve `.stats` CSS'i silinir).
  - Alttaki `.note` metni.
- **Başlık satırı** (`.dayhero` içinde, flex, gap 6 px, alt boşluk 8 px):
  - Solda hafta aralığı: Bricolage 800, 18 px, `white-space: nowrap`.
    - Aynı ay: "5 – 11 Ekim"; iki ay: "28 Eyl – 4 Eki".
    - Yıl yalnızca içinde bulunulan yıldan farklıysa yazılır: "29 Ara 2026 – 4 Oca 2027".
  - Sağda sırasıyla:
    - ‹ ve › düğmeleri: 44×44, kenarlık 1 px `--hero-line`, köşe 11 px, `aria-label` "Önceki hafta" / "Sonraki hafta".
    - "📅 Hafta" düğmesi: yükseklik 44, yatay iç boşluk 12 px, kenarlık 1 px `--honey`, metin `--honey`, 14 px 700.
      📅 `aria-hidden`. `aria-haspopup="dialog"`, `aria-label` "Haftanın tamamını gör".
  - Hafta okları seçili günü ±7 gün kaydırır (haftanın aynı günü).
  - 360 px'te satır 304 px'e sığar; sığmazsa başlık 16 px'e iner, düğmeler küçülmez.
- **"Bugüne dön":** yalnızca seçili hafta bugünün haftası değilse, şeridin altında ortalanmış görünür.
  - Yükseklik 44, zemin `--honey`, metin `--ink`, 13,5 px 700.
  - Bugün seçilir. Bu haftadayken (başka bir gün seçili olsa bile) gösterilmez.
- **Şerit:** `.trail` ızgarası `grid-template-columns: repeat(7, minmax(0, 1fr))` (bugünkü `1fr`, içerik genişleyince
  taşıyor; 19 numaralı görsel). Hücre (`.trail-dot`, mevcut düğme):
  - Sıra: gün kısaltması (mevcut `.wk`) → gün numarası (mevcut `.num`) → ders sayacı → ikon satırı.
    `min-height` 76 px, gap 4 px, padding 6 px 0.
  - Renkli noktalar (`.pips`, `.pip`) kalkar; CSS'leri silinir.
  - **Ders sayacı:**
    - JetBrains Mono 10 px, "done/total" ("2/3", "10/12").
    - Hepsi tamamsa `--honey`, değilse `--hero-soft`. Ders yoksa "–".
    - Seçili hücrede `--ink`.
  - **İkon satırı:**
    - Gösterim: 2 ya da daha az aktivite varsa hepsi; 3 ya da daha fazlaysa ilk ikon + "+N" (N = kalan sayı).
    - Ölçü: ikon 14 px emoji, 15 px genişlikte kutu (inline-grid, ortalı), aralar 1 px.
    - Açık zemin: koyu hücrede `--hero-ink`, seçili hücrede `--surface`; köşe 6 px, yükseklik 18 px, iç boşluk 0 2 px.
    - "+N": JetBrains Mono 10 px, 600, `--ink`.
    - Aktivite yoksa satır boş kalır (yükseklik korunur, hücreler hizalı kalır).
    - İkon `kindInfo(kind).icon`; eski "Etkinlik" kayıtları ✦.
  - **Seçili ve bugün:** seçili gün `--honey` zemin, `--ink` yazı (mevcut). Bugün seçili değilse 1 px `--hero-line`
    çerçeve (mevcut).
  - **Yükleniyor:** hücreler gün adı ve numarasıyla hemen çizilir; sayaç ve ikon yerleri boş kalır (yükseklik sabit).
  - **Haftalık veri hatası:** şerit boş sayaçlarla kalır. Gün kartlarının kendi hata/yeniden dene akışı değişmez.
- **Gün başlığı** (hero'nun altında, kartların üstünde, `h2`, `tabIndex=-1`):
  - Biçim: "Cumartesi, 10 Ekim". Yıl farklıysa "…, 10 Ekim 2027".
  - Bricolage 800, 20 px; kenar boşluğu 4 px 4 px 10 px.
  - Bugünse yanında "bugün" etiketi: zemin `--honey`, metin `--ink`, 11 px 600, hap.

### 3. Hafta paneli (alt sayfa) — yeni `components/WeekSheet.jsx` (+ ortak `components/Sheet.jsx`)
- **`Sheet` (ortak alt sayfa):** ⋯ menüsü de kullanır.
  - Katman: `position: fixed; inset: 0`, `rgba(30,26,20,.45)`.
  - Sayfa: alttan açılır, köşe 18 px 18 px 0 0, `--bg` zemin (menüde `--surface`), en üstte 36×4 px tutamak (`--line-strong`).
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = sayfa başlığı.
  - Açılınca odak başlığa ya da ilk düğmeye gider. Tab içeride döner (odak tuzağı).
  - Esc, "Kapat"/"Vazgeç" ve katmana dokunmak kapatır. Kapanınca odak açan düğmeye döner.
  - Açıkken arka plan kaymaz (`body` overflow kilidi). Hafta paneli için `prefers-reduced-motion`'da animasyon yok.
- **Hafta paneli:** üstten 90 px boşluk bırakır, içerik kendi içinde kayar.
  - **Başlık satırı:** `h3` "Bu hafta · 5 – 11 Ekim" (başka haftada yalnızca aralık), Bricolage 18 px. Sağda "Kapat"
    düğmesi (44×44 en az).
  - **Satırlar:** 7 gün, her biri tam genişlik düğme, min-height 50 px; mevcut `.card` görünümü (zemin `--surface`,
    kenarlık `--line`, köşe `--radius`), aralar 6 px.
    - Solda gün kısaltması (mono 10 px, büyük harf) ve numarası (Bricolage 20 px 800).
    - 1. satır kalın: "2/3 ders · 100 dk", ders yoksa "Ders yok".
    - 2. satır `--ink-soft` 12,5 px: "🏅 Yüzme 10:00 · 🎤 Okul konseri 15:00 · ✦ Veteriner randevusu" (saat mono 12 px;
      saati olmayanda yalnızca ad). Aktivite yoksa "Aktivite yok". Uzun satır sarar, kırpılmaz.
    - Sağda "›" (`aria-hidden`).
  - **Bugün:** satır `--ink` kenarlık + solda 4 px `--honey` iç gölge (mevcut `.weekcard.today` görünümü);
    1. satırın başına "Bugün · " eklenir.
  - **Seçili gün:** `aria-current="date"` yalnızca bugünde; seçili gün için görsel ek yok.
  - **Satıra dokununca:** o gün seçilir, panel kapanır, sayfa en üste kayar (`scrollTo(0,0)`), odak gün başlığına (`h2`)
    gider.
  - **Alt bilgi:** ortalı 12 px `--ink-soft` "Bu hafta 360 dk ders · 3 gün spor · 5 aktivite". Hafta boşsa
    "Bu hafta henüz plan yok."
  - **Yükleniyor:** panel açılır, satırların yerinde `Loading` (HoneycombSpinner).
  - **Hata:** mevcut `.load-error` + "Tekrar dene".

### 4. Çalışma Planı kartı — `components/StudyCard.jsx`
- **Kalkanlar:**
  - `.hint` ("Rozete dokunarak…").
  - Satırdaki durum rozeti (`.status-badge`).
  - ✎ ve × düğmeleri.
  - `.swatch`.
  - Satırdaki tam metin AuditTag ("Sen ekledin").
  - `ReadOnlyMark` kilidi.
  - Her zaman açık ekleme formu.
  - Kartın altındaki "✎ Dersleri düzenle" bağlantısı (forma taşınır, aşağıda).
- **Kart başlığı:** sağdaki toplam "1/3 · 100 dk" (JetBrains Mono 12 px, `--ink-soft`, hap değil). Ders yoksa gösterilmez.
- **Satır** (min-height 56 px, alt çizgi `--line`):
  - **Durum dairesi:** soldaki düğme 44×44, sol kenar −8 px.
    - Görünüm: içte 24 px daire, kenar 2 px.
    - Yapılacak: kenar `--ink-faint` (kart zemininde 5,3:1), içi boş.
    - Devam Ediyor: kenar `--warn`, sol yarısı `--warn` dolu.
    - Tamamlandı: `--study` dolu, beyaz ✓ (13 px 700).
    - Dokununca `nextStatus`. Ailedeki herkes değiştirebilir (çocuk dahil, canlıda).
    - `aria-label`: "{Ders}: {Durum}. Dokununca {Sonraki durum} olur.", örn. "Türkçe: Devam Ediyor. Dokununca Tamamlandı olur."
  - **Orta:** ders adı (15 px 600; tamamlanınca üstü çizili, `--ink-soft`), konu (12,5 px `--ink-soft`).
  - **Kim ekledi:** yalnızca başkasının eklediği kayıtta, adın yanında mevcut `AuditTag compact` (18 px baş harf dairesi,
    `.audit-initial`). Çocuk profilinde (`user.profile.role === 'Child'`) hiç gösterilmez.
  - **Sağ:**
    - Süre: "40 dk", mono 13 px 500, `--study`, hap değil.
    - ⋯ düğmesi: 44×44, sağ kenar −10 px, `--ink-soft`, 20 px. `aria-label` "{Ders}: seçenekler",
      `aria-haspopup="dialog"`.
- **Yeni ders sırası:** satır sırası sunucunun sırası (değişmez).
- **Boş gün:** "Bu gün için ders yok." (mevcut `.empty-note`), altında "+ Ders ekle".
- **"+ Ders ekle":**
  - Düğme: yükseklik 44, zemin `--honey`, metin `--ink`, 14 px 700, köşe `--radius-sm`, üst boşluk 10 px.
  - Dokununca yerinde form açılır, düğme gizlenir. Form 2 sütun (1fr 88px), gap 8 px, üst çizgi `--line`:
    1. satır: "Ders seç" select (tam genişlik).
    2. satır: "Konu (isteğe bağlı)" ve "dk" (`inputMode="numeric"`).
    3. satır: "Ekle" (honey) + "İptal" (ghost) + sağda metin düğmesi "Dersleri düzenle" (mevcut `.manage-toggle`;
       mevcut ders listesi panelini, yani ekle/sil, formun altında açar).
  - Bütün alanlar en az 16 px ve 44 px yükseklik.
  - Hata metinleri bugünkü gibi `.inline-error`.
  - Başarılı eklemede form açık kalır; konu ve dk temizlenir, ders seçimi korunur, odak dk alanına gider.
    "İptal" formu kapatır, odak "+ Ders ekle"ye döner.
  - Ders listesi boşsa: mevcut "Önce derslerini ekle" önerileri değişmeden kalır ("+ Ders ekle" yerine).
- **Düzenleme:** ⋯ → "Düzenle", satırın yerinde mevcut `.edit-form` açılır (ders, konu, dk, durum, Kaydet/İptal; değişmez).

### 5. ⋯ menüsü — yeni `components/EntryMenu.jsx` (Sheet kullanır, `--surface` zemin, iç boşluk 8 16 24 px)
- **Başlık** (`h3`, Bricolage 17 px):
  - Ders için "Türkçe · 30 dk".
  - Aktivite için "Yüzme · 10:00" (saat yoksa yalnızca ad; eski spor süresi varsa "· 1 sa 30 dk").
- **Alt metin** (12,5 px `--ink-soft`), parçalar " · " ile birleşir:
  - konu ya da not (varsa)
  - ders durumu ("Devam Ediyor")
  - mevcut AuditTag tam metni ("Ayşe ekledi", "Sen ekledin", "İlker düzenledi")
  - zaman damgası ("9 Eki 20:14"; mevcut alan varsa)
- **Öğeler:** tam genişlik, min-height 48 px, üst çizgi `--line`, 15 px 600, sola dayalı:
  "Düzenle" · "Sil" (`--danger`) · "Vazgeç" (`--ink-soft`).
- **Sil:** onay sorulmaz. Mevcut iyimser silme + "Geri al" bildirimi; menü kapanır.
- **Salt okunur kayıt** (`canEdit === false`):
  - "Düzenle" ve "Sil" yok. Alt metnin altında "Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir."
    ve "Vazgeç".
  - Durum dairesi yine çalışır (yalnızca dersler).

### 6. Aktiviteler kartı — `components/EventCard.jsx`
- **Değişmeyenler:** kart başlığı, ikon kutusu (`.ico`), ad, not ve ikon sırasıyla ekleme formu (`EventForm`) aynı kalır.
- **Satır:**
  - ✎ ve × kalkar, yerine ⋯ (44×44; aynı EntryMenu).
  - Saat sağda, mono 13 px (spor `--sport-deep`, diğerleri `--event-deep`), hap değil.
  - Kim ekledi: dersteki kuralın aynısı (compact baş harf; çocukta yok).
  - `ReadOnlyMark` kalkar; salt okunurluk menüde anlatılır.
- **Düzenle:** satırda mevcut `EventForm mode="edit"` açılır.
- **Boş gün:** "Bu gün için aktivite yok." (metin kısalır), ikon satırı altında.

### 7. WeekPage'in akıbeti
- **Silinenler:**
  - `pages/WeekPage.jsx` dosyasının tamamı (`WeekTable`, `WeekDayCard`, `EventChip`, `.wkadd` ekleme çubuğu, Tablo/Liste).
  - `components/StatsBar.jsx`.
  - Kullanılmıyorsa `components/EditEventDialog.jsx` ve `ReadOnlyMark.jsx`.
- **Yeniden kullanılacaklar:**
  - `eventChipText` / `eventLabel` / `eventMeta` mantığı Hafta paneli satırı için. Gerekirse `utils/events.js`'e taşınır.
  - `patchWeek` / `removeFromWeek` gerekmez (paneldeki veri salt okunur).
- **CSS (`index.css`), kullanılmayanlar silinir:**
  - `.viewtabs`, `.weeknav`, `.weekbar`, `.modetoggle`, `.wkadd*`, `.wktable*`, `.weekcard*`, `.chip*` (başka yerde yoksa)
  - `.stats*`, `.datenav*`, `.pips`/`.pip`, `.status-badge*`, `.hint`, `.note` (başka kullanım yoksa),
    `.entry .swatch`, `.entry .del/.edit`
  - Yeni sınıflar mevcut değişkenlerle yazılır; yeni renk eklenmez.

### 8. Durumlar özeti

| Durum | Görünüm |
|---|---|
| Gün yükleniyor | Hero ve şerit görünür, kartların yerinde `Loading` |
| Gün yüklenemedi | Mevcut `.load-error` "Gün yüklenemedi: …" + "Tekrar dene" |
| Boş gün | "Bu gün için ders yok." + "+ Ders ekle"; "Bu gün için aktivite yok." + ikonlar |
| Boş hafta | Bütün hücrelerde "–" ve ikon yok; panel satırlarında "Ders yok / Aktivite yok", altta "Bu hafta henüz plan yok." |
| Çocuk profili | Baş harf yok; durum dairesi bütün derslerde çalışır; başkasının kaydında ⋯ menüsü salt okunur |
| Salt okunur kayıt | Satır aynı görünür, ⋯ menüsünde açıklama metni |
| Uzun metin | Ders adı, konu, aktivite adı sarar (`overflow-wrap: anywhere`); süre ve saat sarmaz; ⋯ sabit |
| Başka hafta | "Bugüne dön" görünür; panel başlığı yalnızca aralık |

### 9. Metinler
- **Yeni metinler:**
  - "📅 Hafta", "Haftanın tamamını gör", "Bugüne dön", "Bu hafta · {aralık}", "Kapat"
  - "Ders yok", "Aktivite yok", "Bu hafta henüz plan yok."
  - "+ Ders ekle", "Dersleri düzenle", "Düzenle", "Sil", "Vazgeç"
  - "Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir."
  - "Bu gün için ders yok.", "Bu gün için aktivite yok."
- **Kural:** durum adları değişmez: Yapılacak → Devam Ediyor → Tamamlandı.

### 10. Erişilebilirlik
- **Şerit hücresi `aria-label`:**
  - Örnekler: "Cumartesi 10 Ekim, bugün: 3 dersten 1'i tamam; Yüzme 10:00, Okul konseri 15:00, Veteriner randevusu",
    "Cuma 9 Ekim: plan yok".
  - Seçim `aria-pressed`, bugün `aria-current="date"`.
- **Şerit renk ve yazı:** sayaç ve ikonlar görsel; renk tek başına bilgi taşımaz (tamamlanma "2/2" yazıyla da var).
- **Odak halkası:** hero ve alt sayfa koyu katman üzerinde `--honey` (mevcut `.dayhero :focus-visible` kuralı yeni
  düğmeleri kapsamalı). Kartlarda `--ink`.
- **Alt sayfalar:** Bölüm 3'teki odak tuzağı, Esc ve kapanınca odağın geri dönmesi.
  iPhone'da dokunulan düğmeye odak verilmez; odak geri verme `ref` ile yapılır.
- **Erişilebilir adlar:** bütün düğmelerin anlamlı adı var. Durum değişince ekran okuyucuya
  mevcut bildirim/aria-live ile "{Ders}: Tamamlandı" duyurulur.

---

## Kabul Kriterleri
1. Plan ekranında sekme yok. Ad menüsü, Ailem, Bildirimler ve "‹ Plana dön" çalışıyor.
2. 360 ve 390 px'te (ebeveyn ve çocuk profili, örnek hafta) `document.documentElement.scrollWidth` viewport'tan büyük değil.
3. Şeritte en kötü durum, yani 5 aktiviteli, "10/12" dersli, seçili gün: 360 px'te ikon satırı hücreye sığıyor, yan
   hücreye taşmıyor, 7 hücre eşit genişlikte.
4. 3 ya da daha fazla aktiviteli günde hücrede ilk ikon ve "+N" görünüyor; 1–2 aktivitede ikonların hepsi. Renkli noktalar yok.
5. Ders sayacı "done/total" doğru. Hepsi tamamsa sarı, ders yoksa "–". Seçili hücrede siyah.
6. ‹ › haftayı değiştiriyor, seçili gün haftanın aynı günü oluyor. "Bugüne dön" yalnızca başka haftadayken görünüyor ve bugünü seçiyor.
7. `?date=YYYY-MM-DD` ile açılınca o gün seçili, şerit o haftayı gösteriyor. Uygulama açıkken bildirime dokununca da aynı.
8. "📅 Hafta" panelinde 7 gün; her satırda "x/y ders · z dk" ya da "Ders yok" ve aktivitelerin adı ve saati var.
   Güne dokununca panel kapanıyor, o gün seçiliyor, sayfa en üstte ve odak gün başlığında.
9. Panel ve ⋯ menüsü Esc, Kapat/Vazgeç ve arka plana dokunmakla kapanıyor. Açıkken Tab dışarı çıkmıyor,
   arka plan kaymıyor, kapanınca odak açan düğmeye dönüyor.
10. Ders satırında yalnızca durum dairesi, ad, konu, süre ve ⋯ var; ✎, × ve kilit yok. Daire Yapılacak → Devam Ediyor →
    Tamamlandı döngüsünde ilerliyor. Tamamlanan ders mavi dolu daire ve ✓, adı üstü çizili.
11. Çocuk profili ebeveynin eklediği dersin durumunu değiştirebiliyor. Çocuk profilinde baş harf görünmüyor.
    Ebeveynde yalnızca başkasının kaydında baş harf var. "Sen ekledin" satırlarda hiç yok, yalnızca ⋯ menüsünde.
12. ⋯ → Düzenle yerinde düzenleme açıyor. Sil kaydı siliyor ve "Geri al" çalışıyor. Salt okunur kayıtta Düzenle ve Sil
    yok, açıklama metni var.
13. "+ Ders ekle" formu açıyor; ekleme sonrası form açık kalıyor, dk temizleniyor. İptal formu kapatıyor.
    "Dersleri düzenle" ders ekleyip silebiliyor. Ders listesi boşken öneri kutusu görünüyor.
14. Ekranda ipucu ya da not metni yok ("Rozete dokunarak…", "Hafta Planı sekmesinden…").
15. Bütün dokunulabilir öğeler en az 44×44 px: ‹ ›, 📅 Hafta, Bugüne dön, şerit hücresi, durum dairesi, ⋯, menü öğeleri,
    panel satırları, + Ders ekle. Yazı alanları en az 16 px (iPhone'da yakınlaşma yok).
16. Aktiviteler kartının ikon sırası ve ekleme formu önceki gibi; satırlarda ⋯ ile düzenle/sil çalışıyor.
17. Ekleme, silme ya da durum değişikliğinden sonra şerit ve panel güncelleniyor (sayfa yenilemeden).
18. `WeekPage.jsx` ve `StatsBar.jsx` silinmiş; `index.css`'te kullanılmayan kural yok.
    `npm run build` uyarısız, e2e (backend) etkilenmiyor.
19. Yeni npm paketi, dış font ya da ikon yok.

## Dokunulacak dosyalar (frontend-developer)
`pages/PlanShell.jsx`, `pages/DayPage.jsx`, `pages/WeekPage.jsx` (silinir), `components/WeekTrail.jsx`,
`components/StudyCard.jsx`, `components/EventCard.jsx`, `components/StatsBar.jsx` (silinir), yeni `components/Sheet.jsx`,
`components/WeekSheet.jsx`, `components/EntryMenu.jsx`, `utils/events.js`, `utils/format.js` (gerekirse), `index.css`.

---

## Ürün Onayı

**Karar: Düzeltmeyle onaylandı.** Tasarım, kullanıcının verdiği kararların hepsiyle tutarlı: tek ekran, şeritte en fazla 2 ikon
ve "+N", "📅 Hafta" paneli (güne dokununca kapanıp o günü açıyor), ⋯ menüsü, durum dairesi, "+ Ders ekle", ipuçlarının ve renkli
noktaların kalkması, haftalık toplamın panele taşınması, çocukta baş harfin gizlenmesi ve çocuğun ebeveynin dersini işaretlemesi.
Frontend aşağıdaki düzeltmelerle başlayabilir. Tasarım bölümü değişmedi; düzeltmeler burada.

### Açıkça onaylanmamış küçük kararlar
1. **Ders eklendikten sonra formun açık kalması: Onaylandı.** Hafta tablosu ve `.wkadd` çubuğu kalktığı için toplu planlama
   artık "gün seç → art arda ekle" akışıyla yapılacak. Formun açık kalması bu kaybı karşılıyor. Gün değiştirilince ne olacağı
   tasarımda yazmıyordu; D1'de karara bağlandı.
2. **"Dersleri düzenle"nin forma taşınması: Onaylandı.** Ders listesi seyrek değişiyor; ekleme sırasında ihtiyaç doğduğu için
   formun içinde olması mantıklı. Ders listesi boşken öneri kutusu kaldığı için yeni kullanıcı yolunu bulabiliyor.
3. **Salt okunur kayıtta kilidin kalkıp açıklamanın ⋯ menüsüne geçmesi: Metin düzeltmesiyle onaylandı (D2).** Çocuk ekranında
   kayıtların çoğu ebeveynin. Her satırda kilit olması kalabalık yaratıyor, ayrıca "hiçbir şey yapamazsın" gibi görünüyor.
   Oysa çocuk durumu değiştirebiliyor.

### Düzeltmeler (frontend-developer uygular, ux-ui-designer inceler)
- **D1. Form açıkken gün değişmesi:** "+ Ders ekle" formu açıkken şeritten, ‹ › ile, "Bugüne dön" ile ya da Hafta panelinden
  başka bir gün seçilirse form açık kalır. Ders seçimi korunur, konu ve dk alanlarına dokunulmaz. Sonraki "Ekle" yeni seçili güne
  ekler. "Ekle" düğmesinin erişilebilir adı hedef günü içerir: "Cumartesi 10 Ekim gününe ekle". Görünür metin "Ekle" olarak
  kalır, çünkü hedef gün başlığı (`h2`) ve seçili şerit hücresi aynı ekranda.
- **D2. Salt okunur açıklama metni** (⋯ menüsü, `canEdit === false`):
  - Derste: "Durumu daireye dokunarak değiştirebilirsin. Düzenleme ve silme yalnızca ekleyen kişi ya da bir ebeveyn içindir."
  - Aktivitede tasarımdaki metin aynen kalır: "Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir."
  - Bölüm 9'daki metin listesine bu ders metni de eklenir.
- **D3. Açık katmanlar ve derin bağlantı:** Hafta paneli ya da ⋯ menüsü açıkken `plantobee:open` mesajı gelirse önce açık katman
  kapanır, sonra o gün seçilir. Ailem ya da Bildirimler görünümündeyken gelirse plan görünümüne geçilir.
- **D4. Çift gönderim:** "Ekle" ve menüdeki "Sil", istek sürerken ikinci kez tetiklenmez. Hızlı çift dokunuş iki kayıt eklemez.
- **D5. Eski haftanın geç gelen yanıtı:** ‹ › hızlıca art arda basılırsa önceki haftanın geç gelen yanıtı şeridin ve panelin
  üzerine yazılmaz. Ekranda her zaman son seçilen haftanın verisi görünür.
- **D6. Haftalık toplamın anlamı** (Varsayım): Panel altındaki "Bu hafta 360 dk ders", tamamlanan değil **planlanan** derslerin
  dakika toplamıdır. "3 gün spor", en az bir Spor aktivitesi olan gün sayısıdır. "5 aktivite", haftadaki bütün aktivitelerin
  sayısıdır (Spor dahil).

### Kullanıcı Hikayeleri (ürün tarafından eklendi)
- **H1. Ebeveyn haftayı planlar:** Ebeveyn olarak haftanın günlerine sırayla ders eklemek istiyorum. Böylece Hafta tablosu
  olmadan da haftayı birkaç dakikada planlayabilirim. (Şeritte gün seç → "+ Ders ekle" → art arda ekle → başka gün seç → devam.)
- **H2. Çocuk günlük kullanımda işaretler:** Çocuk olarak bugünün derslerini tek dokunuşla Devam Ediyor ya da Tamamlandı
  yapmak istiyorum. Böylece ebeveynimin eklediği planı da takip edebilirim, kim eklediğiyle uğraşmam.
- **H3. Bildirimden ilgili güne gelirim:** Bildirime dokunduğumda uygulama hangi görünümde olursa olsun ilgili günün planı
  açılsın. O gün başka haftadaysa şerit o haftayı göstersin.
- **H4. Haftalar arasında gezinirim:** Geçen ya da gelecek haftaya bakıp tek dokunuşla bugüne dönebilmek istiyorum.
- **H5. Tek profilli kullanıcı:** Ailesinde başka üye olmayan bir kullanıcı olarak ekranımda "kim ekledi" işaretleri ya da salt
  okunur kısıtlar görmek istemiyorum. Her kaydımı düzenleyip silebilmeliyim.

### Ek Kabul Kriterleri
20. **D1:** Form açıkken şeritte başka bir güne geçilince form açık kalıyor ve ders seçimi korunuyor. Sonraki "Ekle" kaydı yeni
    seçili güne ekliyor, önceki güne eklemiyor. Bu, sunucudan dönen veride ve şerit sayacında doğrulanır.
21. **Toplu planlama:** Ebeveyn, sayfa yenilemeden ve Hafta tablosu olmadan Pzt–Cum günlerinin her birine 2 ders ekleyebiliyor.
    Sonunda şeritte her gün "0/2" görünüyor, panelde de her gün için "0/2 ders · {toplam} dk" yazıyor.
22. **D2:** Çocuk profilinde, ebeveynin eklediği bir dersin ⋯ menüsünde Düzenle ve Sil yok. Durum açıklama metni var.
    Menü kapandıktan sonra aynı dersin dairesine dokunulunca durum değişiyor ve kaydediliyor (sayfa yenilenince de korunuyor).
23. **D3:** Hafta paneli açıkken, ⋯ menüsü açıkken ve Ailem ya da Bildirimler görünümündeyken bildirime dokunulunca (ya da
    `plantobee:open` gelince) katman kapanıyor, plan görünümünde ilgili gün seçili oluyor ve şerit o günün haftasını gösteriyor.
24. **Derin bağlantı (Varsayım, mevcut davranış korunur):** `?date=` geçersiz bir tarihse (`2026-13-40`, boş) uygulama hata
    vermeden bugünü açıyor.
25. **D4:** "Ekle"ye hızlıca iki kez dokunulunca tek kayıt ekleniyor. Menüde "Sil"e iki kez dokunulunca tek silme oluyor ve
    tek "Geri al" bildirimi çıkıyor.
26. **D5:** ‹ düğmesine hızlıca 3 kez basılınca şerit ve panel 3 hafta önceki veriyi gösteriyor. Arada başka haftanın sayaçları
    kalıcı olarak görünmüyor. Bu, ağ yavaşlatılarak (DevTools "Slow 4G") test edilir.
27. **H5:** Tek profilli kullanıcıda hiçbir satırda baş harf görünmüyor. Her kaydın ⋯ menüsünde Düzenle ve Sil var, ayrıca
    "Sen ekledin" alt metni çıkıyor.
28. **Eski tercih:** Tarayıcıda eski `plantobee:view=week` ya da `weekMode` değeri kayıtlıyken uygulama açılınca plan ekranı
    hatasız açılıyor ve konsolda hata görünmüyor.
29. **Haftalık veri hatası:** Hafta ayrıntı isteği başarısız olunca şerit "–"/boş sayaçlarla kalıyor ve gün kartları
    çalışmaya devam ediyor. Hafta paneli açılınca "Tekrar dene" görünüyor, dokununca veri geliyor.
30. **D6:** Panel alt bilgisindeki dakika, haftadaki bütün derslerin (durumu ne olursa olsun) dakika toplamına eşit. Spor gün
    sayısı ve aktivite sayısı örnek haftada elle sayılan değerle aynı.
31. **Ekran okuyucu:** Durum dairesine dokununca ekran okuyucu "{Ders}: {Yeni durum}" duyuruyor (VoiceOver ile doğrulanır).
    Şerit hücresinin okunan adı Bölüm 10'daki biçimde.
32. **Kabul kriteri 5'in netleştirilmesi:** "Sarı" `--honey`, "siyah" `--ink` demek. Testte hesaplanan renk bu değişkenlerin
    değeriyle karşılaştırılır.
33. **Kabul kriteri 13'ün netleştirilmesi:** Başarılı eklemeden sonra konu ve dk boşalıyor, ders seçimi korunuyor ve odak dk
    alanına gidiyor.

### Kaybedilen işlevler ve karşılıkları
| Eski işlev | Yeni karşılığı | Değerlendirme |
|---|---|---|
| Hafta tablosu ile toplu planlama | Şeritte gün seçimi + açık kalan form (D1, KK 20–21) | Kabul. Ekleme başına dokunuş sayısı biraz artıyor ama her gün tek ekranda. |
| `.wkadd` ekleme çubuğu (herhangi bir güne ekleme) | Aynı akış | Kabul. |
| Hafta Planı'ndaki "Güne git" | Panel satırına dokunma (KK 8) | Karşılanıyor. |
| StatsBar haftalık özet | Panel alt bilgisi (D6) | Karşılanıyor. Özet artık bir dokunuş uzakta; kullanıcı kararı. |
| Tablo/Liste görünüm tercihi | Yok | Kabul (kullanıcı kararı: tek ekran). |

### Riskler
- **Yanlış güne ekleme:** Form açıkken gün değiştirmek kolaylaştığı için kullanıcı farkında olmadan başka güne ekleyebilir.
  Gün başlığı ve şerit seçimi bunu azaltıyor; silmede "Geri al" var. Canlıda şikâyet gelirse formda hedef gün etiketi eklenir.
- **Keşfedilebilirlik:** "Dersleri düzenle" ve salt okunur açıklaması artık bir dokunuş içeride. Yeni kullanıcı için öneri
  kutusu kalıyor; risk düşük.
- **Alışkanlık değişikliği:** Hafta Planı sekmesine alışmış ebeveyn sekmeyi arayabilir. "📅 Hafta" düğmesi görünür ve sarı
  çerçeveli; ek duyuru gerekmez (Varsayım).
- **İstek sayısı:** Her değişiklikten sonra hafta ayrıntısı yeniden çekiliyor (bugünkü `loadWeek` gibi). Yeni bir yük yok, ama
  D5'teki eski yanıt sorunu gözden kaçarsa yanlış sayaç görünür.
- **Emoji görünümü:** İkon genişliği cihazın emoji fontuna bağlı. 19 numaralı ölçüm 2 ikonda 360 px'te 5 px pay bırakıyor.
  Android'de (Noto Color Emoji) KK 3 ayrıca doğrulanmalı.

### Backend Gereksinimleri
**Backend değişikliği gerekmez.** Gerekçesi:
- Şerit ve Hafta paneli, mevcut `GET /days/week/{pzt}/details` ucunun döndürdüğü verilerden türetiliyor: ders durumu, dakika,
  aktivite türü, adı ve saati. Bunlar bugün WeekPage'in kullandığı alanlar.
- Ekleme, düzenleme, silme ve durum değiştirme mevcut uçlarla yapılıyor. Çocuğun ebeveynin dersini Tamamlandı işaretleyebilmesi
  zaten canlıda (son commit: "Çocuk, ebeveynin eklediği dersi Tamamlandı işaretleyebilir").
- `canEdit` ve "kim ekledi" (audit) alanları gün verisinde zaten var. Rol bilgisi `user.profile.role` ile alınıyor.
- Bildirim derin bağlantısı (`?date=`, `plantobee:open`) değişmiyor.
- **Tek koşul:** Frontend geliştirici, ayrıntı ucunun aktivite saatini ve ders durumunu her gün için döndürdüğünü ilk adımda
  doğrular. Bir alan eksikse iş durdurulmaz, ürün yöneticisine bildirilir ve backend için ayrı istek açılır. Backend e2e
  testleri bu görevde değişmez (KK 18).

## Backend Çıktısı

**Değişiklik yok.** Kod, şema, migration ve e2e değişmedi. `GET /api/days/week/{pzt}/details` ana ekranın tek veri kaynağı
olarak olduğu gibi kullanılabilir.

**Doğrulanan alanlar** (`DaysController.GetWeekDetails` → `LoadDaysAsync` / `LoadAuditAsync` / `ToDayDto`):
- Yanıt `{ days: [7 × { date, studyEntries, events }] }`. Her zaman 7 gün döner, kayıtsız gün boş listelerle gelir.
  Biçim `GET /api/days/{date}` ile aynıdır.
- Ders: `id, subject, topic, minutes, status ("todo"|"inprogress"|"done"), canEdit, createdBy {memberId, displayName,
  isFormerMember} | null, createdAt, updatedBy, updatedAt, isImported`. Sıra eklenme sırasıdır (Id).
- Aktivite: `id, kind, title, time, note, trainingType, minutes, canEdit, createdBy, createdAt, updatedBy, updatedAt,
  isImported`. Sıra: önce saatliler saate göre, sonra saatsizler eklenme sırasıyla.
- Eski antrenman kayıtlarında `title` boş olabilir; ad `trainingType`'tan türetilir (mevcut kural).

**Ölçüm** (plantobee_e2e, yerel; 7 gün × 4 ders + 3 aktivite, kayıtlar ebeveyn ve çocuk tarafından eklenmiş):
- Yanıt yaklaşık 15,5 KB. Süre: medyan 3,1 ms, p95 3,8 ms (50 istek; ebeveyn ve çocuk profili aynı).
- İstek başına SQL (EF günlüğü), toplam 6 sorgu, her biri 0–1 ms. Çocuk profilinde profil sorgusuyla birlikte 7 olur:
  - kullanıcı (e-posta doğrulama)
  - sahip profili
  - Days
  - StudyEntries
  - Events
  - audit üyeleri (tek `ANY(@ids)`)
- Sorgular AsNoTracking ve split query ile çalışır. N+1 yok, kartezyen çarpım yok. Kullanılan indeksler
  `(FamilyId, Date)` (benzersiz) ve `DayId`.
- Hız sınırı: kullanıcı başına dakikada 300 istek. Her değişiklikten sonra yeniden çekmek bu sınırın çok altında kalır.

**Bilinen sınırlama:** Split query'deki ayrı `Days` sorgusu kaldırılabilir; bu, istek başına bir veritabanı gidiş-dönüşü
kazandırır. Ölçülen süreler bunu gerektirmediği için yapılmadı. Canlıda (Render ↔ Neon) yavaşlık görülürse ilk
bakılacak yer burası.

---

## Frontend Çıktısı

**Durum:** Tamamlandı. `npm run build` (VITE_API_URL=https://example.invalid/api) uyarısız; oxlint'te yeni uyarı yok (kalan 7 uyarı
değişmeyen dosyalarda). Backend e2e (yerel API) 110 geçti, 0 kaldı. Veri doğrulaması: `GET /days/week/{pzt}/details` 7 günün
DayDto'sunu (ders `status`, `minutes`, `canEdit`, audit; aktivite `kind`, `title`, `time`, `note`, `trainingType`, `minutes`) döndürüyor;
eksik alan yok.

### Değişen / eklenen / silinen dosyalar (yalnızca `frontend/src`)
- **Yeni:** `components/Sheet.jsx` (ortak alt sayfa: portal, odak tuzağı, Esc/katman/Kapat, `body` kilidi, `#root` inert, odak
  `returnFocusRef` ile geri), `components/WeekSheet.jsx` (Hafta paneli), `components/EntryMenu.jsx` (⋯ menüsü).
- **Değişen:** `pages/PlanShell.jsx` (görünüm `plan|family|notifications`; hafta ayrıntısı tek istek + istek kimliği (D5); eski
  `plantobee:view`/`weekMode` silinir; `?date=` geçersiz tarih doğrulaması; `plantobee:open` → katmanları kapat + plana geç (D3)),
  `pages/DayPage.jsx` (hero başlık satırı, hafta okları, "Bugüne dön", gün başlığı `h2`, Hafta paneli; "+ Ders ekle" formunun durumu
  burada tutulur (D1); haftalık veride gün varsa beklemeden gösterilir), `components/WeekTrail.jsx` (sayaç + ikon satırı, `aria-label`),
  `components/StudyCard.jsx` (durum dairesi, ⋯, "+ Ders ekle" formu, "Dersleri düzenle" form içinde, aria-live duyuru, çift gönderim
  koruması), `components/EventCard.jsx` (⋯ menüsü, saat sağda), `components/AuditTag.jsx` (compact = yalnızca başkasının baş harfi,
  çocukta yok), `context/AuditContext.js` (`hideInitials`), `utils/format.js` (`weekRangeLabel`, `dayTitle`, `withPossessive`),
  `utils/events.js` (`daySummary`, `weekTotals`, `eventWithTime`), `index.css` (yeni kurallar; kullanılmayanlar silindi).
- **Silinen:** `pages/WeekPage.jsx`, `components/StatsBar.jsx`, `components/EditEventDialog.jsx`, `components/ReadOnlyMark.jsx`.

### Kabul kriterleri (headless Chrome, 390 ve 360 px, ebeveyn / çocuk / tek profil)
| # | Durum | Not |
|---|---|---|
| 1 | Geçti | Sekme yok; ad menüsü, Ailem, Bildirimler, "‹ Plana dön" çalışıyor. |
| 2 | Geçti | Ebeveyn, çocuk, en kötü hafta, açık form ve panelde scrollWidth = viewport (360/390). |
| 3 | Geçti | Pzt: 10/12 + 5 aktivite, seçili, 360 px: 7 hücre 40 px, ikon satırı 33 px, hücre içinde. |
| 4 | Geçti | 3+ aktivitede "🏅+2"/"🏅+4", 1–2'de hepsi; `.pip` yok. |
| 5 / 32 | Geçti | Sayaçlar doğru; tamamsa `--honey` (rgb 246,181,30), seçili `--ink`, diğer `--hero-soft`; ders yoksa "–". |
| 6 | Geçti | ‹ › ±7 gün (aynı gün); "Bugüne dön" yalnızca başka haftada, bugünü seçiyor, odak gün başlığına. |
| 7 | Geçti | `?date=2026-10-14` o gün/hafta; `plantobee:open` mesajı (uygulama açıkken) aynı. |
| 8 | Geçti | 7 satır, "x/y ders · z dk"/"Ders yok", aktivite adı + saat; dokununca kapanıyor, gün seçili, scrollY 0, odak `h2`. |
| 9 | Geçti | Esc, Kapat/Vazgeç, katmana dokunma kapatıyor; Tab/Shift+Tab içeride; `html` overflow hidden + `#root` inert; odak açan düğmeye. |
| 10 | Geçti | Satırda daire, ad, konu, süre, ⋯; döngü Yapılacak → Devam Ediyor → Tamamlandı; tamamlanan mavi ✓, üstü çizili. |
| 11 | Geçti | Çocuk ebeveynin dersini işaretliyor (yenilemede korunuyor); çocukta baş harf yok; satırlarda "Sen ekledin" yok. |
| 12 | Geçti | ⋯ → Düzenle yerinde form (odak ilk alanda); Sil + "Geri al" çalışıyor; salt okunurda açıklama. |
| 13 / 33 | Geçti | Ekleme sonrası form açık, konu/dk boş, ders korunuyor, odak dk; İptal kapatıp odağı "+ Ders ekle"ye veriyor; "Dersleri düzenle" ekle/sil; boş ders listesinde öneri kutusu (sunucu boş listeyi varsayılanlarla doldurduğu için boş yanıt tarayıcıda taklit edildi). |
| 14 | Geçti | `.hint`, `.note` ve metinleri yok. |
| 15 | Geçti | ‹ › 44×44, Hafta 86×44, Bugüne dön 44, şerit hücresi 44×84 (360 px'te 40×84: 7 hücre + 6 aralık 304 px'e sığmak zorunda; koordinatör kabul etti), daire/⋯ 44×44, menü öğeleri 48, panel satırları 52, Kapat ≥44, form alanları 44 px ve 16 px. |
| 16 | Geçti | İkon sırası aynı; aktivite ⋯ ile düzenle/sil. |
| 17 | Geçti | Ekleme/silme/durum sonrası şerit ve panel yenileniyor. |
| 18 | Geçti | Dosyalar silindi; index.css'te kaynakta karşılığı olmayan sınıf yok (betikle denetlendi); build uyarısız; e2e etkilenmedi. |
| 19 | Geçti | Yeni paket/font/ikon yok (`createPortal` react-dom'dan). |
| 20 | Geçti | Form açıkken Cuma'ya geçildi: form açık, ders korunuyor, "Ekle"nin adı "Cuma 9 Ekim gününe ekle"; kayıt sunucuda 9 Ekim'de, şerit 0/1. |
| 21 | Geçti | Pzt–Cum her güne 2 ders (sayfa yenilemeden): şerit "0/2", panel "0/2 ders · 50 dk". |
| 22 | Geçti | Çocukta ebeveynin dersinde yalnızca Vazgeç + D2 metni; daire çalışıyor ve kalıcı. |
| 23 | Geçti | Panel açıkken, menü açıkken, Ailem ve Bildirimler görünümündeyken mesaj: katman kapanıyor, planda o gün/hafta. |
| 24 | Geçti | `2026-13-40` ve boş: bugün açılıyor, konsolda hata yok (önceden 2026-13-40 Şubat 2027'ye kayıyordu; düzeltildi). |
| 25 | Geçti | "Ekle"ye çift tıklama tek kayıt; "Sil"e çift tıklama tek silme, tek "Geri al". |
| 26 | Geçti | Yanıtlar ters sırada geciktirildi (2,4 / 1,6 / 0,4 sn): şerit ve panel her an 3 hafta önceyi gösterdi. |
| 27 | Geçti | Tek profilde baş harf yok; menüde Düzenle/Sil ve "Sen ekledin · …". |
| 28 | Geçti | `plantobee:view=week`, `weekMode=list` ile açılış hatasız, anahtarlar siliniyor. |
| 29 | Geçti | Ayrıntı isteği düşürülünce şerit boş, gün kartları çalışıyor; panelde "Tekrar dene" veriyi getiriyor. |
| 30 | Geçti | Örnek hafta: 390 dk (planlanan), 3 gün spor, 9 aktivite = elle sayılan. |
| 31 | Kısmen | `aria-label`'lar ve aria-live metni ("Matematik: Tamamlandı") DOM'da doğrulandı; VoiceOver ile dinlenmedi. |

### Tasarımdan sapmalar ve kararlar
- **Yıllı aralık (ör. "28 Ara 2026 – 3 Oca 2027"):** 16 px'te bile 304 px'e sığmıyor; 16 karakterden uzun aralıkta başlık 15 px ve
  iki satıra inebiliyor (düğmeler küçülmüyor). Aynı yıl içindeki aralıklar tek satır (360'ta 16 px, 390'da 18 px).
- **Sheet odak halkası:** alt sayfa içeriği açık zeminde olduğu için halka `--ink` (hero'da `--honey`). Tasarım incelemesine bırakıldı.
- **Hafta paneli yükleniyor:** tam ekran `Loading` katmanı yerine panelin içinde HoneycombSpinner + metin (satırların yerinde).
- **Menü alt metni:** durum değişikliği de "düzenledi" sayıldığı için (mevcut audit kuralı) çocuk daireye dokununca ebeveynde o derste
  "D" baş harfi ve menüde "Deniz düzenledi" görünür.
- **Hafta panelinde başka hafta:** alt bilgi metni tasarımdaki gibi "Bu hafta …" ile başlıyor; başka haftada "Bu hafta" ifadesi
  yanıltıcı olabilir, metin kararı ux-ui-designer'da.
- Aynı haftada gün değiştirince gün, haftalık veriden beklemeden çiziliyor (ardından sunucudan tazeleniyor); geç gelen gün yanıtı
  artık seçili günün üzerine yazılmıyor.

### Bilinen sınırlamalar
- VoiceOver ve gerçek iPhone/Android (Noto emoji genişliği, KK 3) denenmedi; ölçümler headless Chrome'da.
- iOS Safari'de `overflow: hidden` arka plan kaymasını her durumda engellemeyebilir (lastik kaydırma).
- Menüde "Sil" sonrası açan ⋯ düğmesi kalktığı için odak sayfaya düşer.
- `EventForm`'un `compact`/`showNote` props'ları ve `eventLabel(ev, short)` artık kullanılmıyor; korunacak dosya olduğu için dokunulmadı.

### Ekran görüntüleri (`/tmp/ptb-fe7-shots/`)
01/02 Gün ebeveyn 390/360 · 03/04 en kötü gün 390/360 · 05 başka hafta (boş) · 06 boş hafta paneli · 07 Hafta paneli · 08 ⋯ menüsü ·
09 + Ders ekle formu · 10 çocuk 390 · 11 çocuk salt okunur menü · 12 çocuk 360 · 13 boş gün · 14 toplu planlama paneli ·
15 derin bağlantı · 16 hafta hatası + Tekrar dene · 17 menü 360 · 18 form 360 · 19 Dersleri düzenle 360 · 20 panel 360 · 21 yıl geçişi 360.

### Düzeltmeler (inceleme sonrası)
Koordinatörün kararıyla 13 madde uygulandı. 390/360 px'te headless Chrome ile doğrulandı; build uyarısız, oxlint'te yeni uyarı yok.
| # | Durum | Not |
|---|---|---|
| 1 | Geçti | Satırdaki baş harf yalnızca `createdBy`'a göre (`utils/format.js` `creatorMark`); durum değişikliği/düzenleme baş harf göstermiyor; çocukta yok. ⋯ menüsü `auditLine`: "Ayşe ekledi · 12:18", "Sen ekledin · 12:18 · Deniz değiştirdi · 12:23" ("Sen değiştirdin" de var). Eski `auditInfo`/`auditTrail` ve `showOwn` kaldırıldı. |
| 2 | Geçti | Şeritteki aralıkta yıl yok ("28 Ara – 3 Oca"). Panel başlığında yıl var, tarih içi NBSP, satır yalnızca "–" sonrasında kırılıyor. 360 px'te "24 – 30 Ağustos" 16 px'e sığmıyordu (124/112 px): DayPage yazıyı sığana kadar 0,5 px adımlarla küçültüyor (en çok 13 px; sonuç 14 px; "27 Tem – 2 Ağu" 15,5 px). Ölçülen 6 aralıkta (360 ve 390) taşma yok ve düğmeler yerinde. |
| 3 | Geçti | Bu hafta: aynı metin. Başka hafta: "Toplam 30 dk ders · 0 gün spor · 0 aktivite"; boşsa "Plan yok.". |
| 4 | Geçti | Panel açıkken gün yükleniyorsa yalnızca boş yer tutucu var, tam ekran katman yok (yanıtlar 2 sn geciktirilerek denendi). |
| 5 | Geçti | İkon–ad, ad–saat NBSP; ayırıcı "NBSP· ": satır yalnızca "·" sonrasında kırılıyor. |
| 6 | Geçti | `.trail-dot .ics .e` rengi `--ink` (✦ koyu ve seçili hücrede okunur). |
| 7 | Geçti | `.sheet` yan iç boşluğu 9 px, `.sheet-body` 5/5/6 px: ilk satırın odak halkası kırpılmıyor. |
| 8 | Geçti | Panel satırında gün numarasından sonra sr-only ", ". |
| 9 | Geçti | `.menu-item` yatay iç boşluğu 0: metin başlık ve alt metinle aynı hizada (16 px). |
| 10 | Geçti | Menüden silince odak sonraki satırın ⋯ düğmesinde, yoksa öncekinde; ders listesi boşalınca "+ Ders ekle", aktivitede kart başlığı (`hooks/useFocusAfterDelete.js`). Menü açıkken bildirim gelince odak gün başlığına gidiyor. |
| 11 | Geçti | Geçersiz `?date=` de adresten siliniyor. |
| 12 | Geçti | Ders silme × görünümü 36 px, `::before` ile dokunma alanı 44 px (dört kenarda doğrulandı). |
| 13 | Geçti | İyimser silme ve durum değişikliği haftalık veriye de yazılıyor: "Geri al" süresince şerit 0/3 → 0/2 ve panel aynı anda düşüyor, "Geri al" ile geri geliyor (`PlanShell` `replaceWeekDay`). |

Yeni dosya: `frontend/src/hooks/useFocusAfterDelete.js`. Değişen: `utils/format.js`, `AuditTag.jsx`, `EntryMenu.jsx`, `StudyCard.jsx`,
`EventCard.jsx`, `WeekSheet.jsx`, `DayPage.jsx`, `PlanShell.jsx`, `context/AuditContext.js`, `index.css`.
Önceki sapmalardan "yıllı aralık iki satıra iner" geçersiz oldu (madde 2); "Bu hafta" metni madde 3 ile çözüldü.
Ekran görüntüleri: `/tmp/ptb-fe7-shots/fix-*` (01 baş harf ve menü, 02 aralıklar 360/390 ve panel yıl geçişi, 03 başka hafta toplamı,
04 panel açıkken yükleniyor, 05-07 panel odak/NBSP, 09 menü hizası, 10 silme sonrası odak, 12 × dokunma alanı, 13 Geri al süresince şerit/panel).
