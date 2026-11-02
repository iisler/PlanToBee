# Görev 14: Alt sabit menü ve yeni üst başlık

Önceki görev: `docs/tasks/13-sesle-ekleme.md`.

Durum: Frontend: Tamamlandı · QA: Ana oturum (aşağıda), telefonda denenmedi · Backend: Değişiklik yok

## Karar (kullanıcı, 02.11)
- Ekranın altında sabit menü: **Bugün · Hafta · + · Ailem · Profil** (önizlemede seçenek 2).
- **+** ortada; basınca düğmenin üstünde küçük menü açılır: **Plan** (aktivite ekle) ve **To-do** (ders ekle). Menü açıkken
  + işareti × olur.
- Üstteki bölüm seçici (Plan · To-do · Bee) kalktı. Plan ve To-do ekranları + menüsünden açılır.
- Sağ üstteki ad menüsü kalktı; yerine alt menüde **Profil** (alttan açılan panel).
- Üst başlık koyu hafta alanının dışında: solda logo ve **PlanToBee**, sağda **"Hoş geldin, [ad]"**, ikisi aynı boyutta (18 px).
- Sesle ekleme (🎤) gün başlığının sağında, yerinde kalır.
- Koyu hafta alanındaki "Hafta" düğmesi alt menüye taşındı.

## Davranış
- **Bugün:** Bee (ajanda) ana ekranı. Zaten Bee'deyken basılırsa bugüne döner. Ailem / Bildirimler sayfasından plana döner.
- **Hafta:** haftanın tamamı paneli (WeekSheet). Başka sayfadayken plana döner ve paneli açar.
- **+ → Plan:** Plan bölümü açılır, odak aktivite türü ikonlarına gider. **+ → To-do:** To-do bölümü açılır, ders ekleme formu
  seçili gün için açılır ve odak ders seçimine gider. Ailem sayfasındayken de çalışır.
  Menü Esc, dışarı dokunma ya da × ile kapanır; ↑/↓ seçenekler arasında gezer.
- Plan ve To-do bölümünün başında "‹ Bugün" düğmesi ve bölüm adı ("Plan · Aktiviteler", "To-do · Dersler") görünür.
- **Ailem:** aile sayfası. **Profil:** panel: profil adı, rol ve aile; Profil değiştir (ailede birden fazla profil varsa),
  Bildirimler (ailede başka profil varsa), Çıkış yap, Vazgeç.
- Seçili sekme sarı zemin, koyu çerçeve ve kalın yazıyla belli olur. Bildirimler sayfasında Profil, Ailem / Hesabı sil
  sayfasında Ailem seçili görünür.

## Uygulama
- `components/TabBar.jsx` (yeni), `components/ProfileSheet.jsx` (yeni). `UserMenu.jsx` ve `SectionTabs.jsx` silindi.
- `pages/PlanShell.jsx`: başlık, alt menü, profil paneli; Hafta panelinin durumu ve + isteği (`addRequest`) burada tutulur.
- `pages/DayPage.jsx`: bölüm seçici ve "Hafta" düğmesi kalktı; `addRequest` gelince ilgili bölüm ve form açılır.
- `index.css`: alt menü, + menüsü, profil paneli, yeni başlık. Sayfa altına menü kadar boşluk; bildirim kutusu menünün üstünde.
- `index.html`: `viewport-fit=cover` (iPhone alt çizgi boşluğu `env(safe-area-inset-bottom)` ile hesaplanır).
- Telefonda bir yazı alanı odaktayken (klavye açık) alt menü gizlenir.

## QA (ana oturum, 02.11)
Sahte API ile gerçek uygulamada (Chromium, 390 ve 360 px) denendi; konsolda hata yok.
- [x] + menüsü açılır, odak ilk seçeneğe gider; Esc kapatır ve odak + düğmesine döner.
- [x] + → Plan: Plan bölümü, odak aktivite türü ikonlarında. + → To-do: ders formu açık, odak ders seçiminde.
- [x] Ailem sayfasından + → To-do çalışır.
- [x] "‹ Bugün" Bee'ye döner; Bugün sekmesi Bee'deyken bugünü seçer.
- [x] Hafta paneli, Profil paneli ve Ailem sayfası alt menüden açılır.
- [x] Sayfa sonundaki son kayıt menünün altında kalmaz.
- [ ] iPhone'da ana ekrana eklenmiş uygulamada alt boşluk ve klavye davranışı denenmeli.
