# Görev 09: Saat çizelgesi (gün: dikey zaman çizelgesi, hafta: 7 sütunlu zaman ızgarası) ve aktivitede başlangıç–bitiş saati

Önceki görev: `docs/tasks/08-hesap-silme.md`.

Durum: Ürün: Tamamlandı · Tasarım: Tamamlandı · Backend: Tamamlandı · Frontend: Tamamlandı · QA: Başlamadı

---

## Özellik Özeti

Bugün aktivitelerde yalnızca başlangıç saati var ve günün hangi saatlerinin boş olduğu görünmüyor. Bu görevle:

1. **Her aktivite türünde** (Spor dahil) başlangıç ve isteğe bağlı **bitiş** saati girilir.
2. **Gün görünümü:** Aktiviteler kartı dikey bir zaman çizelgesine dönüşür (07:00–22:00). Kayıtlar saat
   aralığı kadar blok olarak, aradaki boşluklar metinle ("13:00–20:00 boş · 7 sa") görünür.
3. **Hafta görünümü:** 📅 Hafta panelinde 7 sütunlu zaman ızgarası; hangi gün ne zaman boş tek bakışta görülür.

Çalışma Planı (dersler) en üstte ve bugünkü haliyle kalır; çocuk için bugün odaklı akış değişmez.
Maketler: `/tmp/ptb-ux-preview/40-gun-secenekler.png` (A), `41-hafta-secenekler.png` (A), `42-ekleme-formu.png`,
`44-360-kontrol.png`.

### Kararlar

**Kullanıcı kararları (kesin)**
1. Gün görünümü: **A · dikey zaman çizelgesi**. Hafta görünümü: **A · 7 sütunlu zaman ızgarası**, 📅 Hafta panelinde.
2. Her aktivite türünde başlangıç ve bitiş girilebilir; önceki "Spor'da yalnızca saat" kuralı kalkar.
3. Bitiş isteğe bağlıdır. Girilmezse çizelgede **varsayılan 60 dk** gösterilir ve kayıt "süre belirsiz" olarak işaretlenir.
4. Bitiş < başlangıç ise kayıt gece yarısını aşar. İlk sürümde gün sonunda kesilir ve "↷ ertesi gün" etiketi alır;
   ertesi günün çizelgesinde gösterilmez.

**Varsayılan kararlar (ana oturum kararı; kullanıcı değiştirebilir)**
5. Kurs, ders dışı etüt gibi kayıtlar ayrı tür değil, **✦ Diğer** türüyle ve başlıkla girilir.
6. Çizelge **tüm aile için tektir** (kişi ayrımı/süzme yok).
7. Dersler çizelgede **yer almaz** (saatleri yok); Çalışma Planı'nda kalır.
8. Gün penceresi **07:00–22:00 sabittir**. Pencere dışındaki kayıtlar:
   - Tamamen pencere öncesindeyse (ör. 06:00–06:45) çizelgenin **üst kenarında**, tamamen sonrasındaysa (ör. 22:30)
     **alt kenarında** küçük bir satır olarak gerçek saatiyle gösterilir ("06:00–06:45 · Koşu ↑ pencere dışı").
   - Pencereyi kısmen aşıyorsa (ör. 06:30–08:00) pencere içinde kalan kısmı blok olarak çizilir, gerçek saat
     metinde tam yazılır (06:30–08:00).
   - Boşluk hesabı yalnızca pencere içinde yapılır.
9. **1 saatten kısa boşluklar etiketlenmez** (çizelgede boş görünür ama metin yazılmaz).
10. Haftalık tekrar yoktur (maketteki "Her pazar tekrarla" anahtarı bu görevde yok; sonra).

---

## Kullanıcı Hikayeleri

1. **Ebeveyn olarak**, kursun 09:00–13:00 sürdüğünü girebilmek istiyorum; böylece çocuğumun gün içinde ne zaman
   meşgul olduğunu bilirim.
2. **Ebeveyn olarak**, günün boş saatlerini çizelgede ve yazıyla görmek istiyorum; böylece ders/aktivite
   koyabileceğim aralığı hemen bulurum.
3. **Ebeveyn olarak**, haftanın hangi gününün hangi saatlerinin boş olduğunu tek ekranda görmek istiyorum.
4. **Çocuk olarak**, uygulamayı açınca önce bugünkü derslerimi, sonra günün saat akışını görmek istiyorum.
5. **Aile üyesi olarak**, bitişini bilmediğim bir kaydı (ör. "15:00 konser") yalnızca başlangıçla girebilmek istiyorum.
6. **Aile üyesi olarak**, boş bir aralığa dokunup o aralığa hızlıca aktivite ekleyebilmek istiyorum.
7. **Aile üyesi olarak**, aynı saate denk gelen iki kaydı da okuyabilmek istiyorum.
8. **Aile üyesi olarak**, bildirimde aktivitenin bitiş saatini de görmek istiyorum ("Kurs 09:00–13:00").

---

## Kabul Kriterleri

Örnek gün (QA verisi): **Pazar 11.10.2026**: ✦ Kurs 09:00–13:00, 🏅 Antrenman 20:00–21:30, saatsiz ✦ Veteriner
randevusu, 3 ders.

### Ekleme ve düzenleme formu
1. Tüm türlerde (Spor, Müzik, Konser, Buluşma, Sınav, Diğer) formda "Başlangıç" ve "Bitiş (isteğe bağlı)" alanları vardır.
2. Bitiş boş bırakılarak kayıt eklenebilir; başlangıç da boş bırakılabilir (saatsiz kayıt, bugünkü gibi).
3. Başlangıç boşken bitiş girilemez (alan pasif ya da uyarı); API'ye doğrudan gönderilirse 400 döner.
4. Hızlı süre çipleri (30 dk, 1 sa, 2 sa, 4 sa) başlangıca göre bitişi doldurur (09:00 + 4 sa → 13:00).
5. Form, girilen aralığı ve süreyi metinle özetler ("09:00–13:00 · 4 sa").
6. Bitiş başlangıçtan önceyse (ör. 21:00–01:00) kayıt kabul edilir ve formda "ertesi gün biter" bilgisi görünür.
   Bitiş başlangıca eşitse kayıt reddedilir (Varsayım: süre 0 anlamsız).
