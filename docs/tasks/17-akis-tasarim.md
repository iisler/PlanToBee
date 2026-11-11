# Görev 17: Yeni önyüz "Akış"

Önceki görev: `docs/tasks/16-petek-dolsun-tasarim.md`.

Durum: Tasarım: Önizleme onaylandı (11.11) · Frontend: Tamamlandı · QA: Ana oturum (aşağıda), gerçek telefonda denenmedi · Backend: Değişiklik yok

## Karar (kullanıcı, 11.11)
- Önizlemede (tasarım panosu; repoda değil) Bugün, Hafta, Dersler, Ekle ve Şimdi kartının durumları gösterildi. Kullanıcı
  "koda geçip güncelleyelim, bu haliyle çok daha iyi oldu" dedi.
- Kimlik aynı kaldı: kırık beyaz zemin, bal sarısı, mürekkep, petek, Bricolage + Figtree. Değişen ekranın kurgusu:
  uygulama açılınca "şimdi ne yapıyorum, sırada ne var, ne kadar kaldı?" sorusu yanıtlanır.
- Önceki kararlardan bilerek sapılan yerler (önizlemede belirtildi, onaylandı):
  - **Görev 14:** Profil alt menüden çıktı, sağ üstte baş harf düğmesi oldu; yerine **Dersler** geldi. + artık menü açmaz,
    doğrudan Ekle sayfasını açar. Hafta alttan açılan panel değil, tam sayfa.
  - **Görev 09 / 10:** Saat çizelgesi (orantılı bloklar) yerine sıralı akış listesi. Plan / To-do / Bee bölümleri kalktı;
    yerlerine akıştaki süzgeç çipleri (Tümü · Dersler · Aktiviteler) geldi.
  - **Görev 16:** Ekranda yeniden koyu bir öğe var: Şimdi kartı (tek koyu öğe). Petekteki sayaç ("1/4") ve hafta özeti
    Hafta sayfasına taşındı. JetBrains Mono kalktı; saatler Figtree ile, tablo rakamlarıyla yazılıyor.
  - **UX-12:** Durum düğmesi tek dokunuşla Tamamlandı yapar (tamamlanmış derste geri alır). "Devam ediyor" Şimdi kartındaki
    "Başla" ile ya da düzenleme formundan seçilir.
- Korunan kararlar: boşluklar yalnızca bilgi satırı, ekleme yalnızca + ile (14b); seçili durum bal sarısı ve koyu çerçeve;
  birincil düğmeler koyu (koyu kartın üstünde bal sarısı); emoji yerine çizgi ikon.

## Ekranlar
- **Bugün** (`pages/DayPage.jsx`):
  - Başlık: üstte "Bugün / Yarın / 3 gün sonra", altında gün; sağda sesle ekleme ve profil düğmesi.
  - Haftanın peteği (`WeekTrail`): iki yanda hafta okları, 7 hücre (gün adı, petek, aktivite noktaları). Okul nokta üretmez.
    Başka gündeyken "Bugüne dön".
  - Şimdi kartı (`NowCard`), öncelik sırasıyla: saati gelmiş ders ("Tamamla", kalan süre, süre çubuğu) · "Devam ediyor"
    durumundaki ders · süren aktivite · "Petek doldu" · boşluk (sıradaki kayda kadar süre; boşluğa sığan saatsiz ders
    "Başla" ile önerilir). Başka günde günün özeti; boş günde "Plan yok" ve Ders ekle / Aktivite ekle.
  - Günün akışı (`DayFlow`): süzgeç çipleri ve günün boş süresi · "Gün içinde · saati yok" çipleri · sıralı liste
    (saat, tür peteği, ad, ayrıntı, derste durum düğmesi). Satıra dokununca ⋯ menüsü (Düzenle / Sil). 1 saat ve üstü
    boşluklar ince satır; bugün biten boşluk gösterilmez. Süren kayıt bal zeminli, biten kayıt soluk, tamamlanan dersin
    peteği bal dolu. Okul nötr gri. Listeyi yana çekmek günü değiştirir (önceki davranış).
