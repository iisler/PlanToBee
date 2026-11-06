using Microsoft.AspNetCore.Mvc;

namespace PlanToBee.API.Infrastructure;

// Hatalı şifre kilidi. 5 hatalı denemede (giriş ya da hesap silme) hesap kalıcı olarak kilitlenir ve kendiliğinden
// açılmaz; kilidi "Şifremi unuttum" akışı açar (e-postaya giden kodla ya da bağlantıyla yeni şifre belirlenince).
public static class AuthLockout
{
    // Identity kilidi bitiş zamanı olarak tutar (LockoutEnd = şimdi + süre); 100 yıl fiilen kalıcıdır.
    public static readonly TimeSpan Permanent = TimeSpan.FromDays(365 * 100);

    // İstemci locked_out görünce kullanıcıyı "Şifremi unuttum" ekranına yönlendirir.
    public static ObjectResult LockedOut() => Err.Make(429, "locked_out",
        "Çok fazla hatalı şifre denemesi yapıldığı için hesabın kilitlendi. Kilidi açmak için \"Şifremi unuttum\" " +
        "adımından e-postana gelen kodla yeni şifre belirle.");
}
