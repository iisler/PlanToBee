# Görev 08: Hesap silme ve KVKK metinleri (aydınlatma, gizlilik, kullanım koşulları)

Önceki görev: `docs/tasks/07-tek-ekran.md` (tek ekran plan).

Durum: Ürün: Taslak · Tasarım: Tamam (önizleme kullanıcı onayı bekliyor) · Backend: Tamamlandı (yalnızca hesap silme) · Frontend: Başlamadı · QA: Başlamadı

> **Kapsam güncellemesi (kullanıcı kararı):** Bu turda YALNIZCA hesap silme (uygulama içi silme akışı + sunucu ucu) yapılır. KVKK metinleri, herkese açık metin sayfaları, kayıt ekranındaki koşul onayı ve hesap silme bilgi sayfası sonraki tura kaldı (taslaklar: docs/legal/). Bu turda ilgili kabul kriterleri kapsam dışıdır.


---

## Özellik Özeti

App Store ve Google Play'e çıkış için iki zorunlu eksik kapatılır:

1. **Uygulama içi hesap silme:** Hesap sahibi, Ailem ekranından hesabını ve ailenin tüm verisini kalıcı olarak siler.
2. **KVKK ve gizlilik metinleri:** Aydınlatma Metni + Gizlilik Politikası, Kullanım Koşulları ve Hesap silme bilgi
   sayfası; girişsiz erişilebilir sayfalar olarak yayınlanır. Kayıtta Kullanım Koşulları onayı alınır ve onaylanan
   sürüm sunucuda saklanır.

Metinlerin tam taslağı bu belgede yoktur; ana oturum ayrı dosyada hazırlar. Bu belge içerik başlıklarını ve zorunlu
maddeleri tanımlar.

### Verilen kararlar (kullanıcı onayladı)

**1. Veri sorumlusu:** Gerçek kişi. Metinlerde `[Ad Soyad]` yer tutucusu kullanılır; yayından önce kullanıcı doldurur.
İletişim: plantobee.app@gmail.com.

**2. Hukuki dayanak (KVKK m.5/2)**
- Hizmetin sunulması: m.5/2-c (sözleşmenin kurulması/ifası).
- Güvenlik kayıtları (IP, giriş denemeleri): m.5/2-f (meşru menfaat).
- Kanuni yükümlülükler: m.5/2-ç.
- **Açık rıza metni yok** (pazarlama yok, özel nitelikli veri yok).

**3. Aydınlatma ile onay ayrıdır:** Aydınlatma bir bilgilendirmedir, onay kutusu değildir. Kayıt ekranında:
- `☐ Kullanım Koşulları'nı kabul ediyorum` (bağlantılı; işaretlenmeden kayıt olunmaz).
- Altında bilgi satırı: "Kişisel verilerin Aydınlatma Metni'ne uygun işlenir." (bağlantılı; onay kutusu yok).
- Kabul edilen koşul **sürümü** ve **zamanı** sunucuda hesapla birlikte saklanır (ileride sürüm değişirse yeniden
  onay istenebilsin).

**4. Herkese açık (girişsiz) sayfalar**
- Aydınlatma Metni + Gizlilik Politikası (tek sayfa olabilir).
- Kullanım Koşulları.
- Hesap silme bilgi sayfası (Google Play şartı): uygulama içi adımlar + e-postayla silme talebi yolu.
- Bağlantılar: giriş ekranında ve ad menüsünde.

**5. Hesap silme**
- Yer: Ailem ekranı, yalnızca **hesap sahibi** profilinde: "Hesabı ve tüm verileri sil".
- Onay adımı: silinecekler listesi + hesap şifresi yeniden + "SİL" yazma.
- Silinenler: kullanıcı hesabı, aile, tüm profiller, dersler/aktiviteler/ders listesi, bildirim abonelikleri,
  bildirim ayarları ve bildirim kuyruğu, yenileme belirteçleri/oturumlar; Data Protection anahtarları dışında
  hesaba ait her şey.
- Silme sonrası tüm cihazlar oturumdan düşer; kullanıcı giriş ekranına "Hesabın silindi" bilgisiyle döner.
- Aynı e-postayla yeniden kayıt mümkündür.
- Yedeklerden en geç **30 gün** içinde düşer (metinde yazar). Güvenlik kayıtları **90 gün** saklanır.

**6. Barındırma ve aktarım (bugünkü durum)**
- API: Render (Almanya/Frankfurt). Veritabanı: Neon (Almanya/Frankfurt).
- E-posta: Brevo (AB). Bildirim: Apple/Google push servisleri (içerik uçtan uca şifreli). Site: GitHub Pages.
- Metinlerde "Aktarım" bölümü **ayrı ve bağımsız** tutulur; Türkiye'deki sunucuya geçişte yalnızca o bölüm değişir.