7. Var olan kayıtla çakışan aralık girilirse ekleme engellenmez; "⚠ 20:00 Antrenman ile çakışıyor. Yine de
   ekleyebilirsin." uyarısı görünür (Varsayım; makette var, renk + ikon + metin).
8. Düzenlemede mevcut başlangıç/bitiş dolu gelir; bitiş silinip kaydedilebilir.
9. Mevcut "Spor'da yalnızca saat" kısıtı kalkmıştır: Spor kaydında da bitiş girilip kaydedilebilir.

### Gün görünümü: dikey zaman çizelgesi
10. Gün ekranında sıra: Çalışma Planı (en üstte, değişmeden), sonra Aktiviteler kartı içinde çizelge.
11. Çizelge 07:00–22:00 arasını saat etiketleriyle gösterir; kayıtlar başlangıç–bitiş aralığı kadar blok olarak çizilir
    ve blokta başlık, ikon ve "09:00–13:00 · 4 sa" metni yazar.
12. **Örnek gün:** 11.10.2026'da çizelgede sırasıyla "07:00–09:00 boş", Kurs bloğu (09:00–13:00), "13:00–20:00 boş · 7 sa",
    Antrenman bloğu (20:00–21:30) görünür. 21:30–22:00 (30 dk) boşluğu etiketlenmez. Veteriner randevusu
    "Saati yok" şeridinde görünür.
13. Boşluklar renkten bağımsız olarak **metinle** yazılır (başlangıç–bitiş ve süre). Ekran okuyucu her boşluğu ve
    her kaydı saatleriyle okur.
14. Boş aralıkta "+ Ekle"ye dokununca ekleme formu o aralığın başlangıç ve bitişiyle dolu açılır (tür seçimi kullanıcıda).
15. Bitişi olmayan kayıt 60 dk'lık blok olarak çizilir ve blokta "süre belirsiz" ibaresi (ya da ayırt edici işaret +
    metin) vardır; metinde yalnızca başlangıç yazar ("15:00 · süre belirsiz"). Boşluk hesabında 60 dk sayılır.
16. Gece yarısını aşan kayıt (21:00–01:00) pencere sonunda (22:00) kesilir, blokta "↷ ertesi gün" etiketi ve tam saat
    ("21:00–01:00") yazar. Ertesi günün çizelgesinde görünmez.
17. Pencere dışındaki kayıtlar Karar 8'e göre üst/alt kenarda gösterilir; hiçbir kayıt kaybolmaz.
18. **Dokunma alanı:** 30 dk'lık bir blok dahil her blok ve her "+ Ekle" en az **44 px** yüksekliğinde dokunma alanına
    sahiptir (ölçek ya da en az yükseklikle; yöntem tasarımda).
19. **Çakışma:** Aynı saatteki iki ya da daha fazla kayıt yan yana bölünür; her biri okunur kalır (başlık en az kısaltılmış
    halde ve saat görünür, dokunulabilir). Tasarım en az genişliği belirler; 3'ten fazla çakışmada "+N" gösterimi kabul edilir.
20. **Uzunluk:** Saat başına yaklaşık 28–32 px; 07:00–22:00 kartı makul uzunlukta kalır. Uzun boş aralıklar
    sıkıştırılabilir (tasarım kararı); sıkıştırılırsa boşluk metni gerçek süreyi yazar.
21. Hiç saatli kaydı olmayan günde çizelge yerine kısa bir metin ("Bugün saatli aktivite yok · tüm gün boş") ve ekleme
    düğmeleri görünür (Varsayım).
22. Bugünkü gün için "şu an" çizgisi gösterilir (Varsayım; makette var). Başka günlerde gösterilmez.
23. Her kaydın ⋯ menüsü (düzenle/sil) bugünkü gibi çalışır.

### Hafta görünümü: 7 sütunlu zaman ızgarası (📅 Hafta paneli)
24. Panelde Pzt–Paz 7 sütun ve 07–22 saat ekseni vardır; saatli aktiviteler gerçek aralıklarıyla blok olarak görünür.
25. Bugünün sütunu vurgulanır. Ana ekran ve çocuk akışı değişmez; ızgara yalnızca panelde.
26. Bir sütuna ya da bloğa dokununca o gün Gün ekranında açılır (panel kapanır). Dokunma hedefi 360 px'te en az 44 px
    genişlik × yeterli yükseklik sağlar (sütunun tamamı hedef olabilir; tasarım saat eksenini/kenar boşluğunu daraltabilir).
27. Izgaranın altında boşluklar metinle de yazılır (ör. "En uzun boşluk: Cum 07–22 · Per 07–19") ve renk açıklaması
    vardır. Her sütunun erişilebilir adı o günün kayıtlarını ve boşluklarını içerir.
28. Saatsiz aktivitesi olan günde sütunda bir "saati yok" işareti görünür (ayrıntısı Gün ekranında).
29. Bitişi olmayan ve gece yarısını aşan kayıtlar Gün görünümündeki kurallarla (60 dk, gün sonunda kesme) çizilir.

### Eski kayıtlar, bildirim, hafta şeridi
30. Görev öncesindeki kayıtlar değişmeden görünür: bitişi yoksa "süre belirsiz" kuralıyla; eski antrenman süresi
    (Minutes) olan kayıtlarda bitiş başlangıç + süre olarak gösterilir (bkz. Backend 4).
