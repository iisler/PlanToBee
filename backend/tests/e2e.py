#!/usr/bin/env python3
"""PlanToBee uçtan uca API senaryosu (yalnızca Python standart kütüphanesi).

Kayıt, e-posta doğrulama, giriş kilidi, oturum yenileme, şifre sıfırlama, aile kurma, profiller ve PIN, ortak plan
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
    check("şifre sıfırlama 200, oturum açılmaz", s == 200 and "refreshToken" not in reset and "token" not in reset, (s, reset))
    s, r = req("POST", "/auth/refresh", {"refreshToken": other["refreshToken"]})
    check("şifre değişince eski oturum yenilenemiyor", s == 401 and code_of(r) == "refresh_invalid", (s, r))
    s, _ = req("GET", "/auth/me", token=other["token"])
    check("şifre değişince eski erişim belirteci 401", s == 401, s)
    s, relog = req("POST", "/auth/login", {"email": email, "password": "yeniSifre9"})
    check("yeni şifreyle giriş", s == 200, s)
    s, _ = req("POST", "/auth/refresh", {"refreshToken": relog["refreshToken"]})
    check("sıfırlamadan sonraki oturum yenilenebiliyor", s == 200, s)


def select(auth, profile_id, **body):
    body.setdefault("refreshToken", auth["refreshToken"])
    return req("POST", f"/profiles/{profile_id}/select", body, auth["token"])


def test_profiles_and_plan():
    print("Aile hesabı, profiller (PIN) ve ortak plan yetkileri")
    p_email, account = register_and_verify("Ebeveyn")
    check("girişte profil yok", account.get("profile") is None, account.get("profile"))
    s, b = req("GET", "/days/" + dt.date.today().isoformat(), token=account["token"])
    check("aile yokken plan: 403 family_required", s == 403 and code_of(b) == "family_required", (s, b))

    s, b = req("POST", "/family", {"name": "E2E Ailesi", "profileName": "Annem", "pin": "12a4"}, account["token"])
    check("aile kurarken geçersiz PIN 400", s == 400, (s, b))
    s, owner = req("POST", "/family", {"name": "E2E Ailesi", "profileName": "Annem", "pin": "1234",
                                       "refreshToken": account["refreshToken"]}, account["token"])
    check("aile kuruldu, oturum sahibin profiliyle açıldı",
          s == 200 and owner["family"]["name"] == "E2E Ailesi" and owner["profile"]["isOwner"] is True, (s, owner))
    s, r = req("POST", "/auth/refresh", {"refreshToken": account["refreshToken"]})
    check("aile kurulunca eski profilsiz oturum kapandı", s == 401, s)
    pt = owner["token"]

    s, child = req("POST", "/profiles", {"displayName": "Ela", "role": "Child"}, pt)
    check("PIN'siz çocuk profili eklendi", s == 200 and child["hasPin"] is False, (s, child))
    s, b = req("POST", "/profiles", {"displayName": "Babam", "role": "Parent"}, pt)
    check("PIN'siz ebeveyn profili reddedildi", s == 400 and code_of(b) == "pin_required", (s, b))
    s, dad = req("POST", "/profiles", {"displayName": "Babam", "role": "Parent", "pin": "4321"}, pt)
    check("PIN'li ebeveyn profili eklendi", s == 200 and dad["hasPin"] is True, (s, dad))
    s, b = req("POST", "/profiles", {"displayName": "ela", "role": "Child"}, pt)
    check("aynı adlı profil reddedildi", s == 409, (s, b))

    # Başka bir cihaz: aile hesabıyla giriş, profil seçimi
    s, dev = req("POST", "/auth/login", {"email": p_email, "password": "sifre123"})
    check("yeni cihazda giriş profilsiz", s == 200 and dev.get("profile") is None, (s, dev.get("profile")))
    s, b = req("GET", "/days/" + dt.date.today().isoformat(), token=dev["token"])
    check("profil seçmeden plan: 403 profile_required", s == 403 and code_of(b) == "profile_required", (s, b))
    s, plist = req("GET", "/profiles", token=dev["token"])
    check("profil listesi (3 profil, sahip başta)", s == 200 and len(plist) == 3 and plist[0]["isOwner"], (s, plist))
    s, b = select(dev, owner["profile"]["id"])
    check("PIN'siz ebeveyn seçimi 400 pin_invalid", s == 400 and code_of(b) == "pin_invalid", (s, b))
    s, ct = select(dev, child["id"])
    check("PIN'siz çocuk profili seçildi", s == 200 and ct["profile"]["role"] == "Child", (s, ct))
    s, r = req("POST", "/auth/refresh", {"refreshToken": ct["refreshToken"]})
    check("yenilemede profil hatırlanıyor", s == 200 and (r.get("profile") or {}).get("id") == child["id"], (s, r))
    ct = r

    # Çocuk profili yönetim yapamaz, ebeveyn profilini PIN'siz seçemez
    s, b = req("POST", "/profiles", {"displayName": "Kardeş", "role": "Child"}, ct["token"])
    check("çocuk profil ekleyemez (403 parent_only)", s == 403 and code_of(b) == "parent_only", (s, b))
    s, b = req("DELETE", f"/profiles/{dad['id']}", token=ct["token"])
    check("çocuk profil silemez", s == 403, s)

    # PIN kilidi
    codes = [select(ct, dad["id"], pin="0000")[0] for _ in range(5)]
    check("5 hatalı PIN: 4×400 + kilit 429", codes == [400, 400, 400, 400, 429], codes)
    s, b = select(ct, dad["id"], pin="4321")
    check("kilitliyken doğru PIN de reddedilir", s == 429 and code_of(b) == "pin_locked", (s, b))
    s, plist = req("GET", "/profiles", token=ct["token"])
    locked = next((p for p in plist if p["id"] == dad["id"]), {})
    check("listede kilit süresi görünüyor", (locked.get("lockedSeconds") or 0) > 0, locked)

    # Ortak plan yetkileri
    today = dt.date.today()
    day = today.isoformat()
    s, e1 = req("POST", f"/days/{day}/entries", {"subject": "Matematik", "topic": "Kesirler", "minutes": 30}, pt)
    check("ebeveyn ders ekledi", s == 200, (s, e1))
    s, e2 = req("POST", f"/days/{day}/entries", {"subject": "Fizik", "minutes": 20}, ct["token"])
    check("çocuk ders ekledi", s == 200, (s, e2))
    s, d = req("GET", f"/days/{day}", token=ct["token"])
    entries = {e["subject"]: e for e in d["studyEntries"]} if s == 200 else {}
    check("çocuk: ebeveynin kaydı canEdit=false", entries.get("Matematik", {}).get("canEdit") is False)
    check("çocuk: kendi kaydı canEdit=true", entries.get("Fizik", {}).get("canEdit") is True)
    check("ekleyen profil adı görünüyor", entries.get("Matematik", {}).get("createdBy", {}).get("displayName") == "Annem")
    pid = entries.get("Matematik", {}).get("id")
    cid = entries.get("Fizik", {}).get("id")
    s, b = req("DELETE", f"/days/{day}/entries/{pid}", token=ct["token"])
    check("çocuk ebeveynin kaydını silemiyor (403)", s == 403 and code_of(b) == "plan_read_only", (s, b))
    s, _ = req("PATCH", f"/days/{day}/entries/{cid}/status", {"status": "done"}, pt)
    check("ebeveyn çocuğun kaydını güncelleyebiliyor", s == 200, s)

    s, week = req("GET", f"/days/week/{monday(today).isoformat()}/details", token=pt)
    check("hafta ayrıntısı 7 gün", s == 200 and len(week["days"]) == 7, s)
    s, _ = req("GET", "/days/week/9999-12-31/details", token=pt)
    check("uç tarih 400", s == 400, s)
    s, subj = req("GET", "/subjects", token=pt)
    check("varsayılan ders listesi", s == 200 and len(subj["subjects"]) >= 10, s)

    # Rol ve PIN yönetimi
    s, b = req("PUT", f"/profiles/{child['id']}", {"displayName": "Ela", "role": "Parent"}, pt)
    check("çocuğu ebeveyn yapmak PIN ister", s == 400 and code_of(b) == "pin_required", (s, b))
    s, b = req("PUT", f"/profiles/{owner['profile']['id']}", {"displayName": "Annem", "role": "Child"}, pt)
    check("hesap sahibi çocuk yapılamaz", s == 400, (s, b))
    s, b = req("PUT", f"/profiles/{child['id']}/pin", {"pin": "5555"}, ct["token"])
    check("çocuk kendi PIN'ini koyabiliyor", s == 200 and b["hasPin"] is True, (s, b))
    s, b = req("PUT", f"/profiles/{dad['id']}/pin", {"pin": None}, pt)
    check("ebeveyn PIN'i kaldırılamaz", s == 400 and code_of(b) == "pin_required", (s, b))

    # Profil silme: kayıtları "Eski üye" olarak kalır, o profili kullanan cihaz profil seçmeye döner
    s, _ = req("DELETE", f"/profiles/{child['id']}", token=pt)
    check("ebeveyn çocuk profilini sildi", s == 204, s)
    s, b = req("GET", f"/days/{day}", token=ct["token"])
    check("silinen profilin cihazı: 403 profile_required", s == 403 and code_of(b) == "profile_required", (s, b))
    s, r = req("POST", "/auth/refresh", {"refreshToken": ct["refreshToken"]})
    check("silinen profilde yenileme profilsiz döner", s == 200 and r.get("profile") is None, (s, r.get("profile") if isinstance(r, dict) else r))
    s, d = req("GET", f"/days/{day}", token=pt)
    fiz = next((e for e in d["studyEntries"] if e["subject"] == "Fizik"), {})
    check("silinen profilin kaydı 'eski üye' olarak duruyor", (fiz.get("createdBy") or {}).get("isFormerMember") is True, fiz)
    s, b = req("DELETE", f"/profiles/{owner['profile']['id']}", token=pt)
    check("hesap sahibinin profili silinemez", s == 400, (s, b))

    # Başka aile
    _, stranger = register_and_verify("Yabanci")
    s, so = req("POST", "/family", {"name": "Başka Aile", "profileName": "Yabancı", "pin": "9999"}, stranger["token"])
    st = so["token"]
    s, b = req("DELETE", f"/days/{day}/entries/{cid}", token=st)
    check("başka aile kaydı silemiyor (404)", s == 404, (s, b))
    s, d = req("GET", f"/days/{day}", token=st)
    check("başka aile kayıtları görmüyor", s == 200 and d["studyEntries"] == [], s)
    s, b = select(stranger, dad["id"], pin="4321")
    check("başka ailenin profili seçilemiyor (404)", s == 404, (s, b))
    return p_email


def test_solo_family():
    print("Tek başına kullanım: PIN'siz aile, sonra aileye geçiş")
    email, acc = register_and_verify("Tek")
    s, own = req("POST", "/family", {"name": "Tek Ailesi", "profileName": "Tek", "refreshToken": acc["refreshToken"]}, acc["token"])
    check("PIN'siz aile kuruldu, oturum profille açıldı", s == 200 and (own.get("profile") or {}).get("isOwner") is True, (s, own))
    s, d = req("GET", "/days/" + dt.date.today().isoformat(), token=own["token"])
    check("tek profille plan açılıyor", s == 200, s)

    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, b = select(dev, own["profile"]["id"])
    check("tek profilli ailede PIN'siz ebeveyn seçilebiliyor", s == 200 and b.get("profile"), (s, b))

    s, b = req("POST", "/profiles", {"displayName": "Kız", "role": "Child"}, own["token"])
    check("ilk profil eklenirken kendi PIN'i istenir", s == 400 and code_of(b) == "my_pin_required", (s, b))
    s, b = req("POST", "/profiles", {"displayName": "Kız", "role": "Child", "myPin": "12"}, own["token"])
    check("geçersiz kendi PIN'i 400", s == 400 and code_of(b) == "validation", (s, b))
    s, kid = req("POST", "/profiles", {"displayName": "Kız", "role": "Child", "myPin": "2468"}, own["token"])
    check("kendi PIN'iyle profil eklendi", s == 200, (s, kid))
    s, plist = req("GET", "/profiles", token=own["token"])
    me = next((p for p in plist if p["isOwner"]), {})
    check("sahibin profilinde artık PIN var", me.get("hasPin") is True, me)

    s, dev2 = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, b = select(dev2, me["id"])
    check("ailede 2 profil: PIN'siz seçim reddedilir", s == 400 and code_of(b) == "pin_invalid", (s, b))
    s, b = select(dev2, me["id"], pin="2468")
    check("PIN ile seçiliyor", s == 200, (s, b))


def test_events_and_training():
    print("Etkinlikler ve antrenmanlar (tek liste)")
    email, acc = register_and_verify("Spor")
    s, own = req("POST", "/family", {"name": "Spor Ailesi", "profileName": "Anne", "pin": "1357", "refreshToken": acc["refreshToken"]}, acc["token"])
    pt = own["token"]
    s, kid = req("POST", "/profiles", {"displayName": "Ece", "role": "Child"}, pt)
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, ct = select(dev, kid["id"])
    ct = ct["token"]
    day = dt.date.today()
    d = day.isoformat()

    s, b = req("POST", f"/days/{d}/events", {"kind": "Event", "title": " "}, pt)
    check("adsız etkinlik 400", s == 400, (s, b))
    s, b = req("POST", f"/days/{d}/events", {"kind": "Training", "trainingType": "Top", "minutes": 0}, pt)
    check("süre verilirse 0 olamaz (400)", s == 400, (s, b))
    s, b = req("POST", f"/days/{d}/events", {"kind": "Training", "minutes": 30}, pt)
    check("türsüz antrenman 400", s == 400, (s, b))
    s, b = req("POST", f"/days/{d}/events", {"kind": "Event", "title": "X", "time": "25:00"}, pt)
    check("geçersiz saat 400", s == 400, (s, b))

    s, e1 = req("POST", f"/days/{d}/events", {"title": "Sınav", "time": "09:00"}, pt)
    check("etkinlik (tür verilmeden) eklendi", s == 200 and e1["kind"] == "Event" and e1["minutes"] is None, (s, e1))
    s, t1 = req("POST", f"/days/{d}/events", {"kind": "Training", "trainingType": "Top", "minutes": 90, "time": "17:00"}, pt)
    check("saatli antrenman (eski biçim: türle) eklendi", s == 200 and t1["kind"] == "Training" and t1["title"] == "" and t1["minutes"] == 90, (s, t1))
    s, t2 = req("POST", f"/days/{d}/events", {"kind": "Training", "trainingType": "Voleybol kampı", "minutes": 60}, ct)
    check("çocuk kendi yazdığı türde antrenman ekledi", s == 200 and t2["trainingType"] == "Voleybol kampı", (s, t2))
    s, t3 = req("POST", f"/days/{d}/events", {"kind": "Training", "trainingType": "Kondisyon", "time": "07:00"}, pt)
    check("süresiz (yalnızca saatli) antrenman eklendi", s == 200 and t3["minutes"] is None and t3["time"] == "07:00", (s, t3))
    s, e2 = req("POST", f"/days/{d}/events", {"title": "Saatsiz not"}, pt)

    s, dd = req("GET", f"/days/{d}", token=pt)
    order = [(e["kind"], e["time"]) for e in dd["events"]]
    check("sıra: saatliler saate göre, sonra saatsizler eklenme sırasıyla",
          order == [("Training", "07:00"), ("Event", "09:00"), ("Training", "17:00"), ("Training", ""), ("Event", "")], order)
    check("gün cevabında ayrı antrenman listesi yok", "trainingEntries" not in dd, list(dd.keys()))

    s, b = req("PUT", f"/days/{d}/events/{t1['id']}", {"trainingType": "Kuvvet", "minutes": 45, "time": "18:30", "note": "salon"}, pt)
    check("antrenman düzenlendi", s == 200 and b["trainingType"] == "Kuvvet" and b["minutes"] == 45 and b["time"] == "18:30", (s, b))
    s, b = req("PUT", f"/days/{d}/events/{t1['id']}", {"trainingType": "Kuvvet", "minutes": 0}, pt)
    check("antrenman süresi 0'a düşürülemez", s == 400, (s, b))
    s, b = req("PUT", f"/days/{d}/events/{t1['id']}", {"trainingType": "Kuvvet", "minutes": 45}, ct)
    check("çocuk ebeveynin antrenmanını düzenleyemez", s == 403, (s, b))
    s, b = req("PUT", f"/days/{d}/events/{t2['id']}", {"trainingType": "Top", "minutes": 50}, ct)
    check("çocuk kendi antrenmanını düzenler", s == 200 and b["minutes"] == 50, (s, b))
    s, b = req("PUT", f"/days/{d}/events/{e1['id']}", {"title": "Deneme sınavı", "time": "10:00"}, pt)
    check("etkinlik düzenlendi", s == 200 and b["title"] == "Deneme sınavı", (s, b))

    s, wk = req("GET", f"/days/week/{monday(day).isoformat()}", token=pt)
    today = next(x for x in wk["days"] if x["date"] == d)
    check("hafta özeti: etkinlik sayısı antrenmanları saymaz", today["eventCount"] == 2, today)
    check("hafta özeti: antrenman sayısı ve süresi", today["trainingDone"] and today["trainingCount"] == 3 and today["trainingMinutes"] == 95, today)

    s, _ = req("DELETE", f"/days/{d}/events/{t2['id']}", token=pt)
    check("ebeveyn çocuğun antrenmanını siler", s == 204, s)
    s, b = req("POST", f"/days/{d}/training", {"type": "Top", "minutes": 30}, pt)
    check("eski /training uç noktası yok", s in (404, 405), s)

    # Aktivite türleri: Spor (Training), Müzik, Konser, Buluşma, Sınav, Diğer (Event). Ayrı günde, yukarıdaki sayımları bozmasın.
    d2 = (day + dt.timedelta(days=1)).isoformat()
    s, b = req("POST", f"/days/{d2}/events", {"kind": "Music", "title": " "}, pt)
    check("adsız müzik aktivitesi 400", s == 400, (s, b))
    s, b = req("POST", f"/days/{d2}/events", {"kind": "Dance", "title": "X"}, pt)
    check("tanımsız aktivite türü 400", s == 400, (s, b))
    s, sp = req("POST", f"/days/{d2}/events", {"kind": "Training", "title": "Voleybol kuvvet çalışması", "time": "17:00"}, ct)
    check("spor adla eklendi (türsüz)", s == 200 and sp["kind"] == "Training" and sp["title"] == "Voleybol kuvvet çalışması" and sp["trainingType"] is None, (s, sp))
    kinds = {}
    for k, title in [("Music", "Piyano dersi"), ("Concert", "Okul konseri"), ("Meeting", "Arkadaşlarla sinema"), ("Exam", "Deneme sınavı"), ("Event", "Veteriner")]:
        s, b = req("POST", f"/days/{d2}/events", {"kind": k, "title": title, "minutes": 30}, pt)
        kinds[k] = b
        check(f"{k} aktivitesi eklendi, süre yok sayıldı", s == 200 and b["kind"] == k and b["title"] == title and b["minutes"] is None, (s, b))
    s, b = req("PUT", f"/days/{d2}/events/{kinds['Music']['id']}", {"title": "Gitar dersi", "time": "18:00"}, pt)
    check("müzik aktivitesi düzenlendi, türü korundu", s == 200 and b["kind"] == "Music" and b["title"] == "Gitar dersi", (s, b))
    s, b = req("PUT", f"/days/{d}/events/{t3['id']}", {"title": "Kondisyon antrenmanı", "trainingType": None, "time": "07:00"}, pt)
    check("eski antrenman adla kaydedilir, tür temizlenir", s == 200 and b["title"] == "Kondisyon antrenmanı" and b["trainingType"] is None, (s, b))
    s, wk = req("GET", f"/days/week/{monday(day).isoformat()}", token=pt)
    nxt = next((x for x in wk["days"] if x["date"] == d2), None)
    if nxt is not None:  # d2 haftanın dışında kalabilir (pazar)
        check("hafta özeti: yeni türler etkinlik sayısında, spor ayrı", nxt["eventCount"] == 5 and nxt["trainingCount"] == 1, nxt)


# ---------------------------------------------------------------- bildirimler (Web Push)
# API'nin WebPush:Key ve WebPush:TestEndpointHosts=localhost ile, kısa toplama süresiyle çalışması gerekir
# (WebPush__BatchSeconds=2). Ayarlı değilse bu senaryo atlanır.
# Sahte push servisi gelen istekleri kaydeder; şifrelemenin doğruluğu tests/WebPushSelfTest'te sınanır.

# RFC 8291 test vektöründeki tarayıcı ortak anahtarı (geçerli bir P-256 noktası) ve auth sırrı
UA_PUBLIC = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"
UA_AUTH = "BTBZMqHH6r4Tts7J_aSIgg"


class FakePush:
    def __init__(self):
        import http.server
        import threading
        self.received = []
        outer = self

        class H(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                n = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(n)
                outer.received.append({"path": self.path, "headers": dict(self.headers), "len": len(body)})
                self.send_response(410 if self.path.endswith("/gone") else 201)
                self.end_headers()

            def log_message(self, *a):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def url(self, name):
        return f"http://localhost:{self.port}/push/{name}"

    def to(self, name):
        return [r for r in self.received if r["path"] == f"/push/{name}"]

    def wait(self, name, count, timeout=10):
        end = time.time() + timeout
        while time.time() < end and len(self.to(name)) < count:
            time.sleep(0.2)
        return self.to(name)


def subscribe(token, endpoint, label="Test · Chrome"):
    return req("PUT", "/push/subscription", {"endpoint": endpoint, "p256dh": UA_PUBLIC, "auth": UA_AUTH, "deviceLabel": label}, token)


def test_push():
    print("Bildirimler (Web Push)")
    email, acc = register_and_verify("Push")
    s, own = req("POST", "/family", {"name": "Push Ailesi", "profileName": "Anne", "pin": "2468", "refreshToken": acc["refreshToken"]}, acc["token"])
    pt = own["token"]
    s, cfg = req("GET", "/push/config", token=pt)
    if not (s == 200 and cfg.get("enabled")):
        print("  -- atlandı: API'de WebPush:Key ayarlı değil")
        return
    import base64
    key = base64.urlsafe_b64decode(cfg["publicKey"] + "==")
    check("config: ortak anahtar 65 bayt", len(key) == 65 and key[0] == 4, cfg)

    s, kid = req("POST", "/profiles", {"displayName": "Ece", "role": "Child"}, pt)
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, ct = select(dev, kid["id"])
    ct = ct["token"]
    fake = FakePush()

    s, b = subscribe(pt, "https://ornek.com/push/x")
    check("izinsiz push adresi reddedilir (SSRF)", s == 400 and code_of(b) == "push_endpoint", (s, b))
    s, b = req("PUT", "/push/subscription", {"endpoint": fake.url("anne"), "p256dh": "AAAA", "auth": UA_AUTH}, pt)
    check("geçersiz anahtar reddedilir", s == 400 and code_of(b) == "push_keys", (s, b))
    s, b = subscribe(pt, fake.url("anne"), "iPhone · Safari <script>")
    check("ebeveyn abone oldu", s == 200 and b["id"] > 0, (s, b))
    anne_sub = b["id"]
    s, b = subscribe(ct, fake.url("ece"))
    check("çocuk abone oldu", s == 200, (s, b))
    ece_sub = b["id"]

    s, st = req("GET", "/push/settings", token=pt)
    d = st["settings"]
    check("varsayılanlar: ders/aktivite/bitti açık, değişiklik kapalı, sessiz 22:00-07:30",
          d["studyAdded"] and d["activityAdded"] and d["studyDone"] and not d["changes"] and d["quietEnabled"]
          and d["quietStart"] == "22:00" and d["quietEnd"] == "07:30" and d["mutedMemberIds"] == [], d)
    check("kimin girişleri: kendisi hariç aile", [m["displayName"] for m in st["members"]] == ["Ece"], st["members"])
    labels = sorted(x["label"] for x in st["devices"])
    check("cihaz listesi ve temizlenmiş ad", labels == ["Test · Chrome", "iPhone · Safari script"], labels)

    # Sessiz saatleri test sırasında kapat (gece çalıştırılsa da anında gelsin)
    off = dict(d, quietEnabled=False)
    req("PUT", "/push/settings", off, pt)
    req("PUT", "/push/settings", off, ct)

    day = dt.date.today()
    d1 = day.isoformat()
    s, _ = req("POST", f"/days/{d1}/entries", {"subject": "Matematik", "topic": "Türev", "minutes": 60}, pt)
    got = fake.wait("ece", 1)
    check("ebeveynin dersi çocuğa bildirim olarak gitti", len(got) == 1, got)
    if got:
        h = got[0]["headers"]
        check("başlıklar: aes128gcm, VAPID, TTL", h.get("Content-Encoding") == "aes128gcm"
              and h.get("Authorization", "").startswith("vapid t=") and f"k={cfg['publicKey']}" in h.get("Authorization", "")
              and h.get("TTL") == "86400", h)
        check("gövde şifreli (başlık + içerik)", got[0]["len"] > 86 + 16, got[0]["len"])
    time.sleep(1)
    check("kaydı girene bildirim gitmez", len(fake.to("anne")) == 0, fake.to("anne"))

    t0 = time.time()
    for i in range(3):
        req("POST", f"/days/{d1}/events", {"kind": "Music", "title": f"Piyano {i}"}, ct)
    got = fake.wait("anne", 1, timeout=5)
    check("ilk kayıt beklemeden gider", len(got) >= 1 and time.time() - t0 < 2.5, round(time.time() - t0, 2))
    time.sleep(4)
    n = len(fake.to("anne"))
    check("art arda 3 kayıt: ilki hemen, devamı tek bildirimde (en fazla 2 bildirim)", 1 <= n <= 2, n)

    s, e = req("POST", f"/days/{d1}/entries", {"subject": "Fizik", "minutes": 30}, ct)
    fake.wait("anne", n + 1)
    s, _ = req("PATCH", f"/days/{d1}/entries/{e['id']}/status", {"status": "done"}, ct)
    got = fake.wait("anne", n + 2)
    check("ders tamamlanınca bildirim", len(got) == n + 2, len(got))

    n = len(fake.to("anne"))
    s, _ = req("PUT", f"/days/{d1}/entries/{e['id']}", {"subject": "Fizik", "minutes": 45}, ct)
    time.sleep(4)
    check("değişiklik bildirimi varsayılan kapalı", len(fake.to("anne")) == n, len(fake.to("anne")))
    req("PUT", "/push/settings", dict(off, changes=True), pt)
    s, _ = req("PUT", f"/days/{d1}/entries/{e['id']}", {"subject": "Fizik", "minutes": 50}, ct)
    check("değişiklik açılınca bildirim gider", len(fake.wait("anne", n + 1)) == n + 1, len(fake.to("anne")))

    # Silme ve değişiklik toplama süresini beklemez: hemen önce ekleme bildirimi gitmiş olsa da anında gider.
    n = len(fake.to("anne"))
    s, ev2 = req("POST", f"/days/{d1}/events", {"kind": "Exam", "title": "Deneme"}, ct)
    fake.wait("anne", n + 1)
    t0 = time.time()
    s, _ = req("DELETE", f"/days/{d1}/events/{ev2['id']}", token=ct)
    got = fake.wait("anne", n + 2, timeout=5)
    check("silme bildirimi beklemeden gider", len(got) == n + 2 and time.time() - t0 < 1.8, (len(got), round(time.time() - t0, 2)))

    n = len(fake.to("anne"))
    req("PUT", "/push/settings", dict(off, changes=True, mutedMemberIds=[kid["id"], 999999]), pt)
    s, st = req("GET", "/push/settings", token=pt)
    check("susturulan liste yalnızca aile profillerini tutar", st["settings"]["mutedMemberIds"] == [kid["id"]], st["settings"])
    req("POST", f"/days/{d1}/entries", {"subject": "Kimya", "minutes": 20}, ct)
    time.sleep(4)
    check("susturulan kişinin girişleri bildirim üretmez", len(fake.to("anne")) == n, len(fake.to("anne")))
    req("PUT", "/push/settings", off, pt)

    # Sessiz saat: şu anı kapsayan aralık (Türkiye saati)
    now = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)
    quiet = dict(off, quietEnabled=True, quietStart=(now - dt.timedelta(hours=1)).strftime("%H:%M"), quietEnd=(now + dt.timedelta(hours=1)).strftime("%H:%M"))
    req("PUT", "/push/settings", quiet, pt)
    n = len(fake.to("anne"))
    req("POST", f"/days/{d1}/entries", {"subject": "Tarih", "minutes": 20}, ct)
    time.sleep(4)
    check("sessiz saatte anında bildirim gitmez", len(fake.to("anne")) == n, len(fake.to("anne")))
    req("PUT", "/push/settings", off, pt)

    s, b = req("PUT", "/push/settings", dict(off, quietStart="25:00"), pt)
    check("geçersiz sessiz saat 400", s == 400, (s, b))

    s, b = req("POST", "/push/test", token=ct)
    check("deneme bildirimi kendi cihazına", s == 200 and b["sent"] == 1, (s, b))

    # Yetki ve izolasyon
    s, b = req("DELETE", f"/push/devices/{anne_sub}", token=ct)
    check("çocuk ebeveynin cihazını kaldıramaz (403)", s == 403, (s, b))
    other_email, other = register_and_verify("PushB")
    s, oo = req("POST", "/family", {"name": "Başka", "profileName": "Baba", "pin": "1357", "refreshToken": other["refreshToken"]}, other["token"])
    s, b = req("DELETE", f"/push/devices/{ece_sub}", token=oo["token"])
    check("başka aile cihazı kaldıramaz (404)", s == 404, (s, b))
    s, st = req("GET", "/push/settings", token=oo["token"])
    check("başka aile cihazları görmez", st["devices"] == [], st["devices"])

    # Profil değişimi: aynı cihaz (uç nokta) başka profille yeniden kaydolur
    s, b = subscribe(pt, fake.url("ece"))
    s, st = req("GET", "/push/settings", token=pt)
    owner = {x["id"]: x["memberName"] for x in st["devices"]}
    check("profil değişince abonelik yeni profile geçer", b["id"] == ece_sub and owner.get(ece_sub) == "Anne", owner)
    subscribe(ct, fake.url("ece"))

    # 410: abonelik silinir
    s, b = subscribe(pt, fake.url("gone"))
    gone_id = b["id"]
    req("POST", "/push/test", token=pt)
    s, st = req("GET", "/push/settings", token=pt)
    check("push servisi 410 dönünce abonelik silinir", gone_id not in [x["id"] for x in st["devices"]], st["devices"])

    s, _ = req("DELETE", "/push/subscription", {"endpoint": fake.url("ece")}, ct)
    s2, st = req("GET", "/push/settings", token=ct)
    check("abonelikten çıkış (çıkış yaparken)", s == 204 and ece_sub not in [x["id"] for x in st["devices"]], (s, st["devices"]))

    s, b = subscribe(ct, fake.url("ece2"))
    s, _ = req("DELETE", f"/profiles/{kid['id']}", token=pt)
    s, st = req("GET", "/push/settings", token=pt)
    check("profil silinince cihazları silinir", all(x["memberName"] != "Ece" for x in st["devices"]), st["devices"])
    fake.server.shutdown()


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

    for t in (test_register_privacy, test_login_lockout_parity, test_refresh_tokens, test_profiles_and_plan, test_solo_family, test_events_and_training, test_push):
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