- **Hafta** (`pages/WeekPage.jsx`): özet (tamamlanan ders, çalışılan / planlanan süre, spor günü) · gün başına satır: petek,
  ad, ders sayacı, 07–22 şeridi (ders mavi, spor yeşil, aktivite mercan, okul taralı gri), aktivite adları · renk açıklaması
  ve en uzun boşluklar. Satıra dokununca o gün Bugün ekranında açılır.
- **Dersler** (`pages/LessonsPage.jsx`): haftalık ilerleme · "Güne göre" (Geride kalan + "Bugüne al", bugün ve sonraki günler,
  önceki günlerin tamamlananları) / "Derse göre" (ders başına toplam ve ilerleme) · "Ders listesini düzenle" (alt sayfa).
- **Ekle** (`components/AddSheet.jsx`): Ders / Aktivite · gün çipleri (Bugün, Yarın, sonraki iki gün, Başka gün) · form.
  Ders formunda günün boşluklarından "Boş saatler" çipleri. Altta "Program yükle". Sesle eklemedeki "Düzenle" de bu sayfayı açar.
- **Aile, Bildirimler, Hesabı sil:** içerik aynı; başlıkta yalnızca sayfa adı ve profil düğmesi.

## Uygulama
- Yeni: `pages/WeekPage.jsx`, `pages/LessonsPage.jsx`, `components/NowCard.jsx`, `DayFlow.jsx`, `AddSheet.jsx`,
  `SubjectManager.jsx`, `StatusCheck.jsx`, `WeekHead.jsx`, `Icons.jsx`, `hooks/useNow.js`.
- Silindi: `AgendaCard`, `Timeline`, `DayTiles`, `WeekSheet`, `StudyCard`, `EventCard`; JetBrains Mono dosyaları.
- Değişti: `PlanShell` (görünümler, Ekle sayfası, başka günün dersi için durum ve taşıma), `DayPage`, `TabBar`, `WeekTrail`,
  `StudyForm` (`slots`), `QuickAdd` (`trailing`), `utils/timeline.js` (`flowRows`, `freeSlots`, `flowClass`; çizelge
  yerleşimi silindi), `index.css` (yeni bölüm; kullanılmayan ~270 kural silindi), `fonts.css`.
- "Bugüne al" iki istektir: bugüne saatsiz ekle, eski günden sil. Yalnızca düzenlenebilen (canEdit) derste görünür;
  dersin durumu Yapılacak'a döner.
- Backend ve API sözleşmesi değişmedi.

## Kontrol (ana oturum, 11.11)
- oxlint: hata yok, 10 uyarı (önceden 15; hepsi eski dosyalarda). `vite build` geçti.
- Örnek veriyle (yerel sahte API, Chromium) 390 px'te bakıldı: Bugün (ders sürerken, "Tamamla" sonrası boşluk önerisi,
  boş gün), süzgeç, ⋯ menüsü ve düzenleme, Hafta, Dersler (iki sıralama), Ekle (ders ve aktivite), profil paneli, Aile.
  360 px'te aynı adımlar otomatik çalıştırıldı (yatay taşma ve sayfa hatası denetimi); gözle yalnızca Bugün'e bakıldı.
  İki genişlikte de yatay taşma ve konsol hatası yok.
- Denenmeyenler: gerçek backend ile uçtan uca (e2e yalnızca API'yi sınar; API değişmedi), gerçek iPhone, ekran okuyucu,
  "Bugüne al" ve sesle eklemenin sunucu yanıtları, tekrarlanan aktivite ekleme, çocuk profili (salt okunur kayıtlar).

## Bilinen eksikler
- Petekteki hafta okları 26 px genişliğinde (yükseklik 80 px); 44 px kuralının altında.
- Boş günde akış alanı çok kısa kaldığından yana çekerek gün değiştirmek zor; petekten geçilir.
- Gün yüklenirken tam ekran "Yükleniyor" katmanı duruyor (UX-2 bu görevin kapsamında değil).
- `.claude/agents/ux-ui-designer.md` içindeki "tasarım dili" bölümü eski ekranları anlatıyor; güncellenmedi.

## Geri dönüş
Yalnız ön yüz değişti. Commit geri alınıp yayınlanınca eski görünüm döner; yeni `localStorage` anahtarı yok.
