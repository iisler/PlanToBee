# PlanToBee Kişisel Verilerin Korunması Aydınlatma Metni ve Gizlilik Politikası

Sürüm 1 · Yürürlük tarihi: [GG.AA.YYYY]

Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun ("KVKK") 10. maddesi uyarınca, PlanToBee
uygulamasını ve web sitesini kullanırken kişisel verilerinin nasıl işlendiğini anlatır. Bu bir bilgilendirmedir;
senden ayrıca bir onay istemez.

## 1. Veri sorumlusu

Veri sorumlusu: **[Ad Soyad]** (gerçek kişi, bireysel geliştirici)
İletişim: **plantobee.app@gmail.com**

## 2. Hangi kişisel verileri işliyoruz?

| Veri grubu | Neler | Nasıl saklanır |
|---|---|---|
| Hesap bilgileri | E-posta adresi, görünen ad, şifre | E-posta veritabanında şifreli (AES-256-GCM) saklanır. Şifre hiçbir zaman açık metin saklanmaz; yalnızca geri çevrilemez özeti tutulur. |
| Profil bilgileri | Profil adları (ör. "Ela"), rol (ebeveyn / çocuk), PIN | PIN yalnızca geri çevrilemez özet olarak saklanır. Çocuk profillerinde e-posta ya da başka iletişim bilgisi yoktur. |
| Plan verileri | Dersler, konular, süreler, durumlar; aktiviteler, saatler, notlar; kaydı kimin eklediği ve değiştirdiği | Ailenin ortak planı olarak saklanır; yalnızca aile hesabıyla giriş yapanlar görür. |
| Bildirim bilgileri | Bildirimlere izin verdiysen cihazının bildirim aboneliği ve cihaz adı (ör. "iPhone · Safari"), bildirim tercihlerin | Abonelik bilgileri veritabanında şifreli saklanır. |
| Güvenlik kayıtları | IP adresi, giriş ve PIN denemeleri, oturum bilgileri | Kötüye kullanımı ve yetkisiz girişi önlemek için kısa süre tutulur. |

Uygulamada reklam, analiz ya da takip aracı yoktur. Cihazında yalnızca oturumun açık kalması ve tercihlerin
(ör. seçili profil, bildirim kararı) için gerekli bilgiler saklanır; bunlar çerez değil, uygulamanın kendi
deposudur ve üçüncü kişilerle paylaşılmaz.

## 3. Hangi amaçlarla işliyoruz?

- Hesabını oluşturmak, e-posta adresini doğrulamak ve giriş yapmanı sağlamak,
- Ailenin ortak haftalık planını (dersler, aktiviteler) sunmak ve profiller arasında paylaşmak,
- İstersen aile üyelerinin girdiği kayıtlar için bildirim göndermek,
- Şifre sıfırlama ve hesapla ilgili zorunlu e-postaları göndermek,
- Hizmetin güvenliğini sağlamak, yetkisiz girişi ve kötüye kullanımı önlemek,
- Kanuni yükümlülükleri yerine getirmek ve başvurularını cevaplamak.

## 4. Hukuki sebepler (KVKK m. 5/2)

- **(c) Sözleşmenin kurulması ve ifası:** Hesap, profiller, plan verileri ve bildirimler; hizmeti sana sunabilmek
  için gereklidir.
- **(ç) Hukuki yükümlülüğün yerine getirilmesi:** Kanunlardan doğan saklama, bildirim ve başvuru cevaplama
  yükümlülükleri.
- **(f) Meşru menfaat:** Güvenlik kayıtları ve kötüye kullanımın önlenmesi (temel hak ve özgürlüklerine zarar
  vermemek kaydıyla).

Pazarlama, reklam ya da profilleme amacıyla veri işlemiyoruz; bu nedenle açık rızana dayanan bir işleme yoktur.

## 5. Verileri kime aktarıyoruz?

Verilerin hiçbir şekilde satılmaz, reklam ya da pazarlama amacıyla paylaşılmaz. Yalnızca hizmeti çalıştırmak için
aşağıdaki hizmet sağlayıcılarını kullanıyoruz:

