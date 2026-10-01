# Görev 05: Antrenmanı etkinliklere katma

Önceki görev: `docs/tasks/04-acik-maddeler.md`.
İlgili, paralel iş: etkinliklerin "Saat" alanı serbest metinden saat seçiciye (SS:dd, örn. 17:30) çevriliyor.
Bu görev o işin bittiğini **varsayar**.

Durum: Backend: Tamamlandı · Frontend: Tamamlandı · QA: Ana oturumda test edildi (bkz. Uygulama notları)

---

## Özellik Özeti

Kullanıcının isteği: "Antrenman sekmesini de etkinliğe dahil edelim, oradan seçilebilir olsun, ayrı bir tab olarak kalmasın."

Bugün Gün ekranında üç ayrı kart (Çalışma Planı, Antrenman, Etkinlikler), Hafta tablosunda üç sütun (Ders, Antrenman,
Etkinlik) var. Bu görevden sonra:

- **Antrenman, bir etkinlik türü olur.** Etkinlik eklerken "Tür" seçilir: **Etkinlik** ya da **Antrenman**.
  Antrenman seçilince antrenman türü (Top, Kuvvet, Maç, Kondisyon ya da kullanıcının yazdığı) ve süre alanları çıkar.
- Gün ekranında **iki kart** kalır: Çalışma Planı ve Etkinlikler. Antrenmanlar Etkinlikler kartında, kendi
  rengiyle (bugünkü antrenman rengi) görünür.
- Hafta tablosunda **iki sütun** kalır: Ders ve Etkinlik. Hafta liste görünümünde de Antrenman bölümü kalkar.
- Antrenman istatistikleri **korunur** ("antrenman yapılan gün /7" ve toplam süre). Ailenin canlıdaki mevcut
  antrenman kayıtları kaybolmadan yeni yapıya taşınır.
- Antrenmanın da (isteğe bağlı) bir **saati** olabilir; etkinlik gibi saat seçiciyle girilir.

### Verilen kararlar ve gerekçeleri

**1. Tür seçimi nasıl olacak?**
Etkinlik formunun başında iki seçenekli bir "Tür" seçici olur: `Etkinlik | Antrenman`. Varsayılan: Etkinlik.
- Etkinlik seçiliyken: Etkinlik adı (zorunlu), Saat (isteğe bağlı), Not (isteğe bağlı).
- Antrenman seçiliyken: Antrenman türü (Top / Kuvvet, zorunlu, varsayılan Top), Süre (saat + dakika, zorunlu),
  Saat (isteğe bağlı), Not (isteğe bağlı). Ayrı bir "ad" alanı **yoktur**; kayıt "Top antrenmanı" /
  "Kuvvet antrenmanı" diye görünür.
- Gerekçe: Bugünkü antrenman formundaki alanların hepsi korunur, kullanıcı yeni bir şey öğrenmek zorunda kalmaz.
  Tek seviyeli bir seçim (iki düğme) telefonda en az dokunuşla çalışır. "Top antrenmanı" gibi alt türleri doğrudan
  ilk seçicide göstermek (Etkinlik / Top / Kuvvet) daha kısa olurdu, ama ileride yeni türler eklendikçe seçici
  kalabalıklaşır; o yüzden iki aşamalı tercih edildi.

**2. Süre ve saat birlikte nasıl duracak?**
- Antrenmanın **süresi zorunlu**, **saati isteğe bağlı**. Etkinliğin **saati isteğe bağlı**, süresi yok.
- Ekranda: saatli antrenman "Top antrenmanı · 17:00 · 1 sa 30 dk", saatsiz antrenman "Top antrenmanı · 1 sa 30 dk".
- Gerekçe: Mevcut antrenman kayıtlarının saati yok; saati zorunlu yapmak eski kayıtları ve hızlı girişi bozar.
  Saat bilgisi ise antrenmanlar etkinliklerle aynı listeye girince sıralama için faydalı.

**3. Liste sırası (Varsayım).**
Etkinlikler kartında ve hafta hücrelerinde kayıtlar şöyle sıralanır: önce **saati olanlar saat sırasıyla**, sonra
**saati olmayanlar eklenme sırasıyla**. Etkinlik ve antrenman karışık sıralanır (türüne göre gruplanmaz).

**4. Veri modeli: tek tablo mu, iki tablo mu?**

