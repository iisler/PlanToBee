# PlanToBee (Programmeko) – Ürün Analizi ve Öneriler

Hazırlayan: Ürün Yöneticisi · Tarih: 25 Eylül 2026
Kapsam: Canlıdaki `index.html` (Firebase sürümü), yeni React frontend (`frontend/`) ve .NET API (`backend/PlanToBee.API/`).

---

## 1. Mevcut Durum Özeti

### Uygulama bugün ne yapıyor
PlanToBee, bir öğrencinin günlük **ders çalışma planını**, **voleybol antrenmanlarını** ve **etkinliklerini** (deneme sınavı, maç vb.) tek ekranda takip ettiği bir planlayıcı.

| Alan | Yetenekler |
|---|---|
| Ders | Ders + konu (ops.) + dakika ile kayıt; durum döngüsü (Yapılacak → Devam Ediyor → Tamamlandı); silme; ders listesini düzenleme (varsayılan 10 ders: Matematik, Geometri, Fizik ... İngilizce) |
| Antrenman | Tür (yalnızca "Top" / "Kuvvet") + süre + not; silme |
| Etkinlik | Başlık + saat (serbest metin) + not; düzenleme ve silme (düzenlenebilen tek kayıt türü) |
| Gün görünümü | Önceki/sonraki gün, 7 günlük şerit (her günde ders/antrenman/etkinlik noktaları), haftalık özet (ders dk, antrenmanlı gün sayısı /7, etkinlik sayısı) |
| Hafta Planı | Tablo görünümü (satır = gün, sütun = ders/antrenman/etkinlik, alt satırda toplamlar, tek ekleme çubuğu) ve Liste görünümü (her gün için kart + hızlı ekleme) |
| Geçmiş | (Sadece index.html) Son 21 aktif günün rozetli listesi, tıklayınca o güne gider |
| Tema | Açık/koyu tema, mobil öncelikli tasarım |

### İki sürüm
- **index.html (canlı, GitHub Pages):** Tek kullanıcılı. Firebase anonim giriş; başlıkta sabit "Ela Ada İşler" yazıyor. Sayfada "bu linke erişen herkes görebilir/düzenleyebilir" uyarısı var. Ela'nın gerçek verisi burada.
- **React + .NET (geliştirmede):** E-posta/şifre ile kayıt ve giriş, kullanıcı başına ayrı veri, JWT oturum (30 gün). API adresi şu an `localhost` – henüz yayında değil.

### Hedef kullanıcılar
- **Birincil: Ela** – lise öğrencisi, voleybolcu. Varsayım: Ders listesindeki Geometri/Felsefe/Coğrafya ve "deneme sınavı" örneği nedeniyle üniversite sınavına (YKS) hazırlanan bir öğrenci.
- **İkincil: Ebeveyn (Ilker)** – planı kuran, ilerlemeyi takip eden kişi. Varsayım: Şu an ebeveyn Ela ile aynı ekranı/linki kullanıyor; yeni sürümde ayrı bir "takipçi" rolü yok.
- **Potansiyel: Antrenör / öğretmen** – bugün hiç temsil edilmiyor.

### Ana kullanıcı akışları
1. **Günü planla / kaydet:** Gün sekmesi → ders ekle (durumu "Yapılacak") → çalıştıkça rozete dokunup "Tamamlandı" yap → antrenmanı ekle.
2. **Haftayı önceden planla:** Hafta Planı → tablo → "+" ile gün/tür seç → ders/antrenman/etkinlik ekle.
3. **Geriye bak:** Gün şeridindeki noktalar, haftalık özet, (eski sürümde) Geçmiş listesi.

---

## 2. Güçlü Yönler ve Eksikler / Sürtünme Noktaları

### Güçlü yönler
- **Sade ve odaklı:** Üç kavram (ders/antrenman/etkinlik), üç renk. Öğrenme maliyeti çok düşük.
- **Plan + gerçekleşme tek kayıtta:** Durum rozeti, planlananı ve yapılanı ayırmak için iyi bir temel.
- **Haftalık tablo görünümü:** Haftayı tek bakışta gösteriyor, hızlı ekleme akışı iyi düşünülmüş.
- **Mobil ve koyu tema desteği:** Öğrencinin gerçek kullanım bağlamına (telefon, akşam) uygun.
- **Yeni sürümde veri gizliliği:** Hesap bazlı erişim, eski sürümdeki "linki bilen herkes düzenler" riskini kapatıyor.

