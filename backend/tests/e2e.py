#!/usr/bin/env python3
"""PlanToBee uçtan uca API senaryosu (yalnızca Python standart kütüphanesi).

Kayıt, e-posta doğrulama, giriş kilidi, oturum yenileme, şifre sıfırlama, aile kurma, profiller ve PIN, ortak plan
yetkileri, ders listesi, aktivite başlangıç-bitiş saati, tekrarlayan aktiviteler, hafta ayrıntısı, başka aile izolasyonu,
bildirimler ve hesap silmeyi kontrol eder.

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
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

API = ""
EMAILS = ""
PSQL = []  # --psql verilirse silme senaryosu tablo bazında satır sayar
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


def next_june15(d):
    """d'den sonraki ilk 15 Haziran (en fazla 1 yıl sonra)."""
    j = dt.date(d.year, 6, 15)
    return j if j > d else dt.date(d.year + 1, 6, 15)


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
    s, b = req("PATCH", f"/days/{day}/entries/{pid}/status", {"status": "done"}, ct["token"])
    check("çocuk ebeveynin dersini Tamamlandı işaretleyebiliyor", s == 200 and b["status"] == "done" and b["canEdit"] is False, (s, b))
    s, b = req("PUT", f"/days/{day}/entries/{pid}", {"subject": "Matematik", "topic": "x", "minutes": 5}, ct["token"])
    check("çocuk ebeveynin dersini düzenleyemiyor (403)", s == 403 and code_of(b) == "plan_read_only", (s, b))

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


def test_event_end_time():
    print("Aktivitede başlangıç-bitiş saati")
    email, acc = register_and_verify("Saat")
    s, own = req("POST", "/family", {"name": "Saat Ailesi", "profileName": "Anne", "pin": "1357", "refreshToken": acc["refreshToken"]}, acc["token"])
    pt = own["token"]
    s, kid = req("POST", "/profiles", {"displayName": "Ela", "role": "Child"}, pt)
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, ct = select(dev, kid["id"])
    ct = ct["token"]
    d = (dt.date.today() + dt.timedelta(days=3)).isoformat()
    ev = f"/days/{d}/events"

    s, kurs = req("POST", ev, {"kind": "Event", "title": "Kurs", "time": "09:00", "endTime": "13:00"}, pt)
    check("bitişli aktivite eklendi", s == 200 and kurs["endTime"] == "13:00" and kurs["derivedEndTime"] is None, (s, kurs))
    s, b = req("POST", ev, {"title": "Konser", "time": "15:00"}, pt)
    check("bitişsiz kayıt: endTime ve derivedEndTime null", s == 200 and b["endTime"] is None and b["derivedEndTime"] is None, (s, b))
    s, b = req("POST", ev, {"title": "Boş bitiş", "time": "16:00", "endTime": ""}, pt)
    check("boş bitiş = bitiş yok", s == 200 and b["endTime"] is None, (s, b))
    for bad in ("25:00", "9:00", "13.00", "12:60", "öğle"):
        s, b = req("POST", ev, {"title": "X", "time": "09:00", "endTime": bad}, pt)
        check(f"geçersiz bitiş biçimi 400 ({bad})", s == 400 and code_of(b) == "validation", (s, b))
    s, b = req("POST", ev, {"title": "X", "time": "09:00", "endTime": "x" * 21}, pt)
    check("çok uzun bitiş 400", s == 400, (s, b))
    s, b = req("POST", ev, {"title": "X", "endTime": "13:00"}, pt)
    check("başlangıçsız bitiş 400", s == 400 and code_of(b) == "validation", (s, b))
    s, b = req("POST", ev, {"title": "X", "time": "09:00", "endTime": "09:00"}, pt)
    check("bitiş = başlangıç 400", s == 400 and code_of(b) == "validation", (s, b))
    s, gece = req("POST", ev, {"kind": "Concert", "title": "Gece konseri", "time": "21:00", "endTime": "01:00"}, pt)
    check("gece yarısını aşan kayıt kabul", s == 200 and gece["time"] == "21:00" and gece["endTime"] == "01:00", (s, gece))
    s, spor = req("POST", ev, {"kind": "Training", "title": "Antrenman", "time": "20:00", "endTime": "21:30"}, ct)
    check("Spor'da bitiş kabul (çocuk kendi kaydı)", s == 200 and spor["endTime"] == "21:30", (s, spor))

    # Düzenleme: bitiş değişir, eski istemci gövdesi (endTime yok) bitişi korur, "" siler
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "12:30"}, pt)
    check("bitiş düzenlendi", s == 200 and b["endTime"] == "12:30", (s, b))
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs (eski sekme)", "time": "09:00", "note": "n"}, pt)
    check("eski istemci gövdesiyle düzenlemede bitiş korunur", s == 200 and b["endTime"] == "12:30" and b["title"] == "Kurs (eski sekme)", (s, b))
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "08:30", "endTime": None}, pt)
    check("endTime: null da korur; başlangıç değişebilir", s == 200 and b["endTime"] == "12:30" and b["time"] == "08:30", (s, b))
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "09:00"}, pt)
    check("düzenlemede bitiş = başlangıç 400", s == 400, (s, b))
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "", "endTime": "13:00"}, pt)
    check("düzenlemede başlangıçsız bitiş 400", s == 400, (s, b))
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": ""}, pt)
    check("bitiş temizlendi", s == 200 and b["endTime"] is None, (s, b))
    req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "13:00"}, pt)
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": ""}, pt)
    check("eski istemci saati silerse bitiş de düşer", s == 200 and b["time"] == "" and b["endTime"] is None, (s, b))
    req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "13:00"}, pt)
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "13:00"}, pt)
    check("eski istemci başlangıcı bitişe eşitlerse bitiş düşer", s == 200 and b["time"] == "13:00" and b["endTime"] is None, (s, b))
    req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "13:00"}, pt)

    # Eski süre (Minutes) türetmesi: yalnızca okumada, gerçek bitişten ayrı alanda
    s, eski = req("POST", ev, {"kind": "Training", "trainingType": "Top", "time": "17:00", "minutes": 90}, pt)
    check("Minutes'tan türetilen bitiş derivedEndTime'da", s == 200 and eski["endTime"] is None and eski["derivedEndTime"] == "18:30", (s, eski))
    s, b = req("POST", ev, {"kind": "Training", "trainingType": "Kamp", "time": "23:30", "minutes": 60}, pt)
    check("türetme gece yarısını aşar", s == 200 and b["derivedEndTime"] == "00:30", (s, b))
    s, b = req("POST", ev, {"kind": "Training", "trainingType": "Top", "minutes": 60}, pt)
    check("saatsiz kayıtta türetme yok", s == 200 and b["derivedEndTime"] is None, (s, b))
    s, b = req("PUT", f"{ev}/{eski['id']}", {"trainingType": "Top", "time": "17:00", "minutes": 90, "endTime": "18:30"}, pt)
    check("düzenlenip kaydedilince gerçek bitiş olur", s == 200 and b["endTime"] == "18:30" and b["derivedEndTime"] is None, (s, b))

    # Geri dönüş sonrası eski kodun saatsiz bıraktığı kayıtta kalan bitiş okunurken gönderilmez
    s, ss = req("POST", ev, {"title": "Saatsiz"}, pt)
    n = db_count(f"""WITH u AS (UPDATE "Events" SET "EndTime" = '10:00' WHERE "Id" = {ss['id']} RETURNING 1) SELECT count(*) FROM u""")
    if n is not None:
        s, b = req("GET", f"/days/{d}", token=pt)
        x = next(e for e in b["events"] if e["id"] == ss["id"])
        check("saatsiz kayıtta artakalan bitiş gösterilmez", n == 1 and x["endTime"] is None and x["derivedEndTime"] is None, x)

    # Okuma: gün ve hafta ayrıntısı alanları taşır, sıra başlangıca göre değişmedi
    s, day = req("GET", f"/days/{d}", token=ct)
    byid = {e["id"]: e for e in day["events"]}
    check("gün cevabında endTime", byid[kurs["id"]]["endTime"] == "13:00" and byid[gece["id"]]["endTime"] == "01:00", day["events"])
    times = [e["time"] for e in day["events"] if e["time"]]
    check("sıra yalnızca başlangıca göre", times == sorted(times), times)
    s, wk = req("GET", f"/days/week/{monday(dt.date.fromisoformat(d)).isoformat()}/details", token=pt)
    wd = next(x for x in wk["days"] if x["date"] == d)
    check("hafta ayrıntısında endTime", any(e.get("endTime") == "21:30" for e in wd["events"]), wd["events"])

    # Yetki ve izolasyon
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "14:00"}, ct)
    check("çocuk ebeveynin kaydının bitişini değiştiremez (403)", s == 403, (s, b))
    s, b = req("PUT", f"{ev}/{spor['id']}", {"title": "Antrenman", "time": "20:00", "endTime": "22:00"}, ct)
    check("çocuk kendi kaydının bitişini değiştirir", s == 200 and b["endTime"] == "22:00", (s, b))
    o_email, other = register_and_verify("SaatB")
    s, oo = req("POST", "/family", {"name": "Başka", "profileName": "Baba", "pin": "2468", "refreshToken": other["refreshToken"]}, other["token"])
    s, b = req("PUT", f"{ev}/{kurs['id']}", {"title": "Kurs", "time": "09:00", "endTime": "10:00"}, oo["token"])
    check("başka aile kaydın bitişini değiştiremez (404)", s == 404, (s, b))
    s, b = req("GET", f"/days/{d}", token=oo["token"])
    check("başka aile kayıtları görmez", s == 200 and b["events"] == [], (s, b))
    s, b = req("GET", f"/days/{d}", token=pt)
    k = next(e for e in b["events"] if e["id"] == kurs["id"])
    check("başka ailenin denemesi kaydı değiştirmedi", k["endTime"] == "13:00", k)