| | A) İki tablo kalır, yalnızca ekran birleşir | B) Antrenmanlar etkinliklere taşınır, tek tablo (önerilen) |
|---|---|---|
| Canlı veriye dokunma | Yok, risk düşük | Bir kerelik veri taşıma gerekir |
| Antrenmana saat eklemek | Antrenman tablosuna da saat eklemek gerekir | Etkinlikte zaten saat var |
| Tek listede saat sırası | Ekran iki listeyi birleştirip sıralamak zorunda | Sunucu tek liste döner |
| Etkinliği antrenmana çevirme (ileride) | Silip başka tabloya yeniden ekleme; kaydın kimliği ve "ekleyen" bilgisi değişir | Tek alan değişir |
| Yeni türler (Maç, Turnuva, Okul…) | Her biri için yeni tablo ya da karmaşa | Türe yeni bir değer eklemek yeterli |
| İstatistik sorguları | Değişmez | "Türü antrenman olan etkinlikler" diye güncellenir |
| Firebase içe aktarma komutu | Değişmez | Antrenmanları etkinlik olarak yazacak şekilde güncellenir |

**Öneri: B.** Kullanıcının isteği "antrenman bir etkinlik türüdür" fikri; bunu verinin kendisinde de böyle tutmak,
hem bugünkü saat sıralamasını hem de ileride yeni etkinlik türleri ve mobil uygulamayı sadeleştirir. Taşıma bir kerelik
ve kayıt sayısı küçük; aşağıdaki "Veri taşıma" bölümündeki güvencelerle risk kabul edilebilir.
A seçilirse bu görevdeki ekran ve kabul kriterleri aynen geçerlidir; yalnızca Backend ve Veri taşıma bölümleri küçülür.
(Bkz. Açık Soru 1.)

**5. İstatistikler.**
- "Antrenman: X/7 gün" korunur: haftada en az bir antrenman türü etkinliği olan gün sayısı.
- Haftalık antrenman toplam süresi (hafta tablosu alt satırı) korunur.
- "Etkinlik" sayısı yalnızca **antrenman olmayan** etkinlikleri sayar (antrenmanlar iki kez sayılmasın). (Bkz. Açık Soru 2.)
- Gün ekranındaki hafta şeridinde (her günün altındaki üç nokta) antrenman noktası korunur.

**6. Hafta tablosu.**
- Sütunlar: **Ders | Etkinlik**. Antrenman sütunu kalkar.
- Renkler değişmez: ders, antrenman ve etkinlik bugünkü renklerini korur.
  Etkinlik sütunundaki çipler türüne göre renklenir (antrenman çipi antrenman renginde).
- Alt satır: Ders "X dk"; Etkinlik "N etkinlik · M/7 gün antrenman · toplam süre".

---

## Kullanıcı Hikayeleri

1. **Ebeveyn / çocuk olarak**, Gün ekranında antrenmanı Etkinlikler kartından, tür olarak "Antrenman" seçerek
   eklemek istiyorum; böylece ayrı bir kart aramak zorunda kalmam.
2. **Çocuk olarak**, antrenmanın türünü (Top / Kuvvet), süresini ve istersem başlama saatini girmek istiyorum;
   böylece günümün planında antrenmanın ne zaman olduğunu görürüm.
3. **Ebeveyn olarak**, bir günün tüm etkinliklerini ve antrenmanlarını tek listede, saat sırasıyla görmek istiyorum;
   böylece günün akışını tek bakışta anlarım.
4. **Ebeveyn olarak**, Hafta tablosunda daha az sütunla (Ders, Etkinlik) haftayı telefonda rahatça görmek istiyorum.
5. **Ebeveyn olarak**, haftalık "kaç gün antrenman yapıldı" ve "toplam antrenman süresi" bilgisini eskisi gibi
   görmeye devam etmek istiyorum.
