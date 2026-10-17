# Görev 11: Tekrarlayan aktiviteler ve Okul türü

Önceki görev: `docs/tasks/10-bee-todo-plan.md`.

Durum: Ürün: Tamamlandı · Tasarım: Tamamlandı · Backend: Tamamlandı · Frontend: Tamamlandı · QA: Ana oturum (e2e 336/336, yerel UAT kullanıcı onayı 17.10)

## Özet

Kullanıcı: "Haftalık tekrarlayan planlar için tekrarlayan işleri sonraki aylara yayacak bir kurgu. Örneğin hazirana kadar
her gün okul var ve bunu Bee'de takvim planında görmek istiyorum. Bir plan girdiğimde tekrarlıyorsa, istediğim zamana kadar
aynı gün ve saat için tekrarladığını belirtebilmeliyim."

## Kararlar (kullanıcı)
1. Yalnızca **aktiviteler** tekrarlanabilir (dersler tekrarlanmaz).
2. Tek bir günü değiştirme/silme seçenekleri ("Yalnızca bu gün" / "Tüm tekrarlar") önizlemede gösterilip onaylanacak.
3. Durumlar gün bazında ayrı tutulur (aktivitelerde durum yok; ileride gerekirse gün bazında).
4. Yeni aktivite türü: **🏫 Okul** (`School`). Tür sırası: Spor, Müzik, Konser, Buluşma, Sınav, Okul, Diğer (tasarım kesinleştirir).

## Varsayılanlar (ana oturum; kullanıcı değiştirebilir)
- Tekrar = haftalık, seçilen günlerde (Pzt–Paz çoklu seçim; "Hafta içi" kısayolu), aynı başlangıç–bitiş saati.
- Bitiş tarihi zorunlu; en fazla başlangıçtan 1 yıl sonrası. Başlangıç tarihi = kaydın eklendiği gün.
- Saklama: **tek tekrar kuralı** (seri) + istisnalar; kayıtlar günlere okumada yayılır (180 ayrı satır üretilmez).
- "Yalnızca bu gün" düzenleme: o gün seriden ayrılır (o tarih için istisna + o güne normal aktivite oluşur).
- "Yalnızca bu gün" silme: o tarih için istisna (atlanır). "Tüm tekrarlar" silme: seri silinir (geçmiş günler dahil).
- "Tüm tekrarlar" düzenleme: kuralın kendisi değişir (ad, saat, günler, bitiş tarihi); ayrılmış günler etkilenmez.
- Yetki: Görev 10'daki kurallar (ebeveyn hepsini, çocuk yalnızca kendi eklediği seriyi düzenler/siler).
- Bildirim: seri eklenince tek bildirim ("Ela tekrarlayan aktivite ekledi: 🏫 Okul · Pzt–Cum 08:00–15:00 · 15 Haz'a kadar");
  seri düzenleme/silme "Değişiklik ve silme" ayarına bağlı; her gün için ayrı bildirim GİTMEZ.
- Bee, Plan listesi, Hafta ızgarası, hafta şeridi ikonları ve boşluk hesabı tekrarlanan günleri normal aktivite gibi gösterir;
  tekrar eden kayıtta küçük "↻" işareti.

## Kullanıcı onayı (17.10)
- ⋯ menüsü: **A** (tek menü, 4 seçenek gruplu; önizleme /tmp/ptb-ux-preview/71-menu.png). Alt metinler:
  "20 Ekim'i düzenle" — Sadece bugünün saatini ya da adını değiştir · "20 Ekim'i sil" — Bugün yok; diğer günler aynen kalır ·
  "Tüm Okul tekrarlarını düzenle" — Her güne uygulanır · "Bugünden itibaren tüm Okul tekrarlarını sil" — Geçmiş günler kalır; bugün ve sonrası kalkar.