### Migrasyonda eksik kalanlar (index.html'de var, React'te yok veya farklı)

| # | Konu | index.html | React + .NET | Etki |
|---|---|---|---|---|
| M1 | **Geçmiş listesi** | "Geçmişi Göster" – son 21 aktif gün | Yok | Kullanıcı geriye dönük bakmak için gün gün geri gitmek zorunda |
| M2 | **Kayıt hatası bildirimi** | Kayıt başarısızsa değişiklik geri alınır, uyarı gösterilir | Gün kartları ve hafta görünümünde ekleme/silme/durum değişikliği hatası kullanıcıya gösterilmiyor (sessizce başarısız olabilir) | Kullanıcı kaydettiğini sanıp veri kaybedebilir |
| M3 | **Mevcut verinin taşınması** | Ela'nın tüm geçmişi Firebase'de | Firebase verisini yeni sisteme aktarma yolu yok | Geçişte Ela geçmişini kaybeder – geçişin önündeki ana engel |
| M4 | **Yayında olma** | GitHub Pages'te erişilebilir | API adresi localhost; canlı ortam yok | Yeni sürüm henüz kullanılamaz |
| M5 | **Antrenman süresi girişi** | Sadece dakika | Gün kartı ve liste görünümünde "saat + dakika", tablo görünümünde sadece dakika | Aynı uygulamada iki farklı giriş şekli – tutarsızlık |
| M6 | **Şifremi unuttum** | Gerek yok (anonim) | Sadece geliştirme ortamında açık; canlıda şifre unutan kullanıcı hesaba erişemez | Tek kullanıcılı bir aile uygulamasında ciddi destek yükü |

### Her iki sürümde ortak eksikler ve sürtünme noktaları
- **Ders ve antrenman kayıtları düzenlenemiyor.** Yanlış dakika girilirse sil-yeniden-ekle gerekiyor (sadece etkinlik düzenlenebiliyor).
- **Silmede onay veya geri alma yok.** Küçük "×" butonuna yanlışlıkla dokunmak kaydı kalıcı siliyor; mobilde risk yüksek.
- **Plan ve gerçekleşme istatistikte karışıyor.** "Haftalık ders" toplamı, durumu "Yapılacak" olan kayıtları da sayıyor. Ela 10 saat planlayıp 3 saat çalışsa da özet "10 saat" gösteriyor. Durum rozeti var ama özette karşılığı yok.
- **Antrenman türleri sabit ("Top", "Kuvvet").** Maç, turnuva, kondisyon, esneme/rehabilitasyon, dinlenme günü gibi voleybol gerçekleri girilemiyor.
- **Hafta görünümünden eklenen derslere konu girilemiyor.** Konu sadece gün sayfasından giriliyor.
- **Tekrar eden planlar yok.** Her hafta aynı olan antrenman programı (örn. Salı/Perşembe top, Cumartesi kuvvet) her hafta elle giriliyor.
- **"Bugüne dön" kısayolu yok.** Geçmişte/gelecekte dolaşınca bugüne dönmek için şeride veya oklara basmak gerekiyor.
- **Hedef ve motivasyon yok.** Haftalık hedef, seri (streak), ilerleme çubuğu gibi öğrenciyi geri getiren öğeler bulunmuyor.
- **Etkinlik saati serbest metin.** "17", "17:00", "akşam" hepsi geçerli; sıralama ve hatırlatma yapılamıyor.
- **Uzun vadeli görünüm yok.** Aylık görünüm, ders bazında dağılım, sınava kalan gün yok.
- **Rol ayrımı yok.** Ebeveyn/antrenör sadece izlemek isterse ya Ela'nın hesabına girmek ya da hiç görmemek zorunda.
- **Sayfa yenilenince konum kayboluyor (React).** Seçili gün ve Gün/Hafta sekmesi adres çubuğunda tutulmuyor; yenilemede her zaman "bugün / Gün" açılıyor. Varsayım: Küçük ama tekrar eden bir sürtünme.

---

## 3. Yeni Özellik Önerileri

Değer: Yüksek / Orta / Düşük · Efor: S (küçük) / M (orta) / L (büyük)

### Grup A – Geçişi tamamlama (önkoşullar)

