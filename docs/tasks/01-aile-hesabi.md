# Görev: Aile Hesabı ve Ortak Plan Yönetimi

## Özellik Özeti

PlanToBee herkese açık bir uygulama olacak ve kullanım birimi **aile** olacak.

- **Aileyi kuran:** Aileyi bir ebeveyn açar ve ailenin **yöneticisi** olur.
- **Davet:** Yönetici eşini ve çocuklarını adları, rolleri ve e-posta adresleriyle aileye davet eder. Davet edilen kişiye **tek kullanımlık, süreli bir davet linki** ve **6 haneli yedek kod** içeren bir e-posta gider. Kişi linke tıklayıp şifresini belirleyerek katılır.
- **E-postası olmayan çocuk:** Ebeveyn, hesabı olmayan bir **çocuk profili** oluşturup o çocuğun planını yönetebilir.

Yetkiler, kaydı kimin eklediğine göre değil **planın kime ait olduğuna ve kişinin rolüne** göre belirlenir:
- **Ebeveyn** rolündeki her üye ailedeki **tüm planlarda** kayıt ekleyebilir, düzenleyebilir ve silebilir.
- **Çocuk** rolündeki üye yalnızca **kendi planında** kayıt ekleyebilir, düzenleyebilir ve silebilir. Kardeşlerinin planlarını **salt okunur** görür.

Her kayıtta "ekleyen" ve "en son düzenleyen" bilgisi tutulur ve gösterilir.

Giriş **e-posta ve şifreyle** yapılır. Kayıtta e-posta doğrulaması zorunludur. "Şifremi unuttum" bağlantısı e-postaya gönderilir.

Karar notu: Toplantıda değerlendirilen "plan sahibi takipçilerini kendisi seçer" modeli karmaşıklığı azaltmak için seçilmedi. Seçilen model, aile grubu ile ebeveynin yönettiği çocuk profili modellerinin birleşimi. Aile üzerindeki kontrol ebeveyndedir.

Kavramlar:
- **Aile:** Üyelerden oluşan grup. Her ailenin tam olarak bir yöneticisi vardır.
- **Yönetici:** Aileyi açan ebeveyn. Aile yönetimi yetkileri (üye davet etme, çıkarma, devretme) ondadır.
- **Üye:** Ailedeki kişi. Rolü **Ebeveyn** veya **Çocuk**'tur. Hesabı olan (davetle katılmış) veya hesabı olmayan (çocuk profili) olabilir.
- **Kişisel plan:** Her üyenin kendi gün ve hafta planı (ders, antrenman, etkinlik, ders listesi).
- **Plan sahibi:** Planın ait olduğu üye.

---

## Kullanıcı Hikayeleri

### Hesap ve aile kurulumu
- **H1.** Ebeveyn olarak, e-posta ve şifremle kayıt olup e-postamı doğruladıktan sonra bir aile oluşturmak istiyorum, böylece ailemin planlarını tek yerden yönetebilirim.
- **H2.** Kullanıcı olarak, şifremi unuttuğumda e-postama gelen bağlantıyla yeni şifre belirlemek istiyorum.

### Davet
- **H3.** Yönetici olarak, eşimi ve çocuklarımı ad, rol ve e-posta adresi girerek davet etmek istiyorum, böylece davet e-postası onlara otomatik gider.
- **H4.** Davet edilen kişi olarak, e-postadaki linke tıklayıp yalnızca şifremi belirleyerek aileye katılmak istiyorum.
- **H5.** Davet edilen kişi olarak, link çalışmazsa (örneğin başka bir cihazdayım) e-postadaki 6 haneli yedek kodla katılabilmek istiyorum.
- **H6.** Yönetici olarak, gönderdiğim davetlerin durumunu görmek, gerekirse daveti yeniden göndermek veya iptal etmek istiyorum.

### E-postası olmayan çocuk
- **H7.** Ebeveyn olarak, henüz e-postası olmayan küçük çocuğum için hesapsız bir profil oluşturup onun planını yönetmek istiyorum.
- **H8.** Ebeveyn olarak, çocuğumun ileride e-postası olduğunda onu davet etmek ve mevcut planının onun yeni hesabına bağlanmasını istiyorum.

### Plan görüntüleme ve yetkiler
- **H9.** Aile üyesi olarak, ailedeki kişiler arasında geçiş yapıp herhangi birinin günlük ve haftalık planını görmek istiyorum.
- **H10.** Ebeveyn olarak, ailedeki her çocuğun planına ders, antrenman ve etkinlik ekleyebilmek, bu kayıtları düzenleyip silebilmek istiyorum. Örneğin Ela antrenmandayken annesi onun planını güncelleyebilmeli.
- **H11.** Çocuk olarak, kendi planımdaki tüm kayıtları ekleyip düzenleyebilmek ve silebilmek istiyorum. Bu, başkasının benim planıma eklediği kayıtları da kapsar.
- **H12.** Çocuk olarak, kardeşlerimin planlarını görebilmek ama yanlışlıkla değiştirmemek için yalnızca okuyabilmek istiyorum.
- **H13.** Aile üyesi olarak, bir kaydı kimin eklediğini ve en son kimin düzenlediğini görmek istiyorum.

### Aile yönetimi
- **H14.** Yönetici olarak, aileden bir üyeyi çıkarmak, bir üyenin rolünü değiştirmek ve yöneticiliği başka bir ebeveyne devretmek istiyorum.
- **H15.** Aile üyesi olarak, ailemdeki kişileri, rollerini ve katılım durumlarını görmek istiyorum.

### Geçiş
- **H16.** Ela olarak, eski uygulamadaki (Firebase) tüm kayıtlarımın yeni ailemdeki kişisel planıma aktarılmasını istiyorum.
- **H17.** Mevcut (ailesiz) hesabı olan bir kullanıcı olarak, verimi kaybetmeden bir aile kurmak ya da bir aileye katılmak istiyorum.

---

## Kabul Kriterleri

### Kayıt, giriş, e-posta doğrulama ve şifre sıfırlama (H1, H2)
- Giriş **e-posta ve şifreyle** yapılır.
- Herkese açık kayıt ekranında e-posta, şifre ve görünen ad istenir.
- Kayıttan sonra kullanıcıya doğrulama e-postası gönderilir. **E-posta doğrulanmadan uygulama kullanılamaz.** Kullanıcıya "E-postanı doğrula" ekranı ve "Doğrulama e-postasını tekrar gönder" seçeneği gösterilir.
- Doğrulama tamamlanınca kullanıcı aile oluşturma adımına geçer.
- **Varsayım:** Aile oluşturma adımında aile adı sorulur (örn. "İşler Ailesi"). Yönetici bunu sonradan değiştirebilir. Aileyi kuran kişi **Ebeveyn** rolünde yönetici olur.
- "Şifremi unuttum" ekranında e-posta girilir ve o adrese tek kullanımlık, süreli bir şifre sıfırlama bağlantısı gönderilir. Bağlantıyla yeni şifre belirlenir.
- **Varsayım:** Şifre sıfırlama bağlantısı 1 saat geçerlidir.
- Şifre sıfırlama isteğinde, e-postanın kayıtlı olup olmadığı dışarıya belli edilmez. Her durumda "Kayıtlı bir hesap varsa e-posta gönderildi" mesajı gösterilir.
- Bugün yalnızca geliştirme ortamında açık olan doğrulamasız şifre sıfırlama bu akışla değiştirilir.
- **Varsayım:** Bir kullanıcı aynı anda yalnızca bir aileye üye olabilir.

### Davet: link ve yedek kod (H3–H6)
- Yalnızca yönetici davet gönderebilir. Davet için üç bilgi girilir: **görünen ad**, **rol** (Ebeveyn veya Çocuk), **e-posta adresi**.
- Sistem bu adrese şunları içeren bir e-posta gönderir:
  - **Tek kullanımlık davet linki**
  - **6 haneli yedek kod**
  - Aile adı ve daveti gönderen kişinin adı
- Davet **7 gün** geçerlidir. Süresi dolan link ve kod kullanılamaz.
- **Linkle katılma:**
  - Kişi linke tıklayınca aile adını ve kendi görünen adını görür ("İşler Ailesi seni Ela olarak davet etti").
  - E-posta adresi davetten hazır gelir ve **değiştirilemez**.
  - Kişi yalnızca şifresini belirler ve otomatik olarak giriş yapar.
  - Linkle kayıt olmak e-postayı **doğrulanmış sayar**, ayrıca doğrulama e-postası gönderilmez.
- **Yedek kodla katılma:**
  - Giriş ekranında "Davet kodum var" seçeneği bulunur. Kişi e-posta adresini ve 6 haneli kodu girer.
  - Girilen e-posta, davetin gönderildiği adresle **eşleşmelidir**. Eşleşmezse kod kabul edilmez.
  - Kod doğrulanınca linkle katılmadaki gibi şifre belirlenir ve e-posta doğrulanmış sayılır.
- Link ve kod birlikte tek kullanımlıktır. Biri kullanılınca ikisi de geçersiz olur.
- Geçersiz, kullanılmış, süresi dolmuş veya iptal edilmiş davette sorunun ne olduğu açıkça belirtilir ve kişiye yöneticiden yeni davet istemesi söylenir.
- **Aile ekranında davet durumları:** Her davetin durumu görünür: **Bekliyor** (kalan süreyle), **Katıldı**, **Süresi doldu**, **İptal**.
- **Yönetici işlemleri:** Bekleyen veya süresi dolmuş bir daveti **yeniden gönderebilir**, bekleyen bir daveti **iptal edebilir**.
- **Varsayım:** Yeniden gönderim yeni bir link ve yeni bir kod üretir. Eski link ve kod anında geçersiz olur, süre yeniden 7 gün başlar.
- **Varsayım:** Davet edilen e-postanın zaten bir PlanToBee hesabı varsa kişi yeni şifre belirlemez, mevcut hesabıyla giriş yaparak daveti kabul eder. Yalnızca başka üyesi olmayan tek kişilik bir ailesi varsa katılabilir; bu durumda kendi planı yeni aileye taşınır.
- Kötüye kullanıma karşı kod denemeleri ve davet gönderimleri sınırlandırılır.

### E-postası olmayan çocuk: hesapsız profil (H7, H8)
- **Varsayım:** Ebeveyn rolündeki üyeler, e-posta girmeden yalnızca ad ile bir **çocuk profili** oluşturabilir. Profilin hesabı ve girişi yoktur. Planı yalnızca ebeveynler yönetir.
- Hesapsız profil kişi seçicide diğer üyeler gibi görünür, planı olağan şekilde doldurulur. Aile ekranında "Hesabı yok" olarak işaretlenir.
- **Varsayım:** Yönetici, hesapsız bir profil için daha sonra bir e-posta adresi girerek davet gönderebilir. Çocuk daveti kabul edince **mevcut planı ve tüm kayıtları o yeni hesaba bağlanır**, yeni bir boş plan oluşmaz.
- **Varsayım:** Daveti henüz kabul edilmemiş (Bekliyor durumundaki) bir üyenin de planı vardır ve ebeveynler bu planı doldurabilir. Böylece çocuk katılmadan planı hazırlanabilir.

### Aile üyeleri arasında geçiş (H9, H15)
- **Varsayım:** Planlar **kişi başınadır**. Her aile üyesinin kendi gün ve hafta planı, kendi ders listesi ve kendi istatistikleri vardır. Ortak bir "aile planı" yoktur.
- Uygulamanın üst kısmında **kişi seçici** bulunur (ör. "Ela ▾"). Seçili kişinin Gün ve Hafta Planı görünümleri gösterilir.
- Giriş yapan kişi varsayılan olarak kendi planını görür.
- **Varsayım:** Ebeveynlerin de kendi planı olabilir. Kişi seçicide çocuklar önce listelenir.
- Seçili kişi değiştirildiğinde tarih korunur.
- Aile ekranında tüm üyeler, rolleri, hesap ve davet durumları ve yönetici listelenir. Herkes görebilir, yalnızca yönetici değiştirebilir.

### Rol ve plan bazlı yetkiler (H10–H12)

| Kim | Kendi planı | Başka çocuğun planı | Başka ebeveynin planı |
|---|---|---|---|
| Ebeveyn | Ekle / düzenle / sil | Ekle / düzenle / sil | Ekle / düzenle / sil |
| Çocuk | Ekle / düzenle / sil | Yalnızca görür | Yalnızca görür (**Varsayım**) |

- Yetki, kaydı kimin eklediğine bakılmadan **planın sahibine ve kullanıcının rolüne** göre belirlenir. Çocuk, kendi planına bir ebeveynin eklediği kaydı da düzenleyebilir ve silebilir.
- **Varsayım:** Çocuk, ebeveynlerin kendi planlarını düzenleyemez ve silemez, yalnızca görür.
- Yetkiler **ders listesi** (Subject) için de aynıdır: bir planın ders listesini, o planda düzenleme yetkisi olan kişi yönetir.
- Düzenlenebilen alanlar:
  - Ders: ders, konu, süre, durum
  - Antrenman: tür, süre, not
  - Etkinlik: başlık, saat, not