def test_study_start_time():
    print("Derste başlangıç saati (bitiş = başlangıç + dakika)")
    email, acc = register_and_verify("DersSaat")
    s, own = req("POST", "/family", {"name": "Ders Saat", "profileName": "Anne", "pin": "1357", "refreshToken": acc["refreshToken"]}, acc["token"])
    pt = own["token"]
    s, kid = req("POST", "/profiles", {"displayName": "Can", "role": "Child"}, pt)
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, ct = select(dev, kid["id"])
    ct = ct["token"]
    d = (dt.date.today() + dt.timedelta(days=2)).isoformat()
    en = f"/days/{d}/entries"

    s, mat = req("POST", en, {"subject": "Matematik", "topic": "Türev", "minutes": 40, "startTime": "15:00"}, pt)
    check("saatli ders eklendi, bitiş türetildi", s == 200 and mat["startTime"] == "15:00" and mat["endTime"] == "15:40", (s, mat))
    s, b = req("POST", en, {"subject": "Fizik", "minutes": 30}, pt)
    check("eski istemci gövdesi: saatsiz ders (startTime ve endTime null)", s == 200 and b["startTime"] is None and b["endTime"] is None, (s, b))
    s, b = req("POST", en, {"subject": "Kimya", "minutes": 30, "startTime": ""}, pt)
    check("boş başlangıç = saatsiz", s == 200 and b["startTime"] is None, (s, b))
    s, b = req("POST", en, {"subject": "Gece", "minutes": 90, "startTime": "23:30"}, pt)
    check("gece yarısını aşan ders: bitiş ertesi günün saati", s == 200 and b["endTime"] == "01:00", (s, b))
    s, b = req("POST", en, {"subject": "Tam gün", "minutes": 1440, "startTime": "08:00"}, pt)
    check("tam gün süren derste bitiş türetilmez", s == 200 and b["startTime"] == "08:00" and b["endTime"] is None, (s, b))
    for bad in ["24:00", "9:00", "12:60", "ab:cd", "15.00", "15:00:00"]:
        s, b = req("POST", en, {"subject": "X", "minutes": 30, "startTime": bad}, pt)
        check(f"geçersiz başlangıç {bad!r} 400 validation", s == 400 and code_of(b) == "validation", (s, b))
    s, b = req("POST", en, {"subject": "X", "minutes": 30, "startTime": "x" * 21}, pt)
    check("çok uzun başlangıç 400", s == 400, (s, b))
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "minutes": 40, "startTime": "25:00"}, pt)
    check("düzenlemede geçersiz başlangıç 400", s == 400 and code_of(b) == "validation", (s, b))

    # Düzenleme: değişir; eski istemci gövdesi (alan yok / null) korur; "" siler
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "topic": "Türev", "minutes": 45, "startTime": "16:00"}, pt)
    check("başlangıç ve süre düzenlendi", s == 200 and b["startTime"] == "16:00" and b["endTime"] == "16:45", (s, b))
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "topic": "İntegral", "minutes": 50, "status": "inprogress"}, pt)
    check("eski istemci gövdesiyle düzenlemede başlangıç korunur", s == 200 and b["startTime"] == "16:00" and b["endTime"] == "16:50" and b["topic"] == "İntegral", (s, b))
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "minutes": 50, "startTime": None}, pt)
    check("startTime: null da korur", s == 200 and b["startTime"] == "16:00", (s, b))
    s, b = req("PATCH", f"{en}/{mat['id']}/status", {"status": "done"}, ct)
    check("durum değiştirme başlangıca dokunmaz", s == 200 and b["status"] == "done" and b["startTime"] == "16:00" and b["endTime"] == "16:50", (s, b))
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "minutes": 50, "startTime": ""}, pt)
    check("başlangıç temizlendi", s == 200 and b["startTime"] is None and b["endTime"] is None and b["status"] == "done", (s, b))
    req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "minutes": 40, "startTime": "15:00"}, pt)

    # Okuma: gün ve hafta ayrıntısı; hafta özetinin toplam dakikası değişmez
    s, day = req("GET", f"/days/{d}", token=ct)
    byid = {e["id"]: e for e in day["studyEntries"]}
    check("gün cevabında startTime/endTime", byid[mat["id"]]["startTime"] == "15:00" and byid[mat["id"]]["endTime"] == "15:40", byid.get(mat["id"]))
    mon = monday(dt.date.fromisoformat(d)).isoformat()
    s, wk = req("GET", f"/days/week/{mon}/details", token=pt)
    wd = next(x for x in wk["days"] if x["date"] == d)
    check("hafta ayrıntısında startTime/endTime", any(e.get("startTime") == "15:00" and e.get("endTime") == "15:40" for e in wd["studyEntries"]), wd["studyEntries"])
    check("hafta ayrıntısında saatsiz ders sayılabilir", sum(1 for e in wd["studyEntries"] if e["startTime"] is None) == 2, wd["studyEntries"])
    s, ws = req("GET", f"/days/week/{mon}", token=pt)
    sm = next(x for x in ws["days"] if x["date"] == d)
    check("hafta özeti toplam dakika değişmedi", sm["studyMinutes"] == 40 + 30 + 30 + 90 + 1440 and sm["entryCount"] == 5, sm)

    # Yetki ve izolasyon
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "minutes": 40, "startTime": "10:00"}, ct)
    check("çocuk ebeveynin dersinin saatini değiştiremez (403)", s == 403 and code_of(b) == "plan_read_only", (s, b))
    s, mine = req("POST", en, {"subject": "Resim", "minutes": 20, "startTime": "18:00"}, ct)
    s, b = req("PUT", f"{en}/{mine['id']}", {"subject": "Resim", "minutes": 20, "startTime": "18:30"}, ct)
    check("çocuk kendi dersinin saatini değiştirir", s == 200 and b["startTime"] == "18:30" and b["endTime"] == "18:50", (s, b))
    o_email, other = register_and_verify("DersSaatB")
    s, oo = req("POST", "/family", {"name": "Başka", "profileName": "Baba", "pin": "2468", "refreshToken": other["refreshToken"]}, other["token"])
    s, b = req("PUT", f"{en}/{mat['id']}", {"subject": "Matematik", "minutes": 40, "startTime": "10:00"}, oo["token"])
    check("başka aile dersin saatini değiştiremez (404)", s == 404 and code_of(b) == "not_found", (s, b))
    s, b = req("PATCH", f"{en}/{mat['id']}/status", {"status": "todo"}, oo["token"])
    check("başka aile durum değiştiremez (404)", s == 404, (s, b))
    s, b = req("GET", f"/days/{d}", token=oo["token"])
    check("başka aile dersleri görmez", s == 200 and b["studyEntries"] == [], (s, b))
    s, b = req("GET", f"/days/week/{mon}/details", token=oo["token"])
    check("başka aile hafta ayrıntısında dersleri görmez", s == 200 and all(x["studyEntries"] == [] for x in b["days"]), s)
    s, b = req("GET", f"/days/{d}", token=pt)
    m = next(e for e in b["studyEntries"] if e["id"] == mat["id"])
    check("başka ailenin denemesi dersi değiştirmedi", m["startTime"] == "15:00" and m["status"] == "done", m)


