# Görev 06: Bildirimler (Web Push)

Önceki görev: `docs/tasks/05-antrenman-etkinlige.md`.

Durum: Backend: Tamamlandı · Frontend: Tamamlandı · QA: Ana oturumda test edildi (e2e 136/136, WebPushSelfTest 29/29, gerçek Chrome + FCM uçtan uca). Gerçek cihaz (iPhone/Android) testi canlıda yapılacak.

---

## Özellik Özeti

Aile üyeleri plana bir şey eklediğinde ya da bir dersi bitirdiğinde, diğer aile üyelerinin cihazına bildirim gider
(örn. "Ela Matematik'i bitirdi", "Ela 4 kayıt ekledi · 3 ders, 1 aktivite"). Bildirim uygulama kapalıyken de gelir;
dokununca uygulama ilgili günün sayfasında açılır.

- Bildirimler standart **Web Push** ile gönderilir; üçüncü taraf bildirim servisi kullanılmaz, ek ücret yoktur.
- Abonelik **cihaz + profil** bazlıdır: cihazda hangi profil seçiliyse bildirimler o profil adına gelir.
- Her profil hangi kişilerin girişlerinden, hangi türlerde bildirim alacağını ve sessiz saatleri seçer.
- Ayarlar Ailem ekranındaki yeni **"Bildirimler"** kartındadır.

### Verilen kararlar (kullanıcı onayladı)

**1. Teknoloji**
- Standart Web Push (RFC 8030 / 8291 / 8292). Üçüncü taraf bildirim servisi veya SDK **yok** (Firebase, OneSignal yok).
- Sunucuda dış NuGet paketi **yok**: şifreleme (ECDH P-256, HKDF, AES-128-GCM "aes128gcm") ve VAPID imzası
  (ES256 JWT) .NET'in yerleşik `System.Security.Cryptography`'si ile yazılır ve RFC 8291 test vektörleriyle doğrulanır.
- Frontend'de yalnızca kendi service worker'ımız + web app manifest; dış kütüphane yok.

