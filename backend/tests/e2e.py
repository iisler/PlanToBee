#!/usr/bin/env python3
"""PlanToBee uçtan uca API senaryosu (yalnızca Python standart kütüphanesi).

Kayıt, e-posta doğrulama, giriş kilidi, oturum yenileme, şifre sıfırlama, aile kurma, davet, ortak plan
yetkileri, ders listesi, hafta ayrıntısı ve başka aile izolasyonunu kontrol eder.

API geliştirme modunda, e-postaları bir klasöre yazacak şekilde çalışmalı (LogEmailSender):

    cd backend/PlanToBee.API
    ASPNETCORE_ENVIRONMENT=Development \\
    ConnectionStrings__Default="Host=localhost;Database=plantobee_e2e;Username=<kullanıcı>" \\
    Jwt__Key="<en az 32 karakter>" Email__OutputDirectory=/tmp/plantobee-emails \\
    RateLimits__Auth=1000 RateLimits__InvitePublic=1000 \\
    dotnet run --no-launch-profile --urls http://localhost:5102

    python3 backend/tests/e2e.py --api http://localhost:5102/api --emails /tmp/plantobee-emails

Boş (ya da test için ayrılmış) bir veritabanı kullanın: senaryo her çalıştırmada rastgele adreslerle yeni
hesaplar ve aileler oluşturur. Çıkış kodu: tüm kontroller geçtiyse 0, aksi halde 1.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

API = ""
EMAILS = ""
PASSED = 0
FAILED = []


def check(name, cond, detail=""):
    global PASSED
    if cond:
        PASSED += 1
        print(f"  ok   {name}")
    else:
        FAILED.append(name)
        print(f"  FAIL {name} {detail}")


def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else None
        except ValueError:
            return e.code, raw.decode(errors="replace")


def code_of(body):
    return body.get("code") if isinstance(body, dict) else None


def emails_to(addr):
    """Adrese giden e-postalar, eskiden yeniye."""
    safe = re.sub(r"[^A-Za-z0-9.\-_@]", "_", addr)
    if not os.path.isdir(EMAILS):
        return []
    files = sorted(f for f in os.listdir(EMAILS) if f.endswith(f"_{safe}.txt"))
    return [open(os.path.join(EMAILS, f), encoding="utf-8").read() for f in files]


def wait_email(addr, count, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        mails = emails_to(addr)
        if len(mails) >= count:
            return mails
        time.sleep(0.2)
    return emails_to(addr)


def link_params(mail, path):
    m = re.search(r"https?://\S+/" + re.escape(path) + r"\?(\S+)", mail)
    if not m:
        return None
    return {k: v[0] for k, v in urllib.parse.parse_qs(m.group(1)).items()}


def new_email(tag):
    return f"e2e-{tag}-{uuid.uuid4().hex[:8]}@example.com"


def register_and_verify(name, password="sifre123"):
    email = new_email(name.lower())
    s, b = req("POST", "/auth/register", {"email": email, "password": password, "displayName": name})
    assert s == 200, (s, b)
    mail = wait_email(email, 1)[-1]
    p = link_params(mail, "verify-email")
    s, _ = req("POST", "/auth/verify-email", {"userId": p["userId"], "token": p["token"]})
    assert s == 200
    s, b = req("POST", "/auth/login", {"email": email, "password": password})
    assert s == 200, (s, b)
    return email, b


def monday(d):
    return d - dt.timedelta(days=d.weekday())


# ---------------------------------------------------------------- senaryolar

def test_register_privacy():
    print("Kayıt: hesap varlığı belli olmuyor")
    email = new_email("reg")
    s1, b1 = req("POST", "/auth/register", {"email": email, "password": "sifre123", "displayName": "Deneme"})
    check("yeni adres 200", s1 == 200, (s1, b1))
    check("cevapta token yok", isinstance(b1, dict) and "token" not in b1, b1)
    mails = wait_email(email, 1)
    check("doğrulama e-postası gitti", len(mails) == 1 and "verify-email?" in mails[-1])

    # Aynı adres, doğrulanmamış: aynı cevap, doğrulama e-postası yeniden gider (60 sn sınırı yüzünden
    # hemen gitmeyebilir; bu yüzden yalnızca cevap karşılaştırılır).
    s2, b2 = req("POST", "/auth/register", {"email": email, "password": "baskaSifre1", "displayName": "Başka"})
    check("doğrulanmamış adres: aynı durum kodu ve gövde", (s2, b2) == (s1, b1), (s2, b2))

    # Doğrulanmış adres: aynı cevap, sahibine "zaten hesabın var" e-postası gider.
    p = link_params(mails[-1], "verify-email")
    req("POST", "/auth/verify-email", {"userId": p["userId"], "token": p["token"]})
    s3, b3 = req("POST", "/auth/register", {"email": email, "password": "baskaSifre1", "displayName": "Başka"})
    check("doğrulanmış adres: aynı durum kodu ve gövde", (s3, b3) == (s1, b1), (s3, b3))
    mails = wait_email(email, 2)
    check("sahibine 'zaten hesabın var' e-postası", len(mails) == 2 and "zaten bir hesabın var" in mails[-1], len(mails))
    s, b = req("POST", "/auth/login", {"email": email, "password": "baskaSifre1"})
    check("ikinci kayıt şifreyi değiştirmedi", s == 401, s)
    s, _ = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    check("ilk şifreyle giriş", s == 200, s)

    # Şifre kuralı hatası iki durumda da aynı
    s4, b4 = req("POST", "/auth/register", {"email": email, "password": "123", "displayName": "X"})
    s5, b5 = req("POST", "/auth/register", {"email": new_email("short"), "password": "123", "displayName": "X"})
    check("kısa şifre: kayıtlı ve yeni adreste aynı hata", s4 == s5 == 400 and b4 == b5, (s4, b4, s5, b5))


def test_login_lockout_parity():
    print("Giriş kilidi: kayıtlı ve olmayan hesapta aynı davranış")
    email, _ = register_and_verify("Kilit")
    ghost = new_email("ghost")
    real = [req("POST", "/auth/login", {"email": email, "password": "yanlis"})[0] for _ in range(6)]
    fake = [req("POST", "/auth/login", {"email": ghost, "password": "yanlis"})[0] for _ in range(6)]
    check("durum kodu dizileri aynı", real == fake, (real, fake))
    check("5. denemede kilit (429)", real == [401, 401, 401, 401, 429, 429], real)
    s, b = req("POST", "/auth/login", {"email": ghost, "password": "yanlis"})
    check("olmayan hesapta kilit mesajı", s == 429 and code_of(b) == "locked_out", (s, b))


def test_refresh_tokens():
    print("Oturum yenileme")
    email, auth = register_and_verify("Yenile")
    check("girişte refreshToken ve expiresIn", bool(auth.get("refreshToken")) and 0 < auth.get("expiresIn", 0) <= 3600, auth.get("expiresIn"))
    s, b = req("POST", "/auth/refresh", {"refreshToken": auth["refreshToken"]})
    check("yenileme 200", s == 200 and b.get("token") and b.get("refreshToken"), (s, b))
    check("yenileme belirteci değişti", b["refreshToken"] != auth["refreshToken"])
    s, _ = req("GET", "/auth/me", token=b["token"])
    check("yeni erişim belirteci çalışıyor", s == 200, s)

    # Eski belirteç hemen tekrar gelirse (iki sekme) hırsızlık sayılmaz: refresh_retry
    s, r = req("POST", "/auth/refresh", {"refreshToken": auth["refreshToken"]})
    check("eski belirteç kısa süre içinde: 401 refresh_retry", s == 401 and code_of(r) == "refresh_retry", (s, r))
    s, _ = req("POST", "/auth/refresh", {"refreshToken": b["refreshToken"]})
    check("güncel belirteç hâlâ geçerli", s == 200, s)

    s, r = req("POST", "/auth/refresh", {"refreshToken": "gecersiz-belirtec"})
    check("bilinmeyen belirteç: 401 refresh_invalid", s == 401 and code_of(r) == "refresh_invalid", (s, r))

    # Eşzamanlı yenileme: yalnızca biri kazanır
    s, cur = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        results = list(ex.map(lambda _: req("POST", "/auth/refresh", {"refreshToken": cur["refreshToken"]}), range(6)))
    ok = [r for r in results if r[0] == 200]
    retry = [r for r in results if r[0] == 401 and code_of(r[1]) == "refresh_retry"]
    check("6 eşzamanlı yenilemede 1×200 + 5×refresh_retry", len(ok) == 1 and len(retry) == 5, [r[0] for r in results])

    # Çıkış
    s, cur = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, _ = req("POST", "/auth/logout", {"refreshToken": cur["refreshToken"]})
    check("çıkış 204", s == 204, s)
    s, r = req("POST", "/auth/refresh", {"refreshToken": cur["refreshToken"]})
    check("çıkıştan sonra yenileme 401", s == 401 and code_of(r) == "refresh_invalid", (s, r))

    # Şifre sıfırlama bütün oturumları kapatır
    s, other = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    before = len(emails_to(email))
    req("POST", "/auth/forgot-password", {"email": email})
    mail = wait_email(email, before + 1)[-1]
    p = link_params(mail, "reset-password")
    s, reset = req("POST", "/auth/reset-password", {"userId": p["userId"], "token": p["token"], "newPassword": "yeniSifre9"})
    check("şifre sıfırlama 200 ve yeni oturum", s == 200 and reset.get("refreshToken"), s)
    s, r = req("POST", "/auth/refresh", {"refreshToken": other["refreshToken"]})
    check("şifre değişince eski oturum yenilenemiyor", s == 401 and code_of(r) == "refresh_invalid", (s, r))
    s, _ = req("GET", "/auth/me", token=other["token"])
    check("şifre değişince eski erişim belirteci 401", s == 401, s)
    s, _ = req("POST", "/auth/refresh", {"refreshToken": reset["refreshToken"]})
    check("sıfırlamadan sonraki oturum yenilenebiliyor", s == 200, s)


def test_family_and_plan():
    print("Aile, davet ve ortak plan yetkileri")
    p_email, parent = register_and_verify("Ebeveyn")
    pt = parent["token"]
    s, fam = req("POST", "/family", {"name": "E2E Ailesi"}, pt)
    check("aile kuruldu", s in (200, 201) and fam.get("name") == "E2E Ailesi", (s, fam))

    c_email = new_email("cocuk")
    s, inv = req("POST", "/family/invitations", {"displayName": "Çocuk", "role": "Child", "email": c_email}, pt)
    check("davet gönderildi", s == 200 and inv.get("emailSent") is True, (s, inv))
    mail = wait_email(c_email, 1)[-1] if wait_email(c_email, 1) else ""
    check("davet e-postası Türkiye saatiyle", "(Türkiye saati)" in mail and "(UTC)" not in mail)
    token = (link_params(mail, "invite") or {}).get("token")
    s, prev = req("POST", "/invitations/resolve", {"token": token})
    check("davet önizlemesi", s == 200 and prev.get("familyName") == "E2E Ailesi", (s, prev))
    s, child = req("POST", "/invitations/accept-new", {"token": token, "password": "cocuk123"})
    check("davetle yeni hesap + refreshToken", s == 200 and child.get("refreshToken") and child["family"]["role"] == "Child", (s, child))
    ct = child["token"]

    today = dt.date.today()
    day = today.isoformat()
    s, e1 = req("POST", f"/days/{day}/entries", {"subject": "Matematik", "topic": "Kesirler", "minutes": 30}, pt)
    check("ebeveyn ders ekledi", s == 200, (s, e1))
    s, e2 = req("POST", f"/days/{day}/entries", {"subject": "Fizik", "minutes": 20}, ct)
    check("çocuk ders ekledi", s == 200, (s, e2))
    s, d = req("GET", f"/days/{day}", token=ct)
    entries = {e["subject"]: e for e in d["studyEntries"]} if s == 200 else {}
    check("çocuk: ebeveynin kaydı canEdit=false", entries.get("Matematik", {}).get("canEdit") is False)
    check("çocuk: kendi kaydı canEdit=true", entries.get("Fizik", {}).get("canEdit") is True)
    pid = entries.get("Matematik", {}).get("id")
    cid = entries.get("Fizik", {}).get("id")
    s, b = req("DELETE", f"/days/{day}/entries/{pid}", token=ct)
    check("çocuk ebeveynin kaydını silemiyor (403)", s == 403 and code_of(b) == "plan_read_only", (s, b))
    s, _ = req("PATCH", f"/days/{day}/entries/{cid}/status", {"status": "done"}, pt)
    check("ebeveyn çocuğun kaydını güncelleyebiliyor", s == 200, s)

    s, week = req("GET", f"/days/week/{monday(today).isoformat()}/details", token=pt)
    check("hafta ayrıntısı 7 gün", s == 200 and len(week["days"]) == 7, s)
    s, _ = req("GET", "/days/week/9999-12-31/details", token=pt)
    check("uç tarih 400", s == 400, s)

    s, subj = req("GET", "/subjects", token=pt)
    check("varsayılan ders listesi", s == 200 and len(subj["subjects"]) >= 10, s)

    # Başka aile
    _, stranger = register_and_verify("Yabanci")
    st = stranger["token"]
    req("POST", "/family", {"name": "Başka Aile"}, st)
    s, b = req("DELETE", f"/days/{day}/entries/{cid}", token=st)
    check("başka aile kaydı silemiyor (404)", s == 404, (s, b))
    s, d = req("GET", f"/days/{day}", token=st)
    check("başka aile kayıtları görmüyor", s == 200 and d["studyEntries"] == [], s)

    # Çocuk silebilir: kendi kaydı
    s, _ = req("DELETE", f"/days/{day}/entries/{cid}", token=ct)
    check("çocuk kendi kaydını siliyor", s == 204, s)
    return p_email


def main():
    global API, EMAILS
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:5102/api")
    ap.add_argument("--emails", required=True, help="API'nin Email:OutputDirectory klasörü")
    a = ap.parse_args()
    API, EMAILS = a.api.rstrip("/"), a.emails

    try:
        urllib.request.urlopen(API.rsplit("/api", 1)[0] + "/health", timeout=10)
    except Exception as e:  # noqa: BLE001
        print(f"API'ye ulaşılamadı: {e}")
        return 1

    for t in (test_register_privacy, test_login_lockout_parity, test_refresh_tokens, test_family_and_plan):
        try:
            t()
        except Exception as e:  # noqa: BLE001
            FAILED.append(f"{t.__name__}: {e!r}")
            print(f"  FAIL {t.__name__} beklenmeyen hata: {e!r}")

    print(f"\n{PASSED} geçti, {len(FAILED)} kaldı")
    for f in FAILED:
        print(f"  - {f}")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())