31. Eski istemci (güncellenmemiş sekme) yeni API ile hatasız çalışır; bitiş alanını görmez, kayıtları bozmaz.
32. Bildirim metinleri bitiş varsa aralığı taşır ("Ela Kurs ekledi · Pazar 09:00–13:00"); yoksa bugünkü gibi
    yalnızca başlangıç.
33. Hafta şeridindeki aktivite ikonlarının erişilebilir adı/ipucu bitiş saatini de içerebilir ("Kurs 09:00–13:00").

### Genel
34. 360 ve 390 px'te yatay kaydırma yoktur; tüm dokunma alanları en az 44 px.
35. Bir aile başka ailenin kayıtlarını çizelgede göremez (mevcut yetki kuralları geçerli).

---

## Backend Gereksinimleri

1. **Veri modeli:** Event'e isteğe bağlı **EndTime** ("SS:dd" metin; mevcut Time ile aynı biçim doğrulaması).
   Migration yalnızca boş bırakılabilir sütun ekler; mevcut satırlara dokunmaz.
2. **API:** Aktivite ekleme ve düzenlemede EndTime kabul edilir; okuma DTO'larında döner. Alan gönderilmezse
   (eski istemci) düzenlemede mevcut EndTime **silinmez** (Varsayım: eski istemcinin veriyi bozmaması için;
   bitişi temizlemek için açık bir "boş" değer kullanılır, yöntem backend'in).
3. **Doğrulama:** EndTime biçimi SS:dd (00:00–23:59); Time yokken EndTime → 400; EndTime = Time → 400;
   EndTime < Time geçerli (gece yarısını aşan). Spor türüne özel saat kısıtı kaldırılır.
4. **Eski Minutes değerlendirmesi:** EndTime boş ve Minutes > 0 olan kayıtlarda bitiş Time + Minutes'tan türetilebilir.
   Karar: **yalnızca okumada/gösterimde**, veritabanına yazılmadan. Türetilen değer gerçek EndTime'dan ayırt
   edilebilir olmalı (istemci "süre belirsiz" ile karıştırmasın); kayıt düzenlenip kaydedilirse gerçek EndTime olur.
   Türetme tek yerde yapılır (sunucu önerilir). Time yoksa türetme yapılmaz.
5. **Bildirim metni:** EndTime varsa aktivite bildirimlerinde "09:00–13:00" biçimi.
6. Uçtan uca testler (`backend/tests/e2e.py`): EndTime ekle/düzenle/temizle, biçim hatası, Time'sız EndTime 400,
   eşit saat 400, gece yarısı aşımı kabul, eski istemci gövdesiyle düzenlemede EndTime korunur, Minutes türetmesi,
   Spor'da bitiş kabul, aile izolasyonu.

## Frontend Gereksinimleri

1. Ekleme/düzenleme formu: Başlangıç – Bitiş alanları, süre çipleri, aralık özeti, ertesi gün bilgisi, çakışma uyarısı.
2. Gün ekranı: Aktiviteler kartında dikey zaman çizelgesi (saat ekseni, bloklar, boşluk satırları ve "+ Ekle",
   "Saati yok" şeridi, pencere dışı satırları, şu an çizgisi, çakışma yerleşimi).
3. 📅 Hafta paneli: 7 sütunlu zaman ızgarası, en uzun boşluk metni, renk açıklaması, sütuna dokununca güne geçiş.
4. Boşluk hesabı (pencere içi, ≥ 60 dk etiketli, bitişsiz = 60 dk, gece aşımı kesme) gün ve hafta için aynı kurallarla.
5. Hafta şeridi ikonlarının erişilebilir adına bitiş saati.
6. 360/390 px, 44 px dokunma alanı, ekran okuyucu metinleri (Kabul 13, 18, 27, 34).

---

## Tasarım Notları (ux-ui-designer için)

1. Başlangıç noktası 40-A, 41-A ve 42 maketleri. Tasarımcının A için gördüğü zayıflıklar kabul kriteri oldu:
   30 dk blok 44 px (Kabul 18), çakışma (19), kart uzunluğu ve boşluk sıkıştırma (20), 360 px ızgara (26).
2. Kart uzunluğu için seçenek: sabit ölçek + en az blok yüksekliği, ya da uzun boşlukları sıkıştırma (kırık eksen
   gösterimiyle). Hangisi seçilirse seçilsin boşluk metni gerçek süreyi yazmalı.
3. "Süre belirsiz" bloğu görsel olarak ayırt edilmeli (ör. alt kenarı soluk/kesikli) ama metinle de belirtilmeli.
4. "↷ ertesi gün" etiketi ve pencere dışı satırlarının görünümü tanımlanmalı.
5. Hafta ızgarasında 360 px'te sütun genişliği 44 px'e ulaşmalı; saat ekseni ve kenar boşluğu daraltılabilir,
   ikonlar küçük bloklarda gizlenebilir (yalnızca renk + erişilebilir ad).
6. Renk tek başına bilgi taşımaz: Spor/Aktivite/Boş açıklaması ve metin karşılıkları her yerde.
7. Çakışma uyarısı formda --warn rengi + ⚠ + metin; engellemez.
8. "Her … tekrarla" anahtarı bu görevde çizilmez (Kapsam Dışı).

---

## Kapsam Dışı

- Haftalık/tekrarlayan kayıtlar.
- Derslere saat verme ve dersleri çizelgede gösterme.
- Kişiye göre çizelge ya da süzme; kişi bazında renk.
- Gün penceresinin kullanıcı tarafından değiştirilmesi.
- Gece yarısını aşan kaydın ertesi günde devam bloğu olarak gösterilmesi.
- Sürükle-bırak ile saat değiştirme, bloğu uzatarak süre değiştirme.
- Eski Minutes değerlerinin EndTime'a kalıcı taşınması (veri taşıma).
- Zaman tabanlı hatırlatma bildirimleri ("Kursa 30 dk kaldı").
- Dış takvim (Google/Apple) eşitleme.

---

## Açık Riskler

1. **Kart uzunluğu ve okunabilirlik:** 15 saatlik pencere küçük ekranda uzun; Çalışma Planı'nın altında kaldığı için
   çocuk akışını uzatabilir. Sıkıştırma kararı tasarımda; kullanıcı onayı gerekebilir.
2. **360 px hafta ızgarası:** Sütunlar ~40–44 px; ikon ve kısa bloklar zor seçilir. Çözüm: sütun bütünüyle hedef,
   ayrıntı Gün ekranında.
3. **Varsayılan 60 dk:** Bitişsiz kayıtlar boşluk hesabını yanıltabilir ("süre belirsiz" ibaresi bunu azaltır).
4. **Eski istemci ile düzenleme:** EndTime gönderilmeyen düzenlemede alanın korunması şart (Backend 2); aksi halde
   güncellenmemiş bir sekme bitişleri silebilir.
5. **Minutes türetmesi:** Türetilen bitişin gerçek bitişle karışması; ayırt edilebilir olmalı (Backend 4).
6. **Saat dilimi:** Saatler metin olarak, Türkiye saatine göre girilir; yurt dışında farklı yorumlanabilir (bilinçli kabul).

---

## Geri Dönüş Notu

- Migration yalnızca boş bırakılabilir **EndTime** sütunu ekler; geriye uyumludur, eski istemci ve eski kod etkilenmez.
- Canlıya almadan önce **Neon yedeği (branch/PITR noktası)** alınır.
- Geri dönüşte önce kod geri alınır; sütun kalabilir (eski kod okumaz). Sütun kaldırılması gerekirse ters migration
  ile yapılır ve girilmiş bitiş saatleri kaybolur (gerekirse yedekten geri alınır).

---

## Backend Çıktısı

### API sözleşmesi (frontend için)

Yollar değişmedi: `POST /api/days/{date}/events`, `PUT /api/days/{date}/events/{id}`, `GET /api/days/{date}`,
`GET /api/days/week/{monday}/details`. Yetki, hız sınırı ve aile izolasyonu (başka aile → 404, düzenleyemeyen → 403
`plan_read_only`) aynı.

**İstek gövdesine yeni alan:** `endTime` (string, isteğe bağlı)

| Değer | POST (ekleme) | PUT (düzenleme) |
|---|---|---|
| alan yok / `null` | bitiş yok | **mevcut bitiş korunur** (eski istemci) |
| `""` | bitiş yok | **bitiş silinir** |
| `"SS:dd"` | bitiş yazılır | bitiş yazılır |

Yeni istemci düzenlemede `endTime`'ı **her zaman** göndermeli (bitiş yoksa `""`).

**Doğrulama (400, gövde `{"code":"validation","message":"…"}`):**
- Biçim SS:dd değil (`"25:00"`, `"9:00"`, `"12:60"`): "Bitiş saati SS:dd biçiminde olmalı (örn. 13:00)."
- `time` boş (ya da eski serbest metin) iken bitiş: "Bitiş saati için önce başlangıç saatini girin."
- `endTime == time`: "Bitiş saati başlangıçla aynı olamaz."
- 20 karakterden uzun: ASP.NET'in varsayılan doğrulama gövdesi (`errors.EndTime`).
- `endTime < time` (21:00–01:00) **geçerlidir**: kayıt ertesi gün biter.
- Spor dahil her türde bitiş kabul edilir (backend'de türe özel saat kısıtı zaten yoktu).

**Okuma (EventDto) yeni alanlar:**
- `endTime`: girilmiş gerçek bitiş ya da `null`.
- `derivedEndTime`: `endTime` yokken eski süreden (`time + minutes`, gece yarısında sarar) hesaplanan bitiş; yalnızca
  gösterim içindir, veritabanında yoktur. `time` SS:dd değilse ya da `minutes` boşsa `null`.
- Çizelge bitişi: `endTime ?? derivedEndTime`; ikisi de `null` → "süre belirsiz" (60 dk). Düzenleme formu
  `derivedEndTime`'ı bitiş alanına doldurup kaydederse gerçek `endTime` olur.

Örnek:
```
POST /api/days/2026-10-11/events
{"kind":"Event","title":"Kurs","time":"09:00","endTime":"13:00"}
→ 200 {"id":41,"kind":"Event","title":"Kurs","time":"09:00","endTime":"13:00","derivedEndTime":null,
       "note":"","trainingType":null,"minutes":null,"canEdit":true,…}

Eski spor kaydı → {"kind":"Training","time":"17:00","minutes":90,"endTime":null,"derivedEndTime":"18:30",…}

PUT /api/days/2026-10-11/events/41  {"title":"Kurs","time":"09:00","endTime":"09:00"}
→ 400 {"code":"validation","message":"Bitiş saati başlangıçla aynı olamaz."}
```

Sıralama değişmedi: önce saatliler başlangıca göre, sonra saatsizler eklenme sırasıyla.
Bildirim gövdesi: bitiş varsa `✦ Kurs · 09:00–13:00 — Pazar 11 Eki`, yoksa bugünkü gibi.

### Değişen dosyalar
- `backend/PlanToBee.API/Models/Event.cs`, `Data/AppDbContext.cs`: `EndTime` (`varchar(5)`, NULL olabilir).
- `Migrations/20261010214321_EventEndTime.cs` (+ Designer, snapshot): yalnızca `ADD COLUMN "EndTime"`; Down
  `DROP COLUMN`. plantobee_e2e'de Up → Down → Up uygulandı; 351 satırın mevcut sütun özeti (md5) değişmedi.
- `DTOs/DayDtos.cs`, `Controllers/DaysController.cs` (ApplyEvent, Map), `Infrastructure/PlanText.cs`
  (`EndTime`, `DerivedEndTime`: türetme tek yerde), `Services/Notifications/NotificationService.cs` (aralık metni).
- `backend/tests/e2e.py`: `test_event_end_time` + bildirim metni kontrolü (`--psql` ile); 214 kontrol geçti.
- `docs/DEPLOY.md` 6.3: geri dönüş notu.

### Varsayımlar ve bilinen sınırlamalar
- Eski istemci `endTime` göndermeden düzenlerken saati siler ya da bitişe eşitlerse bitiş 400 yerine sessizce düşer
  (bitişi göremeyen istemci düzenleme yapamaz hale gelmesin diye).
- Geri dönüşten sonra eski kodun anlamsız bıraktığı bitiş (saatsiz kayıt, bitiş = başlangıç) okumada `null` döner.
- Hafta özetindeki `trainingMinutes` hâlâ yalnızca `minutes`'tan hesaplanır; bitiş saatinden süre türetilmez.
- Çakışma kontrolü sunucuda yok (kabul 7: engellenmez; uyarı istemcide).

### Canlıya alma notları
- Yayından önce Neon branch yedeği; geri dönüş etiketi `rollback-oncesi-saat-cizelgesi` (DEPLOY.md 6.3).
- Migration açılışta uygulanır, yalnızca sütun ekler; site Render'dan önce çıkarsa eski API `endTime`'ı yok sayar
  (kaydedilmez) ama hata vermez.

---

## Tasarım

Son önizleme: `/tmp/ptb-ux-preview/45-son-gun-cizelge.png` (gün, çocuk, durumlar, form, 360 px) ve
`46-son-hafta-izgara.png` (Hafta paneli 390/360). Maket kaynağı (sınıf adları ve ölçüler birebir):
`/tmp/ptb-ux-preview/mock45/tl2.css`, yerleşim algoritmasının çalışan örneği: `mock45/gen.py` (`timeline()`, `wgrid()`).

### 0. Ortak hesap (utils/timeline.js, gün ve hafta aynı fonksiyonu kullanır)
- Pencere `WS = 07:00 (420)`, `WE = 22:00 (1320)` dakika.
- Kaydın bitişi: `endTime ?? derivedEndTime`. İkisi de yoksa `E = S + 60`, `noEnd = true`. `derivedEndTime` normal bitiş
  gibi çizilir (süre belirsiz değildir).
- `E < S` → `E += 1440`, `night = true`.
- Sınıflama: `time` yok (ya da eski serbest metin) → **saatsiz**; `E ≤ WS` → **önce**; `S ≥ WE` → **sonra**;
  aksi halde **pencere içi**: `cs = max(S, WS)`, `ce = min(E, WE)`, `cutTop = S < WS`, `cutBot = E > WE`.
- Boşluklar: pencere içi `[cs, ce]` birleşiminin tümleyeni (07:00–22:00 içinde). ≥ 60 dk olanlar etiketlenir.
- Kümeler: `cs`'ye göre sıralı (eşitse uzun olan önce); `cs < kümeBitişi` ise aynı küme (yalnızca **zaman** örtüşmesi;
  uç uca kayıtlar ayrı küme).
- Süre metni mevcut `formatDuration` ("4 sa", "1 sa 30 dk", "30 dk").

### 1. DayPage / EventCard
Sıra değişmez: hero → gün başlığı → **Çalışma Planı** → Aktiviteler kartı. Kartın içi yukarıdan aşağı:
1. `card-head`: başlık + sağda `card-sum` "**9 sa 30 dk boş**" (saatli kayıt yoksa "tüm gün boş"). Eski
   "… spor" toplam rozeti kalkar (spor süresi bloklarda okunuyor).
2. **Saati yok** şeridi (`.tl-untimed`, yalnızca saatsiz kayıt varsa): `--surface-2`, radius 12, üstte mono 10,5 px
   büyük harf "SAATİ YOK"; her kayıt bir `.tl-row` düğmesi (44 px): ikon · ad (tek satır, …) · ⋯.
3. **07:00 öncesi** satırları (`.tl-out`, kesikli çerçeve): `.tl-row.two` iki satır: "Sabah uçuşu" / "05:30–06:15 ·
   ↑ 07:00 öncesi". Çizelgenin üstünde.
4. **Çizelge** (`.tl`), yoksa `.tl-empty`: "Bugün saatli aktivite yok · **tüm gün boş**" (başka gün "Bu gün …").
5. **22:00 sonrası** satırları (`.tl-out.after`): "↓ 22:00 sonrası".
6. `.evadd` içinde EventForm (değişmeden tür ikonları).

Her blok ve satır düğmedir: dokununca mevcut **EntryMenu** (Düzenle/Sil) açılır, `returnFocusRef` o düğme. Görünen ⋯
yalnızca ipucudur (ayrı hedef değil). Düzenle seçilince form kartın altında (`.evadd` yerine) "Kaydet/İptal" ile
açılır, düzenlenen blok `.edit` (2 px siyah iç çerçeve) alır; kapanınca odak bloğa döner.

### 2. Timeline bileşeni (components/Timeline.jsx) ölçüleri
- `.tl { padding-left: 46px }`: solda 40 px saat ekseni (mono 11 px, `--ink-soft`, sağa yaslı), 6 px boşluk, iz.
  İz genişliği: 390 px'te ~280, 360 px'te ~250 px.
- Ölçek **K = 32 px/saat**. Yerleşim kümeler ve boşluklar halinde **üst üste dizilir** (y imleci); eksen doğrusal değil,
  her bölüm kendi başlangıç saatini yazar.
- **Küme:** her kayıt `y = (cs − kümeBaşı)·K`, `h = max(44, (ce − cs)·K)`. Sütun ataması **piksel** kapsamına göre
  açgözlü: alt kenarı ≤ y olan ilk sütun, yoksa yeni sütun. Küme yüksekliği = en büyük `y + h`.
  - 1 sütun: tam genişlik; metin "09:00–13:00 · 4 sa"; ⋯ görünür.
  - 2 sütun: `(100% − 4px)/2`; metin "17:30–19:00"; ⋯ gizli (blok düğme).
  - 3 sütun: `(100% − 8px)/3` (360'ta ≥ 80 px); ikon gizli, metin yalnızca "17:30"; ad kısaltılır.
  - **4+ sütun:** küme liste kümesine döner: kesikli çerçeveli kutu, başlık "10:00–12:00 · 4 aktivite aynı saatte"
    (mono 12), altında her kayıt `.tl-row.two` (44 px). Okunurluk için yan yana bölme yapılmaz.
- **Boşluk:** süre `d`.
  - `d < 60`: yükseklik `d·K` (0–31 px), etiket ve düğme yok.
  - `d ≥ 60`: `.tl-gap` düğmesi, yükseklik `clamp(d·K, 48, 96)` (görünür kutu 6 px içeride, `::before` ile 4 px
    dokunma uzatması; komşuyla çakışmaz). `d·K > 96` (3 saatten uzun) ise **sıkıştırılır**: eksende boşluğun ortasına
    `.tl-brk` zikzak işareti (`--line-faint`, aria-hidden). Metin her zaman gerçek süre: "**13:00–20:00** boş · 7 sa",
    sağda sarı "+ Ekle" hapı (32 px görünür; satırın tamamı hedef). Dar ekranda metin iki satıra kırılabilir.
- **Eksen etiketleri:** her bölümün üstünde başlangıç saati, en altta 22:00, küme içinde tam saatler. Öncelik: şu an >
  bölüm sınırı > tam saat; bir etiket, tutulan bir etikete 14 px'ten yakınsa çizilmez.
- **Blok görünümü** (`.tl-blk`): tür rengi soft zemin + 4 px sol şerit (`--event`/`--sport` inset gölge), radius 10,
  2 px saydam üst/alt kenar (`background-clip: padding-box`): 44 px hedef, 40 px görünür; uç uca bloklar ayrık görünür.
  İçerik üstte: ikon 14 px · ad 13,5/600 (tek satır …) · altında saat mono 11,5 `--ink-soft`.
  - Süre belirsiz `.noend`: 60 dk; alt yarı `--surface`'e solar + 2 px kesikli alt çizgi (tür rengi); metin
    "15:00 · süre belirsiz".
  - 07:00 öncesinden başlayan `.cut-top`: üst köşeler düz + kesikli üst çizgi; metin gerçek saat "06:30–08:00 · 1 sa 30 dk".
  - Gece yarısını aşan `.cut-bot`: alt köşeler düz + kesikli alt çizgi; metin "21:00–00:30 ↷ ertesi gün".
- **Şu an** (`.tl-now`, yalnızca bugün ve 07:00 ≤ şu an < 22:00): 2 px `--ink` çizgi + 8 px nokta, eksende kalın
  "10:45". Küme içinde `(şimdi − kümeBaşı)·K`; boşluk içinde orantılı (`(şimdi − a)/d · yükseklik`, sıkıştırılmışta da).
  Dakikada bir güncellenir, `pointer-events: none`, aria-hidden.
- Örnek gün (11.10.2026): 07:00–09:00 boş · 2 sa (64 px), Kurs (128 px), 13:00–20:00 boş · 7 sa (96, sıkıştırılmış),
  Antrenman (48), 21:30–22:00 (16 px, etiketsiz). Çizelge ~352 px (doğrusal 480 px yerine).

### 3. WeekSheet ızgarası (📅 Hafta paneli)
- Satır listesi yerine `.wg`: `grid-template-columns: 20px repeat(7, minmax(0,1fr))`, `margin: 0 -2px`. Sütun
  360 px'te **44,6 px**, 390'da ~49 px. Sütunlar arasında boşluk yok; görsel ayrım sütun içi 1 px dolgu ile.
- Her gün **tek `<button class="wg-col">`** (başlık + şeritler + iz). Dokununca `onPick(date)` (panel kapanır, gün açılır).
  Bloklar ayrı hedef değildir. Hedef: 44,6 × 376 px.
  - `.wg-hd` 40 px: "PZT" mono 10 + gün numarası display 16/800. Bugün: `--honey` zemin, iz çerçevesi `--ink`,
    `aria-current="date"`.
  - Üst şerit `.wg-un` 20 px (`--surface-2`): ilk saatsiz kaydın ikonu, fazlası "+N" (mono 9,5); 07:00 öncesi kayıt
    varsa "▲".
  - İz `.wg-tr`: 300 px (**20 px/saat, sıkıştırma yok**; günler karşılaştırılabilsin), 10-13-16-19'da kesikli çizgi.
  - Alt şerit `.wg-un.bot` 16 px: gece aşımı "↷", 22:00 sonrası "▼".
- Eksen: 07 · 10 · 13 · 16 · 19 · 22 (mono 10), aria-hidden.
- Blok `.wg-b`: düz tür rengi (`--sport`/`--event`; yüzeye karşı ≥ 3:1), radius 4, `max(8px, süre·20/60)`.
  - Tek sütunda ≥ 20 px (1 sa): 16 px `--surface` çipte ikon.
  - ≥ 40 px (2 sa): ikon + başlangıç "09" (tam saat) ya da "17:30", mono 10/600 beyaz.
  - Çakışmada sütun eşit bölünür, yalnızca renk.
  - Süre belirsiz: çapraz açık çizgili desen. Kesilen kenar köşesiz.
- Bugünün izinde 2 px `--ink` şu an çizgisi.
- Altında `.wg-foot`: "Bir güne dokun: o gün açılır." / "**En uzun boşluk:** Cum 07–22 · Per 07–21 · Pzt 07–17:30"
  (en uzun boşluğu en büyük 3 gün, tam saatte "07", değilse "17:30"). Sonra `.wg-leg`: Spor · Aktivite · Boş ·
  Süre belirsiz · "Üst sıra: saati yok, ▲ 07:00 öncesi" · "Alt sıra: ↷ ertesi güne geçer, ▼ 22:00 sonrası"; en altta
  mevcut `wsfoot` toplamı.
- Yükleniyor/hata: bugünkü `sheet-loading` / `load-error` aynen. Hiç saatli kaydı olmayan hafta: ızgara boş çizilir,
  "En uzun boşluk" yerine "Bu hafta saatli aktivite yok · tüm hafta boş".

### 4. EventForm alanları (tüm türler)
Sıra: tür ikonları → ad → **Başlangıç – Bitiş** → süre çipleri → özet → (uyarı) → not → Ekle/İptal.
- `.evtimes`: `grid-template-columns: minmax(0,1fr) 14px minmax(0,1fr)`. Görünür etiket üstte: "Başlangıç",
  "Bitiş (isteğe bağlı)" (12,5/600 `--ink-soft`). Alanlar TimeInput, 44 px, **font-size 16 px** (iPhone yakınlaşmaz;
  bu formdaki ad ve not alanları da 16 px'e çıkar, şu an 14 px).
- Başlangıç boşken Bitiş `disabled` (kesikli çerçeve, `--bg`) ve çipler `disabled`; özet: "Saat girmezsen “Saati
  yok” bölümünde görünür. Bitiş için önce başlangıcı seç." Başlangıç silinirse bitiş de temizlenir.
- `.evchips` "Süre:" 30 dk · 1 sa · 2 sa · 4 sa: 36 px görünür hap, `::before` dikey 4 px uzatma → 44 px; aralık 8 px,
  çakışmaz. Bitişi `başlangıç + süre` (24 saatte sarar) yapar; o an eşleşen çip `.on` (sarı) + `aria-pressed`.
- `.evsum` (`aria-live="polite"`): "**09:00–13:00** · 4 sa" · bitişsiz "**15:00** · süre belirsiz. Çizelgede 1 saatlik
  yer kaplar." · gece "**21:00–00:30** · 3 sa 30 dk · ↷ ertesi gün biter".
- Bitiş = başlangıç: `inline-error` "Bitiş, başlangıçla aynı olamaz." (gönderim engellenir).
- Çakışma (`.evwarn`, `role="status"`, `--warn` / `--warn-soft`, ⚠ + metin): "⚠ 20:00 Antrenman ile çakışıyor. Yine de
  ekleyebilirsin." Birden çoksa "… Antrenman ve 1 aktivite daha ile …". Düzenlenen kayıt kendiyle karşılaştırılmaz.
  Ekle düğmesi etkin kalır.
- **Boşluktan gelme:** "+ Ekle" → kart formuna kaydırılır, ikonların üstünde `.tl-pre` (`--honey-soft`, 44 px):
  "**13:00–20:00** aralığına ekliyorsun. Tür seç." + "Vazgeç". Odak ilk tür düğmesine. Tür seçilince Başlangıç/Bitiş o
  aralıkla dolu gelir. Vazgeç, İptal ya da başarılı ekleme `.tl-pre`'yi kaldırır.
- Düzenlemede `endTime ?? derivedEndTime` bitişe dolar; kaydederken `endTime` her zaman gönderilir (boşsa `""`).
- Tekrar anahtarı **yok**.

### 5. Metinler
"Saati yok" · "↑ 07:00 öncesi" · "↓ 22:00 sonrası" · "13:00–20:00 boş · 7 sa" · "+ Ekle" · "süre belirsiz" ·
"↷ ertesi gün" · "tüm gün boş" · "Bir güne dokun: o gün açılır." · "En uzun boşluk:". Ürün metnindeki "pencere dışı"
kullanıcıya gösterilmez ("07:00 öncesi" daha anlaşılır).

### 6. Erişilebilirlik
- Çizelge bir `<ol aria-label="Saat çizelgesi, 07:00–22:00">`; öğeler kronolojik DOM sırasında (saatsiz şerit
  önce). Blok `aria-label`: "Kurs, 09:00–13:00, 4 saat: seçenekler" / "Okul konseri, 15:00, süre belirsiz: seçenekler"
  / "Sinema, 21:00–00:30, ertesi gün biter: seçenekler" / "…, 07:00 öncesi: seçenekler". Boşluk: "13:00–20:00 boş,
  7 saat. Bu aralığa aktivite ekle". Etiketsiz kısa boşluklar ve eksen aria-hidden.
- Hafta sütunu `aria-label`: "Pazar 11 Ekim, bugün. Kurs 09:00–13:00; Antrenman 20:00–21:30; Veteriner randevusu,
  saati yok. Boş: 07:00–09:00, 13:00–20:00. Günü aç". İç öğeler aria-hidden. Açıklama satırı normal metin.
- Renk tek başına bilgi taşımaz: boşluk metinle, tür ikonla, süre belirsiz/ertesi gün/dışarıda metin ya da işaretle.
- Odak halkası mevcut `:focus-visible` (bej zeminde siyah). Bloklar `outline-offset: -2px` (komşuya taşmaz).
- Kontrast: `--ink-soft` soft zeminlerde ≥ 5:1, beyaz `--event`/`--sport` üstünde ≥ 4,5:1, `--warn`/`--warn-soft` ≥ 5:1.

### 7. frontend-developer için kabul ölçüleri
- 360 ve 390 px'te yatay kaydırma yok. Blok ≥ 44 px yükseklik ve ≥ 80 px genişlik. Boşluk satırı ≥ 48 px. Hafta
  sütunu ≥ 44 px genişlik. Çip hedefi 44 px.
- Örnek gün çizelgesi 340–380 px. 30 dk kayıt 44 px. 3 saatten uzun boşluk 96 px.
- Yeni renk yok; yalnızca mevcut değişkenler. CSS `tl2.css`'teki sınıflar index.css'e "Saat çizelgesi (Görev 09)"
  başlığıyla taşınır; maket yardımcıları (`.tfake`, `.frag`, `.cardnote`) taşınmaz. Kullanılmayan `.wsrow` kuralları
  silinir.

---

## Frontend Çıktısı

### Dosyalar
- **Yeni** `frontend/src/utils/timeline.js`: ortak hesap (gen.py'nin JS karşılığı, saf işlevler): `span/classify` (saatsiz/önce/sonra/pencere içi, bitiş = `endTime ?? derivedEndTime`, yoksa 60 dk `noEnd`, gece aşımı), `gaps`, `clusters`, `layoutDay` (32 px/sa, en az 44 px blok, boşluk 48–96 px ve 3 saatten uzunda zikzak, piksel kapsamına göre sütun, 4+ sütunda liste kümesi, eksen etiketi önceliği + 14 px kuralı, şu an konumu), `weekColumn`/`weekColumnLabel`/`longestGaps` (20 px/sa), form için `overlapping/overlapText/addMinutes`.
- **Yeni** `components/Timeline.jsx`: Saati yok şeridi, 07:00 öncesi / 22:00 sonrası satırları, `<ol aria-label="Saat çizelgesi, 07:00–22:00">` içinde bloklar ve boşluklar, şu an çizgisi (dakikada bir), boş gün metni.
- `components/EventCard.jsx`: liste yerine Timeline; başlıkta "9 sa 30 dk boş" (spor toplamı kalktı); blok/satır → EntryMenu; düzenleme formu kartın altında, blok `.edit`, kapanınca odak bloğa; boşluk "+ Ekle" → `.tl-pre` + forma kaydırma + odak ilk tür düğmesi.
- `components/EventForm.jsx`: Başlangıç – Bitiş, süre çipleri (`aria-pressed`), özet (`aria-live`), ertesi gün, eşit saat hatası (gönderim engellenir), çakışma uyarısı (engellemez), boşluktan ön doldurma; düzenlemede `endTime` her zaman gönderilir (`""`).
- `components/WeekSheet.jsx`: satır listesi yerine 7 sütunlu ızgara, "En uzun boşluk", renk açıklaması, sütun erişilebilir adı.
- `utils/events.js`: `eventTimeRange`; `eventMeta` (⋯ menüsü) ve `eventWithTime` (hafta şeridi adı) bitişi içerir; kullanılmayan `trainingMinutes` silindi.
- `hooks/useFocusAfterDelete.js`: seçici `[data-id]` (blok ve satırlar da hedef).
- `index.css`: "Saat çizelgesi (Görev 09)" bölümü (tl2.css; maket yardımcıları hariç), `.wsrow` kuralları silindi, form alanları 16 px.

### Kabul kriterleri
1–9 geçti (CDP ile form denendi: 13:00–20:00 boşluğundan Diğer, 4 sa çipi → 17:00, 19:00–20:30 çakışma uyarısı, 15:00 süre belirsiz, 15:00=15:00 hatası, 21:00–00:30 ertesi gün; Spor kaydına bitiş kaydedildi; düzenlemede bitiş silinip API'de `null` oldu; eski süreli spor düzenlemede 18:30 ile doldu, kaydedince gerçek `endTime`). 10–23 geçti (örnek gün çizelgesi 360 px; bloklar 58/128/90/48 px). 24–29 geçti (sütun 360'ta 45 px, 390'da 49 px × 376 px; erişilebilir adlar tasarımdaki metinle aynı). 30, 33 geçti; 31 ve 32 backend kapsamı (istemci değişikliği gerekmedi); 34 geçti (360/390'da `scrollWidth` = ekran, 44 px altı hedef yok); 35 sunucu yetkisiyle (değişmedi).

### Sapmalar / sınırlamalar
- 2 sütunlu blokta süre belirsiz metni ("21:00 · süre belirsiz") kısalabilir; tam metin erişilebilir adda.
- 2 sütunda gece aşımı metni "21:00–00:30 ↷" (sığması için); tek sütunda tam "↷ ertesi gün".
- Saatsiz şerit ve pencere dışı satırları `<ol>` dışında ama DOM sırası kronolojik.
- Blokta "kim ekledi" baş harfi yalnızca tek sütunda görünür; erişilebilir adda her zaman var (çocukta yok).
- Liste kümesi (4+) satır yüksekliği düzeltmesi derlendi, ekran görüntüsü düzeltmeden önce alındı (07-…png).
- Yeni paket yok, yeni renk yok.

### Ekran görüntüleri (`/tmp/ptb-fe9-shots/`)
01 gün 390 · 02–06 diğer günler · 07–08 12 Ekim (4+ çakışma, 3 sütun, 22:00 sonrası, eski süreli spor) · 10/11 Hafta 390/360 · 12 gün 360 · 13 çocuk · 20 form çakışma · 21 ekleme sonrası (gece aşımı).