**A1. Firebase verisini içe aktarma**
- Açıklama: Ela'nın Firebase'deki tüm günlerini (ders, antrenman, etkinlik, ders listesi) yeni sistemdeki hesabına tek seferlik aktarma.
- Problem: Geçişte geçmişin kaybolması (M3).
- Değer: Yüksek · Efor: M
- Hikaye: *Ela olarak, yeni uygulamaya geçtiğimde eski kayıtlarımın aynen orada olmasını istiyorum, böylece geçmişimi kaybetmeden devam edebilirim.*

**A2. Yeni sürümün yayına alınması**
- Açıklama: React + API'nin internetten erişilebilir hale gelmesi, eski linkten yeni sürüme yönlendirme.
- Problem: Yeni sürüm kullanılamıyor (M4).
- Değer: Yüksek · Efor: M
- Hikaye: *Ela olarak, uygulamayı telefonumdan her yerden açabilmek istiyorum.*

**A3. Kaydetme hatalarının her yerde gösterilmesi**
- Açıklama: Ekleme, silme, durum değiştirme başarısız olursa kullanıcıya açık bir uyarı ve eski duruma dönüş (eski sürümdeki davranışın eşdeğeri).
- Problem: Sessiz veri kaybı (M2).
- Değer: Yüksek · Efor: S
- Hikaye: *Ela olarak, bir kayıt kaydedilemediğinde bunu hemen görmek istiyorum, böylece kaydettim sanıp veri kaybetmem.*

**A4. Geçmiş listesinin geri getirilmesi**
- Açıklama: Son aktif günlerin özet listesi (eski sürümdeki "Geçmişi Göster").
- Problem: Geriye dönük bakış zorluğu (M1).
- Değer: Orta · Efor: S
- Hikaye: *Ela olarak, son haftalarda hangi gün ne yaptığımı tek listede görmek istiyorum.*

**A5. Güvenli şifre sıfırlama**
- Açıklama: E-posta ile doğrulanan "Şifremi unuttum" akışı.
- Problem: Şifreyi unutan kullanıcının hesaba erişememesi (M6).
- Değer: Orta · Efor: M
- Hikaye: *Kullanıcı olarak, şifremi unuttuğumda e-postama gelen bağlantıyla yeni şifre belirleyebilmek istiyorum.*

### Grup B – Günlük kullanım kalitesi

**B1. Ders ve antrenman kayıtlarını düzenleme**
- Açıklama: Etkinlikte olduğu gibi ders (ders, konu, dakika) ve antrenman (tür, süre, not) kayıtlarının yerinde düzenlenmesi.
- Problem: Yanlış girişte sil-yeniden-ekle zahmeti.
- Değer: Yüksek · Efor: S
- Hikaye: *Ela olarak, planladığım 60 dakikayı gerçekte 45 dakika çalıştıysam kaydı düzeltebilmek istiyorum.*

**B2. Silmede geri alma**
- Açıklama: Silinen kayıt için birkaç saniyelik "Geri al" bildirimi.
- Problem: Yanlış dokunuşla kalıcı veri kaybı.
- Değer: Orta · Efor: S
- Hikaye: *Ela olarak, yanlışlıkla sildiğim bir kaydı hemen geri alabilmek istiyorum.*

**B3. Planlanan / gerçekleşen ayrımı özette**
- Açıklama: Haftalık özette "Tamamlanan ders dk / Planlanan ders dk" gösterimi (örn. "180 / 300 dk"), gün şeridinde tamamlanma oranı.
- Problem: Özetin gerçek çalışmayı değil planı göstermesi.
- Değer: Yüksek · Efor: S
- Hikaye: *Ela olarak, bu hafta planladığımın ne kadarını gerçekten çalıştığımı görmek istiyorum.*

**B4. Özelleştirilebilir antrenman türleri**
- Açıklama: Ders listesi gibi düzenlenebilir antrenman türü listesi (varsayılan: Top, Kuvvet, Maç, Kondisyon, Esneme/Toparlanma).
- Problem: Voleybol programının gerçekliğinin iki türe sığmaması.
- Değer: Orta · Efor: S
- Hikaye: *Ela olarak, maçlarımı ve toparlanma seanslarımı da doğru türle kaydetmek istiyorum.*