**7. İşlenen veriler (gerçek koda göre)**
- Hesap: e-posta (veritabanında AES-256-GCM şifreli), şifre özeti, görünen ad.
- Profil: profil adları, rol, PIN özeti. Çocuk profillerinde e-posta yok, yalnızca ad; çocuk profillerini ebeveyn açar.
- Plan: dersler, aktiviteler, notlar, saatler, ekleyen/değiştiren bilgisi.
- Bildirim: abonelik (şifreli) ve cihaz adı.
- Güvenlik: IP adresi ve giriş denemeleri (hız sınırı/kilit).

---

## Kullanıcı Hikayeleri

1. **Hesap sahibi olarak**, hesabımı ve ailemin tüm verisini uygulama içinden kalıcı olarak silebilmek istiyorum.
2. **Hesap sahibi olarak**, silmeden önce neyin silineceğini açıkça görmek ve yanlışlıkla silmemek için güçlü bir
   onay vermek istiyorum.
3. **Çocuk veya diğer ebeveyn olarak**, aile hesabını silemeyeyim; böylece aile verisi yanlışlıkla kaybolmaz.
4. **Aile üyesi olarak**, hesap silindiğinde açık kalan cihazlarımın da oturumdan düşmesini istiyorum.
5. **Eski kullanıcı olarak**, hesabımı sildikten sonra aynı e-postayla yeniden kayıt olabilmek istiyorum.
6. **Yeni kullanıcı olarak**, kayıt olurken Kullanım Koşulları'nı okuyup kabul etmek ve verilerimin nasıl
   işlendiğini öğrenmek istiyorum.
7. **Ziyaretçi olarak**, giriş yapmadan Aydınlatma Metni, Gizlilik Politikası, Kullanım Koşulları ve hesap silme
   bilgisine ulaşmak istiyorum.
8. **Uygulamaya erişimi olmayan kullanıcı olarak**, e-postayla silme talebinde bulunabilmek istiyorum.
9. **Veri sorumlusu olarak**, hangi kullanıcının hangi koşul sürümünü ne zaman kabul ettiğini bilmek istiyorum.

---

## Kabul Kriterleri

### Kayıt ve koşul onayı
1. Kayıt ekranında "Kullanım Koşulları'nı kabul ediyorum" onay kutusu bulunur, varsayılan olarak işaretsizdir;
   "Kullanım Koşulları" bağlantısı koşul sayfasını açar.
2. Kutu işaretli değilken kayıt düğmesi kayıt yapmaz ve kullanıcıya anlaşılır bir uyarı gösterilir.
3. Onay kutusu atlanarak doğrudan API'ye yapılan kayıt isteği (koşul onayı yok veya yanlış/bilinmeyen sürüm)
   sunucuda reddedilir (400) ve hesap oluşmaz.
4. Kutunun altında "Kişisel verilerin Aydınlatma Metni'ne uygun işlenir." satırı vardır; "Aydınlatma Metni"
   bağlantılıdır ve bu satırda onay kutusu yoktur.
5. Başarılı kayıttan sonra veritabanında hesapla birlikte kabul edilen koşul sürümü ve kabul zamanı (UTC) bulunur.
6. Görev öncesinde açılmış mevcut hesaplar çalışmaya devam eder; onay alanları boş kalır (Varsayım: mevcut
   kullanıcılardan yeniden onay istemek bu görevde yoktur, bkz. Kapsam Dışı).

### Herkese açık sayfalar
7. Aydınlatma/Gizlilik, Kullanım Koşulları ve Hesap silme bilgi sayfaları giriş yapmadan, kalıcı adreslerden açılır
   (mağaza formlarına girilecek adresler; Varsayım: GitHub Pages altında).
8. Giriş ekranında ve ad menüsünde bu üç sayfanın bağlantıları vardır.
9. Her metinde "Son güncelleme" tarihi ve sürüm bilgisi bulunur; Kullanım Koşulları sürümü, sunucuda saklanan
   sürümle aynı değerdir.
10. Hesap silme bilgi sayfası uygulama içi adımları (ad menüsü > Ailem > Hesabı ve tüm verileri sil) ve
    plantobee.app@gmail.com adresine silme talebi yolunu, silinen/saklanan verileri ve sürelerini (yedekler 30 gün,
    güvenlik kayıtları 90 gün) içerir.
11. Sayfalar 360 px genişlikte yatay kaydırmasız okunur.

### Hesap silme: görünürlük ve yetki
12. "Hesabı ve tüm verileri sil" yalnızca hesap sahibi profili seçiliyken Ailem ekranında görünür.
13. Çocuk profili seçiliyken bu seçenek görünmez; çocuk profiliyle silme uç noktasına yapılan istek reddedilir
    (403) ve hiçbir veri silinmez.
