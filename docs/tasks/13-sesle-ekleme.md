# Görev 13: Sesle aktivite ekleme

Önceki görev: `docs/tasks/12-ana-ekran-ux-ui.md`.

Durum: Frontend: Tamamlandı · QA: Ana oturum (aşağıda), telefonda denenmedi · Backend: Değişiklik yok

## Karar (kullanıcı, 30.10)
- Cümle **kurallarla, cihazda** çözülür (seçenek A). Yapay zekâ (Claude, sunucu üzerinden) seçilmedi: komut başına ücret,
  API anahtarı ve aile verisinin üçüncü tarafa gitmesi istenmedi. Kaçırılan cümle çok olursa yeniden düşünülür; onay kartı
  ikisinde de aynı kalır.
- Mikrofon, Plan bölümündeki "+ Aktivite ekle" satırının sağında.

## Akış
1. 🎤'a dokununca panel açılır ve dinleme başlar (tarayıcının konuşma tanıması, `tr-TR`). Dinleme dokunuşla başlatılır:
   iPhone Safari başka türlü izin vermez.
2. Söylenen ya da kutuya yazılan cümle anında çözülür; altında onay kartı: tür ikonu · ad · tür, gün · saat · süre.
3. **Ekle:** kayıt söylenen güne eklenir. Gün seçili günden farklıysa o gün açılır ve "… eklendi: Pazar, 1 Kasım"
   bildirimi çıkar. **Düzenle:** ekleme formu o günde, tür seçili ve alanlar dolu açılır (not, tekrar oradan eklenir).
   **Vazgeç:** panel kapanır.
4. Konuşma tanıma yoksa ya da izin verilmezse kutu açılır: yazılır ya da klavyenin 🎤 tuşuyla (dikte) söylenir.
   İzin reddedilince o oturumda kendiliğinden dinlemeye başlanmaz.

## Tanınanlar (`frontend/src/utils/quickAdd.js`)
- **Tarih:**
  - bugün, yarın, öbür gün, yarından sonra, haftaya (+7 gün)
  - 1 Kasım ("1 Kasım'da", yıllı da olur), kasımın 1'i, ayın 5'i, 11/11, 01.11.2026
  - Gün adları: cumartesi; bu / haftaya / gelecek hafta salı
  - Yıl söylenmeyen geçmiş tarih gelecek yıla gider. Tarih yoksa seçili gün.
- **Saat:**
  - 13:00, 13.00, saat 13, 13'te, 3 buçukta, on üçte
  - Aralık: 13 ila / ile / – 15, 13'ten 15'e (kadar)
  - Gün parçası: sabah, öğlen, öğleden sonra, akşam, gece
  - Gündüz varsayımı: "3'te" 15:00. Bitiş, başlangıçtan sonraki en yakın saattir: "10'dan 2'ye" 10:00–14:00,
    "22'den 1'e" gece aşımı.
  - Süre: "2 saat", "90 dakika", "bir buçuk saat", "yarım saat".
- **Tür (anahtar kelime, öncelik sırasıyla):**
  - Sınav: sınav, deneme
  - Konser: konser, gösteri
  - Spor: maç, antrenman, voleybol, yüzme…
  - Müzik: piyano, gitar…
  - Okul: okul, kurs, ders, etüt, veli
  - Buluşma: sinema, parti, doğum günü…
  - Bulunamazsa Diğer; o zaman ad zorunludur.
- **Ad:** Kalan kelimelerden oluşur. "gir / ekle / koy / kaydet", "misin", "arasına", "lütfen", baştaki "bir" atılır.
- **Desteklenmeyenler:** "her salı" gibi tekrarlar, tek cümlede birden çok aktivite ve ders (To-do) ekleme.

## Gizlilik
Ses PlanToBee sunucusuna gitmez. Ancak tarayıcının konuşma tanıması sesi işletim sistemi sağlayıcısına gönderebilir
(Chrome'da Google, Safari'de Apple). Uygulamaya yalnızca çözülmüş aktivite gider.

## Dokunulan dosyalar
- Yeni: `frontend/src/utils/quickAdd.js`, `components/QuickAdd.jsx`
- `components/EventCard.jsx`: "+ Aktivite ekle" satırı QuickAdd'e taşındı.
- `components/EventForm.jsx`: `draft` / `onClearDraft`.
- `pages/DayPage.jsx`: `quickAdd` başka güne de ekler, `quickEdit` ve taslak.
- `index.css`

## QA (ana oturum, 30.10)
- **Ayrıştırıcı:** 32 örnek cümle Node ile denendi (bugün = 30 Ekim 2026 Cuma), hepsi doğru. Örnek: "1 kasım saat 13:00 ila
  15:00 arasına voleybol maçı gir" → 2026-11-01, 13:00–15:00, Spor, "Voleybol maçı".
- **Arayüz:** Panel ve form, sahte konuşma tanımayla ayrı bir sayfada headless Chrome'da 390 px'te görüldü:
  - Onay kartı ve "Düzenle" sonrası dolu form doğru görünüyor.
  - Taşma yok.
- **Doğrulanmadı:** Tam uygulamada sunucuya ekleme (yerelde PostgreSQL yok).
- **Derleme:** oxlint 0 hata, 15 uyarı (öncekiyle aynı); `vite build` başarılı.
- **Telefonda bakılacaklar:**
  - iPhone'da ana ekrana eklenmiş uygulamada konuşma tanıma çalışıyor mu? Çalışmazsa klavye diktesi.
  - Mikrofon izni penceresi.
  - Başka güne ekleyince o günün açılması.

## Geri dönüş
Yalnız ön yüz değişti. Commit geri alınıp main'e gönderilince eski sürüm yayınlanır.