**B5. Tutarlı süre girişi ve "Bugün" kısayolu**
- Açıklama: Tüm ekranlarda aynı süre giriş şekli; gün sayfasında bugünden farklı bir gündeyken "Bugün" butonu; seçili gün/görünümün yenilemede korunması.
- Problem: M5 ve gezinme sürtünmesi.
- Değer: Orta · Efor: S
- Hikaye: *Ela olarak, hangi ekranda olursam olayım süreyi aynı şekilde girmek ve tek dokunuşla bugüne dönmek istiyorum.*

### Grup C – Planlamayı hızlandırma

**C1. Haftayı kopyala / şablon hafta**
- Açıklama: Geçen haftanın planını (veya kayıtlı bir "şablon haftayı") yeni haftaya tek seferde kopyalama; kopyalanan dersler "Yapılacak" durumunda gelir.
- Problem: Her hafta aynı programı elle girme.
- Değer: Yüksek · Efor: M
- Hikaye: *Ela olarak, antrenman ve ders programım her hafta benzer olduğu için geçen haftayı kopyalayıp sadece farkları düzeltmek istiyorum.*

**C2. Tekrarlayan kayıtlar**
- Açıklama: "Her Salı ve Perşembe 120 dk Top" gibi kuralla tekrarlayan antrenman/ders/etkinlik.
- Problem: C1 ile aynı; daha esnek ama daha karmaşık.
- Değer: Orta · Efor: L
- Hikaye: *Ela olarak, sabit antrenman günlerimi bir kere tanımlayıp her hafta otomatik görmek istiyorum.*

**C3. Tamamlanmayanı ertele**
- Açıklama: Tamamlanmamış bir ders kaydını tek dokunuşla ertesi güne (veya seçilen güne) taşıma.
- Problem: Yapılamayan planın kaybolması veya elle yeniden girilmesi.
- Değer: Orta · Efor: S
- Hikaye: *Ela olarak, bugün yetiştiremediğim Fizik çalışmasını yarına taşımak istiyorum.*

### Grup D – Motivasyon ve içgörü

**D1. Haftalık hedefler**
- Açıklama: Haftalık ders süresi hedefi (toplam veya ders bazında) ve antrenman günü hedefi; özette ilerleme çubuğu.
- Problem: Neye göre "iyi hafta" olduğunun belirsizliği.
- Değer: Yüksek · Efor: M
- Hikaye: *Ela olarak, haftalık 15 saat çalışma hedefi koyup ne kadar yaklaştığımı görmek istiyorum.*