14. Hesap sahibi olmayan ebeveyn profiliyle seçenek görünmez; istek reddedilir (403), veri silinmez.
15. Bir ailenin oturumuyla başka bir ailenin silinmesi mümkün değildir: istek yalnızca oturumun kendi hesabını
    hedefler; başka aileye ait veri hiçbir koşulda etkilenmez (iki aileli testte diğer ailenin tüm verisi aynen kalır).
16. Oturumsuz istek 401 döner.

### Hesap silme: onay adımı
17. Onay penceresinde silinecekler listesi (hesap, aile, tüm profiller, plan verileri, bildirim ayarları/abonelikleri,
    tüm cihazlardaki oturumlar) ve geri alınamayacağı bilgisi gösterilir.
18. Hesap şifresi girilmeden ve "SİL" yazılmadan silme düğmesi etkin olmaz.
19. "SİL" dışındaki yazım (örn. "sil", "SIL", boşluklu) kabul edilmez (Varsayım: büyük harf, Türkçe İ ile tam eşleşme).
20. Yanlış şifreyle istek reddedilir, veri silinmez ve kullanıcıya "Şifre hatalı" benzeri mesaj gösterilir.
    Yanlış şifre denemeleri mevcut hız sınırı/kilit kurallarına tabidir.
21. Vazgeç denirse hiçbir şey silinmez ve kullanıcı Ailem ekranında kalır.

### Hesap silme: sonuç
22. Başarılı silmeden sonra silmeyi yapan cihaz giriş ekranına döner ve "Hesabın silindi" bilgisi görünür;
    cihazda kalan oturum/profil bilgisi temizlenir.
23. Silme anında başka cihazlarda açık oturumlar bir sonraki istekte 401 alır ve giriş ekranına düşer; yenileme
    belirteciyle yeni oturum alınamaz.
24. Veritabanında doğrulama (QA, silmeden sonra): silinen hesaba ait kullanıcı, aile, profiller, dersler,
    aktiviteler, ders listesi, bildirim abonelikleri, bildirim ayarları, bildirim kuyruğu ve yenileme belirteci
    satırı kalmaz (her tablo için hesaba/aileye göre sayım = 0).
25. Silinen ailenin bildirim kuyruğundaki bekleyen bildirimler gönderilmez.
26. Aynı e-postayla yeniden kayıt başarılı olur; yeni hesap boştur, eski veriden hiçbir şey görünmez.
27. Silinen e-postayla giriş denemesi, var olmayan hesapla aynı genel hata mesajını verir.
28. Silme işlemi bütün halinde yapılır: ara adımda hata olursa hiçbir şey yarım silinmiş kalmaz ve kullanıcıya hata
    gösterilir.
29. Güvenlik kayıtları (IP, giriş denemeleri) hesapla birlikte silinmeyebilir; en fazla 90 gün sonra kendiliğinden
    silinir (Varsayım: bu süre sınırı mevcut kayıtlar için de uygulanır).

### Metin içeriği (kontrol listesi)
30. Aydınlatma Metni aşağıdaki "Metin içerik başlıkları" bölümündeki tüm zorunlu başlıkları içerir.
31. Kullanım Koşulları aşağıdaki tüm zorunlu başlıkları içerir.
32. Metinlerde `[Ad Soyad]` yer tutucusu dışında kişisel bilgi bulunmaz; yayından önce doldurulduğu kontrol edilir.

---

## Metin İçerik Başlıkları (zorunlu maddeler)

### A. Aydınlatma Metni + Gizlilik Politikası
1. **Veri sorumlusu:** `[Ad Soyad]` (gerçek kişi), iletişim plantobee.app@gmail.com.
2. **İşlenen kişisel veriler:** Karar 7'deki liste; e-postanın şifreli saklandığı, şifre ve PIN'in yalnızca özet
   olarak tutulduğu; çocuk profillerinde e-posta olmadığı.
3. **İşleme amaçları:** hesap ve aile yönetimi, plan hizmetinin sunulması, aile içi bildirimler, şifre sıfırlama/
   e-posta doğrulama gibi hizmet e-postaları, güvenlik (kötüye kullanım ve kaba kuvvet önleme).
4. **Hukuki sebepler:** m.5/2-c, m.5/2-f (güvenlik kayıtları), m.5/2-ç. Açık rızaya dayalı işleme olmadığı.
5. **Aktarım (ayrı bölüm):** Render, Neon (Frankfurt), Brevo (AB), Apple/Google push servisleri (içerik uçtan uca
   şifreli), GitHub Pages; yurt dışı aktarım bilgisi. Bölüm, Türkiye sunucusuna geçişte tek başına değiştirilebilir.
6. **Toplama yöntemi:** uygulama arayüzü üzerinden kullanıcının girdiği bilgiler; otomatik olarak sunucu ve güvenlik
   kayıtları. Reklam/izleme/analitik çerezi kullanılmadığı (Varsayım: kodda yok, ana oturum teyit etsin).