6. **Aile üyesi olarak**, daha önce girdiğimiz antrenman kayıtlarının (eski Firebase'den aktarılanlar dahil)
   kaybolmadan yeni ekranda görünmesini istiyorum.
7. **Aile üyesi olarak**, silme ve "Geri al", "ekleyen" bilgisi ve düzenleme yetkilerinin eskisi gibi çalışmasını istiyorum.

---

## Kabul Kriterleri

### Gün ekranı
1. Gün ekranında yalnızca iki kart vardır: "Çalışma Planı" ve "Etkinlikler". "Antrenman" kartı yoktur.
2. Etkinlikler kartının ekleme formunda "Etkinlik" ve "Antrenman" seçenekli bir tür seçici vardır; form açıldığında
   "Etkinlik" seçilidir.
3. "Etkinlik" seçiliyken form alanları: Etkinlik adı, Saat (saat seçici), Not. Ad boşsa kayıt eklenmez ve
   "Etkinlik adını yazın." uyarısı görünür.
4. "Antrenman" seçiliyken form alanları: Antrenman türü (Top / Kuvvet), Süre (sa + dk), Saat (saat seçici, isteğe
   bağlı), Not. Etkinlik adı alanı görünmez. Süre 0 ya da boşsa kayıt eklenmez ve "Süreyi girin." uyarısı görünür.
5. Tür değiştirildiğinde, her iki türde ortak olan alanlara (Saat, Not) yazılmış değerler korunur.
6. Eklenen antrenman, Etkinlikler kartında antrenman renginde, "Top antrenmanı" biçiminde, varsa saati ve süresiyle
   görünür (örn. "Top antrenmanı · 17:00 · 1 sa 30 dk").
7. Etkinlikler kartında kayıtlar şu sırayla görünür: saati olanlar saate göre artan sırada, ardından saati olmayanlar
   eklenme sırasına göre. Örnek: 09:00 etkinlik, 17:00 antrenman, saatsiz etkinlik.
8. O gün antrenman varsa kart başlığında günlük toplam antrenman süresi görünür (örn. "1 sa 30 dk antrenman").
9. Kart boşken "Bu gün için planlı etkinlik veya antrenman yok." yazar.
10. Bir antrenmanı düzenlerken antrenman türü, süre, saat ve not değiştirilebilir. Listede olmayan eski türler
    (örn. içe aktarılmış "Antrenman") düzenleme ekranında seçili ve korunmuş olarak görünür.

### Hafta ekranı
11. Hafta tablosunda sütunlar "Ders" ve "Etkinlik"tir; "Antrenman" sütunu yoktur.
12. Etkinlik sütununda antrenman çipleri antrenman renginde, diğer etkinlikler etkinlik renginde görünür; çip metni
    Gün ekranındaki ile aynı bilgiyi kısa biçimde taşır (örn. "Top · 17:00 · 1 sa 30 dk", "Deneme sınavı · 10:00").
13. Hızlı ekleme çubuğunda tür seçenekleri "Ders" ve "Etkinlik"tir. "Etkinlik" seçilince ek olarak Etkinlik /
    Antrenman seçimi çıkar ve 3. ve 4. maddedeki alanlar (not hariç) görünür.
14. Etkinlik sütunundaki "+" düğmesi hızlı ekleme çubuğunu o güne ve "Etkinlik" türüne getirir.
15. Tablonun alt satırında Etkinlik sütunu "N etkinlik · M/7 gün antrenman · toplam süre" gösterir; N antrenmanları
    saymaz. Örnek: haftada 3 etkinlik ve 2 farklı günde toplam 2 sa 30 dk antrenman varsa
    "3 etkinlik · 2/7 gün antrenman · 2 sa 30 dk".
16. Liste görünümünde her günde "Ders" ve "Etkinlik" bölümleri vardır; "Antrenman" bölümü yoktur. Etkinlik
    bölümünün hızlı satırından tür seçilerek antrenman eklenebilir.
17. Hafta ekranının altındaki açıklama metni yeni yapıya göre güncellenir ("ders ve etkinlik (antrenman dahil)").

### İstatistikler
18. Liste görünümündeki istatistik çubuğunda "Antrenman X/7 gün" değeri, haftada en az bir antrenmanı olan gün
    sayısına eşittir. Aynı günde iki antrenman 1 gün sayılır.
19. İstatistik çubuğundaki "Etkinlik" sayısı antrenmanları saymaz.
20. Gün ekranındaki hafta şeridinde antrenmanı olan günlerde antrenman noktası (renkli) görünür; yalnızca
    antrenmanı olan bir günde etkinlik noktası yanmaz.

### Mevcut davranışlar korunur
21. Ebeveyn her antrenmanı ve etkinliği düzenleyip silebilir; çocuk yalnızca kendi eklediklerini. Başkasının kaydında
    düzenle/sil düğmeleri yerine salt okunur işareti görünür. Sunucu da aynı kuralı uygular (yetkisiz istek reddedilir).
22. Antrenman silinince 5 sn boyunca "Top antrenmanı silindi · Geri al" bildirimi çıkar; "Geri al"a basılırsa kayıt
    geri gelir ve sunucuda silinmez. Etkinlik için "… etkinliği silindi · Geri al". Gün kartı, hafta tablosu ve hafta
    listesinde aynı çalışır.
23. "Sen ekledin" / "Aslı ekledi" ve hafta görünümündeki baş harf rozeti antrenman kayıtlarında da eskisi gibi görünür.

### Veri taşıma ve içe aktarma
24. Geçişten sonra, geçişten önce var olan her antrenman kaydı aynı günde, aynı tür, süre ve notla, aynı "ekleyen"
    ve "düzenleyen" bilgisiyle ve (varsa) "aktarıldı" işaretiyle Etkinlikler kartında görünür. Geçiş öncesi ve sonrası
    antrenman sayısı aile bazında eşittir.
25. Geçişten önce ve sonra aynı haftanın "Antrenman X/7 gün" ve toplam antrenman süresi değerleri aynıdır.
26. Firebase içe aktarma komutu çalıştırıldığında antrenmanlar yeni yapıda (antrenman türünde etkinlik olarak)
    oluşur ve Gün ekranında görünür. Komutun özet çıktısı antrenman sayısını yine ayrı gösterir. Eski yedeklerdeki
    tek nesne biçimli antrenman ({done, minutes, note}) hâlâ okunur. "Daha önce aktarılmış" kontrolü yeni yapıdaki
    kayıtları da görür.

### Mobil
27. 360 px ve 390 px genişlikte Etkinlikler formu yatay kaydırma olmadan sığar; tür seçici düğmeleri ve saat seçici
    parmakla rahat dokunulabilir büyüklüktedir (en az 44 px yükseklik).
28. Tür seçici ekran okuyucuda "Tür" grubu olarak okunur ve seçili seçenek belirtilir.

---

## Backend Gereksinimleri

1. **Etkinlik kaydı türü taşır.** Her etkinliğin bir türü olur: `Etkinlik` veya `Antrenman`. Antrenman türündeki
   etkinlik ayrıca şunları taşır: antrenman türü (Top, Kuvvet ya da içe aktarılmış serbest metin; en fazla 50 karakter),
   süre (dakika). Saat ve not her iki türde ortak.
2. **Doğrulama kuralları.**
   - Etkinlik: ad zorunlu; süre ve antrenman türü gönderilse de yok sayılır ya da reddedilir (backend seçer, tutarlı olsun).
   - Antrenman: antrenman türü zorunlu; süre 1–1440 dakika. Ad alanı gerekmez.
   - Saat: boş ya da SS:dd (paralel saat seçici işiyle aynı kural).
   - Hata mesajları Türkçe ve mevcut hata biçiminde.
3. **Uç noktalar.** Etkinlik ekleme / düzenleme / silme uç noktaları türü ve antrenman alanlarını kabul eder.
   Antrenmana özel ayrı uç noktalar (`/days/{date}/training`) kaldırılır. Varsayım: ön yüz ve sunucu aynı anda
   yayına alınır; birkaç dakikalık geçişte eski sürümü açık olan kullanıcı bir hata görüp sayfayı yenileyebilir.
4. **Gün ve hafta ayrıntısı cevabı.** Bir günün cevabında antrenmanlar etkinlik listesinin içinde, türleriyle gelir;
   ayrı antrenman listesi kalmaz. Liste, Kabul Kriteri 7'deki sırayla döner (saatliler saat sırasıyla, sonra
   saatsizler eklenme sırasıyla).
