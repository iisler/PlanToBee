# Görev 16: Yeni görünüm "Petek dolsun"

Önceki görev: `docs/tasks/15-program-yukleme.md`.

Durum: Frontend: Tamamlandı · QA: Ana oturum (aşağıda), gerçek telefonda denenmedi · Backend: Değişiklik yok

## Karar (kullanıcı, 06–07.11)
- Önizlemede üç yön gösterildi; kullanıcı C'yi ("Petek dolsun") seçti ve 07.11'de "koda geç", "canlıya alabilirsin" dedi.
- Zemin kırık beyaz (#FAF8F4). Bej ve koyu da karşılaştırıldı; koyu tema şimdilik yok.
- Bal sarısı yalnızca petek dolumunda, seçili ve bugün durumunda, + düğmesinin parlamasında. Birincil düğmeler koyu.
- + düğmesi koyu, yuvarlak ve menünün içinde; arkasında hafif bal sarısı parlama. Önizlemedeki sarı altıgen beğenilmedi.
- Dersler ve Sıradaki özet kutuları kısa: başlık ve sayı aynı satırda.
- Kayıttaki onay kutusundan "18 yaşını doldurdum" ifadesi kaldırıldı. Kullanım Koşulları'ndaki 18 yaş maddesi duruyor.

- **16b (kullanıcı, 07.11):** Ders formunda bitiş saati girilebilir; girilince süre ondan hesaplanır
  (kayıtta yine başlangıç + süre tutulur). Süre çiplerine 120 dk eklendi.

## Yapılanlar
- Renk ve yazı: `index.css` `:root` değişkenleri yenilendi. Gövde 15 px, en küçük yazı 12 px (Hafta ızgarası 11 px).
- Haftanın peteği (`WeekTrail`, `DayPage`): koyu hafta alanı yerine beyaz kart.
  - Her gün bir petek hücresi; o günün dersleri tamamlandıkça hücre alttan bal rengiyle dolar.
  - Hücrenin altında aktivite noktaları; kartın altında hafta özeti ("12/16 ders tamam · 3 gün tam petek").
- Özet kutuları (`DayTiles`, yeni):
  - Dersler: tamamlanan/toplam, ilerleme çubuğu ve kalan ilk ders.
  - Sıradaki (bugün): sıradaki saatli kayıt ve kaç dakika sonra başladığı. Başka günde "İlk plan" gösterilir. Tamamlanan ders sıradaki sayılmaz.
- Günün akışı:
  - Başlık "Günün akışı", boş süre yanında çip olarak.
  - Bloklar yuvarlak ve renkli; tür ikonu renkli bir dairenin içinde.
  - Tamamlanan ders gri ve üstü çizili; "şu an" çizgisinde bal rengi küçük bir petek.
- Emoji yerine çizgi ikonlar (`KindIcon`, yeni): çizelge, Plan listesi, Hafta ızgarası, aktivite türü seçimi, sesle ekleme kartı ve program yükleme.
- "Devam ediyor" yarım dairesi artık ders mavisi (önceden kahverengiydi).
- Alt menü:
  - + koyu bir daire, arkasında hafif parlama.
  - Seçili sekme bal sarısı ve koyu çerçeveli.
  - Profil baş harfi koyu bir dairenin içinde.
- Hafta paneli: başlıkta tarih aralığı, üstte özet çipleri (ders, spor günü, aktivite), bugünün sütunu açık bal renginde.
- Ders formu: ders seçimi açılır liste yerine çiplerle yapılıyor. Etiketler koyu, alanlar beyaz, "Ekle" koyu.
- Giriş: üstte petek kümesi, her alanda görünür etiket, "Şifremi unuttum" şifrenin altında, "Giriş yap" koyu.

## Kontrol (ana oturum, 07.11)
- oxlint (hata yok) ve `vite build` geçti.
- Örnek veriyle (yerel sahte API) tarayıcıda 390 ve 360 px'te bakıldı: giriş, Bugün (petek, kutular, akış), Hafta paneli, + menüsü ve ders formu. 360 px'te yatay taşma yok.
- Backend değişmediği için e2e çalışmadı. Gerçek telefonda (iPhone Safari) denenmedi.