- Durum değiştirmek de düzenleme sayılır.
- Ders ve antrenman kayıtlarının düzenlenebilmesi bu kapsamda gelir. Bugün yalnızca etkinlik düzenlenebiliyor.
- **Salt okunur görünüm:** Çocuk bir kardeşinin (veya ebeveyninin) planını açtığında ekranda "Ela'nın planı · yalnızca görüntüleme" gibi açık bir işaret bulunur. Ekleme formları, düzenleme, silme ve durum değiştirme kontrolleri gösterilmez.
- Kurallar arayüzden bağımsız olarak **sunucu tarafında da** uygulanır. Yetkisiz bir istek reddedilir.
- Rol değişikliği anında etkili olur. Örneğin Çocuk rolünden Ebeveyn rolüne alınan kişi hemen tüm planları düzenleyebilir.

### Kim ekledi / kim düzenledi (H13)
- Her ders, antrenman, etkinlik ve ders listesi kaydında şu bilgiler tutulur: **ekleyen üye**, **eklenme zamanı**, **en son düzenleyen üye** ve **en son düzenlenme zamanı**.
- Kaydı plan sahibinden başka biri eklediyse veya düzenlediyse kayıt üzerinde küçük bir iz görünür (örn. "Annem ekledi" veya "Babam düzenledi · 18:40").
- Bu bilgi yetkiyi etkilemez, yalnızca bilgilendirme amaçlıdır.
- **Varsayım:** İlk sürümde yalnızca "en son düzenleyen" gösterilir. Tam değişiklik geçmişi tutulmaz.

### Aile yönetimi (H14)
- Aşağıdaki işlemler yalnızca yöneticiye açıktır:
  - Davet gönderme, yeniden gönderme ve iptal etme
  - Hesapsız profil oluşturma
  - Üye çıkarma
  - Üyenin rolünü değiştirme
  - Yöneticiliği devretme
  - Aile adını değiştirme
- **Varsayım:** Hesapsız profil oluşturmak da yalnızca yöneticiye açıktır. (Diğer ebeveynler profilin planını yönetebilir ama yeni profil oluşturamaz.)
- Yönetici kendisini aileden çıkaramaz. Aileden ayrılmak için önce yöneticiliği devretmesi gerekir.
- **Varsayım:** Yöneticilik yalnızca katılımı tamamlanmış ve rolü **Ebeveyn** olan bir üyeye devredilebilir. Devirden sonra eski yönetici Ebeveyn rolünde normal üye olur.
- Üye çıkarma, rol değişikliği ve yönetici devri onay penceresiyle yapılır.
- **Aileden çıkarılan üye:**
  - Çıkarılan üyenin aileye erişimi hemen sona erer, açık oturumu aile verisine erişemez.
  - Çıkarılan üyenin başkalarının planlarına eklediği veya düzenlediği kayıtlar silinmez. Ekleyen ve düzenleyen bilgisi "Eski üye: [Ad]" olarak görünür. Bu kayıtlar da normal yetki kurallarına tabidir.
  - **Varsayım:** Hesabı olan üyenin **kendi kişisel planı** aileden çıkarılır ve üyeyle birlikte gider. Üye kendi tek kişilik ailesiyle devam eder.
  - **Varsayım:** **Hesapsız bir profil** çıkarılırsa planı kalıcı olarak silinir. Silmeden önce bu açıkça uyarılır.
- **Varsayım:** Hesabı olan üyeler (yönetici hariç) kendi isteğiyle aileden ayrılabilir. Ayrılmada da aynı kurallar geçerlidir.