7. **Saklama süreleri:** hesap süresince; silmede hemen; yedeklerde en geç 30 gün; güvenlik kayıtları 90 gün.
8. **İlgili kişinin hakları (KVKK m.11):** maddenin tüm bentleri.
9. **Başvuru yolu:** plantobee.app@gmail.com; en geç 30 gün içinde ücretsiz yanıt; Kurul'a şikâyet hakkı.
10. **Çocuklar:** çocuk profillerinin ebeveyn tarafından açıldığı, çocuk için yalnızca ad tutulduğu, çocuk adına
    hakların ebeveyn/veli tarafından kullanılacağı.
11. **Güvenlik önlemleri (kısa):** şifreleme, özetleme, hız sınırı.
12. **Değişiklikler ve son güncelleme tarihi/sürüm.**

### B. Kullanım Koşulları
1. **Hizmet tanımı:** aile için ders ve aktivite planlama uygulaması; ücretsiz.
2. **Hesap ve ebeveyn sorumluluğu:** hesabı yetişkin açar; çocuk profillerinden ve girilen içerikten hesap sahibi
   sorumludur; şifre/PIN güvenliği kullanıcıdadır.
3. **Kabul edilemez kullanım:** hukuka aykırı içerik, sisteme saldırı, otomatik kötüye kullanım, başkası adına hesap.
4. **Hizmetin olduğu gibi sunulması:** garanti verilmez; kesinti ve veri kaybı riskine karşı sorumluluk sınırı
   (tüketici mevzuatının izin verdiği ölçüde).
5. **Hesabın sonlandırılması:** kullanıcının silme hakkı; kötüye kullanımda erişimin kapatılabileceği.
6. **Değişiklikler:** sürüm numarası; önemli değişiklikte yeniden onay istenebileceği.
7. **Uygulanacak hukuk:** Türkiye Cumhuriyeti hukuku (Varsayım).
8. **İletişim:** plantobee.app@gmail.com.

### C. Hesap silme bilgi sayfası
Uygulama içi adımlar, e-postayla talep (hesap e-postasından gönderilmesi istenir), silinen veriler, saklanan veriler ve
süreleri (yedek 30 gün, güvenlik kayıtları 90 gün).

---

## Backend Gereksinimleri

1. **Hesap silme uç noktası:** yalnızca oturum sahibi kullanıcının hesabını hedefler (hedef kimliği istekten
   alınmaz); seçili profilin hesap sahibi olması zorunlu (aksi 403); hesap şifresi yeniden doğrulanır (yanlışsa hata,
   hız sınırına tabi); "SİL" onay metni sunucuda da kontrol edilir.
2. Silme tek işlemde (transaction) yapılır: kullanıcı, aile, profiller, dersler, aktiviteler, ders listesi, bildirim
   abonelikleri/ayarları/kuyruğu, yenileme belirteçleri ve hesaba bağlı diğer tüm satırlar. Data Protection anahtar
   tabloları korunur.
3. Silme sonrası mevcut erişim belirteçleri de geçersiz olur (diğer cihazlar sonraki istekte 401); arka plan bildirim
   işi silinmiş aileye gönderim yapmaz.
4. E-posta tekilliği silinen hesabı engellemez; aynı e-postayla yeniden kayıt çalışır.
5. **Koşul onayı alanları:** hesapta kabul edilen koşul sürümü ve kabul zamanı (UTC). EF Core migration ile eklenir;
   mevcut hesaplarda boş kalabilir.
