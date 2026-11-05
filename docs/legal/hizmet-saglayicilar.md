# Hizmet sağlayıcıları (veri işleyenler) listesi

İç belge; herkese açık sayfada yayımlanmaz. Aydınlatma metni (docs/legal/aydinlatma-ve-gizlilik.md, Bölüm 5)
sağlayıcıları ad vermeden, **alıcı grubu + amaç + ülke** olarak sayar. Bu liste:

- KVKK m. 11/1-ç başvurusunda ("verilerim kimlere aktarıldı?") adları bildirmek,
- KVKK m. 9 standart sözleşmelerini ve Kurum'a bildirimlerini takip etmek,
- App Store / Google Play gizlilik formlarını tutarlı doldurmak için tutulur.

Bir sağlayıcı değişince bu liste ve aydınlatma metnindeki aktarım tablosu birlikte güncellenir.

| Sağlayıcı | Alıcı grubu (aydınlatma metnindeki adı) | Amaç | Konum | Standart sözleşme | Kurum'a bildirim |
|---|---|---|---|---|---|
| Render | Bulut sunucu ve barındırma hizmet sağlayıcısı | API sunucusu | Almanya (Frankfurt) | [ ] | [ ] |
| Neon | Veritabanı hizmet sağlayıcısı | PostgreSQL veritabanı | Almanya (Frankfurt) | [ ] | [ ] |
| Brevo | E-posta gönderim hizmet sağlayıcısı | Doğrulama, giriş kodu, şifre sıfırlama e-postaları | Avrupa Birliği | [ ] | [ ] |
| GitHub (Pages, Actions artifact) | Yazılım geliştirme ve barındırma platformu | Web sitesi; AES-256 şifreli gece yedekleri (30 gün) | ABD | [ ] | [ ] |
| Apple Push Notification service, Google Firebase Cloud Messaging, Mozilla ve diğer tarayıcı push servisleri | Cihaz ve tarayıcı üreticilerinin bildirim servisleri | Bildirim iletimi (içerik uçtan uca şifreli) | Ağırlıklı ABD | Uygulanamıyor olabilir, bkz. not | — |

## Notlar

- **Standart sözleşme (KVKK m. 9/4-c):** Kurul'un ilan ettiği metin değiştirilmeden imzalanır ve imzadan itibaren
  **5 iş günü** içinde Kurum'a bildirilir. Sağlayıcıların AB GDPR veri işleme sözleşmeleri (DPA/SCC) Türk standart
  sözleşmesinin yerini tutmaz.
- **Bildirim servisleri:** Push servisleri şifreli içeriği iletir; abonelik adresi cihazın/tarayıcının kendi
  servisine aittir. Bu servislerle ayrı sözleşme yapmak pratikte mümkün olmayabilir; hukukçuya danışılmalı.
- **Sesle ekleme:** Konuşma tanıma tarayıcının özelliğidir; PlanToBee sesi almaz ve aktarmaz. Bu bir aktarım değil,
  bu yüzden tabloda yok (aydınlatma metni Bölüm 4'te bilgi verir).
- **Sunucu Türkiye'ye taşınırsa:** Yurt dışı aktarım bölümü (5.2) ve bu tablo güncellenir.