**D2. İstatistik sayfası**
- Açıklama: Ders bazında dağılım (hangi derse ne kadar zaman), son 4-8 haftanın trendi, antrenman yükü (haftalık toplam süre).
- Problem: Uzun vadeli dengesizliği (örn. Kimya'nın ihmal edilmesi) fark edememek.
- Değer: Orta · Efor: M
- Hikaye: *Ela olarak, son bir ayda hangi derse az zaman ayırdığımı görmek istiyorum.*

**D3. Seri (streak) göstergesi**
- Açıklama: Art arda en az bir tamamlanmış ders kaydı olan gün sayısı.
- Problem: Düzenli kullanım alışkanlığı oluşturmak.
- Değer: Düşük-Orta · Efor: S
- Hikaye: *Ela olarak, kaç gündür aralıksız çalıştığımı görmek beni motive eder.*

**D4. Sınav geri sayımı ve deneme sonuçları**
- Açıklama: Önemli bir sınav tarihi (örn. YKS) için geri sayım; deneme sınavı etkinliklerine ders bazında net sonucu girme ve trendini görme.
- Problem: Çalışmanın sonuca etkisini görememek. Varsayım: Ela sınava hazırlanıyor.
- Değer: Yüksek (varsayım doğruysa) · Efor: M
- Hikaye: *Ela olarak, deneme sınavlarımdaki netlerimin zamanla nasıl değiştiğini görmek istiyorum.*

### Grup E – Paylaşım ve erişim

**E1. İzleyici (ebeveyn/antrenör) erişimi**
- Açıklama: Ela'nın hesabına davet edilen bir kişinin planı salt okunur (veya kısıtlı yetkiyle) görmesi.
- Problem: Ebeveynin takibi için hesap paylaşma zorunluluğu.
- Değer: Orta-Yüksek · Efor: L
- Hikaye: *Ebeveyn olarak, Ela'nın haftalık planını ve ilerlemesini kendi hesabımdan görmek istiyorum, ama onun kayıtlarını değiştirmek istemiyorum.*

**E2. Ana ekrana eklenebilir uygulama ve hatırlatmalar**
- Açıklama: Telefonda uygulama gibi açılma; isteğe bağlı günlük hatırlatma ("Bugünün planını girdin mi?") ve etkinlik hatırlatması.
- Problem: Uygulamayı açmayı unutmak.
- Değer: Orta · Efor: M (hatırlatma kısmı L olabilir)
- Hikaye: *Ela olarak, akşam 21:00'de günü kapatmam için bir hatırlatma almak istiyorum.*

---

## 4. Önceliklendirilmiş Yol Haritası

### Hemen (geçişi güvenle tamamlamak)
1. **A3** Kaydetme hatalarının gösterilmesi (S) – veri güvenliği
2. **A1** Firebase verisini içe aktarma (M) – geçişin önkoşulu
3. **A2** Yeni sürümün yayına alınması (M)
4. **A4** Geçmiş listesi (S) – eski sürümle özellik eşitliği
5. **B1** Ders/antrenman düzenleme (S)
6. **B5** Tutarlı süre girişi + "Bugün" kısayolu (S)

> Hedef: Eski sürümden eksiksiz, daha güvenli bir yeni sürüme geçiş. Bu aşama bitmeden index.html kapatılmamalı.

### Sonraki (kullanım değerini artırmak)
7. **B3** Planlanan / gerçekleşen ayrımı (S)
8. **C1** Haftayı kopyala (M)
9. **B4** Özelleştirilebilir antrenman türleri (S)
10. **B2** Silmede geri alma (S)
11. **C3** Tamamlanmayanı ertele (S)
12. **D1** Haftalık hedefler (M)
13. **A5** Güvenli şifre sıfırlama (M) – ortak hesap kullanımı yaygınlaşmadan önce

### İleride (büyüme ve derinleşme)
14. **D4** Sınav geri sayımı ve deneme sonuçları (M)
15. **D2** İstatistik sayfası (M)
16. **E1** İzleyici erişimi (L)
17. **E2** Ana ekran uygulaması + hatırlatmalar (M-L)
18. **C2** Tekrarlayan kayıtlar (L) – C1 yeterli olmazsa
19. **D3** Seri göstergesi (S)

---

## 5. Açık Sorular (karar Ilker'e ait)

1. **Hedef kitle:** PlanToBee sadece Ela için mi kalacak, yoksa başka öğrencilerin (takım arkadaşları, kardeşler) de kullanacağı bir ürün mü olacak? Bu cevap, E1, A5 ve kayıt ekranının önceliğini doğrudan belirliyor.
2. **Ebeveyn/antrenör rolü:** Ela'nın planını kim görmeli? Sadece görme mi, yoksa plan ekleyebilme (örn. antrenörün antrenman programını girmesi) de mi?
3. **Geçiş planı:** index.html ne zaman kapatılacak? Geçiş sırasında bir süre iki sürüm paralel çalışacak mı? Eski linke gelenler yeni sürüme yönlendirilmeli mi?
4. **Veri aktarımı:** Firebase'deki tüm geçmiş mi aktarılsın, yoksa belirli bir tarihten sonrası yeterli mi? Aktarım sonrası Firebase verisi silinsin mi, yedek olarak kalsın mı?
5. **Sınav hedefi:** Ela hangi sınava (YKS, LGS, okul sınavları) ve hangi tarihe hazırlanıyor? D4'ün değeri buna bağlı.
6. **"Haftalık ders" metriği:** Özet planlananı mı, tamamlananı mı, ikisini birden mi göstermeli? (B3)
7. **Antrenman detayı:** Voleybol tarafında sadece süre yeterli mi, yoksa maç sonucu, yorgunluk/zorluk derecesi, sakatlık notu gibi bilgiler de takip edilmek isteniyor mu?
8. **Hatırlatmalar:** Ela'ya bildirim gönderilmesi isteniyor mu, isteniyorsa hangi saatlerde ve hangi durumlarda? (Öğrencinin bunaltılmaması önemli.)
9. **Yayın ortamı ve bütçe:** Yeni sürüm için ücretli bir sunucu/veritabanı kabul edilebilir mi, yoksa ücretsiz katmanlarda kalmak mı hedef?
10. **Tasarım ekranları:** Masaüstü/tablet kullanımı önemli mi, yoksa telefon öncelikli tasarım yeterli mi?