### Geçiş: mevcut hesaplar ve Firebase verisi (H16, H17)
- **Varsayım:** Bu özellik yayına girdiğinde mevcut her kullanıcı otomatik olarak **tek kişilik bir aileye** alınır ve bu ailenin **Ebeveyn** rolündeki yöneticisi olur. Mevcut gün, kayıt ve ders listesi verileri kaybolmadan o kişinin kişisel planı olur. Mevcut kayıtların ekleyeni hesap sahibi olarak işaretlenir.
- **Varsayım:** Mevcut hesapların e-postaları doğrulanmamış sayılır. Bu hesaplar ilk girişte doğrulama ekranına yönlendirilir ve doğrulamadan uygulamayı kullanamaz.
- **Varsayım (Ela'nın Firebase verisi):**
  - Önce Ilker (baba) aileyi kurar. Ardından Ela'yı e-postasıyla davet eder ya da onun için hesapsız bir profil oluşturur.
  - Firebase'deki tüm günler, ders, antrenman ve etkinlik kayıtları ile ders listesi **tek seferlik bir aktarımla** Ela'nın kişisel planına taşınır.
  - Aktarılan kayıtların ekleyeni **Ela** olarak işaretlenir ve "aktarıldı" olarak ayırt edilebilir.
  - Aktarım Ela katılmadan önce de yapılabilir.
  - Firebase verisi aktarımdan sonra silinmez, bir süre yedek olarak saklanır.
- Aktarımdan sonra gün sayısı ve toplam ders, antrenman ve etkinlik adetleri kaynak veriyle karşılaştırılarak doğrulanır.

---

## Backend Gereksinimleri

### Veri modeli (kavramsal)
- **User:** Giriş e-posta ve şifreyle yapılır. E-postanın doğrulanıp doğrulanmadığı tutulmalıdır.
- **Aile:** ad, oluşturulma zamanı, yönetici üye.
- **Aile üyesi:** aile, görünen ad, rol (Ebeveyn / Çocuk), bağlı kullanıcı hesabı (hesapsız profilde ve daveti bekleyen üyede boş), durum (Hesabı yok / Davet bekliyor / Katıldı / Ayrıldı).
- **Davet:** hangi üyeye ait olduğu, davet edilen e-posta adresi, tek kullanımlık link belirteci, 6 haneli yedek kod, geçerlilik bitiş zamanı, durum (Bekliyor / Katıldı / Süresi doldu / İptal), gönderen. Link belirteci tahmin edilemez olmalı.
- **Plan sahipliği:** Bugün `Day` ve `Subject` doğrudan bir `User`'a bağlı. Plan sahibi artık bir **aile üyesi** olmalı. Böylece hesapsız profillerin ve daveti bekleyen üyelerin de planı olabilir, ve davet kabul edilince plan yeni hesaba taşınmadan bağlanabilir.
- **Kayıt izleri:** `StudyEntry`, `TrainingEntry`, `Event` ve `Subject` için şu bilgiler tutulmalı: ekleyen üye, eklenme zamanı, en son düzenleyen üye, en son düzenlenme zamanı. Aktarılan kayıtlar ayırt edilebilir olmalı.

### E-posta gönderimi
Uygulama şu e-postaları göndermelidir:
- Kayıt doğrulama e-postası
- Şifre sıfırlama bağlantısı
- Aile daveti (link ve 6 haneli yedek kod)

E-postalar Türkçe olmalı, aile adını ve gönderen kişiyi açıkça göstermelidir. Gönderimler kötüye kullanıma karşı sınırlandırılmalıdır.

### Uç noktalar (ihtiyaç listesi)
- **Hesap:**
  - Kayıt, e-posta doğrulama, doğrulama e-postasını yeniden gönderme
  - Giriş (e-posta ve şifre)
  - Şifre sıfırlama isteği, bağlantıyla yeni şifre belirleme
- **Aile:**
  - Aile oluşturma
  - Aile bilgisini ve üye listesini getirme
  - Aile adını değiştirme
- **Davet:**
  - Davet gönderme (ad, rol, e-posta)
  - Daveti yeniden gönderme, iptal etme
  - Link belirtecini veya e-posta + yedek kodu doğrulama (aile adı, görünen ad ve e-postayı döner)
  - Davetle yeni hesap oluşturarak katılma
  - Davetle mevcut hesapla katılma
- **Üyeler:**
  - Hesapsız çocuk profili oluşturma
  - Hesapsız profile davet gönderme (mevcut plan korunur)
  - Rol değiştirme
  - Üye çıkarma
  - Aileden ayrılma
  - Yöneticiliği devretme
- **Plan:**
  - Gün, hafta ve ders listesi uç noktaları **hangi üyenin planı** olduğunu belirtecek şekilde genişletilmeli. Plan belirtilmezse giriş yapan kişinin planı döner.
  - Ders ve antrenman kaydı düzenleme eklenmeli (bugün yalnızca etkinlik düzenlemesi var).
  - Plan ve kayıt dönen uç noktalar şunları döndürmeli:
    - Ekleyen ve en son düzenleyen bilgisi (görünen ad, eski üye olup olmadığı)
    - İstekte bulunan kullanıcının bu planda **düzenleme yetkisi olup olmadığı**

### Yetki kuralları (sunucu tarafında zorunlu)
- **Okuma:** Kullanıcı yalnızca kendi ailesinin üyelerine ait planları okuyabilir. Ailedeki tüm planlar tüm üyelerce okunabilir.
- **Yazma** (ekleme, düzenleme, silme, durum değiştirme, ders listesi yönetimi):
  - Ebeveyn rolündeki üye ailedeki tüm planlarda yazabilir.
  - Çocuk rolündeki üye yalnızca kendi planında yazabilir.
  - Kaydı kimin eklediği yetkiyi etkilemez.
- **Aile yönetimi** yalnızca yöneticiye açıktır.
- **E-posta doğrulaması:** E-postası doğrulanmamış kullanıcı aile ve plan uç noktalarına erişemez.
- **Çıkarılan üye:** Aileden çıkarılan veya ayrılan kullanıcının mevcut oturumu artık aile verisine erişemez.
- **Kötüye kullanım:** Davet kodu denemeleri sınırlandırılmalı. Yedek kod yalnızca davet edilen e-postayla birlikte geçerli olmalı.

### Geçiş
- Mevcut her kullanıcı için tek kişilik bir aile oluşturulmalı. Kullanıcı bu ailede Ebeveyn rolünde yönetici olmalı ve mevcut verileri onun planına bağlanmalı. Mevcut kayıtların ekleyeni hesap sahibi olmalı.
- Mevcut hesaplar e-postası doğrulanmamış olarak işaretlenmeli.
- Firebase verisini belirli bir aile üyesinin planına aktaran tek seferlik bir aktarım aracı sağlanmalı. Aktarımdan sonra özet adetler raporlanmalı.

---

## Frontend Gereksinimleri

### Giriş, kayıt ve e-posta akışları
- Giriş ekranı: e-posta ve şifre, "Şifremi unuttum" bağlantısı, "Davet kodum var" seçeneği.
- Kayıt ekranı: e-posta, şifre, görünen ad. Kayıttan sonra "E-postanı doğrula" ekranı ve tekrar gönderme seçeneği.
- Doğrulama sonrası aile oluşturma adımı (aile adı).
- Şifre sıfırlama: e-posta girme ekranı ve bağlantıdan açılan yeni şifre ekranı.
- **Davet linkinden açılan ekran:** Aile adını ve görünen adı gösterir. E-posta dolu ve değiştirilemez gelir. Kullanıcı yalnızca şifre belirler. E-posta zaten bir hesaba aitse ekran bunun yerine "Giriş yap ve katıl" akışını gösterir.
- **Yedek kod ekranı:** E-posta ve 6 haneli kod girilir, ardından aynı şifre belirleme adımına geçilir.
- Tüm hata durumları (geçersiz, süresi dolmuş, iptal edilmiş davet, e-posta eşleşmemesi, doğrulanmamış e-posta) anlaşılır Türkçe mesajlarla gösterilmelidir.

### Kişi seçici ve salt okunur görünüm
- Başlıkta, bugünkü kullanıcı etiketinin yerine aile üyeleri arasında geçiş sağlayan bir seçici olmalı. Seçili kişinin adı ve baş harfi görünmeli.
- Gün ve Hafta Planı görünümleri seçili kişinin planını göstermeli. Kişi değişince seçili tarih korunmalı.
- Başka birinin planı görüntülenirken bu açıkça belli olmalı (örn. "Ela'nın planı").
- Kullanıcının düzenleme yetkisi olmayan bir planda şunlar gizlenmeli:
  - Ekleme formları (gün kartları, hafta tablosundaki "+" butonları ve ekleme çubuğu, liste görünümündeki hızlı ekleme)
  - Düzenleme, silme ve durum değiştirme kontrolleri
  - Ders listesi yönetimi

  Ekranda "yalnızca görüntüleme" işareti gösterilmeli.

### Kayıt kartları
- Ders ve antrenman kayıtları için düzenleme modu eklenmeli (etkinlikteki gibi).
- Kaydı plan sahibinden başka biri eklediyse veya düzenlediyse kayıt üzerinde küçük bir iz görünmeli ("Annem ekledi", "Babam düzenledi · 18:40", "Eski üye: …").
- Aynı iz hafta tablosu ve liste görünümündeki kayıt çiplerinde de gösterilmeli (yer darsa dokununca açılan detayda gösterilebilir).

### Aile ekranı ("Ailem")
- Üyeleri, rollerini, hesap ve davet durumlarını ve yöneticiyi listeler.
- **Yöneticiye özel:**
  - Davet formu (ad, rol, e-posta)
  - "E-postası olmayan çocuk ekle" (yalnızca ad)
  - Hesapsız profil için "Davet gönder"
  - Davet satırında durum (Bekliyor ve kalan süre, Katıldı, Süresi doldu, İptal), "Yeniden gönder" ve "İptal et"
  - Rol değiştirme, üye çıkarma, yöneticiliği devretme (onay pencereleriyle)
  - Aile adını değiştirme
- Hesapsız profil çıkarılırken planın silineceği açıkça uyarılmalı.
- **Üyelere özel:** "Aileden ayrıl" (onay penceresiyle).
- Yönetici olmayanlar ekranı salt okunur görür.

### Genel
- Tüm ekleme, düzenleme ve silme işlemlerinde hata olursa kullanıcıya görünür bir uyarı verilmeli ve ekran eski haline dönmeli.
- Yetki reddi anlaşılır bir mesajla gösterilmeli.

---

## Önerilen fazlar
1. **Hesap temeli:** E-posta doğrulama, e-postayla şifre sıfırlama, mevcut hesapların tek kişilik aileye geçişi.
2. **Aile ve davet:** Aile oluşturma, davet linki ve yedek kod, hesapsız çocuk profili, kişi seçici, aile ekranı.
3. **Yetki ve izler:** Rol ve plan bazlı yetkiler, salt okunur görünüm, kayıt izleri, ders ve antrenman düzenleme.
4. **Firebase aktarımı:** Ela'nın verisinin aktarımı ve doğrulanması. İptal edildi (2026-09-26): Firebase verisi aktarılmayacak, canlıda sıfırdan hesap açılacak.

## Kapsam Dışı (bu görevde yok)
- SMS gönderimi.
- Anlık bildirimler ("Annen planına ders ekledi").
- Rol dışında üye bazında özel yetkiler.
- Tam değişiklik geçmişi (audit log).
- Birden fazla aileye üyelik.
- Yaş doğrulaması ve yasal ebeveyn onayı süreçleri.

---

## Ilker'e onaylatılacak varsayımlar
1. **Planlar kişi başına:** Ortak aile planı yok. Kişi seçiciyle üyeler arasında geçiliyor.
2. **Ebeveynlerin de kendi planı olabilir.** Seçicide önce çocuklar listeleniyor.
3. **Çocuk ebeveynin planını yalnızca görür,** düzenleyemez ve silemez.
4. **Hesapsız çocuk profili:**
   - Profili yalnızca yönetici oluşturur. Planını tüm ebeveynler yönetir.
   - Çocuğun e-postası olunca davet gönderilir ve mevcut plan onun yeni hesabına bağlanır.
5. **Daveti bekleyen üyenin planı katılmadan önce doldurulabilir.**
6. **Yeniden gönderim eski davet linkini ve kodunu geçersiz kılar,** süre yeniden 7 gün başlar.
7. **Davet edilen e-postanın zaten hesabı varsa,** kişi mevcut hesabıyla katılır. Bu yalnızca tek kişilik ailesi varsa mümkündür ve o durumda planı yeni aileye taşınır.
8. **Yönetici yetkileri:**
   - Rol değiştirme
   - Üye çıkarma
   - Yöneticiliği devretme (yalnızca katılmış bir Ebeveyn'e)
   - Aile adını değiştirme
   - Yönetici, devretmeden aileden ayrılamaz.
9. **Aileden çıkarılan üye:** Hesabı olan üyenin kendi planı onunla birlikte gider. Hesapsız bir profil çıkarılırsa planı kalıcı olarak silinir.
10. **Bir kullanıcı yalnızca bir aileye üye olabilir.** Mevcut her hesap Ebeveyn rolünde yönetici olarak tek kişilik bir aileye dönüşür.
11. **Mevcut hesaplar doğrulanmamış sayılır** ve ilk girişte e-posta doğrulaması ister.
12. **Şifre sıfırlama bağlantısı 1 saat geçerlidir.**
13. **Ela'nın Firebase verisi Ela'nın planına aktarılır:** ekleyen "Ela (aktarıldı)" olarak işaretlenir, Firebase verisi bir süre yedek olarak saklanır.
14. **Kayıt izi olarak yalnızca "en son düzenleyen" tutulur,** tam değişiklik geçmişi yok.

---

## Backend Çıktısı

Kapsam: 1-3. fazlar (hesap temeli, aile ve davet, rol tabanlı yetki ve kayıt izleri) ve mevcut hesapların tek kişilik aileye geçişi. **4. faz (Firebase verisinin Ela'nın planına aktarımı) bu turda yapılmadı, sonraki tura bırakıldı.** Veri modelinde `IsImported` alanı bu aktarım için hazır.

### Değişen / eklenen dosyalar (`backend/PlanToBee.API/`)
- **Modeller:** `Models/User.cs` (DisplayName), `Models/Family.cs`, `Models/FamilyMember.cs`, `Models/Invitation.cs`, `Models/AuditedEntity.cs` (yeni); `Day.cs`, `Subject.cs` (UserId → MemberId), `StudyEntry.cs`, `TrainingEntry.cs`, `Event.cs` (kayıt izleri).
- **Veri:** `Data/AppDbContext.cs`, `Migrations/20260925213316_FamilyAccounts.cs` (+ Designer, Snapshot).
- **Controller'lar:** `Controllers/AuthController.cs` (yeniden yazıldı), `Controllers/FamilyController.cs` (yeni), `Controllers/InvitationsController.cs` (yeni), `Controllers/DaysController.cs`, `Controllers/SubjectsController.cs`.
- **DTO'lar:** `DTOs/AuthDtos.cs`, `DTOs/FamilyDtos.cs` (yeni), `DTOs/DayDtos.cs`.
- **Servisler:** `Services/MemberContext.cs` (üyelik ve plan yetkisi), `Services/FamilyService.cs` (aile açma, ayrılma, plan taşıma), `Services/InvitationService.cs`, `Services/AuthTokenService.cs`, `Services/AuditLookup.cs`, `Services/Email/*` (e-posta soyutlaması, Log ve SMTP uygulaması, Türkçe şablonlar).
- **Altyapı:** `Infrastructure/ApiErrors.cs`, `RateLimitPolicies.cs`, `SendThrottle.cs`, `RequireVerifiedEmailAttribute.cs`, `EmailConfirmationTokenProvider.cs`, `SecureCodes.cs`, `AppOptions.cs`.
- **Ayar:** `Program.cs`, `appsettings.json`, `appsettings.Development.json`, `PlanToBee.API.http` (örnek istekler), `backend/.gitignore` (`dev-emails/`).

### Veri modeli
- **AspNetUsers:** + `DisplayName`. Yeni hesaplarda `UserName` = e-posta. `EmailConfirmed` doğrulama durumudur.
- **Families:** `Id, Name(100), CreatedAt`.
- **FamilyMembers:** `Id, FamilyId, DisplayName(50), Role (Parent|Child), Status (NoAccount|Invited|Joined|Left), IsAdmin, UserId?, CreatedAt, JoinedAt?, LeftAt?`.
  - `UserId` üzerinde kısmi benzersiz indeks: bir kullanıcı yalnızca bir aileye üye olabilir.
  - `(FamilyId) WHERE IsAdmin` kısmi benzersiz indeksi: ailede en fazla bir yönetici olur.
  - Ayrılan ve çıkarılan üyenin satırı `Left` olarak kalır, `UserId` boşaltılır. Bu satır "Eski üye: [Ad]" gösterimi için saklanır.
- **Invitations:** `Id, FamilyId, MemberId, Email, NormalizedEmail, TokenHash, CodeHash, CodeSalt, FailedCodeAttempts, ExpiresAt, Status (Pending|Accepted|Cancelled), InvitedByMemberId, CreatedAt, LastSentAt, SendCount, AcceptedAt?, CancelledAt?` ve xmin eşzamanlılık belirteci.
  - Link belirteci 256 bit rastgeledir. Belirteç ve kodun kendisi saklanmaz, yalnızca SHA-256 özetleri saklanır.
  - "Süresi doldu" durumu `Pending` ve `ExpiresAt < şimdi` koşulundan hesaplanır.
- **Days / Subjects:** Plan sahibi `MemberId` (FamilyMember) oldu. Benzersiz indeks `(MemberId, Date)`.
- **StudyEntries / TrainingEntries / Events / Subjects:** `CreatedByMemberId?, CreatedAt, UpdatedByMemberId?, UpdatedAt?, IsImported`. Üye silinirse FK `SET NULL` olur.

### Geçiş (migration `FamilyAccounts`)
- Mevcut her kullanıcı için `"{Ad} Ailesi"` adında tek kişilik bir aile açılır. Kullanıcı bu ailede Ebeveyn rolünde yönetici olur.
- Mevcut günler ve ders listesi bu üyenin planına bağlanır. Mevcut kayıtların ekleyeni hesap sahibi, eklenme zamanı geçiş anı olarak işaretlenir.
- Tüm mevcut hesaplar `EmailConfirmed = false` yapılır.
- Adım `NOT EXISTS` koşuluyla korunur, yani idempotenttir. `Down` geri alması plan sahipliğini kullanıcıya geri yazar. Hesapsız profillerin planları geri almada silinir.
- `Program.cs` açılışta `Migrate()` çağırır. Bu yüzden API ilk çalıştığında yerel `plantobee` veritabanı otomatik geçirilir. Öncesinde yedek almak önerilir.

### E-posta
- **Soyutlama:** `IAppEmailSender`. Sağlayıcı `Email:Provider` ayarıyla seçilir.
  - **Development:** `Log` sağlayıcısı e-postayı göndermez. Link ve kod dahil tüm içeriği konsola ve `backend/PlanToBee.API/dev-emails/*.txt` dosyalarına yazar. Bu klasör git'e girmez.
  - **Üretim:** `Smtp` sağlayıcısı kullanılır. `Email:Smtp:Host/Port/EnableSsl/Username` ayarları appsettings'ten, `Email:Smtp:Password` user-secrets veya `Email__Smtp__Password` ortam değişkeninden gelir.
- **Bağlantılar:** `App:FrontendBaseUrl` ayarından üretilir (dev: `http://localhost:5173`). CORS izni de bu adrese verilir.
- **Frontend'in karşılaması gereken rotalar:**
  - `/verify-email?userId=…&token=…`
  - `/reset-password?userId=…&token=…`
  - `/invite?token=…`

### Genel sözleşme kuralları
- **Kimlik:** `Authorization: Bearer <token>`. Token 30 gün geçerlidir. Şifre değişince eski token'lar geçersiz olur (401).
- **Yeni hata gövdesi:** `{ "code": "makine_kodu", "message": "Türkçe mesaj", "errors"?: ["..."] }`. `message` kullanıcıya doğrudan gösterilebilir.
  - Model doğrulama hataları (DataAnnotations) eskisi gibi `{ errors: { Alan: ["mesaj"] } }` biçiminde döner.
  - Rate limit aşımı her uç noktada `429 { code: "rate_limited" }` döner.
- **Enum'lar JSON'da metindir:**
  - `role`: `"Parent"` / `"Child"`
  - `status` (üye): `"NoAccount"` / `"Invited"` / `"Joined"`
  - davet durumu: `"Pending"` / `"Accepted"` / `"Expired"` / `"Cancelled"`
- **Zamanlar** UTC ISO-8601'dir.
- **Doğrulama zorunluluğu:** Aile (`/api/family/**`) ve plan (`/api/days/**`, `/api/subjects/**`) uç noktaları, e-postası doğrulanmamış kullanıcıya `403 email_not_verified` döner. Doğrulama durumu her istekte veritabanından okunur, doğrulamadan sonra yeni token gerekmez.
- **Ailesi olmayan kullanıcı:** Aile ve plan uç noktaları `403 family_required` döner.
- **Başka ailenin verisi:** Her durumda `404` döner, varlığı belli edilmez.
- **Anında etki:** Üyelik ve rol her istekte veritabanından okunur. Rol değişikliği anında etkili olur, çıkarılan üyenin açık oturumu eski aileye hemen erişemez.
- **Kötüye kullanım sınırları:**

  | Kapsam | Sınır |
  |---|---|
  | `/api/auth/*` | IP başına 20 istek/dk |
  | `/api/invitations/*` | IP başına 10 istek/5 dk |
  | Davet gönderme ve yeniden gönderme | Kullanıcı başına 20/saat; aile başına 30 e-posta/gün; aynı davet için 60 sn bekleme |
  | Doğrulama ve şifre sıfırlama e-postası | Adres başına 60 sn bekleme, 5/saat |
  | Giriş | 5 hatalı denemede hesap 5 dk kilitlenir |
  | Yedek kod | Davet başına 5 hatalı denemede kilitlenir |

  IP ve kullanıcı sınırları `RateLimits:Auth`, `RateLimits:InvitePublic` ve `RateLimits:InviteSend` ayarlarıyla değiştirilebilir.

### API sözleşmesi

Kısaltmalar: 🔓 anonim, 🔑 oturum gerekir, ✅ oturum ve doğrulanmış e-posta gerekir, 👑 yalnızca aile yöneticisi.

#### Ortak nesneler
- `FamilySummary`: `{ id, name, memberId, displayName, role, isAdmin }` (giriş yapan kişinin üyeliği)
- `AuthResponse`: `{ token, email, displayName, username, emailVerified, family: FamilySummary | null }`. `username` alanı geriye dönük uyumluluk içindir ve `displayName` ile aynıdır.
- `AuditMember`: `{ memberId, displayName, isFormerMember }`. `isFormerMember=true` ise üye aileden ayrılmış ya da plan başka aileye taşınmıştır; "Eski üye: {displayName}" gösterilir.
- **Kayıt izi alanları** her kayıtta bulunur: `createdBy: AuditMember|null, createdAt, updatedBy: AuditMember|null, updatedAt|null, isImported`.
  - `createdBy` null ise sistem eklemiştir (ör. varsayılan dersler).
  - `updatedBy` null ise kayıt hiç düzenlenmemiştir.
- `Invitation`: `{ id, memberId, memberName, email, role, status, expiresAt, lastSentAt, createdAt, invitedBy, remainingSeconds|null }`. `remainingSeconds` yalnızca `Pending` davette doludur.
- `FamilyMember`: `{ id, displayName, role, status, isAdmin, hasAccount, isMe, canEdit, email|null, invitation: Invitation|null }`.
  - `canEdit`: istekte bulunanın bu üyenin planına yazıp yazamayacağı.
  - `invitation`: üyenin en son daveti.
- `Family`: `{ id, name, createdAt, myMemberId, iAmAdmin, myRole, members: FamilyMember[] }`. `Left` üyeler listelenmez. Sıralama: önce çocuklar, sonra ebeveynler, her grupta eklenme sırası.

#### Hesap (`/api/auth`)

| Metot ve yol | Yetki | İstek | Cevap 200 | Hatalar |
|---|---|---|---|---|
| `POST /api/auth/register` | 🔓 | `{ email, password, displayName }` (`username` de kabul edilir) | `AuthResponse` (`emailVerified:false`). Doğrulama e-postası gider. | 400 `validation` (şifre en az 6 karakter, yinelenen e-posta, ad boş) |
| `POST /api/auth/login` | 🔓 | `{ email, password }` | `AuthResponse`. Doğrulanmamış kullanıcı da token alır. | 401 `invalid_credentials`, 429 `locked_out` |
| `GET /api/auth/me` | 🔑 | - | `{ userId, email, displayName, emailVerified, family: FamilySummary\|null }` | 401 |
| `POST /api/auth/verify-email` | 🔓 | `{ userId, token }` (bağlantıdaki değerler olduğu gibi) | `{ message, alreadyVerified }` | 400 `verify_invalid` (token 2 gün geçerli) |
| `POST /api/auth/resend-verification` | 🔓 veya 🔑 | `{}` (oturum açıksa) veya `{ email }` | Her durumda aynı: `{ message }` | 429 `rate_limited` (60 sn içinde tekrar) |
| `POST /api/auth/forgot-password` | 🔓 | `{ email }` | Her durumda aynı: `{ message: "Kayıtlı bir hesap varsa…" }` | - |
| `POST /api/auth/reset-password` | 🔓 | `{ userId, token, newPassword }` | `AuthResponse` (otomatik giriş). E-posta doğrulanmış sayılır. Eski oturumlar düşer. | 400 `reset_invalid` (geçersiz, kullanılmış veya 1 saat geçmiş), 400 `validation` |

**Kaldırılanlar:** `GET /api/auth/features` ve doğrulamasız `POST /api/auth/reset-password {email,newPassword}`. `reset-password` artık yukarıdaki token'lı akıştır.

#### Aile (`/api/family`, tümü ✅)

| Metot ve yol | Yetki | İstek | Cevap 200 | Hatalar |
|---|---|---|---|---|
| `GET /api/family` | üye | - | `Family` | 403 `family_required` |
| `POST /api/family` | ailesiz kullanıcı | `{ name }` (1-100) | `Family` (kurucu Ebeveyn ve yönetici) | 409 `already_in_family`, 400 |
| `PUT /api/family` | 👑 | `{ name }` | `Family` | 403 `admin_only` |
| `GET /api/family/invitations` | 👑 | - | `Invitation[]` (tüm geçmiş, yeniden eskiye) | 403 `admin_only` |
| `POST /api/family/invitations` | 👑 | `{ displayName, role, email }` | `{ member: FamilyMember, emailSent }`. Üye `Invited` olarak oluşur, planı hemen doldurulabilir. | 409 `already_member`, 409 `already_invited`, 400, 429 |
| `POST /api/family/invitations/{id}/resend` | 👑 | - | `{ member, emailSent }`. Yeni link ve kod üretilir, eskileri geçersiz olur, süre 7 gün. | 404 `invite_not_found`, 409 `invite_not_pending`, 429 (60 sn) |
| `POST /api/family/invitations/{id}/cancel` | 👑 | - | `FamilyMember`. Üye planıyla kalır, `NoAccount`'a döner. | 404, 409 `invite_not_pending` |
| `POST /api/family/members/profiles` | 👑 | `{ displayName }` | `FamilyMember` (`Child`, `NoAccount`) | 400 |
| `POST /api/family/members/{id}/invite` | 👑 | `{ email }` | `{ member, emailSent }`. Kabul edilince mevcut plan yeni hesaba bağlanır. | 404 `member_not_found`, 409 `member_has_account_or_invite`, 409 `already_member`/`already_invited` |
| `PUT /api/family/members/{id}/role` | 👑 | `{ role }` | `FamilyMember` | 404, 400 `admin_must_be_parent` |
| `DELETE /api/family/members/{id}` | 👑 | - | `{ removedMemberId, planDeleted }` | 404, 400 `admin_cannot_leave` (kendini) |
| `POST /api/family/leave` | yönetici olmayan üye | - | `FamilySummary` (yeni tek kişilik ailesi) | 400 `admin_cannot_leave` |
| `POST /api/family/transfer-admin` | 👑 | `{ memberId }` | `Family` (`iAmAdmin:false`) | 404, 400 `transfer_target_invalid` (katılmış Ebeveyn değil), 400 `already_admin` |

- **Üye çıkarmada `planDeleted`:**
  - Hesabı olan üye çıkarılırsa `false` döner. Üye `Left` olur, planı onunla birlikte yeni tek kişilik ailesine taşınır.
  - Hesapsız veya daveti bekleyen üye çıkarılırsa `true` döner. Plan kalıcı olarak silinir. Arayüz bunu önceden uyarmalı.

#### Davet kabulü (`/api/invitations`, IP rate limit)

Kimlik bilgisi iki biçimde gönderilebilir: `{ token }` (linkten) veya `{ email, code }` (yedek kod). Kod yalnızca davetin gönderildiği e-postayla geçerlidir.

| Metot ve yol | Yetki | İstek | Cevap 200 | Hatalar |
|---|---|---|---|---|
| `POST /api/invitations/resolve` | 🔓 | `{ token }` veya `{ email, code }` | `{ familyName, displayName, role, email, invitedBy, expiresAt, accountExists }`. Daveti tüketmez. | aşağıya bakın |
| `POST /api/invitations/accept-new` | 🔓 | `{ token }` veya `{ email, code }` + `password` | `AuthResponse` (otomatik giriş, `emailVerified:true`) | 409 `account_exists`, 400 `validation` (şifre), aşağıdakiler |
| `POST /api/invitations/accept-existing` | 🔑 | `{ token }` veya `{ email, code }` | `AuthResponse` (yeni aile bilgisiyle) | 403 `invite_email_mismatch`, 409 `already_member`, 409 `family_not_empty`, aşağıdakiler |

- **Davet hataları (üç uç noktada ortak):**
  - 404 `invite_invalid`: link geçersiz ya da davet yeniden gönderildiği için eski link.
  - 400 `invite_code_invalid`: e-posta ve kod eşleşmedi.
  - 429 `invite_code_locked`: 5 hatalı denemeden sonra kod kilitlendi, link çalışmaya devam eder.
  - 410 `invite_used`, 410 `invite_expired`, 410 `invite_cancelled`.
  - 400 `invite_credentials_required`: ne token ne de e-posta ve kod gönderildi.
- **`accept-existing` ayrıntıları:**
  - Kullanıcının başka üyesi olmayan tek kişilik bir ailesi varsa (hesapsız profil veya bekleyen davet de "üye" sayılır), planı yeni aileye taşınır.
  - Aynı tarihli günler birleştirilir, aynı adlı dersler tekrar eklenmez.
  - E-posta doğrulanmış sayılır.

#### Plan: gün ve hafta (`/api/days`, tümü ✅)

Tüm uç noktalar isteğe bağlı `?memberId={üyeId}` alır. Verilmezse giriş yapan kişinin planı kullanılır. Kayıt kimliğiyle (`{id}`) yapılan işlemlerde plan sahibi kaydın kendisinden bulunur. Bu işlemlerde `memberId` gerekmez, gönderilirse yok sayılır.

| Metot ve yol | İstek | Cevap |
|---|---|---|
| `GET /api/days/{yyyy-MM-dd}` | - | `{ date, memberId, canEdit, studyEntries[], trainingEntries[], events[] }` |
| `GET /api/days/week/{pazartesi}` | - | `{ memberId, canEdit, days: [{ date, studyMinutes, entryCount, trainingDone, trainingCount, eventCount }] }` (değişti, eskiden dizi dönüyordu) |
| `POST /api/days/{date}/entries` | `{ subject, topic?, minutes }` | `StudyEntry` |
| `PUT /api/days/{date}/entries/{id}` (**yeni**) | `{ subject, topic?, minutes, status? }` (`status` verilmezse korunur) | `StudyEntry` |
| `PATCH /api/days/{date}/entries/{id}/status` | `{ status: "todo"\|"inprogress"\|"done" }` | `StudyEntry` |
| `DELETE /api/days/{date}/entries/{id}` | - | 204 |
| `POST /api/days/{date}/training` | `{ type, minutes, note? }` | `TrainingEntry` |
| `PUT /api/days/{date}/training/{id}` (**yeni**) | `{ type, minutes, note? }` | `TrainingEntry` |
| `DELETE /api/days/{date}/training/{id}` | - | 204 |
| `POST /api/days/{date}/events` | `{ title, time?, note? }` | `Event` |
| `PUT /api/days/{date}/events/{id}` | `{ title, time?, note? }` | `Event` |
| `DELETE /api/days/{date}/events/{id}` | - | 204 |

- **Kayıt biçimleri** (her birine kayıt izi alanları eklenir):
  - `StudyEntry` = `{ id, subject, topic, minutes, status }`
  - `TrainingEntry` = `{ id, type, minutes, note }`
  - `Event` = `{ id, title, time, note }`
- **Hatalar:**
  - 400 `invalid_date`, 400 `validation`
  - 403 `plan_read_only`: okuma izni var, yazma izni yok
  - 404 `plan_not_found`: `memberId` başka aileye ait, ayrılmış ya da yok
  - 404 `not_found`: kayıt yok ya da başka ailenin kaydı
  - 403 `family_required`, 403 `email_not_verified`
- **Yetki kuralı:** Okuma ailedeki tüm üyelere açıktır. Yazma kuralları:
  - Ebeveyn ailedeki tüm planlara yazar.
  - Çocuk yalnızca `memberId == kendi üyeliği` olan plana yazar.
  - Kaydı kimin eklediği yetkiyi etkilemez.
  - Durum değiştirme de yazma sayılır.

#### Plan: ders listesi (`/api/subjects`, tümü ✅)

| Metot ve yol | İstek | Cevap | Not |
|---|---|---|---|
| `GET /api/subjects?memberId=` | - | `{ memberId, canEdit, subjects: [{ id, name, ...kayıt izi }] }` (değişti, eskiden dizi dönüyordu) | Liste boşsa varsayılan 10 ders eklenir (`createdBy: null`). |
| `POST /api/subjects?memberId=` | Gövde düz JSON metnidir: `"Robotik"` (eskisi gibi) | `Subject` | 409 `duplicate_subject`, 403 `plan_read_only` |
| `DELETE /api/subjects/{id}` | - | 204 | 403 `plan_read_only`, 404 |

### Frontend'in değiştirmesi gerekenler
1. **Hata gösterimi:** `errorText()` yeni gövdeyi okumalı: `data.message` (ve varsa `data.errors[]`). Eski düz metin ve dizi dönen uç noktalar artık `{code,message}` döner.
2. **Kayıt:** `username` yerine `displayName` gönder. Eski alan da çalışır. Kayıt cevabı token döner. `emailVerified:false` ise "E-postanı doğrula" ekranını göster. "Tekrar gönder" için `POST /auth/resend-verification {}` kullanılır.
3. **Giriş sonrası yönlendirme:**
   - `emailVerified=false` ise doğrulama ekranı.
   - `family=null` ise aile oluşturma adımı.
   - İkisi de tamamsa uygulama.
   - Herhangi bir istekte `403 email_not_verified` veya `family_required` gelirse aynı yönlendirme yapılmalı.
   - `localStorage`'daki `username` yerine `displayName` kullanılabilir.
4. **Kaldırılan akışlar:** `/auth/features` ve doğrulamasız şifre sıfırlama kaldırıldı. Giriş ekranı her zaman "Şifremi unuttum" (`/auth/forgot-password`) göstermeli. `/reset-password?userId&token` rotası `POST /auth/reset-password` çağırmalı.
5. **Yeni rotalar:** `/verify-email?userId&token` → `POST /auth/verify-email`. `/invite?token` → `POST /invitations/resolve`.
   - `accountExists=false` ise şifre formu gösterilir ve `accept-new` çağrılır.
   - `accountExists=true` ise "Giriş yap ve katıl" gösterilir: giriş yapılır, ardından `accept-existing` çağrılır.
   - "Davet kodum var" ekranı aynı uç noktalara `{email, code}` gönderir.
6. **Kişi seçici:** `GET /family` üyelerini kullanır (sıralama sunucudan gelir). Seçili üye kendisi değilse tüm gün, hafta ve ders listesi isteklerine `?memberId=` eklenmeli. Kayıt kimlikli PUT/PATCH/DELETE isteklerine eklemek gerekmez.
7. **Salt okunur görünüm:** Cevaplardaki `canEdit` ile belirlenir (`DayDto.canEdit`, `WeekDto.canEdit`, `SubjectList.canEdit`, `FamilyMember.canEdit`).
8. **Cevap biçimi değişiklikleri:** `GET /subjects` ve `GET /days/week/...` artık dizi değil nesne döner (`.subjects`, `.days`). Kayıtlar ek alanlar içerir.
9. **Düzenleme modu:** Ders ve antrenman kayıtları için `PUT` uç noktaları kullanılır.
10. **Kayıt izi:** `createdBy`/`updatedBy` üyesi plan sahibinden (`memberId`) farklıysa iz gösterilir. `isFormerMember` ise "Eski üye: …" gösterilir.

### Neler gerçekten test edildi
- `dotnet build`: hatasız ve uyarısız.
- **Migration:** Yerel PostgreSQL'deki `plantobee` veritabanının kopyasına (`plantobee_familytest`) uygulandı.
  - 6 kullanıcı 6 tek kişilik aileye dönüştü.
  - 200 gün, 40 ders, tüm ders, antrenman ve etkinlik kayıtları korundu. Sahipsiz kayıt yok, ekleyen alanı boş kayıt yok.
  - Tüm hesaplar doğrulanmamış işaretlendi.
  - `Down` ve tekrar `Up` ayrı bir kopyada denendi.
  - Gerçek `plantobee` veritabanına **dokunulmadı**. Test kopyaları silindi.
- **Uçtan uca test:** API test kopyasına karşı çalıştırıldı, Python ve urllib ile yazılmış bir betik 132 kontrolün tamamını geçti. Kapsanan akışlar:
  - Kayıt, doğrulanmamış erişim reddi, doğrulama, aile oluşturma.
  - Davet (link ve kod, yanlış e-posta, yanlış kod, tekrar kullanım).
  - Hesapsız profil, bekleyen üyenin planını doldurma, davetle yeni hesap.
  - Çocuk yetki reddi (ekleme, düzenleme, silme, durum, ders listesi), başka ailenin verisine 404.
  - Mevcut hesapla katılma ve plan taşıma, rolün anında etkili olması, yönetici devri.
  - Yeniden gönderim, süre dolması, iptal, 5 hatalı kodla kilit.
  - Profile davet ve planın korunması, üye çıkarma ve planın üyeyle gitmesi, eski üye izi, profil silme, aileden ayrılma.
  - Şifre sıfırlama (tek kullanım, eski oturumların düşmesi).
  - Geçirilmiş eski bir hesabın şifre sıfırlamayla girip eski verisini görmesi.
  - Varsayılan IP sınırıyla 11. istekte 429.
- **Test edilmeyenler:**
  - SMTP ile gerçek e-posta gönderimi (gerçek SMTP bilgisi yok).
  - Frontend entegrasyonu.

### Bilinen sınırlamalar
- **4. faz yapılmadı:** Firebase aktarım aracı ve adet doğrulama raporu sonraki tura bırakıldı.
- **Bellek içi sınırlayıcılar:** Rate limit ve e-posta gönderim sınırları tek sunucu örneğinde geçerlidir. Birden fazla örnekte paylaşılan bir depo (ör. Redis) gerekir.
- **Log sağlayıcısı gizli bilgi yazar:** Link ve kodları loglar, yalnızca geliştirme içindir. Üretimde `Log` seçilirse açılışta uyarı loglanır.
- **Eski link hatası ayırt edilmiyor:** Yeniden gönderim eski belirteci tamamen değiştirir. Eski link `invite_invalid` (404) döner; "yeniden gönderildi" durumu ayrıca ayırt edilmez.
- **İptal edilen davetin üyesi:** Planıyla birlikte `NoAccount` profiline döner. Rolü Ebeveyn olsa da böyle kalır. Yönetici yeniden davet edebilir ya da çıkarabilir.
- **Boş kalan eski aile:** Mevcut hesapla başka aileye katılan veya aileden ayrılan kullanıcının eski ailesi, üyesiz bir kayıt olarak veritabanında kalır. Bu kayıt işlevsel bir etki yaratmaz.
- **Kayıtta hesap varlığı belli oluyor:** Kayıt ekranı yinelenen e-postayı eskisi gibi bildirir, yani hesap varlığı bu ekranda belli olur. Şifre sıfırlama ve doğrulama e-postası uç noktaları belli etmez.
- **Yedek kodun özeti:** Kod SHA-256 ve tuzla saklanır. Kod 6 haneli olduğundan veritabanı sızarsa kaba kuvvetle çözülebilir. Davetin 7 günlük süresi ve tek kullanımlık olması bu riski sınırlar.
- **Okuyana göre değişmeyen varsayılan dersler:** `GET /subjects` boş listede varsayılan dersleri, isteği yapan salt okunur olsa bile ekler (eski davranış korundu).

### QA düzeltmeleri (1. tur)
QA'nın 1, 2 ve 3. bulguları ile /auth/me sınırı düzeltildi. Giriş kilidinin hesap varlığını belli etmesi Ilker'in kararını beklediği için değiştirilmedi.
1. **Kullanılmış, iptal edilmiş davetin yedek kodu** (`Services/InvitationService.cs`):
   - Kod yolu artık bekleyen davetlerin yanında son 30 günde gönderilmiş kapanmış davetlere de bakar. Eşleşme önce bekleyen davetlerde aranır.
   - Doğru kod girildiğinde 410 `invite_used` veya `invite_cancelled` döner. Süresi dolmuş davet eskisi gibi 410 `invite_expired` döner.
   - Yanlış kod eskisi gibi 400 `invite_code_invalid` döner.
   - Deneme sayacı ve 5 denemede kilit değişmedi: sayaç yalnızca bekleyen davetlerde işler, kilitli davette doğru kod 429 `invite_code_locked` döner, link çalışmaya devam eder.
2. **`resend-verification` hesap varlığını belli etmiyor** (`Controllers/AuthController.cs`):
   - Oturumsuz (`{email}`) istekte sınır aşılırsa da 200 ve aynı mesaj döner, e-posta sessizce gönderilmez.
   - Oturumlu (`{}`) istekte sınır aşılırsa eskisi gibi 429 `rate_limited` döner.
3. **Kayıt e-postası gönderim sınırına sayılıyor:** Kayıtta giden doğrulama e-postası da adres başına 60 sn ve 5/saat sınırına dahil. Kayıttan hemen sonra oturumlu "Tekrar gönder" 60 sn boyunca 429 döner. Frontend Çıktısı'ndaki "ilk 60 saniyede 'Tekrar gönder' her zaman 429 döner" notu bu düzeltmeyle yeniden doğru.
4. **`/api/auth/me` giriş sınırından çıkarıldı** (`Infrastructure/RateLimitPolicies.cs`):
   - Artık IP başına 20/dk olan `auth` sınırına değil, yeni `session` politikasına bağlı.
   - `session` sınırı kullanıcı başına 120 istek/dk, oturumsuz istekte IP başına. `RateLimits:Session` ayarıyla değiştirilebilir.
   - Diğer `/api/auth/*` uç noktaları eskisi gibi IP başına 20/dk.

**Doğrulama:**
- `dotnet build` hatasız ve uyarısız.
- `plantobee` veritabanının geçici bir kopyasında (`plantobee_qafix`) API çalıştırılıp 15 yeni kontrol denendi, hepsi geçti. Kapsanan durumlar:
  - Kullanılmış, iptal edilmiş ve süresi dolmuş davetin doğru kodu; kullanılmış davetin yanlış kodu.
  - Kilit regresyonu: 4 kez 400, ardından 429; kilitte doğru kod 429, link çalışıyor.
  - Kayıttan hemen sonra oturumlu yeniden gönderim 429.
  - Oturumsuz yeniden gönderim: kayıtlı-doğrulanmamış ve kayıtsız adres için 4 cevap aynı; ek e-posta gitmedi.
  - `RateLimits:Auth=3` ayarında `/auth/me` 10 kez 200, giriş sınırı ise çalışmaya devam ediyor.
- Önceki uçtan uca betik yeniden çalıştırıldı: 132 kontrolün 131'i geçti. Kalan kontrol, kullanılmış davetin koduna eski davranışı (400) bekliyordu; artık 1. düzeltme gereği 410 `invite_used` dönüyor.
- Gerçek `plantobee` veritabanına dokunulmadı. Kopya ve `dev-emails` klasörü silindi.

## Frontend Çıktısı

Kapsam: 1-3. fazlar (hesap akışları, aile ve davet, kişi seçici, salt okunur görünüm, kayıt izleri, ders ve antrenman düzenleme). 4. faz (Firebase aktarımı) yok. "Backend Çıktısı → Frontend'in değiştirmesi gerekenler" listesinin 10 maddesi de uygulandı.

### Değişen / eklenen dosyalar (`frontend/src/`)
- **API katmanı:**
  - `api/errors.js`: `errorText()` yeni gövdeyi okur (`message`, `errors[]`, eski `{errors:{Alan:[]}}`). Yeni `errorCode()` fonksiyonu eklendi.
  - `api/client.js`: 403 `email_not_verified` ve `family_required` cevaplarında olay yayınlar. `VITE_API_URL` ile adres değiştirilebilir (varsayılan `http://localhost:5002/api`).
- **Bağlamlar:**
  - `context/AuthContext.jsx` (yeniden yazıldı): kullanıcı nesnesi `{token, email, displayName, emailVerified, family}` biçimindedir. Açılışta `/auth/me` ile tazelenir. `applyAuth`, `refreshMe` ve `register(displayName)` eklendi.
  - `context/accountStatus.js`: `anon | loading | unverified | nofamily | ready` durumlarını hesaplar.
  - `context/NoticeContext.jsx`: ekranın altında hata ve bilgi bildirimi gösterir.
- **Hook:** `hooks/useMutation.js`. Değişiklik ekrana hemen uygulanır, sonra istek gönderilir. Hata olursa ekran eski haline döner, mesaj gösterilir ve veri sunucudan yeniden okunur. `plan_read_only` ve `plan_not_found` hatalarında aile bilgisi de tazelenir.
- **Yardımcılar:** `utils/format.js`: tarih ve süre biçimleri, Türkçe iyelik eki ("Ela'nın", "Can'ın"), rol ve durum etiketleri, kayıt izi metni (`auditTrail`).
- **Yönlendirme:** `App.jsx` (yeniden yazıldı).
  - Hesap durumuna göre yönlendirir: giriş, "E-postanı doğrula", aile kurma ya da uygulama.
  - E-posta bağlantısı rotaları oturum durumundan bağımsız açılır: `/verify-email`, `/reset-password`, `/forgot-password`, `/invite`, `/invite-code`.
- **Yeni sayfalar:**
  - `pages/ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `VerifyEmailPage.jsx`, `VerifyPendingPage.jsx` (tekrar gönder, "Doğruladım, devam et").
  - `pages/CreateFamilyPage.jsx` (varsayılan ad "{Ad} Ailesi").
  - `pages/InvitePage.jsx`: link ve yedek kodla katılma. Yeni hesap için şifre belirleme, mevcut hesap için "Giriş yap ve katıl". Farklı hesapla girişliyse uyarı gösterir.
  - `pages/PlanShell.jsx`: ana ekran. Kişi seçici, Gün, Hafta Planı ve Ailem sekmeleri, ders listesi yönetimi burada.
  - `pages/FamilyPage.jsx`: "Ailem" ekranı.
- **Yeni bileşenler:** `components/PersonPicker.jsx`, `PlanBanner.jsx`, `AuditTag.jsx`, `ConfirmDialog.jsx`, `AuthLayout.jsx`.
- **Değişenler:**
  - `pages/LoginPage.jsx`: `/auth/features` ve doğrulamasız sıfırlama kaldırıldı. "Şifremi unuttum" ve "Davet kodum var" her zaman görünür.
  - `pages/DayPage.jsx`, `pages/WeekPage.jsx`: `memberId`, `canEdit`, kayıt izi, hata olursa geri alma.
  - `components/StudyCard.jsx`, `TrainingCard.jsx`: düzenleme modu eklendi.
  - `components/EventCard.jsx`: `canEdit` ve kayıt izi.
  - `index.css`: yeni bileşenlerin stilleri.

### Bağlanan API'ler
- **Hesap:** `/auth/register` (`displayName`), `/auth/login`, `/auth/me`, `/auth/verify-email`, `/auth/resend-verification {}`, `/auth/forgot-password`, `/auth/reset-password {userId, token, newPassword}`.
- **Aile:**
  - Aile: `GET/POST/PUT /family`, `POST /family/leave`, `POST /family/transfer-admin`.
  - Davetler: `GET/POST /family/invitations`, `POST /family/invitations/{id}/resend`, `POST /family/invitations/{id}/cancel`.
  - Üyeler: `POST /family/members/profiles`, `POST /family/members/{id}/invite`, `PUT /family/members/{id}/role`, `DELETE /family/members/{id}`.
- **Davet:** `/invitations/resolve`, `/invitations/accept-new`, `/invitations/accept-existing`. Hepsine `{token}` ya da `{email, code}` gönderilir.
- **Plan:**
  - Gün ve hafta: `GET /days/{date}`, `GET /days/week/{pazartesi}` (`.days`).
  - Ders kayıtları: `POST/PUT/DELETE /days/{date}/entries`, `PATCH /days/{date}/entries/{id}/status`.
  - Antrenman ve etkinlik: `POST/PUT/DELETE /days/{date}/training`, `POST/PUT/DELETE /days/{date}/events`.
  - Ders listesi: `GET/POST /subjects` (`.subjects`, `.canEdit`), `DELETE /subjects/{id}`.
  - Seçili kişi kendisi değilse GET ve POST isteklerine `?memberId=` eklenir. Kayıt kimlikli PUT/PATCH/DELETE isteklerine eklenmez.

### Davranış özeti
- **Kişi seçici:** Başlıktaki "Ad ▾" düğmesi aile üyelerini sunucunun sırasıyla listeler (önce çocuklar). Seçili tarih ve hafta korunur.
  - Başkasının planında "Ela'nın planı" işareti görünür.
  - `canEdit=false` ise yanına "· yalnızca görüntüleme" eklenir. Gün kartlarındaki formlar, düzenle ve sil düğmeleri, durum rozeti ve ders listesi yönetimi gizlenir. Hafta tablosundaki "+", "×" ve ekleme çubuğu ile liste görünümündeki hızlı ekleme de gizlenir.
- **Kayıt izi:** Ekleyen ya da son düzenleyen plan sahibinden farklıysa kart altında görünür, örneğin "Anne ekledi", "Baba düzenledi · 18:40", "Eski üye: Anne ekledi". Hafta tablosu ve liste çiplerinde küçük yazıyla gösterilir.
- **Hatalar:** Her ekleme, düzenleme, silme ve durum değişikliği hatasında bildirim çıkar ve ekran eski haline döner. Ekleme formları yalnızca başarıda temizlenir, düzenleme formu hatada açık kalır.
  - `plan_read_only` gelirse aile bilgisi tazelenir ve kontroller gizlenir (rol sayfa açıkken düşürülmüş olabilir).
  - `plan_not_found` gelirse kişinin kendi planına dönülür.
- **Yönlendirme:** Herhangi bir istekte 403 `email_not_verified` gelirse doğrulama ekranına, `family_required` gelirse aile kurma ekranına geçilir.
- **Ailem:**
  - Üyeler, roller, hesap ve davet durumları görünür (Bekliyor ve kalan süre, Katıldı, Süresi doldu, İptal).
  - Yöneticiye özel işlemler: yeniden gönder, iptal, profil için "Davet gönder", rol değiştir, yöneticiliği devret, aileden çıkar, aile adını değiştir, davet formu, "E-postası olmayan çocuk ekle" ve davet geçmişi.
  - Rol değişikliği, devir, çıkarma ve ayrılma onay penceresiyle yapılır. Hesapsız ya da daveti bekleyen üye çıkarılırken planın **kalıcı olarak silineceği** uyarısı gösterilir.
  - Yönetici olmayan üye ekranı salt okunur görür ve "Aileden ayrıl" seçeneğini kullanabilir.

### Neler gerçekten test edildi
- `npm run build`: hatasız.
- `npm run lint`: hata yok, 8 uyarı. Uyarılar önceki sürümdeki türlerle aynıdır: veri çeken effect'lerde `set-state-in-effect`, hook dışa aktarımında `only-export-components`.
- **Uçtan uca (gerçek tarayıcı):** Headless Chrome ve puppeteer ile denendi.
  - API, `plantobee` veritabanının `pg_dump` ile alınmış kopyasında (`plantobee_fe`) ayrı portta çalıştırıldı. Vite de ayrı portta çalıştırıldı. Migration kopyaya uygulandı. **Gerçek `plantobee` veritabanına dokunulmadı.** İş sonunda süreçler kapatıldı, kopya veritabanı ve test e-postaları silindi.
  - Ana senaryo 74 kontrolün tamamını geçti, ek senaryolar 8 kontrolün tamamını geçti.
- **Ana senaryoda denenenler:**
  - Kayıt, doğrulama ekranı, "tekrar gönder" (60 sn sınırı mesajı), e-postadaki bağlantıyla doğrulama, aile kurma.
  - Ders, antrenman ve etkinlik ekleme ve düzenleme (PUT), durum değiştirme.
  - Hata anında geri alma: ağ hatasında silinen kayıt geri geldi, ekleme formu temizlenmedi.
  - Hesapsız profil, Ebeveyn ve Çocuk davetleri, "Bekliyor · N gün kaldı", 60 sn içinde yeniden gönderme hatası.
  - Kişi seçici: tarih korundu, başkasının planına ve daveti bekleyen üyenin planına kayıt eklendi.
  - Davet linkiyle yeni hesap. E-posta alanı salt okunur geldi.
  - "Anne ekledi" izi. Çocuk, başkasının kendi planına eklediği kaydı düzenleyip silebildi.
  - Çocuğun kardeş planında salt okunur görünüm (gün, hafta tablosu, liste, ders listesi).
  - Yanlış ve doğru yedek kod.
  - Rol değişikliğinin anında etkisi, davet iptali (Hesabı yok + İptal), hesapsız profil silme uyarısı.
  - Yönetici devri, aileden ayrılma ve "Eski üye: Anne ekledi".
  - Şifremi unuttum, bağlantıyla sıfırlama ve otomatik giriş, kullanılmış bağlantı hatası.
  - Geçersiz ve kullanılmış davet linki mesajları.
  - Önbellek "doğrulanmış" gösterirken 403 `email_not_verified` ile doğrulama ekranına yönlendirme. 403 `family_required` ile aile kurma ekranına yönlendirme.
  - Mevcut hesapla "Giriş yap ve katıl": tek kişilik ailedeki plan yeni aileye taşındı.
- **Ek senaryolarda denenenler:**
  - Sayfa açıkken Çocuk yapılan kullanıcının ekleme denemesi: `plan_read_only` mesajı çıktı, kayıt eklenmedi, formlar gizlendi, "yalnızca görüntüleme" işareti göründü.
  - Görüntülenen üye silinince kişinin kendi planına dönüldü.
  - Eski localStorage biçimiyle (`token` ve `username`) açılış.
  - Geçersiz token ile giriş ekranına dönüş.
- **Görsel kontrol:** Ekran görüntüleriyle bakıldı (kişi seçici, Ailem, kayıt izi, başkasının planı). Davet formundaki bir stil hatası bu kontrolde bulunup düzeltildi.
- **Test edilmeyenler:**
  - Gerçek SMTP ile gönderim.
  - Süresi dolmuş davet (7 gün) ve kilitlenmiş kod (5 hatalı deneme): bu mesajlar yalnızca backend `message` metniyle gösterilir, arayüzde ayrıca denenmedi.
  - Mobil Safari ve gerçek cihaz.

### Backend'e notlar
- **Hafta görünümünün istek sayısı:** Hafta görünümü kayıt ayrıntısına ihtiyaç duyduğu için hâlâ 7 ayrı `GET /days/{date}` isteği atıyor. `GET /days/week` yalnızca özet dönüyor. Kayıtları ve izleri de dönen bir hafta uç noktası (ör. `?detail=true`) istek sayısını düşürür.
- **Kayıt sonrası "tekrar gönder":** Kayıt olur olmaz doğrulama e-postası gittiği için ilk 60 saniyede "Tekrar gönder" her zaman 429 döner. Arayüz bu mesajı gösteriyor. Sorun değil, bilgi amaçlıdır.
- **`POST /family/leave` cevabı:** `AuthResponse` değil, `FamilySummary` döner. Frontend ayrıldıktan sonra `/auth/me` çağırıyor, bu yüzden uyumsuzluk yok.
- **Sözleşme uyumu:** Sözleşmeyle uyumsuzluk bulunmadı. DTO'lar (`DayDto`, `WeekDto`, `SubjectListDto`, `FamilyDto`, `InvitationPreviewDto`) task.md'deki tanımla birebir eşleşti.

### Bilinen sınırlamalar
- **Davet süresi güncellenmiyor:** "N gün kaldı" bilgisi aile yüklendiği anda hesaplanır, canlı olarak geri saymaz.
- **Seçili kişi hatırlanmıyor:** Sayfa yenilenince kişi seçimi kişinin kendi planına döner (kabul kriterindeki varsayılan).
- **Salt okunur işareti gecikebilir:** Başkası rolü değiştirdiğinde işaret, bir sonraki aile yüklemesine ya da ilk reddedilen yazma isteğine kadar eski kalabilir. Gün ve hafta verisindeki `canEdit` her yüklemede günceldir.
- **Dar hücrelerde iz metni:** Hafta tablosu çiplerinde iz metni küçük yazıyla satıra eklenir. Çok dar ekranlarda satır uzayabilir.
- **React Native'e geçiş:** Bileşenler sade tutuldu. `localStorage`, `window` olayları ve `<select>` gibi web öğeleri RN'e geçişte AsyncStorage ve Picker ile değiştirilmelidir. `ConfirmDialog` ve `NoticeContext` RN'deki Modal ve Alert karşılıklarıyla birebir değiştirilebilecek biçimde yazıldı.
- **Kapsam dışı:** Kökteki eski tek dosyalık `index.html` sürümü bu görevde güncellenmedi. 4. faz (Firebase aktarımı) arayüzü yok.

## Durum: Backend: Tamamlandı · Frontend: Tamamlandı · QA: Onaylandı

## QA Sonuçları

Kapsam: 1-3. fazlar. 4. faz (Firebase aktarımı) bilinçli olarak kapsam dışı, hata sayılmadı.

**Test ortamı:** Gerçek `plantobee` veritabanının `pg_dump` kopyası (`plantobee_qa`) kullanıldı. API ayrı klasöre derlenip 5102 portunda, Vite 5174 portunda çalıştırıldı. E-postalar geçici bir klasöre yazıldı. Gerçek `plantobee` veritabanına dokunulmadı; hâlâ yalnızca `InitialCreate` migration'ında. 5002 ve 5173 portlarındaki süreçlere dokunulmadı. İş sonunda süreçler kapatıldı, `plantobee_qa` silindi, geçici e-postalar temizlendi.

**Özet:** Kritik ve yüksek önemde hata yok. Sunucu tarafındaki yetki kuralları, IDOR koruması, davetin tek kullanımlık olması, süre, yeniden gönderim, deneme sınırı, migration ve frontend'deki salt okunur görünüm, geri alma ve yönlendirmeler bağımsız testlerde geçti. Bir kabul kriteri (davet hata mesajlarının açıklığı) yedek kod yolunda tam karşılanmıyor. Ayrıca düşük önemde birkaç bulgu var.

### Gerçekten çalıştırılan testler

**API testleri (Python/urllib, 4 betik, 268 kontrol):** 263'ü geçti. Kalan 5 kontrolün 3'ü aşağıdaki bulgular, 1'i test betiğinin kendi hatası (boş bir güne bakmıştı, doğru günle tekrar denenince geçti), 1'i de bilgi amaçlı ölçüm.

| Kabul kriteri | Sonuç | Denenenler |
|---|---|---|
| Kayıt, e-posta doğrulama (H1) | Geçti | Kayıt `emailVerified:false` döner. Doğrulanmamış kullanıcı `/family`, `/days`, `/days/week`, `/subjects` ve `POST /family` isteklerinde 403 `email_not_verified` alır. Bozuk token 400 döner. Doğrulama çalışır, ikinci doğrulamada `alreadyVerified` döner. Doğrulamadan sonra aynı token geçerli kalır. Aile oluşturulur, kurucu Ebeveyn rolünde yönetici olur. İkinci aile 409 döner. Büyük harfli yinelenen e-posta ve boş ad 400 döner. |
| Şifre sıfırlama (H2) | Geçti | Kayıtlı ve kayıtsız e-posta için cevap ve durum kodu aynı. Kayıtsız adrese e-posta gitmiyor. Bağlantı `/reset-password` rotasına gidiyor, e-postada "1 saat" yazıyor. Sıfırlamadan sonra otomatik giriş yapılıyor ve eski token 401 alıyor. Aynı bağlantı ikinci kez `reset_invalid` döner. Eski doğrulamasız `{email,newPassword}` akışı ve `/auth/features` kaldırılmış. 1 saatlik süre yalnızca kodda görüldü (`TokenLifespan=1h`), gerçekten beklenmedi. |
| Davet: link (H3, H4) | Geçti | E-postada link, 6 haneli kod, aile adı, gönderen adı ve "7 gün" bilgisi var. `resolve` aile adını, görünen adı ve e-postayı döner. `accept-new` gövdedeki farklı e-postayı yok sayar ve davet adresini kullanır, e-posta doğrulanmış sayılır. Ayrıca doğrulama e-postası gitmez. Kullanılmış link 410 `invite_used` döner. |
| Davet: yedek kod (H5) | Kısmen geçti (Bulgu 1) | Kod başka e-postayla 400 döner. Büyük harf ve boşluklu e-posta ile kod kabul edilir. Kodla katılımdan sonra link 410 döner. Süresi dolmuş davetin kodu 410 `invite_expired` döner. **Kullanılmış ve iptal edilmiş davetin kodu `invite_code_invalid` ("eşleşmedi") dönüyor.** |
| Yeniden gönderim, süre, iptal (H6) | Geçti | 60 sn içinde yeniden gönderim 429 döner. Yeniden gönderim yeni link ve kod üretir, eski link 404, eski kod 400 döner. Süre dolunca (DB'de `ExpiresAt` geri alındı) link ve kod 410 `invite_expired` döner, `accept-new` reddedilir, listede `Expired` görünür. Süresi dolmuş davet yeniden gönderilebiliyor ve tekrar `Pending` oluyor. İptal edilen davet 410 `invite_cancelled` döner, üye `NoAccount` olur, iptal edilen davet yeniden gönderilemez (409). |
| Deneme sınırı | Geçti | 5 hatalı koddan sonra 429 `invite_code_locked` döner. Kilitten sonra doğru kod ve kodla `accept-new` da reddedilir, link çalışmaya devam eder. Varsayılan ayarlarla `/api/invitations` 11. istekte, `/api/auth` 21. istekte 429 döner. Girişte 5 hatalı denemeden sonra 429 `locked_out` döner. |
| Hesapsız profil (H7, H8) | Geçti | Profil `Child`/`NoAccount` olarak oluşur. Yönetici olmayan ebeveyn profilin planına yazabilir. Profile gönderilen davet kabul edilince aynı `memberId` kullanılır ve eski günler ile kayıtlar yeni hesapta görünür. Profil çıkarılınca `planDeleted:true` döner, günleri DB'den silinir, plan 404 döner. |
| Mevcut hesapla katılma (varsayım 7) | Geçti | `resolve` `accountExists:true` döner, `accept-new` 409 `account_exists` döner. Başka hesapla `accept-existing` 403 `invite_email_mismatch` döner. Kodla `accept-existing` çalışır; ders, etkinlik ve özel ders taşınır, ekleyen bilgisi yeni üyeye çevrilir. Çok üyeli ailedeki kullanıcı 409 `family_not_empty` alır ve ailesinde kalır. |
| Yetki matrisi (H10-H12) | Geçti | Anne ve baba (yönetici olmayan ebeveyn) 5 plana (iki çocuk, iki ebeveyn, hesapsız profil) 3 kayıt türünü ekleyebiliyor, birbirlerinin kaydını düzenleyip silebiliyor. Çocuk kendi planına ekliyor, ebeveynin kendi planına eklediği kaydı düzenliyor (PUT), durumunu değiştiriyor (PATCH) ve siliyor. Çocuk kardeşin, ebeveynlerin ve hesapsız profilin planına ekleme, düzenleme, durum değiştirme ve silme denediğinde her işlemde 403 `plan_read_only` alıyor. Buna `?memberId=kendisi` eklenmiş silme hilesi de dahil. Bu planları okuyabiliyor, `canEdit=false` dönüyor. Ders listesinde de aynı kurallar geçerli (ekleme ve silme 403). |
| Rol değişikliğinin anında etkisi | Geçti | Çocuk Ebeveyn yapılınca aynı token ile kardeşin planına hemen yazabiliyor. Tekrar Çocuk yapılınca hemen 403 alıyor. Yönetici kendi rolünü Çocuk yapamıyor. |
| IDOR, başka aile | Geçti | Başka ailenin kullanıcısı `?memberId=` ile gün, hafta ve ders listesine erişemiyor (404 `plan_not_found`) ve yazamıyor. Kayıt id'siyle PUT, PATCH ve DELETE (ders, antrenman, etkinlik) 404 `not_found` dönüyor. Başka ailenin dersini silemiyor. Başka ailenin üyesine ve davetine yönelik yönetici işlemleri (çıkarma, rol, devir, profile davet, yeniden gönderim, iptal) 404 dönüyor. Veri değişmedi. |
| Yalnızca yöneticiye açık işlemler (H14) | Geçti | Yönetici olmayan ebeveyn ve çocuk, 8 yönetici işleminin tamamında 403 `admin_only` alıyor. |
| Kayıt izleri (H13) | Geçti | `createdBy`, `updatedBy`, `createdAt`, `updatedAt` ve `isImported` doğru dolu. Çıkarılan üyenin eklediği kayıt kalıyor ve `isFormerMember:true` dönüyor. |
| Aile yönetimi (H14, H15) | Geçti | Çocuk listede önce geliyor. `canEdit` rol matrisine uyuyor. Çocuğa, hesapsız ebeveyne ve kendine devir reddediliyor. Yönetici ayrılamıyor ve kendini çıkaramıyor. Devirden sonra eski yönetici Ebeveyn rolünde normal üye oluyor. Hesabı olan üye çıkarılınca `planDeleted:false` dönüyor. Açık oturumu eski aileye erişemiyor (404), kendi planıyla tek kişilik ailesine geçiyor, çıkarıldığı ailedeki eski kayıtlarını silemiyor. Aileden ayrılma de aynı şekilde çalışıyor. |
| Migration (H17, varsayım 10-11) | Geçti | Migration kopyada API açılışında uygulandı. Geçişten önce ve sonra alınan dökümler satır satır aynı: 6 kullanıcı, 200 gün, tüm ders, antrenman ve etkinlik alanları (ders, konu, dakika, durum, tür, not, başlık, saat) ve 40 ders. 6 tek kişilik aile oluştu, herkes Ebeveyn rolünde yönetici. Tüm hesaplar `EmailConfirmed=false`. `CreatedByMemberId` boş kayıt yok, ekleyeni plan sahibinden farklı kayıt yok. Eski bir hesap (ela@ada.com) şifre sıfırlamayla girip eski günlerini, kayıtlarını ve ders listesini gördü. `Down` migration denenmedi. |

**Tarayıcı testleri (puppeteer-core ile headless Chrome, 3 betik, 55 kontrol):** Hepsi geçti. Bir kontrol ilk denemede test betiğinin kendi hatası yüzünden başarısız oldu, düzeltilmiş ayrı bir betikle tekrar denenince geçti.
- **Kişi seçici:** Çocuk girişte kendi planını görüyor ve kendi planında işaret yok. Kişi değişince tarih korunuyor. Seçicide "· görüntüleme" etiketi var.
- **Salt okunur görünüm:** Kardeşin, hesapsız profilin ve ebeveynin planında "X'in planı · yalnızca görüntüleme" işareti var. Gün kartlarında ekleme formu, düzenle, sil, durum butonu ve ders listesi yönetimi yok. Hafta tablosunda ekleme çubuğu, "+", "×" ve durum değiştirme yok. Liste görünümünde hızlı ekleme yok. Kayıt izi ("Mehmet ekledi") gün kartında ve hafta tablosunda görünüyor.
- **Hata olunca geri alma:** Sunucu 500 ya da ağ hatası döndüğünde silinen kayıt geri geliyor ve bildirim görünüyor. Durum değişikliği hatasında eski durum geri geliyor. Düzenleme hatasında form açık kalıyor. Ekleme hatasında form temizlenmiyor. Başarılı ekleme ve düzenleme çalışıyor.
- **Rol düşürme:** Sayfa açıkken Çocuk yapılan kullanıcı ekleme denediğinde kontroller gizleniyor ve "yalnızca görüntüleme" işareti çıkıyor.
- **Yönlendirmeler:** Kayıttan sonra "E-postanı doğrula" ekranı açılıyor. "Tekrar gönder" ve "Doğruladım" (doğrulamadan) çalışıyor. Doğrulama bağlantısından sonra aile kurma adımına, oradan uygulamaya geçiliyor. Uygulama açıkken DB'de doğrulama kaldırılınca 403 `email_not_verified` ile doğrulama ekranına, üyelik kaldırılınca 403 `family_required` ile aile kurma ekranına yönlendiriliyor.
- **Hesap ve davet ekranları:** Giriş ekranında "Şifremi unuttum" ve "Davet kodum var" var. Şifremi unuttum ekranı kayıtsız adreste de aynı mesajı veriyor. Geçersiz sıfırlama bağlantısında mesaj görünüyor. Davet linkinde aile adı ve görünen ad görünüyor, e-posta dolu ve salt okunur geliyor, şifre belirlenince otomatik giriş yapılıyor. Kullanılmış ve geçersiz link mesajları görünüyor. Yedek kod ekranında yanlış e-postayla "eşleşmedi" mesajı çıkıyor, doğru kodla şifre adımına geçiliyor.
- **Ailem:** Çocuk ekranı salt okunur görüyor, yönetici işlemleri yok, "Aileden ayrıl" var. Yöneticide davet formu, profil ekleme, ad değiştirme, "Bekliyor · N gün kaldı", "Yeniden gönder" ve "Daveti iptal et" var. Hesapsız profil için "Hesabı yok" ve "Davet gönder" görünüyor. Profil çıkarılırken "KALICI OLARAK silinecek" uyarısı çıkıyor. Rol değişikliği onay penceresiyle yapılıyor. 60 sn içinde yeniden gönderimde anlaşılır mesaj çıkıyor.
- `vite build` hatasız (çıktı geçici klasöre alındı). `oxlint` hata vermedi, yalnızca uyarı verdi.

### Yalnızca kod okuyarak değerlendirilenler (çalıştırılmadı)
- Kullanıcı başına 20 davet/saat ve aile başına 30 e-posta/gün sınırları (`SendThrottle`, `InviteSend` politikası).
- Şifre sıfırlama bağlantısının 1 saat, doğrulama bağlantısının 2 gün geçerliliği (`Program.cs`, `EmailConfirmationTokenProvider`).
- Frontend'de mevcut hesapla "Giriş yap ve katıl" akışı ve farklı hesapla girişliyken gösterilen uyarı (`InvitePage.jsx`). Backend tarafı API testinde geçti.
- Yönetici devri ve aileden ayrılma ekranlarının onay pencereleri (`FamilyPage.jsx`). Backend tarafı API testinde geçti.
- Migration `Down` adımı.
- Eski özelliklerin korunması: Kökteki `index.html` Firebase kullanan bağımsız eski sürüm, API'ye bağlı değil, bu yüzden backend değişiklikleri onu etkilemiyor. React tarafında HEAD'e göre fark incelendi. Hafta tablo ve liste görünümü, istatistikler, gün şeridi, antrenman saat/dakika girişi, not alanları, etkinlik düzenleme, ders listesi yönetimi ve durum döngüsü korunmuş. Kaybolan bir özellik bulunmadı.

### Bulgular

**Bulgu 1: Kullanılmış veya iptal edilmiş davetin yedek kodunda sorun açıkça belirtilmiyor.** Önem: Orta. Düzeltme: **Backend**.
- **Kabul kriteri:** "Geçersiz, kullanılmış, süresi dolmuş veya iptal edilmiş davette sorunun ne olduğu açıkça belirtilir ve kişiye yöneticiden yeni davet istemesi söylenir." (Davet H3-H6)
- **Tekrar üretme:**
  1. Bir davet gönder.
  2. Daveti link ya da kodla kabul et, ya da yönetici `POST /api/family/invitations/{id}/cancel` ile iptal etsin.
  3. `POST /api/invitations/resolve {"email":"<davet adresi>","code":"<doğru kod>"}` gönder.
- **Beklenen:** 410 `invite_used` ya da `invite_cancelled`.
- **Gerçekleşen:** 400 `invite_code_invalid`, "E-posta adresi ve kod eşleşmedi…". Kullanıcı doğru kodu girdiği halde yanlış girdiğini düşünür ve deneme hakkını tüketir. Aynı davetin linki doğru mesajı veriyor.
- **Neden:** `InvitationService.ResolveAsync` kod yolunda adayları yalnızca `Status == Pending` olan davetlerle sınırlıyor.
- **Öneri:** Kod eşleşmesi tüm davetlerde (ya da aynı adrese giden son davetlerde) aransın, eşleşen davetin durumuna göre `invite_used` ya da `invite_cancelled` dönülsün. Doğru kod gerektiği için bu, hesap varlığını dışarıya belli etmez.
- **Frontend:** `InvitePage` bu kodları zaten `INVITE_FATAL` içinde doğru gösteriyor. Backend düzeltmesinden sonra frontend'de değişiklik gerekmez.

**Bulgu 2: "Doğrulama e-postasını tekrar gönder" kayıtlı hesabı belli ediyor.** Önem: Düşük-Orta. Düzeltme: **Backend**.
- **İlgili kriter:** Şifre sıfırlamada "e-postanın kayıtlı olup olmadığı dışarıya belli edilmez" ilkesi ve sözleşmedeki "Her durumda aynı" notu. Hesap varlığının kayıt ekranında belli olması bilinen sınırlama olarak kabul edilmişti; bu bulgu ondan ayrı bir uç noktada.
- **Tekrar üretme:**
  1. Doğrulanmamış bir hesabın e-postasıyla oturumsuz olarak `POST /api/auth/resend-verification {"email":"x@..."}` isteğini 60 sn içinde iki kez gönder. İkincisi 429 `rate_limited` döner.
  2. Aynı isteği kayıtsız bir e-postayla iki kez gönder. Her ikisi de 200 döner.
- **Öneri:** `forgot-password`'daki gibi sınır aşıldığında da 200 ve aynı mesaj dönülsün. Oturum açık (`{}`) çağrıda 429 dönmeye devam edebilir, çünkü orada hesap zaten biliniyor.

**Bulgu 3: Kayıtta giden doğrulama e-postası gönderim sınırına sayılmıyor.** Önem: Düşük. Düzeltme: **Backend**.
- **İlgili kriter:** "Gönderimler kötüye kullanıma karşı sınırlandırılmalıdır." Sözleşmede adres başına 60 sn bekleme var.
- **Tekrar üretme:**
  1. `POST /api/auth/register` ile kayıt ol.
  2. Hemen `POST /api/auth/resend-verification {}` gönder.
- **Gerçekleşen:** 200 döner ve 60 sn dolmadan ikinci e-posta gider. Arayüzde de "tekrar gönder" hemen ikinci e-postayı gönderdi.
- **Not:** Frontend Çıktısı'ndaki "ilk 60 saniyede 'Tekrar gönder' her zaman 429 döner" notu gerçek davranışla uyuşmuyor.
- **Öneri:** `Register` içinde `SendVerificationEmailAsync` öncesinde `verify:{userId}` throttle kaydı da yapılsın.

**Bulgu 4 (bilgi, düzeltme zorunlu değil): Giriş kilidi hesap varlığını belli ediyor ve kilitlemeye açık.** Önem: Düşük. Düzeltme: **Backend** (isteğe bağlı).
- Kayıtlı bir e-postaya 5 hatalı giriş denemesinden sonra 429 `locked_out` dönüyor. Kayıtsız adres her zaman 401 dönüyor.
- Başka biri de bir hesabı 5 dakikalığına kilitleyebilir.
- Kabul kriterlerinde açıkça istenmediği için yalnızca bilgi olarak raporlandı.

**Bulgu 5 (bilgi): `/api/auth/me` de `auth` IP sınırına (20 istek/dk) dahil.** Önem: Düşük. Düzeltme: **Backend** (isteğe bağlı).
- Aynı ev ağından (aynı IP) çalışan bir ailede uygulama açılışları ve giriş denemeleri aynı sınırı paylaşır. Sınır aşılırsa açılışta "Sunucuya ulaşılamadı" ekranı görünür.
- Testte sınır doldurulduktan sonra `/auth/me` 429 döndü.
- Öneri: `/auth/me` bu politikadan çıkarılabilir ya da ona ayrı bir sınır verilebilir.

### Sonuç
Bulgu 1 bir kabul kriterini yedek kod yolunda karşılamadığı için durum **QA: Düzeltme Gerekiyor** olarak işaretlendi. Bulgu 1-3 yalnızca backend'de düzeltilmeli. Frontend için düzeltme gerekmiyor; Frontend Çıktısı'ndaki 429 notu (Bulgu 3) Bulgu 3 düzeltilince doğru hale gelir. Düzeltmeden sonra yeniden test edilecekler: Bulgu 1-3'teki adımlar ve davet kodu yolunun regresyonu (kilit, süre dolması, başka e-postayla kod).

## QA Sonuçları (2. tur)

Kapsam: Backend Çıktısı → "QA düzeltmeleri (1. tur)" bölümündeki 4 düzeltmenin bağımsız doğrulanması ve kısa bir regresyon turu.

**Ortam:** 1. turdakiyle aynı. Gerçek `plantobee` veritabanının kopyası (`plantobee_qa`) kullanıldı. API 5102 portunda çalıştırıldı, güncel koddan yeniden derlendi (`dotnet build` hatasız ve uyarısız). Vite 5174 portunda çalıştırıldı. Gerçek `plantobee` veritabanına dokunulmadı; hâlâ yalnızca `InitialCreate` migration'ında. 5002 ve 5173 portlarındaki süreçlere dokunulmadı. İş sonunda süreçler kapatıldı, kopya silindi, geçici e-postalar temizlendi.

### Düzeltmelerin doğrulanması (gerçekten çalıştırıldı)

| QA bulgusu | Sonuç | Denenenler |
|---|---|---|
| **1.** Kullanılmış veya iptal edilmiş davetin yedek kodu | **Düzeldi** | Kullanılmış davetin doğru kodu 410 `invite_used` döner. İptal edilmiş davetin doğru kodu 410 `invite_cancelled` döner. Aynı adrese iptalden sonra gönderilen yeni davette eski kod `invite_cancelled` dönerken yeni kod çalışır. Yanlış kod 400 döner. İptal kodu başka e-postayla 400 döner ve bu kodla hesap açılamaz. Kilit regresyonu: 5 hatalı denemeden sonra doğru kod 429 döner, link çalışır. Tarayıcıda "Davet kodum var" ekranında kullanılmış kod girilince "Bu davet zaten kullanılmış… yöneticiden yeni davet iste" mesajı görünüyor. |
| **2.** Oturumsuz `resend-verification` isteği hesabı belli ediyor | **Düzeldi** | Kayıtlı ve doğrulanmamış, doğrulanmış ve kayıtsız adresler için 60 sn içinde yapılan 7 isteğin hepsi aynı 200 cevabını döndü. Sınır aşıldığında ek e-posta gitmedi. |
| **3.** Kayıt e-postası gönderim sınırına sayılmıyor | **Düzeldi** | Kayıttan hemen sonra oturumlu "tekrar gönder" 429 döner ve e-posta gitmez. Tarayıcıda "Bir dakika bekleyip tekrar dene" mesajı görünüyor. |
| **5.** `/auth/me` giriş sınırına dahil (backend'in listesinde 4. madde) | **Düzeldi** | Varsayılan ayarlarla `/auth` sınırı (IP başına 20/dk) dolduktan sonra giriş 429 dönmeye devam ediyor. `/auth/me` ise aynı kullanıcı için 120 istek boyunca 200, 121. istekte 429 döndü. Oturumsuz `/auth/me` 401 döner. `/invitations` IP sınırı 11. istekte 429 döner. |

**Açık bilgi maddesi (düzeltme şartı değil, Ilker'in kararında):** QA 1. tur Bulgu 4. 5 hatalı girişten sonra kayıtlı hesap 429 `locked_out` alıyor, kayıtsız adres her zaman 401 alıyor. Bu 2. turda da aynı. Başkası da bir hesabı 5 dakikalığına kilitleyebilir.

**Yeni bilgi notu (düşük, düzeltme şartı değil):** Kapanmış (kullanılmış ya da iptal edilmiş) davetlerin koduna yapılan hatalı denemeler sayılmıyor. Testte kullanılmış bir davete 6 yanlış koddan sonra doğru kod yine 410 `invite_used` döndü.
- Bu, yalnızca son 30 gündeki kapanmış bir davetin kodunun tahmin edilip "kullanılmış" ya da "iptal" bilgisinin öğrenilmesine izin verir. Bu kodla katılım ya da hesap açılamaz.
- IP sınırı (10 istek/5 dk) denemeleri zaten yavaşlatıyor.
- Güvenlik açığı olarak değerlendirilmedi.

### Regresyon turu (gerçekten çalıştırıldı)
- **API testleri (1. turdaki 4 betik ve düzeltmeler için yeni bir betik):** 280 kontrolün 279'u geçti.
  - 1. turda başarısız olan A4, D6 ve H3 artık geçiyor.
  - Başarısız kalan tek kontrol (V3) test betiğinin kendi hatası: boş bir güne bakıyor. Kayıtlı bir günle tekrar denenince (21 Eylül: 2 ders, 1 etkinlik) geçti.
  - **Kapsanan akışlar:**
    - Yetki matrisi (129 kontrol): çocuk ve ebeveyn her plan ve her işlem türünde, ders listesi dahil, `memberId` hilesi dahil.
    - IDOR: başka ailenin plan, kayıt, ders, üye ve davet id'leri 404 döner.
    - Davet linki ve yedek kodu: tek kullanımlık olması, süre dolması, yeniden gönderim, iptal, 5 hatalı denemede kilit.
    - Hesapsız profil ve mevcut hesapla katılma.
    - Rolün anında etkili olması.
    - Yönetici devri, üye çıkarma ve aileden ayrılma.
    - Şifre sıfırlama: tek kullanımlık olması, eski oturumun düşmesi, kayıtsız adresin belli edilmemesi.
- **Migration:** Kopyada yeniden uygulandı. 200 gün, tüm kayıt alanları ve 40 ders geçiş öncesiyle satır satır aynı.
- **Tarayıcı testleri (headless Chrome):** 53 kontrolün 52'si ilk çalıştırmada geçti. Ayrı betiklerle tekrar denenen iki durum da geçti. İki yeni UI kontrolü (UI-F1, UI-F3) de geçti.
  - Başarısız kalan kontrol (UI10, silme hatasında geri alma) 1. turdaki gibi betiğin kendi yarış durumu. Ayrı bir betikle hem 500 hem ağ hatasında kaydın geri geldiği ve bildirimin çıktığı doğrulandı.
  - Yedek kod ve Ailem kontrollerini (R16-R23) içeren betik ilk çalıştırmada test tarafında bir sayfa geçişi zamanlaması yüzünden yarıda kaldı. Ayrı çalıştırılınca 8 kontrolün tamamı geçti.
  - **Kapsanan akışlar:**
    - Kişi seçici ve tarihin korunması.
    - Salt okunur görünüm: gün, hafta tablosu, liste, ders listesi.
    - Kayıt izi.
    - Hata olunca geri alma: silme, durum, düzenleme, ekleme.
    - Rol düşürülünce kontrollerin gizlenmesi.
    - Kayıt, doğrulama, aile kurma.
    - `email_not_verified` ve `family_required` yönlendirmeleri.
    - Şifremi unuttum.
    - Davet linki, kod ekranı ve hata mesajları.
    - Ailem (yönetici ve çocuk görünümü, silme uyarısı, onay pencereleri).

### Sonuç
1. turdaki düzeltme gerektiren bulguların hepsi (1, 2 ve 3) ile `/auth/me` sınırı düzeldi. Regresyon bulunmadı. Giriş kilidi maddesi Ilker'in kararına bırakılmış bilgi maddesi olarak açık. Durum: **QA: Onaylandı**.