5. **Hafta özeti** (Gün ekranındaki hafta şeridi) her gün için şunları vermeye devam eder: antrenman yapıldı mı,
   antrenman sayısı; buna ek olarak günün **antrenman toplam süresi**. Etkinlik sayısı antrenmanları saymaz.
6. **Yetki ve iz.** Ekleyen/düzenleyen kaydı, "düzenleyebilir mi" bilgisi ve ebeveyn/çocuk kuralı bugünkü gibi
   çalışır; başka ailenin kaydı 404, yetkisiz düzenleme 403 döner.
7. **Firebase içe aktarma** (`Infrastructure/FirebaseImport.cs`): antrenmanları antrenman türünde etkinlik olarak
   yazar; tür boşsa "Antrenman", süre bugünkü gibi 0–1440 arasına sıkıştırılır, saat boş. Özet çıktısında
   "antrenman" ve "etkinlik" sayıları ayrı kalır. Eski tek nesne biçimi desteklenmeye devam eder.
   Varsayım: içe aktarılan antrenmanın süresi 0 olabilir (eski veride süre yoksa); bu kayıtlar eklenir, ekranda
   süresiz gösterilir. Elle eklemede süre zorunludur.
8. **Uçtan uca testler** (`backend/tests/e2e.py`): antrenman ekleme/düzenleme/silme etkinlik uç noktası üzerinden,
   doğrulama kuralları, hafta özeti sayıları, yetki (403/404) senaryoları güncellenir.