**2. Güvenlik**
- Abonelik bilgisi (endpoint, p256dh, auth) veritabanında mevcut `PersonalDataProtector` ile AES-256-GCM şifreli saklanır.
- VAPID özel anahtarı yalnızca Render gizli değişkenindedir (kodda/GitHub'da yok).
- Endpoint yalnızca bilinen push servislerine (Apple, Google FCM, Mozilla, Microsoft) izinlidir (SSRF önlemi).
- Bildirim içeriği uçtan uca şifrelidir.

**3. Abonelik: cihaz + profil**
- Cihazda seçili profil adına abone olunur; profil değişince abonelik yeni profile geçer.
- Çıkış yapılınca ya da profil silinince abonelik silinir.
- Push servisi 404/410 dönerse abonelik silinir.

**4. Kime gider**
- Kaydı giren kişiye bildirim gitmez.
- "Kimin girişleri": profil bazlı seçim; varsayılan: kendisi hariç herkes.

**5. Bildirim türleri ve varsayılanlar**

| Tür | Varsayılan | Örnek |
|---|---|---|
| Ders eklenince | AÇIK | "Ela Matematik ekledi · Salı" |
| Aktivite eklenince | AÇIK | "Ela Konser ekledi · Cuma 19:00" |
| Değişiklik ve silme | KAPALI | "Ela bir dersi sildi" |
| Ders tamamlanınca (durum Tamam'a geçince) | AÇIK | "Ela Matematik'i bitirdi" |

Varsayım: Örnek metinler yön gösterir; kesin metinleri frontend/tasarım belirler, kabul kriterlerindeki bilgileri taşıması yeterlidir.

**6. Toplama:** İlk giriş için bildirim hemen gider; aynı kişinin sonraki ~1 dk içindeki girişleri tek bildirimde toplanır
("Ela 4 kayıt ekledi · 3 ders, 1 aktivite").

**7. Sessiz saatler:** Var; varsayılan AÇIK, 22:00–07:30 (Türkiye saati). Bu aralıkta oluşanlar sessiz saat bitince
tek özet bildirim olarak gider.

**8. İzin isteme:** Uygulamada bir kez "Aileden haberdar ol" kartı gösterilir ("Bildirimleri aç" / "Şimdi değil").
"Şimdi değil" denirse o cihazda bir daha sorulmaz. Ayarlar Ailem ekranındaki "Bildirimler" kartından yapılır:
bu cihaz aç/kapa, kimin girişleri, türler, sessiz saatler, bildirim alan cihaz listesi.

**9. Dokununca:** Uygulama ilgili günün sayfasında açılır.

**10. iPhone:** "Ana Ekrana Ekle" yönlendirmesi yapılmaz (kapsam dışı). iPhone'da Web Push yalnızca ana ekrana
eklenmiş uygulamada çalışır; bu bilinen bir kısıttır.

**11. Altyapı:** Ücretsiz katman; ek ücretli servis yok. Render ücretsiz sunucu uyuyabilir (bkz. Açık Riskler 1).

---

## Kullanıcı Hikayeleri

1. **Ebeveyn olarak**, çocuğum plana ders veya aktivite eklediğinde telefonuma bildirim gelsin istiyorum; böylece
   uygulamayı açmadan haberdar olurum.
2. **Ebeveyn olarak**, çocuğum bir dersi bitirdiğinde ("Ela Matematik'i bitirdi") haber almak istiyorum.
3. **Çocuk olarak**, ebeveynim planıma bir şey eklediğinde bildirim almak istiyorum.
4. **Aile üyesi olarak**, kendi girdiğim kayıtlar için bildirim almak istemiyorum.
5. **Aile üyesi olarak**, biri art arda birçok kayıt girdiğinde tek tek değil, tek bir özet bildirim almak istiyorum.
6. **Aile üyesi olarak**, gece rahatsız edilmek istemiyorum; sessiz saatte oluşanları sabah tek özet olarak görmek istiyorum.
7. **Aile üyesi olarak**, kimin girişlerinden ve hangi türlerde bildirim alacağımı seçmek istiyorum.
8. **Aile üyesi olarak**, uygulama ilk açıldığında bildirimleri açmayı bir kez önersin; istemezsem bir daha sormasın.
9. **Aile üyesi olarak**, bildirime dokununca ilgili günün planına gitmek istiyorum.
10. **Ebeveyn olarak**, hangi cihazların bildirim aldığını görmek istiyorum.
11. **Aile üyesi olarak**, ortak bir tablette profil değiştirdiğimde bildirimlerin yeni seçilen profile göre gelmesini istiyorum.

---

## Kabul Kriterleri

### İzin kartı ve abonelik
1. Bildirim desteği olan bir tarayıcıda, cihazda daha önce karar verilmemişse uygulamada "Aileden haberdar ol" kartı
   "Bildirimleri aç" ve "Şimdi değil" düğmeleriyle görünür.
2. "Bildirimleri aç"a basılınca tarayıcının izin penceresi açılır; izin verilirse cihaz seçili profil adına abone olur
   ve kart kaybolur. Ailem > Bildirimler kartında "Bu cihaz" açık görünür.
3. "Şimdi değil"e basılırsa kart kaybolur ve o cihazda sayfa yenilense, çıkış yapılıp girilse bile bir daha görünmez.
4. Tarayıcı izni reddedilirse kart kaybolur; Bildirimler kartında bildirimin tarayıcıda engellendiği ve tarayıcı
   ayarlarından açılması gerektiği yazar.
5. Bildirim desteklemeyen ortamda (örn. iPhone'da ana ekrana eklenmemiş Safari) izin kartı görünmez; Bildirimler
   kartında "Bu cihazda bildirimler desteklenmiyor" benzeri bir bilgi yazar. "Ana Ekrana Ekle" yönlendirmesi yoktur.
6. Cihazda profil değiştirilince abonelik yeni profile geçer: sonraki bildirimler yeni profilin ayarlarına göre gelir,
   eski profil adına bu cihaza bildirim gitmez.
7. Çıkış yapılınca o cihazın aboneliği sunucudan silinir; çıkıştan sonra yapılan girişler için o cihaza bildirim gitmez.
8. Bir profil silinince o profile ait tüm abonelikler silinir.
9. Push servisi bir abonelik için 404 veya 410 dönerse abonelik sunucudan silinir ve cihaz listesinden kalkar.

### Kime, ne zaman gider
10. Kaydı giren profile ait hiçbir cihaza o kayıt için bildirim gitmez (aynı profil başka cihazda da açık olsa bile).
11. Yeni oluşturulan profilin "Kimin girişleri" ayarında kendisi dışındaki tüm aile üyeleri seçilidir.
12. Bir kişinin "Kimin girişleri"nden çıkarılan aile üyesinin girişleri için o kişiye bildirim gitmez.
13. Varsayılan türler: Ders eklenince AÇIK, Aktivite eklenince AÇIK, Değişiklik ve silme KAPALI, Ders tamamlanınca AÇIK.
14. Bir dersin durumu Tamam'a geçince "<Ad> <Ders>'i bitirdi" bilgisini taşıyan bildirim gider (örn. "Ela Matematik'i bitirdi").
    Tamam'dan başka duruma alıp tekrar Tamam yapmak ayrıca tamamlanma bildirimi üretir (Varsayım).
15. "Değişiklik ve silme" kapalıyken düzenleme ve silme bildirim üretmez; açılınca üretir. Silmede "Geri al" ile
    geri alınan kayıt için silme bildirimi gitmez (Varsayım: silme bildirimi geri al süresi dolduktan sonra değerlendirilir).
16. Bir türü kapatan kişiye o türde bildirim gitmez; diğer kişilerin ayarı etkilenmez.

### Toplama
17. Aynı kişi art arda birden fazla kayıt girerse ilki hemen gider, ~1 dk içindeki devamı tek bildirimde toplanır ve sayıları türüne göre
    gösterir (örn. "Ela 4 kayıt ekledi · 3 ders, 1 aktivite").
18. Tek kayıt girildiyse bildirim o kaydın adını taşır (toplama metni kullanılmaz).
19. Toplanan bildirimler yalnızca alıcının açık türlerini içerir (örn. aktivite bildirimi kapalı olana "3 ders" gider).

### Sessiz saatler
20. Yeni profilde sessiz saatler AÇIK ve 22:00–07:30 (Türkiye saati) olarak gelir; kullanıcı kapatabilir ve
    başlangıç/bitiş saatlerini değiştirebilir.
21. Sessiz saat içinde oluşan olaylar için anında bildirim gitmez; sessiz saat bitince (bkz. Açık Riskler 1 için
    gecikme payı) tüm bekleyenler tek özet bildirim olarak gider.
22. Sessiz saat kapalıysa gece oluşan olaylar anında gider.

### Bildirim içeriği ve dokunma
23. Bildirime dokununca uygulama açılır (açıksa öne gelir) ve ilgili günün Gün ekranı gösterilir. Toplu bildirimde
    birden çok gün varsa en erken gün açılır (Varsayım).
24. Uygulama zaten açıkken gelen bildirim de sistem bildirimi olarak gösterilir (Varsayım).

### Ayarlar: Ailem > Bildirimler kartı
25. Kartta şunlar bulunur: Bu cihaz aç/kapa, Kimin girişleri (aile üyeleri listesi, kendisi hariç), 4 bildirim türü
    anahtarı, Sessiz saatler (aç/kapa + başlangıç/bitiş), Bildirim alan cihazlar listesi.
26. Ayarlar seçili profile aittir; başka profil seçilince o profilin ayarları görünür.
27. Cihaz listesinde her cihaz anlaşılır bir adla (örn. "iPhone · Safari", "Windows · Chrome") ve hangi profil adına
    abone olduğu ile görünür; ebeveyn listeden bir cihazın aboneliğini kaldırabilir (Varsayım).
28. "Bu cihaz" kapatılınca bu cihazın aboneliği silinir, açılınca yeniden abone olunur.
29. Kart 360 ve 390 px genişlikte yatay kaydırmasız sığar; anahtarlar en az 44 px dokunma alanına sahiptir.

### Güvenlik
30. Veritabanında endpoint, p256dh ve auth düz metin olarak bulunmaz (veritabanı dökümünde aranınca çıkmaz).
31. İzinli push servisleri dışındaki bir endpoint ile abonelik isteği reddedilir (örn. `https://ornek.com/...`,
    `http://...`, IP adresi, `localhost`).
32. VAPID özel anahtarı depoda (kod, yapılandırma dosyaları, GitHub) bulunmaz; yalnızca ortam değişkeninden okunur.
    Değişken yoksa uygulama çalışmaya devam eder, yalnızca bildirim gönderilmez ve günlüğe uyarı yazılır.
33. Sunucu şifreleme ve VAPID imzası RFC 8291 test vektörüyle birebir aynı çıktıyı üreten birim testine sahiptir.
34. Bir aile, başka ailenin aboneliklerini/ayarlarını göremez ve değiştiremez (404); çocuk profili yalnızca kendi
    ayarlarını değiştirebilir.

### Tarayıcı uyumluluğu (QA)
35. Gerçek cihazda uçtan uca denenir: Android Chrome, masaüstü Chrome/Edge/Firefox, ana ekrana eklenmiş iPhone
    uygulaması. Her birinde bildirim gelir ve dokununca doğru gün açılır.

---

## Backend Gereksinimleri (özet)

1. Abonelik kaydı: cihaz + profil; endpoint/p256dh/auth şifreli; cihaz adı; oluşturulma ve son başarılı gönderim zamanı.
2. Profil bildirim ayarları: kimin girişleri, 4 tür anahtarı, sessiz saatler (aç/kapa, başlangıç, bitiş). Varsayılanlar yukarıdaki gibi.
3. Uç noktalar: abone ol / profil değiştir / abonelikten çık; ayarları oku/güncelle; cihaz listesi ve cihaz kaldırma;
   VAPID açık anahtarını verme. Çıkış ve profil silme abonelikleri temizler.
4. Kayıt ekleme/düzenleme/silme ve durum Tamam'a geçişi bildirim olayı üretir; alıcılar ayarlara göre süzülür.
5. Toplama (ilki hemen, devamı ~1 dk) ve sessiz saat kuyruğu kalıcı (veritabanında) tutulur; sunucu yeniden başlasa da kaybolmaz.
6. Web Push gönderimi, aes128gcm şifreleme ve VAPID ES256 imzası yerleşik kriptografiyle; dış paket yok.
7. Gönderim hatası kayıt isteğini başarısız yapmaz; 404/410 aboneliği siler, diğer hatalar günlüğe yazılır.
8. Uçtan uca testler (`backend/tests/e2e.py`): abonelik, ayarlar, SSRF reddi, yetki (403/404), alıcı süzme.

## Frontend Gereksinimleri (özet)

1. Kendi service worker'ımız (push alma, bildirim gösterme, dokununca ilgili güne açma) ve web app manifest.
   GitHub Pages yolu (`/PlanToBee/app/`) altında çalışır.
2. "Aileden haberdar ol" kartı ve "Şimdi değil" kararının cihazda saklanması.
3. Ailem ekranında "Bildirimler" kartı (Kabul Kriteri 25).
4. Profil değişimi, çıkış ve "Bu cihaz" anahtarında abonelik güncellemesi.
5. Desteklenmeyen ortam ve reddedilmiş izin durumlarında açıklayıcı metin.

---

## Kapsam Dışı

- iPhone için "Ana Ekrana Ekle" yönlendirmesi/rehberi.
- Üçüncü taraf bildirim servisleri (Firebase Cloud Messaging SDK, OneSignal vb.) ve ücretli servisler.
- E-posta veya SMS bildirimi.
- Zaman tabanlı hatırlatmalar (örn. "Aktiviteye 30 dk kaldı", "Bugün henüz ders girilmedi").
- Uygulama içi bildirim geçmişi / bildirim kutusu.
- Mağaza uygulaması (Capacitor) yerel bildirimleri; ileride ayrıca ele alınacak.
- Bildirim metinlerinin kişiselleştirilmesi (ses, simge seçimi vb.).

---

## Açık Riskler

1. **Render ücretsiz sunucu uykusu.** Anlık bildirimler kayıt isteği sırasında (sunucu uyanıkken) gönderilir, sorun yok.
   Ancak toplanan devam bildirimleri (~1 dk sonra gönderim) ve sessiz saat bitişindeki özet için arka plan işi sunucu uykudayken çalışamaz;
   07:30'da kimse uygulamayı açmazsa özet gecikir.
   **Önerilen basit çözüm:** Kuyruk veritabanında tutulur; sunucu her uyanışta ve her gelen istekte süresi dolmuş
   bekleyenleri boşaltır (arka plan zamanlayıcı da uyanıkken çalışır). Toplama için: kişi yeni kayıt girdikçe, kendi
   isteği sırasında önceki penceresi dolmuş olanlar gönderilir. Gerekirse ileride ücretsiz bir dış zamanlayıcı
   (örn. GitHub Actions cron ile sağlık uç noktasına istek) sunucuyu sabah uyandırabilir; bu görevde zorunlu değil.
   Sonuç: toplu/sessiz saat özetleri dakikalar ile saatler arasında gecikebilir; bu kabul edilen bir sınırlamadır.
2. **Kendi kriptografi kodumuz.** Dış paket kullanılmadığı için hata riski bizde; RFC 8291 test vektörü ve gerçek
   cihaz testleri (Kabul Kriteri 33, 35) zorunludur.
3. **iPhone kısıtı.** iPhone'da yalnızca ana ekrana eklenmiş uygulamada çalışır; yönlendirme yapılmadığı için
   iPhone kullanan aile üyeleri bildirimleri fark etmeyebilir.
4. **Push servis adresleri.** İzinli servis listesi (Apple, Google FCM, Mozilla, Microsoft) değişirse yeni
   aboneliklerin reddedilmesi olası; liste kolay güncellenebilir tutulmalı.
5. **Ortak cihaz.** Profil değişince abonelik yeni profile geçtiği için, ortak tablette en son seçilen profil
   bildirimleri alır; önceki profil o cihazdan bildirim almaz (bilinçli karar).
6. **Saat dilimi.** Sessiz saatler Türkiye saatine göredir; yurt dışındaki cihazda yerel saatle örtüşmeyebilir.