<!-- AKTARIM BÖLÜMÜ: Sunucu Türkiye'ye taşınınca yalnızca bu bölüm güncellenir. -->
| Hizmet | Ne için | Konum |
|---|---|---|
| Render | Uygulama sunucusu (API) | Almanya (Frankfurt) |
| Neon | Veritabanı | Almanya (Frankfurt) |
| Brevo | Doğrulama ve şifre sıfırlama e-postalarının gönderimi | Avrupa Birliği |
| Apple Push Notification service, Google Firebase Cloud Messaging ve tarayıcı bildirim servisleri | Bildirimlerin cihazına iletilmesi | Yurt dışı |
| GitHub Pages | Web sitesinin yayınlanması | Yurt dışı |

Bildirim içerikleri uçtan uca şifrelidir; bildirim servisleri içeriği okuyamaz, yalnızca şifreli mesajı cihazına
iletir. Bu sağlayıcılara yapılan aktarım KVKK'nın 9. maddesi kapsamındadır.
<!-- /AKTARIM BÖLÜMÜ -->

Kanunen yetkili kamu kurum ve kuruluşlarına, yalnızca hukuken zorunlu olduğu hallerde ve istenen ölçüde bilgi
verilebilir.

## 6. Toplama yöntemi

Kişisel verilerin, uygulamayı ve web sitesini kullandığında elektronik ortamda, doğrudan senden (kayıt, profil ve
plan girişleri) ve kullanım sırasında otomatik olarak (güvenlik kayıtları, bildirim aboneliği) toplanır.

## 7. Saklama süreleri

- Hesap ve plan verileri hesabın açık olduğu sürece saklanır.
- Hesabını sildiğinde tüm verilerin hemen silinir; veritabanı yedeklerinden de en geç **30 gün** içinde düşer.
- Silinen bir profilin eklediği kayıtlar ailenin planında kalır ve "Eski üye" olarak görünür; hesap silindiğinde
  bunlar da silinir.
- Güvenlik kayıtları en fazla **90 gün** saklanır.
- Bildirim aboneliği, bildirimleri kapattığında, çıkış yaptığında ya da cihaz aboneliği geçersiz olduğunda silinir.

## 8. Çocukların verileri

PlanToBee'de hesabı ebeveyn (hesap sahibi) açar. Çocuk profillerini ebeveyn oluşturur; çocuklardan e-posta ya da
iletişim bilgisi alınmaz, yalnızca profil adı ve plan verileri işlenir. Hesap sahibi, ailesindeki profillerin
verilerinin girilmesinden ve kullanılmasından sorumludur.

## 9. KVKK m. 11 kapsamındaki hakların

Veri sorumlusuna başvurarak şunları isteyebilirsin:
- Kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi isteme,
- İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
- Yurt içinde ya da yurt dışında aktarıldığı üçüncü kişileri bilme,
- Eksik ya da yanlış işlenmişse düzeltilmesini isteme,
- KVKK m. 7'de öngörülen şartlar çerçevesinde silinmesini ya da yok edilmesini isteme,
- Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,
- İşlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhine bir sonuç ortaya çıkmasına
  itiraz etme,
- Kanuna aykırı işlenmesi sebebiyle zarara uğraman halinde zararın giderilmesini talep etme.

## 10. Başvuru yolu

Başvurunu, kimliğini doğrulayabileceğimiz bilgilerle birlikte **plantobee.app@gmail.com** adresine, tercihen
hesabına kayıtlı e-posta adresinden gönderebilirsin. Başvurun en geç **30 gün** içinde ücretsiz olarak
cevaplanır. Hesabını ve tüm verilerini uygulama içinden de silebilirsin: Ad menüsü › Ailem › Hesabı ve tüm verileri
sil.

## 11. Değişiklikler

Bu metin güncellenirse yeni sürüm bu sayfada yayımlanır ve yürürlük tarihi değişir. Önemli değişikliklerde
uygulama içinde bilgilendirilirsin.