## Frontend Gereksinimleri

1. **Gün ekranı:** Antrenman kartı kaldırılır. Etkinlikler kartı iki türü de listeler, ekler, düzenler ve siler.
   - Ekleme formunun başında `Etkinlik | Antrenman` tür seçici (iki düğmeli, bölümlü kontrol).
   - Saat alanı her iki türde saat seçici (paralel işle aynı bileşen).
   - Antrenman satırı: antrenman rengi ve simgesi, "Top antrenmanı", saat (varsa), süre.
   - Kart başlığında o günün toplam antrenman süresi (varsa).
2. **Hafta tablosu:** Antrenman sütunu kaldırılır; Etkinlik sütunu türe göre renkli çipler gösterir. Hızlı ekleme
   çubuğu "Ders | Etkinlik"; Etkinlik seçilince telefona sığacak sade bir Etkinlik/Antrenman seçimi (Varsayım: açılır
   liste; tasarımcı bölümlü düğme de seçebilir). Alt satır Kabul Kriteri 15'teki biçimde.
3. **Hafta liste görünümü:** Antrenman bölümü kaldırılır; Etkinlik bölümünün hızlı satırında tür seçimi.
4. **İstatistik çubuğu ve hafta şeridi:** "Antrenman X/7 gün" ve antrenman noktası yeni veriden hesaplanır;
   etkinlik sayısı ve etkinlik noktası antrenmanları saymaz.
5. **Geri al, ekleyen izi, salt okunur işareti:** Tüm yeni listelerde mevcut bileşenlerle aynı davranış.
   Geri al metni: "Top antrenmanı silindi", "<ad> etkinliği silindi".
6. **Renkler:** Mevcut renk değişkenleri (ders, antrenman, etkinlik) aynen kullanılır; yeni renk eklenmez.
7. **Metinler:** Boş kart, ekran altı açıklamaları ve ekran okuyucu etiketleri ("Pazartesi için etkinlik ekle" vb.)
   yeni yapıya göre güncellenir.
8. **Mobil öncelik:** 360 px genişlikte tek satıra sığmayan form alanları alt satıra iner; yatay kaydırma olmaz.

## Veri taşıma

Mevcut antrenman kayıtları (canlıda, Neon PostgreSQL) yeni yapıya bir kez taşınır.