# ---------------------------------------------------------------- tekrarlayan aktiviteler

def week_events(token, mon):
    """Haftanın günleri: tarih -> aktivite listesi (GET /days/week/{monday}/details)."""
    s, wk = req("GET", f"/days/week/{mon.isoformat()}/details", token=token)
    assert s == 200, (s, wk)
    return {x["date"]: x["events"] for x in wk["days"]}


def occ(events, series_id):
    return [e for e in events if e.get("seriesId") == series_id]


def test_series():
    print("Tekrarlayan aktiviteler (seri) ve Okul türü")
    email, acc = register_and_verify("Tekrar")
    s, own = req("POST", "/family", {"name": "Tekrar Ailesi", "profileName": "Anne", "pin": "1593", "refreshToken": acc["refreshToken"]}, acc["token"])
    pt = own["token"]
    s, kid = req("POST", "/profiles", {"displayName": "Ela", "role": "Child"}, pt)
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, ct = select(dev, kid["id"])
    ct = ct["token"]
    o_email, o_acc = register_and_verify("TekrarB")
    s, o_own = req("POST", "/family", {"name": "Başka Tekrar", "profileName": "Baba", "pin": "7531", "refreshToken": o_acc["refreshToken"]}, o_acc["token"])
    ot = o_own["token"]

    w1 = monday(dt.date.today()) + dt.timedelta(days=7)  # gelecek hafta (pazartesi)
    iso = lambda d: d.isoformat()  # noqa: E731
    until = w1 + dt.timedelta(days=7 * 4 + 3)  # 5. haftanın perşembesi
    # Tür "Event": Okul türü tatilde gizlenir, değişen haftalarda tatile denk gelmesin (Okul + tatil aşağıda sabit tarihle)
    base = {"kind": "Event", "title": "Okul", "time": "08:00", "endTime": "15:00", "daysOfWeek": [1, 2, 3, 4, 5],
            "startDate": iso(w1), "untilDate": iso(until)}

    bad = [
        ("gün yok", dict(base, daysOfWeek=[])),
        ("gün alanı yok", {k: v for k, v in base.items() if k != "daysOfWeek"}),
        ("geçersiz gün (8)", dict(base, daysOfWeek=[1, 8])),
        ("bitiş < başlangıç", dict(base, untilDate=iso(w1 - dt.timedelta(days=1)))),
        ("bitiş > 1 yıl", dict(base, untilDate=iso(dt.date(w1.year + 1, w1.month, w1.day) + dt.timedelta(days=1)))),
        ("bitiş tarihi yok", dict(base, untilDate=None)),
        ("bitiş tarihi biçimi", dict(base, untilDate="15.06.2027")),
        ("bitiş saati başlangıçsız", dict(base, time="", endTime="15:00")),
        ("bitiş = başlangıç", dict(base, endTime="08:00")),
        ("geçersiz saat", dict(base, time="8:00")),
        ("adsız", dict(base, title="  ")),
        ("aralıkta seçili gün yok", dict(base, untilDate=iso(w1), daysOfWeek=[6])),
        ("aralık dışı istisna", dict(base, exceptions=[iso(until + dt.timedelta(days=1))])),
    ]
    for name, body in bad:
        s, b = req("POST", "/series", body, pt)
        check(f"seri doğrulama: {name} 400", s == 400 and code_of(b) == "validation", (s, b))
    s, b = req("POST", "/series", dict(base, startDate="2026-13-01"), pt)
    check("seri doğrulama: geçersiz başlangıç 400 invalid_date", s == 400 and code_of(b) == "invalid_date", (s, b))
    s, b = req("POST", "/series", dict(base, kind="Dance"), pt)
    check("seri doğrulama: tanımsız tür 400", s == 400, (s, b))
    s, b = req("POST", "/series", dict(base, untilDate=iso(dt.date(w1.year + 1, w1.month, w1.day)), daysOfWeek=[7]), pt)
    check("bitiş tam 1 yıl sonrası kabul", s == 200, (s, b))
    req("DELETE", f"/series/{b['id']}", token=pt) if s == 200 else None

    s, sr = req("POST", "/series", base, pt)
    check("Okul serisi eklendi (Pzt–Cum 08:00–15:00)",
          s == 200 and sr["kind"] == "Event" and sr["daysOfWeek"] == [1, 2, 3, 4, 5] and sr["time"] == "08:00"
          and sr["endTime"] == "15:00" and sr["startDate"] == iso(w1) and sr["untilDate"] == iso(until)
          and sr["exceptions"] == [] and sr["canEdit"] and sr["createdBy"]["displayName"] == "Anne", (s, sr))
    sid = sr["id"]
    s, n1 = req("POST", f"/days/{iso(w1)}/events", {"kind": "Music", "title": "Piyano", "time": "07:00"}, pt)
    s, n2 = req("POST", f"/days/{iso(w1)}/events", {"kind": "Event", "title": "Saatsiz"}, pt)
    s, n3 = req("POST", f"/days/{iso(w1)}/events", {"kind": "Exam", "title": "Aynı saat", "time": "08:00"}, pt)

    wk = week_events(pt, w1)
    days = [w1 + dt.timedelta(days=i) for i in range(7)]
    check("hafta içi her gün bir tekrar, hafta sonu yok",
          [len(occ(wk[iso(d)], sid)) for d in days] == [1, 1, 1, 1, 1, 0, 0], [len(occ(wk[iso(d)], sid)) for d in days])
    o = occ(wk[iso(days[2])], sid)[0]
    check("sanal kayıt: id 0, seriesId, occurrenceDate, recurring özeti",
          o["id"] == 0 and o["occurrenceDate"] == iso(days[2]) and o["kind"] == "Event" and o["time"] == "08:00"
          and o["endTime"] == "15:00" and o["recurring"] == {"daysOfWeek": [1, 2, 3, 4, 5], "startDate": iso(w1), "untilDate": iso(until)}
          and o["canEdit"] and o["createdBy"]["displayName"] == "Anne", o)
    order = [(e["title"], e["id"] == 0) for e in wk[iso(w1)]]
    check("gün sırası: saate göre, aynı saatte normal kayıt önce, saatsiz sonda",
          order == [("Piyano", False), ("Aynı saat", False), ("Okul", True), ("Saatsiz", False)], order)
    s, b = req("GET", f"/days/{iso(days[3])}", token=pt)
    check("gün ucu da tekrarı gösterir", s == 200 and len(occ(b["events"], sid)) == 1, b)
    normal = [e for e in wk[iso(w1)] if e["id"] != 0]
    check("normal kayıtlarda seri alanları null",
          all(e["seriesId"] is None and e["occurrenceDate"] is None and e["recurring"] is None for e in normal), normal)
    last = week_events(pt, monday(until))
    check("bitiş tarihinde var, sonrasında yok",
          len(occ(last[iso(until)], sid)) == 1 and len(occ(last[iso(until + dt.timedelta(days=1))], sid)) == 0, last)
    check("başlangıçtan önce yok", all(len(occ(v, sid)) == 0 for v in week_events(pt, w1 - dt.timedelta(days=7)).values()))
    s, sw = req("GET", f"/days/week/{iso(w1)}", token=pt)
    counts = [x["eventCount"] for x in sw["days"]]
    check("hafta özeti tekrarları sayar", counts == [4, 1, 1, 1, 1, 0, 0], counts)

    # Saatsiz tekrar (spor, cumartesi): "Saati yok" şeridinde, hafta özetinde spor olarak
    s, tr = req("POST", "/series", {"kind": "Training", "title": "Yüzme", "daysOfWeek": [6], "startDate": iso(w1), "untilDate": iso(until)}, ct)
    check("çocuk saatsiz spor serisi ekledi", s == 200 and tr["time"] == "" and tr["endTime"] is None and tr["daysOfWeek"] == [6], (s, tr))
    wk = week_events(pt, w1)
    o = occ(wk[iso(days[5])], tr["id"])
    check("saatsiz tekrar: saat boş, süre yok", len(o) == 1 and o[0]["time"] == "" and o[0]["minutes"] is None and o[0]["canEdit"], o)
    s, sw = req("GET", f"/days/week/{iso(w1)}", token=pt)
    sat = sw["days"][5]
    check("hafta özeti: tekrarlayan spor", sat["trainingDone"] and sat["trainingCount"] == 1 and sat["eventCount"] == 0, sat)

    # Yalnızca bu gün sil (salı)
    tue, wed, fri = days[1], days[2], days[4]
    s, b = req("POST", f"/series/{sid}/skip", {"date": iso(tue)}, pt)
    check("yalnızca bu gün silme 204", s == 204, (s, b))
    wk = week_events(pt, w1)
    check("salı kalktı, diğer günler duruyor", len(occ(wk[iso(tue)], sid)) == 0 and len(occ(wk[iso(wed)], sid)) == 1, wk)
    s, b = req("POST", f"/series/{sid}/skip", {"date": iso(tue)}, pt)
    check("aynı günü tekrar silmek idempotent (204)", s == 204, (s, b))
    s, b = req("POST", f"/series/{sid}/skip", {"date": iso(days[5])}, pt)
    check("tekrar günü olmayan tarih 400 not_occurrence", s == 400 and code_of(b) == "not_occurrence", (s, b))
    s, b = req("POST", f"/series/{sid}/skip", {"date": iso(until + dt.timedelta(days=4))}, pt)
    check("bitişten sonraki tarih 400 not_occurrence", s == 400 and code_of(b) == "not_occurrence", (s, b))
    s, b = req("POST", f"/series/{sid}/skip", {"date": "yarın"}, pt)
    check("geçersiz tarih 400 invalid_date", s == 400 and code_of(b) == "invalid_date", (s, b))
    s, sw = req("GET", f"/days/week/{iso(w1)}", token=pt)
    check("hafta özeti atlanan günü saymaz", sw["days"][1]["eventCount"] == 0, sw["days"][1])
    s, b = req("POST", f"/series/{sid}/restore", {"date": iso(tue)}, pt)
    check("yalnızca bu gün silmeyi geri al (204), salı geri geldi", s == 204 and len(occ(week_events(pt, w1)[iso(tue)], sid)) == 1, (s, b))
    s, b = req("POST", f"/series/{sid}/restore", {"date": iso(tue)}, ct)
    check("çocuk ebeveynin serisinde geri alamaz (403)", s == 403, (s, b))
    req("POST", f"/series/{sid}/skip", {"date": iso(tue)}, pt)

    # Yalnızca bu gün düzenle (çarşamba): o gün normal aktivite olur
    s, b = req("POST", f"/series/{sid}/detach", {"date": iso(wed), "title": "Okul (yarım gün)", "time": "08:00", "endTime": "07:00"}, pt)
    check("ayırmada saat kuralları geçerli (bitiş < başlangıç gece yarısını aşar, kabul)", s == 200, (s, b))
    s, b = req("POST", f"/series/{sid}/detach", {"date": iso(wed), "title": "Tekrar", "time": "08:00"}, pt)
    check("ayrılmış günü yeniden ayırmak 409 occurrence_gone", s == 409 and code_of(b) == "occurrence_gone", (s, b))
    s, b = req("POST", f"/series/{sid}/detach", {"date": iso(fri), "title": "X", "time": "", "endTime": "12:00"}, pt)
    check("ayırmada bitiş başlangıçsız 400", s == 400 and code_of(b) == "validation", (s, b))
    s, det = req("POST", f"/series/{sid}/detach", {"date": iso(fri), "title": "Okul gezisi", "time": "09:00", "endTime": "12:00", "note": "çanta"}, pt)
    check("yalnızca bu gün düzenleme: normal aktivite döner",
          s == 200 and det["id"] > 0 and det["seriesId"] is None and det["kind"] == "Event" and det["title"] == "Okul gezisi"
          and det["endTime"] == "12:00" and det["note"] == "çanta", (s, det))
    wk = week_events(pt, w1)
    check("cuma: tekrar yok, ayrılan aktivite var",
          len(occ(wk[iso(fri)], sid)) == 0 and [e["title"] for e in wk[iso(fri)]] == ["Okul gezisi"], wk[iso(fri)])
    s, b = req("PUT", f"/days/{iso(fri)}/events/{det['id']}", {"title": "Okul gezisi (müze)", "time": "09:00", "endTime": "13:00"}, pt)
    check("ayrılan gün normal uçla düzenlenir", s == 200 and b["endTime"] == "13:00", (s, b))
    s, b = req("PUT", f"/days/{iso(days[3])}/events/0", {"title": "X"}, pt)
    check("sanal kayıt (id 0) eski uçla düzenlenemez (404)", s == 404, (s, b))

    # Tüm tekrarlar düzenleme: kural değişir, ayrılan ve atlanan günler korunur
    s, b = req("PUT", f"/series/{sid}", {"title": "Okul", "time": "08:30", "endTime": "15:30", "daysOfWeek": [1, 2, 3, 4], "untilDate": iso(w1 - dt.timedelta(days=1))}, pt)
    check("tüm tekrarlar: bitiş < başlangıç 400", s == 400, (s, b))
    s, b = req("PUT", f"/series/{sid}", {"title": "Okul", "time": "08:30", "daysOfWeek": [], "untilDate": iso(until)}, pt)
    check("tüm tekrarlar: gün yok 400", s == 400, (s, b))
    s, up = req("PUT", f"/series/{sid}", {"title": "Okul", "time": "08:30", "endTime": "15:30", "daysOfWeek": [4, 1, 2, 3, 3], "untilDate": iso(until), "note": "servis"}, pt)
    check("tüm tekrarlar düzenlendi (günler sıralı, tekrarsız)",
          s == 200 and up["daysOfWeek"] == [1, 2, 3, 4] and up["time"] == "08:30" and up["note"] == "servis"
          and up["exceptions"] == sorted([iso(tue), iso(wed), iso(fri)]) and up["updatedBy"]["displayName"] == "Anne", (s, up))
    wk = week_events(pt, w1)
    mon_o = occ(wk[iso(w1)], sid)
    check("pazartesi yeni saatle, salı hâlâ yok, çarşamba ayrılmış, cuma tekrar yok",
          len(mon_o) == 1 and mon_o[0]["time"] == "08:30" and mon_o[0]["endTime"] == "15:30"
          and not occ(wk[iso(tue)], sid) and not occ(wk[iso(wed)], sid) and not occ(wk[iso(fri)], sid)
          and [e["title"] for e in wk[iso(wed)]] == ["Okul (yarım gün)"], wk)
    nxt = week_events(pt, w1 + dt.timedelta(days=7))
    check("sonraki hafta: Pzt–Per var, cuma yok",
          [len(occ(nxt[iso(w1 + dt.timedelta(days=7 + i))], sid)) for i in range(5)] == [1, 1, 1, 1, 0], nxt)

    # Yetki: çocuk ebeveynin serisini değiştiremez (403), kendi serisini değiştirir; ebeveyn çocuğunkini değiştirir
    o = occ(week_events(ct, w1)[iso(w1)], sid)
    check("çocuk ebeveynin tekrarını görür, düzenleyemez (canEdit false)", len(o) == 1 and o[0]["canEdit"] is False, o)
    upd = {"title": "X", "time": "08:00", "daysOfWeek": [1], "untilDate": iso(until)}
    for name, (m, path, body) in {
        "düzenleme": ("PUT", f"/series/{sid}", upd),
        "silme": ("DELETE", f"/series/{sid}", None),
        "yalnızca bu gün silme": ("POST", f"/series/{sid}/skip", {"date": iso(w1)}),
        "yalnızca bu gün düzenleme": ("POST", f"/series/{sid}/detach", {"date": iso(w1), "title": "X"}),
    }.items():
        s, b = req(m, path, body, ct)
        check(f"çocuk ebeveynin serisinde {name}: 403 plan_read_only", s == 403 and code_of(b) == "plan_read_only", (s, b))
    s, b = req("GET", f"/series/{sid}", token=ct)
    check("çocuk seriyi okuyabilir (canEdit false)", s == 200 and b["canEdit"] is False, (s, b))
    s, b = req("PUT", f"/series/{tr['id']}", {"title": "Yüzme kursu", "daysOfWeek": [6, 7], "untilDate": iso(until)}, ct)
    check("çocuk kendi serisini düzenler", s == 200 and b["daysOfWeek"] == [6, 7], (s, b))
    s, b = req("POST", f"/series/{tr['id']}/detach", {"date": iso(days[6]), "title": "Yüzme yarışı", "time": "10:00"}, pt)
    check("ebeveyn çocuğun serisinden gün ayırır; kayıt çocuğun kalır",
          s == 200 and b["createdBy"]["displayName"] == "Ela" and b["updatedBy"]["displayName"] == "Anne", (s, b))
    s, b = req("PUT", f"/days/{iso(days[6])}/events/{b['id']}", {"title": "Yüzme yarışı", "time": "11:00"}, ct)
    check("çocuk kendi serisinden ayrılan günü düzenler", s == 200, (s, b))

    # Başka aile: görmez, değiştiremez (404)
    check("başka aile tekrarları görmez", all(v == [] for v in week_events(ot, w1).values()))
    s, sw = req("GET", f"/days/week/{iso(w1)}", token=ot)
    check("başka aile hafta özetinde tekrar sayılmaz", all(x["eventCount"] == 0 and x["trainingCount"] == 0 for x in sw["days"]), sw)
    for name, (m, path, body) in {
        "okuma": ("GET", f"/series/{sid}", None),
        "düzenleme": ("PUT", f"/series/{sid}", upd),
        "silme": ("DELETE", f"/series/{sid}", None),
        "yalnızca bu gün silme": ("POST", f"/series/{sid}/skip", {"date": iso(w1)}),
        "yalnızca bu gün düzenleme": ("POST", f"/series/{sid}/detach", {"date": iso(w1), "title": "X"}),
        "geri alma": ("POST", f"/series/{sid}/restore", {"date": iso(tue)}),
    }.items():
        s, b = req(m, path, body, ot)
        check(f"başka aile {name}: 404", s == 404 and code_of(b) == "not_found", (s, b))
    s, b = req("GET", "/series/99999999", token=pt)
    check("olmayan seri 404", s == 404, (s, b))

    # Okul türü normal aktivitede de
    s, b = req("POST", f"/days/{iso(days[5])}/events", {"kind": "School", "title": "Veli toplantısı", "time": "10:00"}, pt)
    check("Okul türünde normal aktivite", s == 200 and b["kind"] == "School", (s, b))

    # Tüm tekrarlar silme + "Geri al" (silinen seri istisnalarıyla yeniden eklenir)
    s, res = req("DELETE", f"/series/{sid}", token=pt)
    gone = res.get("series", {}) if isinstance(res, dict) else {}
    check("tüm tekrarlar silindi (cevap: silinen seri)", s == 200 and res["truncated"] is False and gone["id"] == sid and gone["exceptions"] == up["exceptions"], (s, gone))
    wk = week_events(pt, w1)
    check("silinince hiçbir günde tekrar yok, ayrılan günler kalır",
          all(not occ(v, sid) for v in wk.values()) and [e["title"] for e in wk[iso(fri)]] == ["Okul gezisi (müze)"], wk)
    s, b = req("GET", f"/series/{sid}", token=pt)
    check("silinen seri 404", s == 404, (s, b))
    s, b = req("POST", f"/series/{sid}/skip", {"date": iso(w1)}, pt)
    check("silinen seride gün silme 404", s == 404, (s, b))
    undo = {k: gone[k] for k in ["kind", "title", "time", "endTime", "note", "daysOfWeek", "startDate", "untilDate", "exceptions"]}
    s, again = req("POST", "/series", undo, pt)
    check("geri al: seri istisnalarıyla geri geldi", s == 200 and again["exceptions"] == gone["exceptions"] and again["id"] != sid, (s, again))
    wk = week_events(pt, w1)
    check("geri alınca salı/çarşamba/cuma yine boş, pazartesi var",
          [len(occ(wk[iso(d)], again["id"])) for d in days[:5]] == [1, 0, 0, 1, 0], [len(occ(wk[iso(d)], again["id"])) for d in days[:5]])

    # Eşzamanlı aynı gün ayırma: yalnızca biri aktivite oluşturur
    thu2 = iso(w1 + dt.timedelta(days=10))
    with concurrent.futures.ThreadPoolExecutor(4) as ex:
        res = list(ex.map(lambda _: req("POST", f"/series/{again['id']}/detach", {"date": thu2, "title": "Aynı anda"}, pt)[0], range(4)))
    s, d = req("GET", f"/days/{thu2}", token=pt)
    check("eşzamanlı ayırma: tek 200, diğerleri 409; günde tek kayıt",
          sorted(res) == [200, 409, 409, 409] and [e["title"] for e in d["events"]] == ["Aynı anda"], (res, d["events"]))

    # "Tüm tekrarlar" silme bugünden (from) itibaren: seri kısalır, önceki günler kalır; "Geri al" = PUT
    aid, w3 = again["id"], w1 + dt.timedelta(days=14)
    s, b = req("DELETE", f"/series/{aid}?from=15.06.2027", token=pt)
    check("silme: geçersiz from 400", s == 400 and code_of(b) == "invalid_date", (s, b))
    s, res = req("DELETE", f"/series/{aid}?from={iso(w3)}", token=pt)
    check("from ile silme: seri kısaldı, cevap önceki hâl",
          s == 200 and res["truncated"] is True and res["series"]["untilDate"] == iso(until), (s, res))
    s, cur = req("GET", f"/series/{aid}", token=pt)
    check("kısalan seri: bitiş from - 1, istisnalar korunur",
          s == 200 and cur["untilDate"] == iso(w3 - dt.timedelta(days=1)) and cur["exceptions"] == res["series"]["exceptions"], (s, cur))
    check("from öncesi günler kalır, from ve sonrası yok",
          len(occ(week_events(pt, w1)[iso(w1)], aid)) == 1 and all(not occ(v, aid) for v in week_events(pt, w3).values()))
    put = {k: res["series"][k] for k in ["title", "time", "endTime", "note", "daysOfWeek", "untilDate"]}
    s, b = req("PUT", f"/series/{aid}", put, pt)
    check("geri al (PUT): eski bitiş tarihi ve günler geri geldi",
          s == 200 and b["untilDate"] == iso(until) and len(occ(week_events(pt, w3)[iso(w3)], aid)) == 1, (s, b))
    s, b = req("DELETE", f"/series/{aid}?from={iso(w1)}", token=pt)
    check("from başlangıçtan önce/eşit: seri tamamen silinir", s == 200 and b["truncated"] is False
          and req("GET", f"/series/{aid}", token=pt)[0] == 404, (s, b))

    # Tatiller: Okul tekrarı resmî tatilde ve okul tatilinde görünmez, arifede görünür; diğer türler görünür
    s, sch = req("POST", "/series", {"kind": "School", "title": "Okul", "time": "08:00", "endTime": "15:00",
                                     "daysOfWeek": [1, 2, 3, 4, 5], "startDate": "2027-10-25", "untilDate": "2027-11-26"}, pt)
    s, mus = req("POST", "/series", {"kind": "Music", "title": "Piyano", "time": "17:00", "daysOfWeek": [5],
                                     "startDate": "2027-10-25", "untilDate": "2027-11-26"}, pt)
    wk = week_events(pt, dt.date(2027, 10, 25))
    check("Okul: 28 Ekim (arife) var, 29 Ekim (Cumhuriyet Bayramı) yok; Piyano 29 Ekim'de var",
          [len(occ(wk[f"2027-10-{d}"], sch["id"])) for d in (25, 26, 27, 28, 29)] == [1, 1, 1, 1, 0]
          and len(occ(wk["2027-10-29"], mus["id"])) == 1, {k: [e["title"] for e in v] for k, v in wk.items()})
    s, d = req("GET", "/days/2027-10-29", token=pt)
    check("gün cevabında tatil: Cumhuriyet Bayramı (official)",
          s == 200 and {"name": "Cumhuriyet Bayramı", "kind": "official"} in d["holidays"], (s, d.get("holidays")))
    s, d = req("GET", "/days/2027-10-28", token=pt)
    check("arife yarım gün (half)", s == 200 and [h["kind"] for h in d["holidays"]] == ["half"], (s, d.get("holidays")))
    s, d = req("GET", "/days/2027-10-27", token=pt)
    check("sıradan gün: tatil listesi boş", s == 200 and d["holidays"] == [], (s, d.get("holidays")))
    s, w = req("GET", "/days/week/2027-10-25", token=pt)
    check("hafta özeti: 29 Ekim tatil, Okul sayılmaz (yalnızca Piyano)",
          s == 200 and w["days"][4]["holidays"][0]["name"] == "Cumhuriyet Bayramı" and w["days"][4]["eventCount"] == 1
          and w["days"][3]["eventCount"] == 1, (s, w))
    s, sch2 = req("POST", "/series", {"kind": "School", "title": "Okul", "daysOfWeek": [1, 2, 3, 4, 5],
                                      "startDate": "2027-03-01", "untilDate": "2027-03-19"}, pt)
    gone = [len(occ(week_events(pt, dt.date(2027, 3, 8))[f"2027-03-{d:02d}"], sch2["id"])) for d in range(8, 13)]
    check("ara tatil (8-12 Mart 2027): Okul hiç görünmez, önceki hafta görünür",
          gone == [0] * 5 and len(occ(week_events(pt, dt.date(2027, 3, 1))["2027-03-01"], sch2["id"])) == 1, gone)
    s, d = req("GET", "/days/2027-03-09", token=pt)
    check("aynı güne iki kayıt: Ramazan Bayramı ve ara tatil",
          [h["kind"] for h in d["holidays"]] == ["official", "school"], d.get("holidays"))


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
    kurs = f"Kurs {uuid.uuid4().hex[:6]}"
    req("POST", f"/days/{d1}/events", {"title": kurs, "time": "09:00", "endTime": "13:00"}, ct)
    time.sleep(4)
    check("sessiz saatte anında bildirim gitmez", len(fake.to("anne")) == n, len(fake.to("anne")))
    # Bekleyen bildirim kuyrukta düz metin durur; gövdede saat aralığı ("✦ Kurs 09:00–13:00")
    held = db_count(f"""SELECT count(*) FROM "PendingNotifications" WHERE "Body" LIKE '✦ {kurs} · 09:00–13:00 —%'""")
    if held is not None:
        check("bildirim metninde bitiş aralığı", held == 1, held)
    # Saatli ders: "📚 Ad · 15:00–15:40 — Gün"; saatsiz ders bugünkü metin ("📚 Tarih · 20 dk — Gün")
    ders = f"Ders {uuid.uuid4().hex[:6]}"
    req("POST", f"/days/{d1}/entries", {"subject": ders, "minutes": 40, "startTime": "15:00"}, ct)
    time.sleep(1)
    held = db_count(f"""SELECT count(*) FROM "PendingNotifications" WHERE "Body" LIKE '📚 {ders} · 15:00–15:40 —%'""")
    if held is not None:
        check("saatli ders bildiriminde saat aralığı", held == 1, held)
    held = db_count(f"""SELECT count(*) FROM "PendingNotifications"
        WHERE "RecipientMemberId" = {own['profile']['id']} AND "Body" LIKE '📚 Tarih · 20 dk —%'""")
    if held is not None:
        check("saatsiz ders bildirim metni değişmedi", held == 1, held)
    # Tekrarlayan aktivite (sessiz saatte kuyrukta bekler): tek bildirim, metinde kuralın özeti
    okul = f"Okul {uuid.uuid4().hex[:6]}"
    sd = monday(day) + dt.timedelta(days=7)
    s, ser = req("POST", "/series", {"kind": "School", "title": okul, "time": "08:00", "endTime": "15:00", "daysOfWeek": [1, 2, 3, 4, 5],
                                     "startDate": sd.isoformat(), "untilDate": next_june15(sd).isoformat()}, ct)
    check("seri eklendi (bildirim senaryosu)", s == 200, (s, ser))
    time.sleep(1)
    held = db_count(f"""SELECT count(*) FROM "PendingNotifications"
        WHERE "RecipientMemberId" = {own['profile']['id']} AND "Body" LIKE '🏫 {okul} · Pzt–Cum 08:00–15:00 · 15 Haziran''a kadar'""")
    if held is not None:
        check("seri eklenince tek bildirim, metin kural özeti", held == 1, held)
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


