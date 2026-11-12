# Görev 18: Kabul edilen yasal metin sürümünü kaydetme ve yeniden onay

Önceki görev: `docs/tasks/17-akis-tasarim.md`. İlgili: `docs/tasks/08-hesap-silme.md` (karar 3: "kabul edilen koşul
sürümü ve zamanı saklanır, ileride sürüm değişirse yeniden onay istenebilsin").

Durum: Backend: Tamamlandı · Frontend: Tamamlandı · QA: e2e (GitHub Actions) · Tasarım: mevcut giriş ekranı bileşenleri

## Neden
- KVKK m.10: aydınlatmanın yapıldığını ispat yükü veri sorumlusundadır. Bugün hesapta yalnızca "işaretlendi" (true) ve
  kayıt anı tutuluyor; **hangi metnin** okunduğu belli değil.
- TBK m.24 (genel işlem koşulları): sonradan değişen koşullar, karşı taraf kabul etmedikçe bağlamaz. Koşullar
  değiştiğinde yeni sürüm için yeniden onay alınmalı ve kaydedilmeli.

## Kararlar
1. **Tek kaynak:** Güncel sürümler backend sabitindedir (`Infrastructure/LegalVersions.cs`: `Kvkk`, `Terms`; bugün ikisi
   de 2). Önyüz güncel sürümü `GET /auth/me` ve oturum açan cevaplardan (`legal`) okur.
   - Metin dosyaları (`frontend/public/legal/aydinlatma.html`, `kosullar.html`) sürümü `<meta name="legal-version">`
     ile de taşır; e2e, bu değerlerin ve `docs/legal/*.md` içindeki "Sürüm N" satırının backend ile aynı olduğunu
     kontrol eder. Metin değişince üçü aynı PR'da artırılır.
2. **Hesapta saklananlar** (`Users`): `KvkkVersion`, `KvkkReadAt`, `TermsVersion`, `TermsAcceptedAt` (boş olabilir).
   `IsKvkkChecked`, `IsTermsAccepted`, `ConsentsAcceptedAt` (kayıt anı) korunur.
   - **Mevcut hesaplar geriye dönük doldurulmaz:** hangi sürümü gördükleri kanıtlanamaz; bir kez yeniden onay verirler.
3. **Kayıt:** İstemci, kullanıcıya gösterdiği metnin sürümünü gönderir (`kvkkVersion`, `termsVersion`; metindeki
   meta etiketinden okunur). Güncelden farklıysa kayıt `409 consent_outdated` ile reddedilir (hesap aranmadan önce; her
   adreste aynı cevap). Sürüm gönderilmezse (eski istemci) güncel sürüm yazılır.
4. **Yeniden onay:** Kabul edilen sürüm güncelden küçükse (ya da boşsa) önyüz uygulamayı açmaz:
   - **Hesap sahibinin profili** seçiliyse (ya da hesabın ailesi yoksa) yeniden onay sayfası açılır. Değişen her metin
     için: Aydınlatma Metni → yalnızca **"Okudum"** (açık rıza değildir, KVKK m.10); Kullanım Koşulları →
     **"Onaylıyorum"**. Metin alttan açılan sayfada okunur, düğme metnin sonundadır (kayıttaki gibi).
   - Onaylamak istemeyen kullanıcıya açıklama ve **"Hesabı sil"** yolu (mevcut silme formu) ile "Çıkış yap" gösterilir.
   - **Başka bir profil** (çocuk ya da diğer ebeveyn) seçiliyse: "Hesap sahibinin yeni metinleri onaylaması gerekiyor"
     bilgisi ve "Profil değiştir" / "Çıkış yap". Hesap sahibi herhangi bir cihazda onaylayınca diğer cihazlar da açılır.
   - Girişten sonra sıra: e-posta doğrulama → aile kurma → profil seçimi → yeniden onay → uygulama. (Silme ve onay ucu
     hesap sahibi profilini istediğinden onay profil seçiminden sonradır.)
5. **Uç nokta:** `POST /api/auth/consents` `{ kvkkVersion?, termsVersion? }`. Gönderilen sürüm güncelle aynı olmalı
   (değilse `409 consent_outdated`); en az biri gönderilmeli (`400 validation`). Ailesi olan hesapta yalnızca hesap
   sahibinin profili onaylar (`403 owner_only`, profil yoksa `403 profile_required`). Cevap: güncel `legal` durumu.
6. **Sunucu, plan uç noktalarını onaya bağlamaz** (bu turda): engel önyüzdedir; kayıt ve ispat sunucudadır.

### `legal` nesnesi (me ve oturum açan cevaplar)
```json
{ "kvkkVersion": 2, "termsVersion": 2,
  "acceptedKvkkVersion": 1, "acceptedTermsVersion": 2,
  "kvkkRequired": true, "termsRequired": false }
```

## Kullanıcı Hikâyeleri
1. **Veri sorumlusu olarak**, her hesabın hangi Aydınlatma Metni ve Kullanım Koşulları sürümünü ne zaman okuduğunu /
   kabul ettiğini kanıtlayabilmek istiyorum.
2. **Hesap sahibi olarak**, koşullar değiştiğinde girişten sonra yeni metni okuyup onaylamak; onaylamak istemezsem
   hesabımı silebilmek istiyorum.
3. **Çocuk profili olarak**, yasal onay ekranıyla karşılaşmayayım; hesap sahibinin onaylaması gerektiğini göreyim.

## Kabul Kriterleri
- [x] Kayıtta gösterilen sürüm ve zaman hesaba yazılır; `me.legal.acceptedKvkkVersion/acceptedTermsVersion` güncel sürüme eşittir.
- [x] Güncelden farklı sürümle kayıt `409 consent_outdated` döner, kayıtlı ve yeni adreste aynı cevap.
- [x] Eski sürümle kayıtlı hesapta `me.legal.kvkkRequired/termsRequired` true; önyüz yeniden onay sayfasını açar.
- [x] `POST /auth/consents` güncel sürümü ve zamanı yazar; eski sürüm 409, boş gövde 400, hesap sahibi dışı profil 403.
- [x] Onaydan sonra `me.legal.*Required` false, uygulama açılır.
- [x] Aydınlatma için düğme "Okudum", koşullar için "Onaylıyorum"; reddetme yolunda "Hesabı sil" var.
- [x] HTML metinlerindeki ve `docs/legal` içindeki sürüm, backend sabitiyle aynı (e2e kontrol eder).
- [x] EF migration: dört yeni sütun, geriye dönük doldurma yok.

## Kapsam dışı
- Plan uç noktalarının sunucuda onaya bağlanması.
- Sürüm geçmişi tablosu (her onayın ayrı satırı); bugün yalnızca son kabul edilen sürüm ve zamanı tutulur.
- Metin değişikliğinin e-postayla duyurulması.