1. **Önce yedek:** Geçişten hemen önce veritabanının yedeği alınır (Neon'da dal/anlık görüntü ya da döküm). Yedeğin
   alındığı, yayın notunda yazılır.
2. **Ne taşınır:** Her antrenman kaydı, aynı günde, antrenman türünde bir etkinlik olur. Korunan bilgiler: gün,
   antrenman türü, süre, not, ekleyen, eklenme zamanı, düzenleyen, düzenlenme zamanı, "aktarıldı" işareti.
   Saat boş kalır.
3. **Tek adım, ya hep ya hiç:** Taşıma tek seferde yapılır; bir hata olursa hiçbir değişiklik kalmaz ve uygulama
   eski hâliyle çalışmaya devam eder.
4. **Kontrol:** Taşımadan önce ve sonra her aile için antrenman sayısı ve toplam antrenman dakikası karşılaştırılır;
   eşit değilse yayın durdurulur.
5. **Eski tablo:** Varsayım: eski antrenman tablosu bu sürümde silinmez, kullanılmadan bir sürüm daha yedek olarak
   bekletilir; bir sonraki görevde kaldırılır. (Bkz. Açık Soru 5.)
6. **Kimlik numaraları değişir:** Taşınan kayıtlar yeni numara alır. Geçiş anında açık olan bir "Geri al" süresi
   içindeki antrenman silme isteği başarısız olabilir; bu kabul edilebilir (kullanıcı sayfayı yenileyip tekrar siler).
7. **Firebase içe aktarma** taşımadan sonra yalnızca yeni yapıya yazar (Backend Gereksinimi 7).

## Kapsam Dışı

- Düzenleme sırasında bir kaydın türünü değiştirmek (etkinliği antrenmana ya da tersine çevirmek). Gerekirse silip
  yeniden eklenir. (Bkz. Açık Soru 3.)
- Aile bazlı antrenman türü listesi tutmak (kullanıcının yazdığı tür yalnızca o kayıtta durur) ya da yeni etkinlik türleri (Okul, Doktor…) tanımlamak.
- Etkinliklere süre eklemek (yalnızca antrenmanın süresi var).
- Antrenman için başlama/bitiş saati aralığı; bitiş saati süreden hesaplanıp gösterilmez.
- Hatırlatma / bildirim (mobil uygulama işiyle birlikte ayrıca ele alınacak).
- Saat alanının serbest metinden saat seçiciye çevrilmesi (ayrı, paralel iş).
- Eski antrenman tablosunun veritabanından silinmesi (bir sonraki görev).

## Kullanıcı kararları (2026-10-02)

Açık sorular kullanıcıya soruldu; yanıtlar:

1. **Veri:** Antrenmanlar etkinliklerle aynı yere taşınır (tek tablo, B seçeneği).
2. **"Etkinlik" sayısı:** Antrenmanları saymaz ("3 etkinlik · 2/7 gün antrenman · 2 sa 30 dk").
3. **Tür dönüştürme:** Gerekmez; yanlış türde girilen kayıt silinip yeniden eklenir.
4. **Antrenman türleri:** Hazır liste (Top, Kuvvet, Maç, Kondisyon) **ve** kullanıcı listede olmayan türü kendisi
   yazabilir (en fazla 50 karakter). Aile bazlı tür listesi tutulmaz; yazılan tür yalnızca o kayıtta durur.
5. **Eski antrenman tablosu:** Bir sürüm yedek olarak bekler (varsayım onaylandı sayıldı).
6. **Liste sırası:** Saatsiz kayıtlar saatlilerin altında (varsayım).
7. **Antrenmanın saati:** İsteğe bağlı (varsayım).

Not: Saat alanı yeni kayıtlarda SS:dd biçimindedir. Eski kayıtlarda serbest metin saat olabilir; böyle bir kayıt
düzenlenirken saat değiştirilmediyse olduğu gibi kabul edilir.

## Uygulama notları (ana oturum, 2026-10-02)

- **Backend:** `Event` modeline `Kind` (Event/Training), `TrainingType`, `Minutes` eklendi. `/days/{date}/training` uç noktaları kaldırıldı;
  etkinlik uç noktaları türe göre doğrular (etkinlik: ad zorunlu; antrenman: tür zorunlu, süre 1-1440). Saat boş ya da SS:dd;
  eski serbest metin saat değiştirilmeden gönderilirse kabul edilir. Gün listesi: saatliler saat sırasıyla, sonra saatsizler.
  Hafta özetine `trainingMinutes` eklendi; `eventCount` antrenmanları saymaz.
- **Migration `MergeTrainingIntoEvents`:** Antrenmanları kayıt iziyle birlikte etkinliklere kopyalar, aile bazında sayı ve toplam dakikayı
  karşılaştırır (tutmazsa hata, değişiklik kalmaz). `TrainingEntries` tablosu yedek olarak durur.
- **Firebase içe aktarma:** Antrenmanları `Kind = Training` etkinlik olarak yazar.
- **Frontend:** Antrenman kartı kaldırıldı; ortak `EventForm` (ekle/düzenle, tür seçici, hazır tür + "Diğer…"), gün kartında satır içi
  düzenleme, hafta tablosu ve listesinde çipe dokununca düzenleme penceresi (`EditEventDialog`). Tüm saatler saat seçici.
- **Testler:** e2e 95/95 (yeni `test_events_and_training`). Migration yerel verinin kopyasında denendi (3 antrenman / 51 dk taşındı,
  geri alma çalıştı). Tarayıcıda 390 ve 360 px: ekleme, "Diğer…" ile tür, düzenleme, hafta tablosu düzenleme penceresi, liste; konsol hatası yok.