# ---------------------------------------------------------------- hesap silme

def db_count(sql):
    """--psql verilmişse sorgunun sonucu (tek sayı), verilmemişse None."""
    if not PSQL:
        return None
    out = subprocess.run(PSQL + ["-Atc", sql], capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip())
    return int(out.stdout.strip())


def account_rows(user_id, family_id, member_ids, entry_ids, event_ids):
    """Hesaba/aileye ait satır sayıları (tablo adı -> sayı)."""
    mids = ",".join(str(i) for i in member_ids) or "0"
    q = {
        "Users": f"""SELECT count(*) FROM "Users" WHERE "Id" = '{user_id}'""",
        "UserTokens+Claims+Logins+Roles": f"""SELECT (SELECT count(*) FROM "UserTokens" WHERE "UserId" = '{user_id}')
            + (SELECT count(*) FROM "UserClaims" WHERE "UserId" = '{user_id}')
            + (SELECT count(*) FROM "UserLogins" WHERE "UserId" = '{user_id}')
            + (SELECT count(*) FROM "UserRoles" WHERE "UserId" = '{user_id}')""",
        "Families": f"""SELECT count(*) FROM "Families" WHERE "Id" = {family_id}""",
        "FamilyMembers": f"""SELECT count(*) FROM "FamilyMembers" WHERE "FamilyId" = {family_id} OR "UserId" = '{user_id}'""",
        "Days": f"""SELECT count(*) FROM "Days" WHERE "FamilyId" = {family_id}""",
        "StudyEntries": f"""SELECT count(*) FROM "StudyEntries" WHERE "Id" IN ({",".join(map(str, entry_ids)) or "0"})""",
        "Events": f"""SELECT count(*) FROM "Events" WHERE "Id" IN ({",".join(map(str, event_ids)) or "0"})""",
        "Subjects": f"""SELECT count(*) FROM "Subjects" WHERE "FamilyId" = {family_id}""",
        "EventSeries": f"""SELECT count(*) FROM "EventSeries" WHERE "FamilyId" = {family_id}""",
        "EventSeriesExceptions": f"""SELECT count(*) FROM "EventSeriesExceptions" x JOIN "EventSeries" s ON s."Id" = x."SeriesId"
            WHERE s."FamilyId" = {family_id}""",
        "PushSubscriptions": f"""SELECT count(*) FROM "PushSubscriptions" WHERE "FamilyId" = {family_id} OR "MemberId" IN ({mids})""",
        "NotificationPreferences": f"""SELECT count(*) FROM "NotificationPreferences" WHERE "MemberId" IN ({mids})""",
        "PendingNotifications": f"""SELECT count(*) FROM "PendingNotifications" WHERE "FamilyId" = {family_id} OR "RecipientMemberId" IN ({mids})""",
        "RefreshTokens": f"""SELECT count(*) FROM "RefreshTokens" WHERE "UserId" = '{user_id}' OR "MemberId" IN ({mids})""",
    }
    return {k: db_count(v) for k, v in q.items()}


