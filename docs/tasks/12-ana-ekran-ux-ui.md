# Görev 12: Ana ekran ve formlar (UX/UI değerlendirmesi)

Önceki görev: `docs/tasks/11-tekrarlayan-aktiviteler.md`. Kaynak: `docs/ux-ui-degerlendirme.md`.

Durum: Tasarım: Önizleme onaylandı (30.10) · Frontend: Tamamlandı · QA: Ana oturum (aşağıda) · Backend: Değişiklik yok

## Kapsam (kullanıcı onayı 30.10: "bu hali uygun, uygula ve canlıya al")
Önizlemeler (repoda değil): ana ekran ilk görünüm, Bee tam sayfa, boşluktan ders ve aktivite ekleme, Plan bölümü.
- **UX-3:** Üst başlık (logo + ad menüsü) plan ekranında siyah hafta alanının içinde; Ailem/Bildirimler'de en üstte kalır.
- **UX-4:** Tek başına uzun kayıt (çizelgede 104 px'ten uzun; ör. Okul 08:00–15:00) 104 px'e sıkıştırılır, ortada kırılma
  işareti; aradaki saat etiketleri gösterilmez.
- **UI-5:** İki kayıt çakışıyor ve ikincisi en az 40 px aşağıdan başlıyorsa ilki tam genişlik, ikincisi %44'ten girintili ve
  üstte (adı kırpılmaz).
- **UI-4:** "Şu an" çizgisi blokların arkasında; blok içindeki metni üstü çizili (tamamlandı) gibi göstermez.
- **UI-7:** Boşluktaki "+ Ekle" ikincil (çerçeveli); sarı seçili duruma kalır.
- **UI-6:** Kart başlıkları ve bölüm etiketleri (Saati yok, menü grupları, rozet, rol) Figtree; mono yalnız saat ve sayılarda.
- **UI-10:**
  - "Hafta" düğmesinde çizgi takvim ikonu (📅 iPhone'da "17 Temmuz" gösteriyordu).
  - Düğmenin erişilebilir adı "Hafta: haftanın tamamını gör".
  - Üç sekmede de ikon.
- **UI-3:**
  - Form alanı çerçeveleri ve kapalı anahtar `--line-field` (#8C826E, 3:1).
  - Sarı seçili durumlarda (sekme, tür, süre çipi, Ders/Aktivite, tekrar günleri) koyu iç çerçeve.
- **UX-11:** Bildirim izni ilk kayıt eklenmeden önerilmez (`plantobee:push-ready`). Sekmelerin altında açık renkli ince
  bant: "Aç" / ×.
- **UX-13:** Boşluktan ders eklerken süre boşluk kadar (en çok 60 dk) dolu; "Boşluk: …" kutusu kaldırıldı.
- **UI-11:** Ders, Konu, aktivite Adı ve Not alanlarında görünür etiket; yer tutucular örnek veriyor.
- **UX-6 (kısmen):** Aktivite adında Enter formu göndermez, Başlangıç'a geçer (`enterKeyHint="next"`).
- **UX-10, UX-16:** Plan kartında "+ Aktivite ekle" etiketi ve "Bugün 3 aktivite" başlığı; tekrar eden "BUGÜN" etiketi
  kaldırıldı.

## Dokunulan dosyalar
- `frontend/src/pages/PlanShell.jsx`, `pages/DayPage.jsx`
- `components/Timeline.jsx`, `SectionTabs.jsx`, `EventCard.jsx`, `EventForm.jsx`, `StudyForm.jsx`, `AgendaSheet.jsx`, `PushPrompt.jsx`
- `utils/timeline.js`, `utils/push.js`, `index.css`

Backend değişmedi.

## QA (ana oturum, 30.10)
Yerelde PostgreSQL olmadığı için backend sözleşmesini taklit eden sahte API ile test edildi (headless Chrome, 390×844 ve 360×780).
- **Taşma:** Hiçbir ekranda yatay taşma yok. Bakılan ekranlar: Bee, Plan, To-do + ekleme formu, boşluktan ders/aktivite
  ekleme, bildirim bandı, Ailem.
- **Yerleşim:** Gün kartı y=541 → y=365. Eski değer 390×844'te, bildirim kartı açıkken ölçülmüştü.
- **Bildirim bandı:** İlk açılışta yok, ilk eklemeden sonra çıkıyor.
- **Formlar:** Boşluktan derste süre 60 geliyor. Aktivite adında Enter'dan sonra sayfa açık kalıyor, odak Başlangıç'ta.
- **Derleme:** oxlint 0 hata, 15 uyarı (öncekiyle aynı); `vite build` başarılı.
- **iPhone'da bakılacaklar:** Hafta alanındaki ad menüsü, bant, uzun kayıt sıkıştırması ve girintili çakışma.

## Geri dönüş
Yalnız ön yüz değişti. Commit geri alınıp main'e gönderilince GitHub Pages eski sürümü yayınlar. Yeni `localStorage` anahtarı
`plantobee:push-ready` eski sürümde okunmaz, zararsızdır.
