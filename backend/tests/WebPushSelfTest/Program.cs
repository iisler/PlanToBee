using System.Security.Cryptography;
using System.Text;
using PlanToBee.API.Infrastructure.WebPush;

// RFC 8291 bölüm 5 test vektörü ve ek kontroller. Çıkış kodu: hepsi geçtiyse 0.
var failed = 0;
void Check(string name, bool ok) { Console.WriteLine($"{(ok ? "  ok  " : "  FAIL")} {name}"); if (!ok) failed++; }
byte[] B(string s) => Base64Url.Decode(s);

var plaintext = Encoding.UTF8.GetBytes("When I grow up, I want to be a watermelon");
var asPrivate = B("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
var asPublic = B("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
var uaPrivate = B("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94");
var uaPublic = B("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
var salt = B("DGv6ra1nlYgDCS1FRnbzlw");
var auth = B("BTBZMqHH6r4Tts7J_aSIgg");
const string expected = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

using var asKey = WebPushCrypto.ImportPrivate(asPrivate);
using var uaKey = WebPushCrypto.ImportPrivate(uaPrivate);
Check("vektör: sunucu ortak anahtarı özel anahtardan türer", WebPushCrypto.ExportPublic(asKey).SequenceEqual(asPublic));
Check("vektör: tarayıcı ortak anahtarı özel anahtardan türer", WebPushCrypto.ExportPublic(uaKey).SequenceEqual(uaPublic));

var body = WebPushCrypto.Encrypt(plaintext, uaPublic, auth, asKey, salt);
Check("RFC 8291 şifreli gövde birebir aynı", Base64Url.Encode(body) == expected);
Check("tarayıcı tarafı vektörü çözer", WebPushCrypto.Decrypt(B(expected), uaKey, auth).SequenceEqual(plaintext));

// Rastgele anahtar/salt ile gidiş-dönüş; her şifreleme farklı çıktı verir
using var ua2 = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
var auth2 = RandomNumberGenerator.GetBytes(16);
var msg = Encoding.UTF8.GetBytes("{\"title\":\"Ela ders ekledi\",\"body\":\"📚 Matematik · 60 dk\"}");
var c1 = WebPushCrypto.Encrypt(msg, WebPushCrypto.ExportPublic(ua2), auth2);
var c2 = WebPushCrypto.Encrypt(msg, WebPushCrypto.ExportPublic(ua2), auth2);
Check("gidiş-dönüş (Türkçe ve emoji)", WebPushCrypto.Decrypt(c1, ua2, auth2).SequenceEqual(msg));
Check("aynı içerik iki kez farklı şifrelenir", !c1.SequenceEqual(c2));
var tampered = (byte[])c1.Clone(); tampered[^5] ^= 1;
var rejected = false; try { WebPushCrypto.Decrypt(tampered, ua2, auth2); } catch (CryptographicException) { rejected = true; }
Check("bozulmuş gövde reddedilir", rejected);
var wrongAuth = false; try { WebPushCrypto.Decrypt(c1, ua2, RandomNumberGenerator.GetBytes(16)); } catch (CryptographicException) { wrongAuth = true; }
Check("yanlış auth sırrıyla çözülemez", wrongAuth);

// VAPID
using var v1 = VapidKey.FromSecret("deneme-gizli-deger-123", "mailto:test@example.com");
using var v1b = VapidKey.FromSecret("deneme-gizli-deger-123", "mailto:test@example.com");
using var v2 = VapidKey.FromSecret("baska-gizli-deger", "mailto:test@example.com");
Check("VAPID: aynı sırdan aynı anahtar", v1.PublicKey == v1b.PublicKey);
Check("VAPID: farklı sırdan farklı anahtar", v1.PublicKey != v2.PublicKey);
Check("VAPID: ortak anahtar 65 bayt, 0x04 ile başlar", B(v1.PublicKey) is { Length: 65 } pk && pk[0] == 4);
var hdr = v1.AuthorizationHeader(new Uri("https://fcm.googleapis.com/fcm/send/abc"), DateTimeOffset.UnixEpoch.AddYears(56));
var jwt = hdr["vapid t=".Length..hdr.IndexOf(',')];
Check("VAPID: imza doğrulanır", v1.Verify(jwt));
Check("VAPID: başka anahtarla doğrulanmaz", !v2.Verify(jwt));
var claims = Encoding.UTF8.GetString(B(jwt.Split('.')[1]));
Check("VAPID: aud endpoint kökeni", claims.Contains("\"aud\":\"https://fcm.googleapis.com\""));
Check("VAPID: imza 64 bayt (r|s)", B(jwt.Split('.')[2]).Length == 64);
Check("VAPID: başlıkta k= ortak anahtar", hdr.EndsWith($"k={v1.PublicKey}"));

// İzinli push servisleri (SSRF)
string[] none = [];
Check("izin: FCM", PushEndpointPolicy.IsAllowed("https://fcm.googleapis.com/fcm/send/x", none, out _));
Check("izin: Apple", PushEndpointPolicy.IsAllowed("https://web.push.apple.com/QW", none, out _));
Check("izin: Mozilla", PushEndpointPolicy.IsAllowed("https://updates.push.services.mozilla.com/wpush/v2/x", none, out _));
Check("izin: Windows", PushEndpointPolicy.IsAllowed("https://wns2-db5p.notify.windows.com/w/?token=x", none, out _));
Check("red: başka alan adı", !PushEndpointPolicy.IsAllowed("https://ornek.com/push", none, out _));
Check("red: http", !PushEndpointPolicy.IsAllowed("http://fcm.googleapis.com/fcm/send/x", none, out _));
Check("red: benzer ad", !PushEndpointPolicy.IsAllowed("https://fcm.googleapis.com.kotu.com/x", none, out _));
Check("red: son ek hilesi", !PushEndpointPolicy.IsAllowed("https://kotupush.apple.com/x", none, out _));
Check("red: kullanıcı bilgisi", !PushEndpointPolicy.IsAllowed("https://a@fcm.googleapis.com/x", none, out _));
Check("red: farklı port", !PushEndpointPolicy.IsAllowed("https://fcm.googleapis.com:8443/x", none, out _));
Check("red: iç ağ", !PushEndpointPolicy.IsAllowed("https://169.254.169.254/latest", none, out _));
Check("red: localhost (test listesi yokken)", !PushEndpointPolicy.IsAllowed("http://localhost:9000/x", none, out _));
Check("izin: localhost yalnızca test listesindeyse", PushEndpointPolicy.IsAllowed("http://localhost:9000/x", ["localhost"], out _));

Console.WriteLine(failed == 0 ? "\nTüm kontroller geçti" : $"\n{failed} kontrol kaldı");
return failed == 0 ? 0 : 1;