- "Tüm tekrarları sil" = bugün ve sonrası: `DELETE /api/series/{id}?from=<bugün>` (Backend Çıktısı'na bakın).

## Kabul kriterleri
1. Aktivite formunda "Tekrarla" seçeneği: günler (çoklu), "Hafta içi" kısayolu, bitiş tarihi; başlangıç saati olmadan da tekrar
   eklenebilir (saatsiz tekrar → her gün "Saati yok" şeridinde).
2. Örnek: bugünden 15.06.2027'ye kadar Pzt–Cum 08:00–15:00 Okul → her hafta içi günü Bee'de 08:00–15:00 bloğu ve "↻";
   hafta sonu yok; 15.06.2027 sonrasında yok; boşluk hesabı Okul'u sayar.
3. Hafta ızgarası ve hafta şeridi tekrarlanan günleri gösterir; ⋯ menüsünde "Yalnızca bu gün" ve "Tüm tekrarlar" seçenekleri.
4. "Yalnızca bu gün" silme o günü kaldırır, diğer günler durur; "Tüm tekrarlar" silme seriyi kaldırır ("Geri al" ile geri alınabilir).
5. "Yalnızca bu gün" düzenleme yalnızca o günü değiştirir; "Tüm tekrarlar" düzenleme ayrılmamış bütün günleri değiştirir.
6. Okul türü formda, Bee'de, Plan'da, Hafta'da 🏫 ikonuyla görünür.
7. Yetki: çocuk başkasının serisini düzenleyemez/silemez (403); başka aile göremez (404).
8. Geçersiz kural reddedilir (400): gün seçilmemiş, bitiş < başlangıç, bitiş > 1 yıl, bitiş saati kuralları (Görev 09).
9. Eski istemci uyumu: seri olmayan aktiviteler aynen çalışır; e2e eski testleri geçer.
10. 360/390 px taşma yok, 44 px dokunma, alanlar 16 px.

## Backend gereksinimleri
- `EventKind.School` (metin olarak saklanır; migration gerekmez ama eski kod okuyamaz → geri dönüş notu).
- Yeni tablolar: `EventSeries` (FamilyId, Kind, Title, Note, Time, EndTime, DaysOfWeek bit maskesi, StartDate, UntilDate,
  audit alanları) ve `EventSeriesExceptions` (SeriesId, Date; benzersiz). Migration yalnızca tablo ekler.
- Gün ve hafta uçları seriyi tarihe yayar; EventDto'ya `seriesId`, `occurrenceDate`, `recurring` (gün/kural özeti) eklenir;
  sanal kayıtların kimliği istemcinin ayırt edebileceği biçimde (öneri: `id = 0`, `seriesId` dolu).
- Uç noktalar (öneri, sözleşmeyi Backend Çıktısı'nda kesinleştir): POST /api/series, PUT /api/series/{id},
  DELETE /api/series/{id}, POST /api/series/{id}/skip {date}, POST /api/series/{id}/detach {date, alanlar}.
- Hafta özeti sayıları, bildirim (yalnızca seri olayları), aile izolasyonu, yetki, e2e senaryoları.

## Frontend gereksinimleri
- Aktivite formunda "Tekrarla" bölümü; ⋯ menüsünde tekrar seçenekleri; "↻" işareti; Okul türü ve ikonu.
- Bee/Plan/Hafta/şerit sanal kayıtları gösterir; anahtarlar `seriesId-date`.

## Geri dönüş
- Migration yalnızca tablo ekler. `School` türünde kayıt varsa eski kod okuyamaz: geri dönüşte önce
  `UPDATE "Events" SET "Kind"='Event' WHERE "Kind"='School'` (DEPLOY.md'ye eklenecek). Canlıya almadan önce Neon yedeği.

## Tasarım
Önizleme: `/tmp/ptb-ux-preview/70-tekrar.png` (repoda değil). Dokunulacak dosyalar: `utils/events.js`, `EventForm.jsx`,
`EntryMenu.jsx`, `Timeline.jsx`, `WeekSheet.jsx`, `index.css`.

**Tür sırası (7 ikon, tek sıra):** 🏅 Spor · 🎵 Müzik · 🎤 Konser · 👥 Buluşma · 📝 Sınav · 🏫 Okul · ✦ Diğer.
- Okul: `{ kind: 'School', icon: '🏫', label: 'Okul', placeholder: 'ör. Okul, Kurs' }`, renk aktivite mercanı (`--event`), yeni renk yok.
- `.evform .acts`: `repeat(7, …)`, `gap: 4px`, düğme yazısı `10px`. 360 px'te düğme ~39 px genişlik, 52 px yükseklik; "Buluşma" sığıyor.

**Aktivite formu, "Tekrarla" (yalnızca aktivitelerde; Ders formunda yok):**
- Konum: özet satırının (`.evsum`) altında, üstte ince çizgi. Satır: "↻ Her hafta tekrarla" + alt satır "Seçtiğin günlerde, aynı saatte";
  sağda mevcut `.switch` (açıkken `.on`). Varsayılan kapalı.
- Açılınca `--surface-2` zeminli kutu (`radius-sm`, 10 px iç boşluk), sırasıyla:
  1. Kısayollar: "Hafta içi" · "Her gün" (hap düğme, 36 px görünür + görünmez katmanla 44 px; seçiliyse sarı zemin).
     Gün seçimi kısayolla birebir eşleşiyorsa kısayol seçili görünür.
  2. Gün dizisi: Pzt Sal Çar Per Cum Cmt Paz; tek parça bölmeli kutu (`grid 7 sütun`, aralıksız, 44 px yükseklik, ~40 px genişlik).
     Seçili gün sarı zemin + altında küçük "✓" (renk tek başına bilgi taşımaz). `role="group" aria-label="Tekrar günleri"`, her düğme `aria-pressed`,
     `aria-label="Pazartesi"` vb. Aralıksız olduğu için yanlış dokunuşta boşluk yok; 44 genişlik 360 px'e sığmıyor, bilinçli istisna.
  3. "Bitiş tarihi" etiketi + `<input type="date">` (16 px, 44 px, `min` = bugün, `max` = bugün + 1 yıl). Varsayılan boş.
  4. Özet (`aria-live="polite"`): "↻ **Pzt–Cum 08:00–15:00** · 15 Haz 2027'ye kadar · 34 hafta". Günler ardışıksa aralık (Pzt–Cum),
     değilse virgüllü (Pzt, Çar, Cum); saat yoksa "saatsiz". Mono yalnızca gün/saat kısmında.
- Hatalar (`.inline-error`): "En az bir gün seç." · "Bitiş tarihini seç." · "Bitiş tarihi en fazla 1 yıl sonrası olabilir."
- Çakışma uyarısı yalnızca bugünün kaydı için gösterilir (seri boyunca hesaplanmaz).

**Gün (Bee) ve Plan listesi:** Tekrarlanan kayıt normal aktivite gibi; adın hemen arkasında `↻` (`.rc`: 12 px, `--ink-soft`,
`aria-label="Her hafta tekrarlanıyor"`). Blok, kısalırsa (`n3`) yine adla birlikte görünür. Ayrılmış gün (detach) `↻` göstermez.

**⋯ menüsü (EntryMenu), tekrarlanan kayıtta:**
- Başlık: "🏫 Okul · 08:00–15:00". Alt satır: "↻ Her hafta Pzt–Cum · 15 Haz 2027'ye kadar · {audit}".
- Grup etiketi (mono, büyük harf, `--ink-soft`): "Yalnızca bu gün · 20 Ekim Salı"
  - "20 Ekim'i düzenle" · "20 Ekim'i sil" (danger)
- Grup etiketi: "Bütün tekrarlar"
  - "Tüm Okul tekrarlarını düzenle" / küçük satır "Pzt–Cum, 15 Haz 2027'ye kadar"
  - "Tüm Okul tekrarlarını sil" (danger) / küçük satır "Geçmiş günler dahil, takvimden kalkar"
- "Vazgeç". Tür adı Okul yerine kaydın adı ("Tüm Yüzme tekrarlarını sil"). Onay penceresi yok; silmeden sonra mevcut "Geri al" bildirimi:
  "20 Ekim silindi." / "Okul tekrarları silindi."
- "20 Ekim'i düzenle": formda Tekrarla bölümü yok; üstte bilgi satırı "Yalnızca 20 Ekim değişir, diğer günler aynı kalır."
- "Tüm … düzenle": Tekrarla bölümü açık ve dolu; düğme "Tüm tekrarları kaydet". Bilgi satırı: "Ayrı düzenlediğin günler değişmez."
- Salt okunur: mevcut `READ_ONLY_EVENT_TEXT`.
- Menü 4 eylem + Vazgeç ile 360 px'te ~470 px; `.menusheet` zaten kaydırılabilir.

**Hafta ızgarası:** Okul bloğu mercan, ikon 🏫 ve saat; blok ≥ 60 px ise saatin altında `↻` (9 px, `--on-accent`). Lejant değişmez.
**Hafta şeridi:** Okul ikonu diğer aktivite ikonları gibi; `↻` yok (yer yok).

## Backend Çıktısı

**Varsayımlar:** Tüm aktivite türleri (Spor dahil) tekrarlanabilir; seride süre (Minutes) tutulmaz. Ayrılan gün normal
`Event` olur ve seriye bağlı değildir: "Tüm tekrarlar" silme ayrılan günleri silmez. Ayrılan günün "ekleyen"i serinin
ekleyenidir (çocuk kendi serisinden ebeveynin ayırdığı günü düzenleyebilir), "düzenleyen" ayıran kişidir.

**Sözleşme.** Hepsi `[Authorize]`, doğrulanmış e-posta, `Api` hız sınırı. Hata gövdesi `{code, message}`.
Ortak: 403 `profile_required`/`family_required`; başka aile ya da yok → 404 `not_found`; yetki yok → 403 `plan_read_only`;
tarih `yyyy-MM-dd`, geçersizse 400 `invalid_date`; alan hataları 400 `validation` (mesaj kullanıcıya gösterilebilir).
Günler ISO: 1 = Pzt … 7 = Paz.

| Uç | Gövde | Cevap |
|---|---|---|
| `POST /api/series` | `{kind, title, time, endTime, note, daysOfWeek:[1..7], startDate, untilDate, exceptions?:[tarih]}` | 200 `SeriesDto` |
| `GET /api/series/{id}` | — | 200 `SeriesDto` |
| `PUT /api/series/{id}` (tüm tekrarlar) | `{title, time, endTime, note, daysOfWeek, untilDate}` (tür ve startDate değişmez; endTime null/"" = yok) | 200 `SeriesDto` |
| `DELETE /api/series/{id}?from=yyyy-AA-gg` (tüm tekrarlar, kullanıcı kararı: bugün ve sonrası) | from = istemcinin bugünü | 200 `{truncated, series}` (series = silmeden önceki hâl). truncated=true: seri from-1'de biter, geçmiş günler kalır; "Geri al" = series alanlarıyla `PUT`. false (seri from'dan önce günü yoksa ya da from yoksa): tamamen silindi; "Geri al" = `POST /api/series` (yeni id) |
| `POST /api/series/{id}/skip` (yalnızca bu gün sil) | `{date}` | 204 (zaten atlanmışsa da 204); tekrar günü değilse 400 `not_occurrence` |
| `POST /api/series/{id}/restore` (bu günü geri al) | `{date}` | 204 (idempotent) |
| `POST /api/series/{id}/detach` (yalnızca bu gün düzenle) | `{date, title, time, endTime, note}` | 200 `EventDto` (yeni normal aktivite, id > 0); 400 `not_occurrence`; zaten ayrılmış/atlanmış 409 `occurrence_gone` |

Doğrulama (400 `validation`): gün yok / 1–7 dışı; `untilDate` yok ya da biçimsiz; `untilDate < startDate`;
`untilDate > startDate + 1 yıl` (tam 1 yıl kabul); seçili günler aralığa hiç düşmüyor; ad boş; saat kuralları tek
aktiviteyle aynı (Görev 09: `time` boş ya da SS:dd, `endTime` yalnızca `time` ile ve ondan farklı; küçükse gece yarısını
aşar); `exceptions` aralık dışında; tanımsız tür.

`SeriesDto`: `{id, kind, title, time, endTime, note, daysOfWeek:[1,2,3,4,5], startDate, untilDate, exceptions:["2026-10-20"],
canEdit, createdBy, createdAt, updatedBy, updatedAt}`.

**Gün/hafta uçları** (`GET /api/days/{date}`, `/week/{monday}/details`) seriyi yayar. `EventDto`'ya üç alan eklendi
(normal kayıtta `null`): `seriesId`, `occurrenceDate`, `recurring: {daysOfWeek, startDate, untilDate}`. Sanal kayıt
`id = 0`; React anahtarı `${seriesId}-${occurrenceDate}`. `canEdit` ve kayıt izleri serinindir; `minutes`, `trainingType`,
`derivedEndTime` null. Sıra: saatliler saate göre (aynı saatte normal kayıt önce), sonra saatsizler. Örnek:

```json
{"id":0,"kind":"School","title":"Okul","time":"08:00","note":"","trainingType":null,"minutes":null,"canEdit":true,
 "createdBy":{"memberId":7,"displayName":"Anne","isFormerMember":false},"createdAt":"…","updatedBy":null,"updatedAt":null,
 "isImported":false,"endTime":"15:00","derivedEndTime":null,"seriesId":12,"occurrenceDate":"2026-10-21",
 "recurring":{"daysOfWeek":[1,2,3,4,5],"startDate":"2026-10-19","untilDate":"2027-06-15"}}
```

Hafta özeti (`/week/{monday}`): tekrarlar `eventCount`'a, spor serileri `trainingCount`/`trainingDone`'a sayılır
(`trainingMinutes`'a eklenmez). `kind: "School"` normal aktivitede de geçerli. Sanal kayıt için `/api/days/.../events/0` → 404.

**Bildirim:** seri ekleme tek bildirim (`ActivityAdded`): "Ela tekrarlayan aktivite ekledi" / "🏫 Okul · Pzt–Cum 08:00–15:00 ·
15 Haziran'a kadar". Seri düzenleme/silme, tek gün silme/ayırma "Değişiklik ve silme" ayarına bağlı; restore bildirim üretmez.
Her tekrar günü için bildirim yok.

**Değişen dosyalar** (backend/PlanToBee.API): `Models/EventSeries.cs` (yeni), `Models/Event.cs` (School),
`Controllers/SeriesController.cs` (yeni), `Controllers/DaysController.cs` (yayma, hafta özeti), `Controllers/AccountController.cs`
(hesap silmede seriler), `Services/SeriesSchedule.cs` (yeni), `Services/PlanWrites.cs` (yeni; `ApplyEvent`, gün oluşturma ve
iz yardımcıları DaysController'dan davranış değişmeden taşındı), `DTOs/SeriesDtos.cs` (yeni), `DTOs/DayDtos.cs`,
`Data/AppDbContext.cs`, `Services/Notifications/NotificationService.cs`, `Migrations/*_EventSeries.cs`; `backend/tests/e2e.py`;
`docs/DEPLOY.md` (6.5).

**Veri modeli / migration `EventSeries`:** yalnızca iki tablo ekler. `EventSeries` (FamilyId → Families cascade, Kind
metin, Title 150, Note 500, Time/EndTime 5, DaysOfWeek bit maskesi Pzt=1…Paz=64, StartDate, UntilDate, iz alanları;
indeks `(FamilyId, UntilDate)`), `EventSeriesExceptions` (SeriesId → cascade, Date; benzersiz `(SeriesId, Date)`).
plantobee_e2e'de Up→Down→Up yapıldı; Events/StudyEntries/Days/FamilyMembers içerik özetleri (md5) değişmedi.

**Doğrulama:** build uyarısız; WebPushSelfTest geçti; `has-pending-model-changes` temiz; e2e 323/323 (push dahil, `--psql` ile
hesap silmede seri tabloları 0).

**Bilinen sınırlamalar:** Aile başına seri sayısı sınırsız (okuma maliyeti seri sayısıyla doğrusal). Tek gün geri alma
(`restore`) ayrılmış günde çağrılırsa o gün hem ayrılan aktivite hem tekrar görünür; istemci yalnızca skip'ten hemen sonra
çağırmalı. "Geri al" ile geri gelen seri yeni id alır ve ekleyeni geri alan kişi olur.

**Canlıya alma:** önce Neon yedeği (branch) ve `rollback-oncesi-tekrar` etiketi; geri dönüşte önce
`UPDATE "Events" SET "Kind"='Event' WHERE "Kind"='School'` (docs/DEPLOY.md 6.5). Site API'den önce çıkarsa `/api/series`
404 ve `School` 400 alır.

## Ek: Tatil ve özel günler (kullanıcı kararı 17.10)
- Kapsam: resmî tatiller (sabit + Ramazan/Kurban Bayramı, arifeler yarım gün), MEB 2026-2027 okul tatilleri (ara tatiller,
  yarıyıl, yaz tatili), özel günler (Anneler/Babalar/Öğretmenler Günü, 10 Kasım, karne günleri). Kaynak: `Services/Holidays.cs`
  (sabit tablo, dış servis yok; bayramlar ve okul takvimi yılda bir elle eklenir — 2028 bayramları ve 2027-28 okul takvimi henüz yok).
- Okul türündeki tekrar, tam gün resmî tatilde ve okul tatilinde **gösterilmez** (hafta özetinde de sayılmaz); arifede görünür.
  Diğer türler ve tek seferlik aktiviteler etkilenmez.
- Görünüm: Bee'de günün üstünde şerit (ör. "🇹🇷 Cumhuriyet Bayramı · Resmî tatil"); hafta şeridinde ve Hafta ızgarasında küçük işaret.
- API (Backend, ana oturum): `DayDto.holidays` ve `WeekSummaryDto.holidays`: `[{name, kind}]`, kind ∈ official | half | school | special;
  sırası official, half, school, special. Boşsa `[]`. e2e 336/336.

## Frontend Çıktısı

**Bileşenler / dosyalar** (frontend/src): yeni `utils/recurrence.js` (sanal kayıt, gün metni "Pzt–Cum", "15 Haz 2027'ye kadar",
"20 Ekim'i", 1 yıl sınırı), `utils/holidays.js`, `components/RepeatMark.jsx` (↻); değişen `utils/events.js` (🏫 Okul, 7 tür),
`utils/timeline.js` (`itemKey`: sanal kayıt `r{seriesId}-{occurrenceDate}`), `EventForm.jsx` ("↻ Her hafta tekrarla": anahtar,
Hafta içi / Her gün, 7 gün dizisi, bitiş tarihi min/max, özet, 3 hata metni; `scope` 'one' | 'all' bilgi satırları ve "Tüm tekrarları
kaydet"), `EntryMenu.jsx` (menü A, 4 seçenek + Vazgeç, salt okunurda yalnızca açıklama), `EventCard.jsx`, `AgendaCard.jsx`,
`AgendaSheet.jsx`, `Timeline.jsx`, `WeekSheet.jsx` (blok ≥ 60 px ise ↻), `WeekTrail.jsx`, `pages/DayPage.jsx`, `index.css`.

**API:** `POST /series` (body.repeat; startDate = seçili gün), `PUT /series/{id}` (Tüm tekrarları düzenle), `POST /series/{id}/detach`
(bu günü düzenle), `POST /series/{id}/skip` (bu günü sil), `DELETE /series/{id}?from=<istemcinin bugünü>`; Geri al: truncated ise
`PUT`, değilse `POST /series` (exceptions dahil). Tatil: `DayDto.holidays` (Bee şeridi; şerit ve ızgara başlığında nokta, aria-label'da ad).

**Tasarımdan sapmalar:** (1) "Yalnızca bu gün sil" istemcide 5 sn bekletilir (mevcut silme akışı gibi); Geri al isteği hiç göndermez,
bu yüzden `restore` kullanılmadı. (2) Menü metinleri bugünkü günde onaylı metin ("Bugün yok…", "bugünün…"), başka günde "Bu gün yok…",
"bu günün…". (3) Tekrar başlangıcı ve tarih `min`'i = formun açık olduğu gün (bugün değil); varsayılan gün = o günün hafta günü.
(4) Dar kapsayıcıda (< 290 px) tür ikonları 4 + 3. (5) Tatil: arife (half) de bal tonunda; yalnızca special gri.

**Doğrulama:** oxlint 15 uyarı (öncekiyle aynı, yeni yok), build temiz. plantobee_e2e + 5095 ile arayüzden: seri ekleme (hata metinleri
dahil), bu günü sil + bekleme sonrası sunucuda yok, bu günü düzenle (id > 0, seriesId null), tüm tekrarları düzenle (ayrılan gün
etkilenmedi), bugünden itibaren sil (geçmiş kaldı) + Geri al, çocukta salt okunur menü. Görüntüler `/tmp/ptb-fe11-shots` (360/390;
29.10.2026 ve 16.11.2026 dahil), yatay taşma yok.

**Bilinen sınırlamalar:** Seri işlemlerinde yalnızca açık gün iyimser güncellenir; hafta şeridi/panel sunucudan tazelenince değişir.
Bitiş tarihi alanı tarayıcının yerel `type="date"` denetimidir (React Native'de tarih seçiciyle değişmeli).