6. **Kayıt doğrulaması:** kayıt isteği koşul onayını ve sürümü taşır; onay yoksa veya sürüm geçerli sürüm değilse 400.
   Geçerli koşul sürümü tek yerde tanımlanır (frontend'in de okuyabileceği şekilde; Varsayım).
7. Güvenlik kayıtları için 90 günlük saklama sınırı (eski kayıtların temizlenmesi).
8. Uçtan uca testler (`backend/tests/e2e.py`): koşulsuz kayıt reddi, onay alanlarının yazılması, silme yetkisi
   (çocuk/diğer ebeveyn 403, oturumsuz 401), yanlış şifre, iki aile izolasyonu, silme sonrası diğer oturum 401 ve
   yenileme reddi, tablo bazında sayım = 0, aynı e-postayla yeniden kayıt.

## Frontend Gereksinimleri

1. Kayıt ekranı: koşul onay kutusu + bilgi satırı (bağlantılı); işaretsizken kayıt yapılmaz; sürüm istekle gönderilir.
2. Herkese açık üç sayfa (girişsiz, kalıcı adres); metinler ana oturumun hazırladığı dosyadan gelir.
3. Giriş ekranında ve ad menüsünde metin bağlantıları.
4. Ailem ekranında yalnızca hesap sahibi profilinde "Hesabı ve tüm verileri sil" ve onay penceresi (liste, şifre,
   "SİL" yazma, Vazgeç).
5. Başarılı silmede yerel oturum/profil/bildirim verisi temizlenir, service worker aboneliği kaldırılır, giriş ekranında
   "Hesabın silindi" gösterilir.
6. Herhangi bir istekte 401 alınınca (başka cihazda silinmiş hesap) giriş ekranına düşülür.
7. 360/390 px'de yatay kaydırmasız; dokunma alanları en az 44 px.

---

## Tasarım Notları (ux-ui-designer için)

1. Silme seçeneği Ailem ekranında sayfanın en altında, ayrı bir "Tehlikeli bölge" alanında; sıradan düğmelerden
   görsel olarak ayrışmalı ama göz korkutucu olmamalı.
2. Onay penceresi: başlık, silinecekler listesi (madde madde, sade dil), "Bu işlem geri alınamaz", şifre alanı,
   "SİL yazın" alanı, iki düğme (Vazgeç birincil konumda, Sil kırmızı ve koşullar sağlanana kadar pasif).
3. Silme sırasında yükleniyor durumu; çift tıklamayla iki istek gitmemeli.
4. "Hesabın silindi" bilgisi giriş ekranında kısa ve sakin bir mesaj.
5. Kayıt ekranında onay kutusu ve bilgi satırı formu kalabalıklaştırmamalı; bağlantılar okunabilir ve dokunulabilir.
6. Metin sayfaları: okunabilir satır uzunluğu, başlık hiyerarşisi, içindekiler (isteğe bağlı), "Son güncelleme" üstte.
7. Giriş ekranı ve ad menüsünde bağlantılar alt kısımda küçük ama erişilebilir.

---

## Kapsam Dışı

- Açık rıza metni, pazarlama izni, çerez onay bandı.
- Koşul sürümü değişince mevcut kullanıcılardan yeniden onay isteme akışı (alt yapı hazırlanır, akış sonra).
- Tek bir profilin (hesap sahibi dışında) kendi isteğiyle hesaptan ayrılması; hesap sahipliğinin devri.
- Silme öncesi veri dışa aktarma (veri taşınabilirliği indirme).
- Silme için bekleme süresi / geri alma penceresi (silme anında kalıcıdır).
- E-postayla gelen silme taleplerinin otomasyonu (elle yürütülür).
- Metinlerin İngilizce sürümü; Türkiye sunucusuna geçiş (ayrı görev).

---

## Açık Riskler

1. **KVKK m.9 (yurt dışı aktarım).** Veriler Almanya/AB'de ve ABD merkezli servislerde (Apple, Google, GitHub)
   işleniyor. Yurt dışı aktarımın yeterlilik/standart sözleşme/bildirim şartları gerçek kişi veri sorumlusu için
   belirsiz; hukukçu teyidi önerildi. Türkiye VPS'e geçiş planı var; metinde "Aktarım" bölümü ayrı tutulur.
2. **VERBİS.** Gerçek kişi ve küçük ölçekli veri sorumlusu için kayıt yükümlülüğü muafiyeti teyit edilmeli.
3. **Yedekler.** Neon'un nokta geri yükleme penceresinin 30 günü aşmadığı teyit edilmeli; aşıyorsa metin veya
   ayar güncellenmeli.
4. **Mağaza şartları.** Google Play veri güvenliği formu ve Apple gizlilik etiketi metinlerle tutarlı doldurulmalı;
   silme bilgi sayfası adresi kalıcı olmalı (GitHub Pages yolu değişirse mağaza kaydı bozulur).
5. **Erişim belirteci ömrü.** Durumsuz belirteçler süresi dolana kadar geçerli kalabilir; Kabul Kriteri 23 için
   sunucu tarafında hesap varlık kontrolü gerekir.
6. **E-postayla silme talebi kimlik doğrulaması.** Talebin hesap sahibinden geldiği elle doğrulanmalı; yanlış kişinin
   talebiyle silme riski.
7. **`[Ad Soyad]` yer tutucusu** yayından önce doldurulmazsa metinler eksik kalır.

---

## Tasarım

Önizleme: `/tmp/ptb-ux-preview/30-hesap-silme.png` (390 px, çerçeve 1–5), `/tmp/ptb-ux-preview/31-hesap-silme-360.png`
(360 px kontrolü + ailesiz hesap, çerçeve 6). 360 px'te yatay taşma yok.

### Kararlar
1. **Onay görünümü tam sayfa, alt sayfa (Sheet) değil.** Gerekçe: iki yazı alanı + uzun liste + iki düğme ~600 px;
   iPhone'da klavye açıkken sabit konumlu alt sayfa klavyenin altında kalır ya da zıplar, katmana yanlış dokunuş
   kapatır. Normal akıştaki sayfada Safari odaklanan alanı kendiliğinden görünür kaydırır. Ailem/Bildirimler gibi
   PlanShell'de yeni bir görünüm: `view === 'delete-account'`.
2. **Ailesiz hesap için de silme yolu gerekir** (Apple 5.1.1(v): hesap açılabilen her uygulamada uygulama içi silme;
   aile kurma ekranında takılan kullanıcı da giriş yapmış bir hesap sahibidir). CreateFamilyPage alt bağlantılarına
   "Çıkış yap" yanına "Hesabı sil" eklenir; aynı form AuthLayout içinde kısa listeyle açılır. VerifyPendingPage
   (doğrulanmamış e-posta) için de aynı bağlantı önerilir. **Backend talebi:** ailesi olmayan kullanıcıda profil/hesap
   sahibi kontrolü yerine "kullanıcının kendisi" yeterli sayılsın (403 değil).
3. Hesap sahibi olmayan **ebeveyn** profilinde sayfanın en altında tek satır not: "Hesabı yalnızca hesap sahibi
   ({sahibin profil adı}) silebilir." **Çocuk** profilinde hiçbir şey görünmez.

### Çerçeve 1: Ailem, en alt (yalnızca `isOwner && isCurrent` profili)
- Son kart (Profil ekle'den sonra): `<section className="card danger-zone" aria-labelledby>`; `card-head` içinde
  `h2` "Hesabı sil"; `.muted` "Hesabın, ailedeki tüm profiller ve tüm plan verileri kalıcı olarak silinir. Bu işlem
  geri alınamaz."; tam genişlik `btn-ghost danger` "Hesabı ve tüm verileri sil" (44 px, kırmızı çerçeve + kırmızı
  yazı; dolu kırmızı değil, göz korkutmasın). Dokununca silme görünümü açılır.

### Çerçeve 2: Silme sayfası (PlanShell, `.wrap` içinde)
- `pagehead`: `btn-ghost small` "‹ Ailem" (Ailem'e döner) + `h2` "Hesabı sil" (açılışta odak, `tabIndex=-1`,
  mevcut familyHeadingRef deseni).
- Tek `card`:
  - `p.delete-lead` "Şunlar kalıcı olarak silinir:"
  - `ul.delete-list`: "Hesabın ve e-posta adresin (`<b>{user.email}</b>`)", "Ailedeki tüm profiller ({n} profil) ve
    PIN'leri", "Tüm dersler, aktiviteler, notlar ve ders listesi", "Bildirim abonelikleri ve ayarları", "Tüm
    cihazlardaki açık oturumlar". (E-posta mono, `overflow-wrap:anywhere`; uzun adres kırılır.)
  - `p.delete-warn` "Bu işlem geri alınamaz." (kalın, `--danger`; kutu yok, hata kutusundan ayrışsın).
  - `.small-note` "Yedeklerden de en geç 30 gün içinde silinir. Aynı e-postayla yeniden kayıt olabilirsin."
  - `form.stack-form.delete-form` (üstte ince çizgi):
    - `label.pin-label` "Hesap şifren" + `PasswordInput` (`autoComplete="current-password"`, placeholder "Şifre").
    - `label.pin-label` "Onaylamak için SİL yaz" + input (`placeholder="SİL"`, `autoCapitalize="characters"`,
      `autoCorrect="off"`, `spellCheck={false}`, `autoComplete="off"`).
    - Hata kutusu `.auth-error role="alert"` (düğmelerin hemen üstünde).
    - `.delete-actions`: iki eşit sütun; solda `btn-ghost` "Vazgeç" (Ailem'e döner, hiçbir şey silinmez), sağda
      `btn-danger` "Hesabı sil"; şifre dolu **ve** değer tam olarak "SİL" iken etkin. Enter = gönder (yalnızca etkinse).
- Yazı alanları **16 px** (iPhone yakınlaştırması; `stack-form input` 14 px olduğu için `.delete-form input` ile).

### Durumlar
- **Boş/pasif (2):** düğme `disabled` (mevcut opaklık 0,6).
- **"SIL"/"sil" yazıldı (2b):** girdi `toLocaleUpperCase('tr')` ya da I→İ ile "SİL"e eşitse ama birebir değilse alanın
  altında `.field-hint` "Büyük harflerle, noktalı İ ile yaz: SİL"; düğme pasif kalır (Kabul 19). `aria-describedby`
  ile alana bağlanır.
- **Yanlış şifre (3):** "Şifre hatalı." (sunucu mesajı); şifre alanı temizlenir ve odaklanır, "SİL" korunur.
- **Kilit/çok deneme (3b):** 429 mesajı aynen ("Çok fazla hatalı deneme. Birkaç dakika sonra tekrar dene.");
  alanlar korunur.
- **Bağlantı hatası:** `errorText` varsayılan metni aynı kutuda; alanlar korunur, tekrar denenebilir.
- **Bekleme (4):** `BusyLabel busy text="Hesabı sil" busyText="Siliniyor…"`; iki alan, Vazgeç ve "‹ Ailem" `disabled`;
  istek sürerken ikinci gönderim yok (çift dokunuş). Sunucu uyanıyorsa 2 sn sonra mevcut `useSlow` + `Loading`
  kullanılabilir.
- **Başarı (5):** giriş ekranında sekmelerin üstünde `.auth-info role="status"` "Hesabın ve tüm verilerin silindi."
  Toast değil, kalıcı (kullanıcı giriş/kayıt sekmesine dokunana ya da yazmaya başlayana kadar). Başka cihazda 401 ile
  düşen oturumda bu mesaj **gösterilmez** (normal giriş ekranı).

### Çerçeve 6: Ailesiz hesap
- CreateFamilyPage `auth-links`: "Çıkış yap" · "Hesabı sil" (`auth-link danger`). Silme görünümü AuthLayout
  (subtitle "Hesabı sil"), liste yalnızca "Hesabın ve e-posta adresin (…)" ve "Tüm cihazlardaki açık oturumlar";
  form, durumlar ve başarı aynı. Vazgeç aile kurma ekranına döner.

### Önerilen index.css ekleri (frontend-developer ekler; maketteki değerler)
```css
.btn-ghost.danger { color: var(--danger); border-color: var(--danger); }
.danger-zone .btn-ghost.danger { width: 100%; min-height: 44px; margin-top: 12px; }
.delete-lead { margin: 0 0 8px; font-size: 14px; }
.delete-list { margin: 0 0 10px; padding-left: 20px; font-size: 14px; line-height: 1.5; }
.delete-list li { margin: 3px 0; }
.delete-list b { font-family: var(--f-mono); font-weight: 500; font-size: 12.5px; overflow-wrap: anywhere; }
.delete-warn { margin: 0 0 4px; font-weight: 700; color: var(--danger); font-size: 14px; }
.delete-form { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.delete-form input { font-size: 16px; }
.delete-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.delete-actions button { min-height: 44px; font-size: 14px; }
.field-hint { font-size: 12.5px; color: var(--warn); font-weight: 600; }
.auth-link.danger { color: var(--danger); text-decoration-color: currentColor; }
```
Yeni renk yok. Kontrast: `--danger` yüzeyde ~9,4:1, `btn-danger` beyaz yazı ~9,7:1, `--warn` yüzeyde AA.

### Erişilebilirlik
- Görünür etiketler (yalnızca placeholder değil); hata `role="alert"`, başarı `role="status"`.
- Düğme metinleri anlamlı; ek aria-label gerekmez. Tehlike rengi her yerde metinle birlikte ("Bu işlem geri alınamaz").
- Odak: sayfa açılınca h2; Vazgeç/geri sonrası Ailem'deki "Hesabı ve tüm verileri sil" düğmesine dön.
- Dokunma alanları: tüm düğmeler ≥44 px; göz düğmesi mevcut 44×44.

### Kabul (tasarım incelemesinde bakılacak)
390 ve 360 px'te taşma yok; düğmeler 44 px; alanlar 16 px; düğme yalnızca şifre + "SİL" ile etkin; çocuk profilinde
bölüm ve not yok; başarı mesajı giriş ekranında kalıcı.

---

## Backend Çıktısı

Kapsam: yalnızca hesap silme (Backend Gereksinimleri 1–4). Koşul onayı alanları (5–6) ve güvenlik kayıtlarının 90 gün
sınırı (7) bu turda yapılmadı. Migration yok, şema değişmedi, yeni paket yok.

### Uç nokta: `POST /api/account/delete`

DELETE yerine POST: gövdede şifre var; gövdeli DELETE'in anlamı tanımsızdır, bazı proxy'ler gövdeyi atar.
`[Authorize]`, hız sınırı `Auth` (IP başına). `[RequireVerifiedEmail]` yok: e-postası doğrulanmamış hesap da silebilir.
Hedef her zaman oturumun kendi hesabıdır; gövdede kimlik yoktur.

Gövde: `{ "password": "…", "confirm": "SİL" }`. `confirm` baştaki ve sondaki boşluk kırpıldıktan sonra tam olarak
`SİL` olmalı (Türkçe İ). Kontrol sırası: profil yetkisi, onay metni, şifre.

| Durum | Gövde | Ne zaman |
|---|---|---|
| 204 | (boş) | Silindi. İstemci yerel oturumu, profili ve bildirim verisini temizler, giriş ekranında "Hesabın silindi" gösterir. |
| 401 | (boş) | Oturum yok ya da geçersiz (hesap başka cihazda silinmişse de bu döner). |
| 403 | `{"code":"owner_only","message":"Hesabı yalnızca hesap sahibi kendi profilinden silebilir."}` | Çocuk ya da diğer ebeveyn profili seçili. |
| 403 | `{"code":"profile_required",…}` | Ailesi olan hesapta profil seçilmemiş. Ailesi olmayan hesapta profil gerekmez. |
| 400 | `{"code":"confirm_invalid","message":"Onaylamak için SİL yaz."}` | `confirm` eksik ya da `SİL` değil (`sil`, `SIL`, `S İL` …). Şifre denemesi sayılmaz. |
| 400 | `{"code":"password_invalid","message":"Şifre hatalı."}` | Şifre yanlış ya da eksik. Giriş kilidi sayacına yazılır. Oturum sürer: 401 değil. |
| 429 | `{"code":"locked_out",…}` | 5 hatalı denemede 5 dk kilit; girişle aynı sayaç. |
| 429 | `{"code":"rate_limited",…}` | IP hız sınırı aşıldı. |
| 500 | `{"code":"server_error",…}` | Silme tamamlanamadı; hiçbir şey silinmedi (işlem geri alındı). |

### Silinenler (tek transaction)
Users satırı aynı anda gelen ikinci silme isteğine karşı `FOR UPDATE` ile kilitlenir. Silme sırası:
StudyEntries, Events, TrainingEntries (eski), Days, Subjects, PendingNotifications, PushSubscriptions,
NotificationPreferences, RefreshTokens, FamilyMembers (eski üyeler dahil), Families. Son olarak
`UserManager.DeleteAsync` ile Users silinir; UserClaims, UserLogins, UserTokens ve UserRoles veritabanında cascade
ile gider. Gerçek FK'ler e2e veritabanında `pg_constraint` ile doğrulandı. Satırlar açıkça siliniyor; cascade'ler
yalnızca o sırada eşzamanlı eklenen satırlar için güvence. DataProtectionKeys tablosuna ve başka ailelere dokunulmaz.

### Sonrası
- Erişim belirteçleri: JwtBearer `OnTokenValidated` her istekte kullanıcıyı arıyor. Kullanıcı olmadığı için bütün
  cihazlar sonraki istekte 401 alır.
- Yenileme belirteçleri silindiği için yenileme `401 refresh_invalid` döner.
- Silinen e-postayla giriş, olmayan hesapla aynı `401 invalid_credentials` gövdesini döner.
- E-posta ve h1 indeks satırı kalmadığı için aynı e-postayla yeniden kayıt çalışır.
- Kuyruktaki bildirimler silindiği için gönderilmez.
- Günlüğe yalnızca `Hesap silindi. UserId=… FamilyId=…` yazılır.
- Davranış değişikliği: `NotificationDispatcher` ve `PushSender`, gönderim sırasında silinen satırlarda çıkan
  `DbUpdateConcurrencyException` hatasını yakalıyor. Eskiden bu hata turu yarıda kesiyor ve diğer ailelerin
  bildirimleri gecikiyordu. Şimdi dağıtıcı turu geri alıp bir sonraki turda yeniden deniyor.

### Değişen dosyalar
- `backend/PlanToBee.API/Controllers/AccountController.cs` (yeni)
- `backend/PlanToBee.API/DTOs/AuthDtos.cs` (`DeleteAccountDto`)
- `backend/PlanToBee.API/Services/Notifications/NotificationDispatcher.cs`
- `backend/PlanToBee.API/Services/Notifications/PushSender.cs`
- `backend/tests/e2e.py`: `test_account_delete` (40 kontrol). Yeni isteğe bağlı `--psql` seçeneği tablo bazında
  satır sayar. Verilmezse sayım atlanır, API üzerinden yapılan kontroller yine çalışır.

### Test sonuçları
- `dotnet build`: 0 uyarı.
- WebPushSelfTest: geçti.
- `has-pending-model-changes`: değişiklik yok.
- e2e (`--psql` ile): 180/180 geçti (140 eski + 40 yeni).

### Canlıya alma ve sınırlamalar
- Şema değişmediği için geri dönüş yalnızca kod geri alımıdır. Silinen veri yedek (Neon branch / PITR) olmadan geri gelmez.
- Eski istemci yeni API ile sorunsuz çalışır. Yeni istemci eski API'ye istek atarsa 404 alır; istemci bunu "silinemedi" diye göstermeli.
- Bellekteki giriş kilidi ve gönderim sınırı kayıtları (SendThrottle, MissingAccountLockout) kimlik bilgisi içermez ve kendiliğinden düşer.

### Frontend için
- 400 `password_invalid` ve 429 gelince oturumu kapatma.
- 204 gelince service worker aboneliğini yerelde kaldır. Sunucudaki abonelik zaten silindi; `DELETE /push/subscription` çağırmaya gerek yok (çağrılırsa 401 döner).