def test_account_delete():
    print("Hesap silme")
    email, acc = register_and_verify("Silinecek")
    s, me = req("GET", "/auth/me", token=acc["token"])
    user_id = me["userId"]
    s, own = req("POST", "/family", {"name": "Silinecek Aile", "profileName": "Anne", "pin": "1470", "refreshToken": acc["refreshToken"]}, acc["token"])
    pt = own["token"]
    family_id = own["family"]["id"]
    owner_id = own["profile"]["id"]
    s, kid = req("POST", "/profiles", {"displayName": "Kuzu", "role": "Child"}, pt)
    s, dad = req("POST", "/profiles", {"displayName": "Baba", "role": "Parent", "pin": "2580"}, pt)
    member_ids = [owner_id, kid["id"], dad["id"]]
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, ct = select(dev, kid["id"])
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, dt_ = select(dev, dad["id"], pin="2580")
    s, dev = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s, other_device = select(dev, owner_id, pin="1470")
    s, noprof = req("POST", "/auth/login", {"email": email, "password": "sifre123"})

    day = dt.date.today().isoformat()
    s, e1 = req("POST", f"/days/{day}/entries", {"subject": "Matematik", "minutes": 30}, pt)
    s, e2 = req("POST", f"/days/{day}/entries", {"subject": "Fizik", "minutes": 20}, ct["token"])
    s, ev = req("POST", f"/days/{day}/events", {"kind": "Music", "title": "Piyano"}, ct["token"])
    req("GET", "/subjects", token=pt)  # varsayılan ders listesi oluşur
    today = dt.date.today()
    s, ser = req("POST", "/series", {"kind": "School", "title": "Okul", "daysOfWeek": [1, 2, 3, 4, 5, 6, 7],
                                     "startDate": today.isoformat(), "untilDate": (today + dt.timedelta(days=30)).isoformat()}, ct["token"])
    req("POST", f"/series/{ser['id']}/skip", {"date": (today + dt.timedelta(days=1)).isoformat()}, pt)
    entry_ids, event_ids = [e1["id"], e2["id"]], [ev["id"]]

    # Bildirim: abonelik + ayar + sessiz saatte bekleyen (kuyrukta duran) bildirim
    fake = None
    s, cfg = req("GET", "/push/config", token=pt)
    if s == 200 and cfg.get("enabled"):
        fake = FakePush()
        subscribe(pt, fake.url("del-anne"))
        subscribe(ct["token"], fake.url("del-kuzu"))
        s, st = req("GET", "/push/settings", token=pt)
        now = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)
        quiet = dict(st["settings"], quietEnabled=True, quietStart=(now - dt.timedelta(hours=1)).strftime("%H:%M"),
                     quietEnd=(now + dt.timedelta(hours=1)).strftime("%H:%M"))
        req("PUT", "/push/settings", quiet, pt)
        req("POST", f"/days/{day}/entries", {"subject": "Kimya", "minutes": 15}, ct["token"])
        time.sleep(0.5)

    # Başka aile: silmeden etkilenmemeli
    o_email, o_acc = register_and_verify("Komsu")
    s, o_own = req("POST", "/family", {"name": "Komşu Aile", "profileName": "Komşu", "pin": "3690", "refreshToken": o_acc["refreshToken"]}, o_acc["token"])
    ot = o_own["token"]
    s, oe = req("POST", f"/days/{day}/entries", {"subject": "Tarih", "minutes": 40}, ot)
    s, o_before = req("GET", f"/days/{day}", token=ot)
    s, o_subj_before = req("GET", "/subjects", token=ot)
    s, o_me = req("GET", "/auth/me", token=ot)
    other_rows_before = account_rows(o_me["userId"], o_own["family"]["id"], [o_own["profile"]["id"]], [oe["id"]], [])
    dpk_before = db_count('SELECT count(*) FROM "DataProtectionKeys"')

    body = {"password": "sifre123", "confirm": "SİL"}
    s, b = req("POST", "/account/delete", body)
    check("silme: oturumsuz 401", s == 401, (s, b))
    s, b = req("POST", "/account/delete", body, ct["token"])
    check("silme: çocuk profili 403 owner_only", s == 403 and code_of(b) == "owner_only", (s, b))
    s, b = req("POST", "/account/delete", body, dt_["token"])
    check("silme: diğer ebeveyn profili 403 owner_only", s == 403 and code_of(b) == "owner_only", (s, b))
    s, b = req("POST", "/account/delete", body, noprof["token"])
    check("silme: profil seçilmemiş 403 profile_required", s == 403 and code_of(b) == "profile_required", (s, b))
    bad = [c for c in ["sil", "SIL", "Sil", "S İL", "SİL!", "", None]
           if code_of(req("POST", "/account/delete", {"password": "sifre123", "confirm": c}, pt)[1]) != "confirm_invalid"]
    check("silme: SİL dışındaki yazımlar 400 confirm_invalid", bad == [], bad)
    s, b = req("POST", "/account/delete", {"password": "yanlis1", "confirm": "SİL"}, pt)
    check("silme: yanlış şifre 400 password_invalid", s == 400 and code_of(b) == "password_invalid", (s, b))
    s, b = req("POST", "/account/delete", {"confirm": "SİL"}, pt)
    check("silme: şifresiz 400 password_invalid", s == 400 and code_of(b) == "password_invalid", (s, b))
    s, d = req("GET", f"/days/{day}", token=pt)
    check("reddedilen isteklerden sonra veri duruyor", s == 200 and len(d["studyEntries"]) >= 2, s)
    s, _ = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    check("başarılı girişte hatalı deneme sayacı sıfırlanır", s == 200, s)

    rows_before = account_rows(user_id, family_id, member_ids, entry_ids, event_ids)
    if rows_before["Users"] is not None:
        check("silmeden önce satırlar var (bildirim kuyruğu ve abonelik dahil)",
              all(rows_before[k] > 0 for k in ["Users", "Families", "FamilyMembers", "Days", "StudyEntries", "Events", "Subjects", "RefreshTokens",
                                               "EventSeries", "EventSeriesExceptions"])
              and (fake is None or (rows_before["PushSubscriptions"] > 0 and rows_before["PendingNotifications"] > 0
                                    and rows_before["NotificationPreferences"] > 0)), rows_before)
    anne_pushes = len(fake.to("del-anne")) if fake else 0

    s, b = req("POST", "/account/delete", {"password": "sifre123", "confirm": "  SİL "}, pt)
    check("hesap sahibi siler (204; baştaki/sondaki boşluk kırpılır)", s == 204, (s, b))
    for name, tok in [("silen cihaz", pt), ("diğer cihaz (sahip)", other_device["token"]), ("çocuk cihazı", ct["token"]), ("profilsiz oturum", noprof["token"])]:
        s, _ = req("GET", "/auth/me", token=tok)
        check(f"silme sonrası {name}: erişim belirteci 401", s == 401, s)
    s, _ = req("GET", f"/days/{day}", token=other_device["token"])
    check("silme sonrası plan isteği 401", s == 401, s)
    s, r = req("POST", "/auth/refresh", {"refreshToken": other_device["refreshToken"]})
    check("silme sonrası yenileme reddedilir", s == 401 and code_of(r) == "refresh_invalid", (s, r))
    s, b = req("POST", "/account/delete", body, other_device["token"])
    check("silme sonrası tekrar silme 401", s == 401, s)
    s1, b1 = req("POST", "/auth/login", {"email": email, "password": "sifre123"})
    s2, b2 = req("POST", "/auth/login", {"email": new_email("yok"), "password": "sifre123"})
    check("silinen e-postayla giriş: olmayan hesapla aynı hata", s1 == s2 == 401 and b1 == b2, (s1, b1, s2, b2))

    rows_after = account_rows(user_id, family_id, member_ids, entry_ids, event_ids)
    if rows_after["Users"] is not None:
        left = {k: v for k, v in rows_after.items() if v != 0}
        check("veritabanı: silinen hesaba/aileye ait satır kalmadı (tablo bazında 0)", left == {}, left)
        o_after = account_rows(o_me["userId"], o_own["family"]["id"], [o_own["profile"]["id"]], [oe["id"]], [])
        check("veritabanı: başka ailenin satırları aynen duruyor", o_after == other_rows_before, (other_rows_before, o_after))
        check("veritabanı: Data Protection anahtarları korunuyor", db_count('SELECT count(*) FROM "DataProtectionKeys"') == dpk_before)
    else:
        print("  -- tablo sayımı atlandı (--psql verilmedi)")
    if fake:
        time.sleep(3)
        check("silinen ailenin bekleyen bildirimi gönderilmedi", len(fake.to("del-anne")) == anne_pushes, len(fake.to("del-anne")))
        fake.server.shutdown()

    s, o_after = req("GET", f"/days/{day}", token=ot)
    check("başka ailenin planı aynen duruyor", s == 200 and o_after == o_before, (s, o_after))
    s, o_subj = req("GET", "/subjects", token=ot)
    check("başka ailenin ders listesi aynen duruyor", s == 200 and o_subj == o_subj_before, s)

    # Aynı e-postayla yeniden kayıt: yeni, boş hesap
    before = len(emails_to(email))
    s, b = req("POST", "/auth/register", {"email": email, "password": "yeniSifre7", "displayName": "Yeni"})
    check("aynı e-postayla yeniden kayıt 200", s == 200, (s, b))
    mails = wait_email(email, before + 1)
    p = link_params(mails[-1], "verify-email") if len(mails) > before else None
    check("yeniden kayıtta doğrulama e-postası gitti", p is not None and p["userId"] != user_id, p)
    s, _ = req("POST", "/auth/verify-email", {"userId": p["userId"], "token": p["token"]}) if p else (0, None)
    check("yeniden kayıt doğrulandı", s == 200, s)
    s, na = req("POST", "/auth/login", {"email": email, "password": "yeniSifre7"})
    check("yeni hesapla giriş, ailesi yok", s == 200 and na.get("family") is None and na.get("profile") is None, (s, na))
    s, b = req("GET", f"/days/{day}", token=na["token"])
    check("yeni hesap: 403 family_required", s == 403 and code_of(b) == "family_required", (s, b))
    s, nf = req("POST", "/family", {"name": "Yeni Aile", "profileName": "Yeni", "refreshToken": na["refreshToken"]}, na["token"])
    s, d = req("GET", f"/days/{day}", token=nf["token"])
    check("yeni hesap eski planı görmüyor", s == 200 and d["studyEntries"] == [] and d["events"] == [], d)
    s, b = req("DELETE", f"/days/{day}/entries/{e1['id']}", token=nf["token"])
    check("eski kayda erişim 404", s == 404, (s, b))
    s, b = select(nf, kid["id"])
    check("eski profile erişim 404", s == 404, (s, b))

    # Ailesi olan hesap (profil seçmeden de ailesizken) ve doğrulanmamış hesap da kendini silebilir
    s, b = req("POST", "/account/delete", {"password": "yeniSifre7", "confirm": "SİL"}, nf["token"])
    check("PIN'siz tek profilli aile sahibi siler", s == 204, (s, b))
    solo_email, solo = register_and_verify("Ailesiz")
    s, b = req("POST", "/account/delete", {"password": "sifre123", "confirm": "SİL"}, solo["token"])
    check("ailesi olmayan hesap siler", s == 204, (s, b))
    u_email = new_email("dogrulanmamis")
    req("POST", "/auth/register", {"email": u_email, "password": "sifre123", "displayName": "Doğrulanmamış"})
    s, ua = req("POST", "/auth/login", {"email": u_email, "password": "sifre123"})
    s, b = req("POST", "/account/delete", {"password": "sifre123", "confirm": "SİL"}, ua["token"])
    check("e-postası doğrulanmamış hesap siler", s == 204, (s, b))
    s, _ = req("POST", "/auth/login", {"email": u_email, "password": "sifre123"})
    check("silinen doğrulanmamış hesapla giriş 401", s == 401, s)

    # Yanlış şifre denemeleri giriş kilidine sayılır
    k_email, k = register_and_verify("SilKilit")
    codes = [req("POST", "/account/delete", {"password": "yanlis", "confirm": "SİL"}, k["token"])[0] for _ in range(5)]
    check("silmede 5 yanlış şifre: 4×400 + 429", codes == [400, 400, 400, 400, 429], codes)
    s, b = req("POST", "/account/delete", {"password": "sifre123", "confirm": "SİL"}, k["token"])
    check("kilitliyken doğru şifreyle de silinmez (429 locked_out)", s == 429 and code_of(b) == "locked_out", (s, b))
    s, b = req("POST", "/auth/login", {"email": k_email, "password": "sifre123"})
    check("kilit girişte de geçerli", s == 429, (s, b))


def main():
    global API, EMAILS
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:5102/api")
    ap.add_argument("--emails", required=True, help="API'nin Email:OutputDirectory klasörü")
    ap.add_argument("--psql", default="", help='isteğe bağlı: test veritabanına psql komutu, örn. "psql -d plantobee_e2e" '
                    "(hesap silmede tablo bazında satır sayımı)")
    a = ap.parse_args()
    API, EMAILS = a.api.rstrip("/"), a.emails
    global PSQL
    PSQL = shlex.split(a.psql)

    try:
        urllib.request.urlopen(API.rsplit("/api", 1)[0] + "/health", timeout=10)
    except Exception as e:  # noqa: BLE001
        print(f"API'ye ulaşılamadı: {e}")
        return 1

    for t in (test_register_privacy, test_login_lockout_parity, test_refresh_tokens, test_profiles_and_plan, test_solo_family, test_events_and_training, test_event_end_time, test_study_start_time, test_series, test_push, test_account_delete):
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
