import { formatDuration } from './format';
import { eventLabel, isTraining, kindInfo } from './events';

// Saat çizelgesi ortak hesabı (Görev 09). Gün çizelgesi (Timeline) ve Hafta ızgarası (WeekSheet) aynı kuralları kullanır:
// pencere 07:00–22:00; bitiş = endTime ?? derivedEndTime; ikisi de yoksa 60 dk ("süre belirsiz");
// bitiş < başlangıç ise gece yarısını aşar (gün sonunda kesilir); boşluklar yalnızca pencere içinde hesaplanır.
// Saf işlevler: React'e bağımlı değil (React Native'e aynen taşınabilir).

export const WS = 7 * 60;   // 07:00
export const WE = 22 * 60;  // 22:00
export const NO_END_MIN = 60;
export const GAP_LABEL_MIN = 60; // 1 saatten kısa boşluk etiketlenmez

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "09:30" → 570; SS:dd değilse (boş ya da eski serbest metin) null
export function toMin(t) {
  const m = HM.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const pad = (n) => String(n).padStart(2, '0');
// 570 → "09:30" (24 saatte sarar; 1320 → "22:00", 1440 → "00:00")
export const hm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
// Hafta metni: tam saatte "07", değilse "17:30"
export const hShort = (m) => (m % 60 === 0 ? pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) : hm(m));

// Ekran okuyucu için uzun süre: "4 saat", "1 saat 30 dakika", "30 dakika"
export function durationLong(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} dakika`;
  if (m === 0) return `${h} saat`;
  return `${h} saat ${m} dakika`;
}

// Kaydın görünen bitişi (gerçek ya da eski süreden türetilmiş); yoksa null
export const endOf = (ev) => ev.endTime || ev.derivedEndTime || null;

// Tek kayıt: { ev, S, E, noEnd, night } (saatsizse null). E gece aşımında 1440'tan büyüktür.
export function span(ev) {
  const S = toMin(ev.time);
  if (S == null) return null;
  const e = toMin(endOf(ev));
  const noEnd = e == null || e === S;
  let E = noEnd ? S + NO_END_MIN : e;
  let night = false;
  if (E < S) { E += 1440; night = true; }
  return { ev, S, E, noEnd, night, start: hm(S), end: noEnd ? null : hm(e) };
}

// Günün kayıtlarını sınıflar: saatsiz / 07:00 öncesi / 22:00 sonrası / pencere içi (cs–ce kesilmiş).
// Pencere içi kayıtlar cs'ye göre sıralı (eşitse uzun olan önce).
export function classify(events) {
  const untimed = [], before = [], after = [], inw = [];
  for (const ev of events) {
    const r = span(ev);
    if (!r) { untimed.push(ev); continue; }
    if (r.E <= WS) before.push(r);
    else if (r.S >= WE) after.push(r);
    else inw.push({ ...r, cs: Math.max(r.S, WS), ce: Math.min(r.E, WE), cutTop: r.S < WS, cutBot: r.E > WE });
  }
  inw.sort((a, b) => a.cs - b.cs || b.ce - a.ce);
  return { untimed, before, after, inw };
}

// Pencere içi boşluklar [a, b] (kayıtların birleşiminin tümleyeni)
export function gaps(inw) {
  const out = [];
  let cur = WS;
  for (const r of inw) {
    if (r.cs > cur) out.push([cur, r.cs]);
    cur = Math.max(cur, r.ce);
  }
  if (cur < WE) out.push([cur, WE]);
  return out;
}

export const freeMinutes = (inw) => gaps(inw).reduce((s, [a, b]) => s + b - a, 0);

// Kart başlığı özeti: "9 sa 30 dk boş" / "tüm gün boş"
export function freeSummary(events) {
  const { inw } = classify(events);
  if (!inw.length) return 'tüm gün boş';
  const f = freeMinutes(inw);
  return f > 0 ? `${formatDuration(f)} boş` : 'boş saat yok';
}

// Zaman örtüşmesine göre kümeler (uç uca kayıtlar ayrı küme)
export function clusters(inw) {
  const cl = [];
  for (const r of inw) {
    const last = cl[cl.length - 1];
    if (last && r.cs < last.end) { last.items.push(r); last.end = Math.max(last.end, r.ce); }
    else cl.push({ start: r.cs, end: r.ce, items: [r] });
  }
  return cl;
}

// Blok saat metni. level 1: "09:00–13:00 · 4 sa", 2: "09:00–13:00", 3: "09:00"
export function timeText(r, level = 1) {
  if (r.noEnd) return level < 3 ? `${r.start} · süre belirsiz` : r.start;
  if (level === 3) return r.start + (r.night ? '↷' : '');
  const rng = `${r.start}–${r.end}`;
  if (level === 2) return r.night ? `${rng} ↷` : rng;
  if (r.night) return `${rng} ↷ ertesi gün`;
  return `${rng} · ${formatDuration(r.E - r.S)}`;
}

// Kısa aralık metni (pencere dışı satırları, form, şerit): "09:00–13:00" / "15:00"
export const rangeText = (r) => (r.noEnd ? r.start : `${r.start}–${r.end}`);

// Ekran okuyucu: "Kurs, 09:00–13:00, 4 saat" / "Okul konseri, 15:00, süre belirsiz" / "Sinema, 21:00–00:30, ertesi gün biter"
export function ariaEvent(r) {
  const name = eventLabel(r.ev);
  if (r.noEnd) return `${name}, ${r.start}, süre belirsiz`;
  const rng = `${r.start}–${r.end}`;
  if (r.night) return `${name}, ${rng}, ertesi gün biter`;
  return `${name}, ${rng}, ${durationLong(r.E - r.S)}`;
}

export const kindClass = (ev) => (isTraining(ev) ? 'sport' : 'evt');

// ---------- Gün çizelgesi yerleşimi ----------
export const K = 32 / 60;     // px/dk (32 px/saat)
export const MIN_BLOCK = 44;  // en az blok yüksekliği (dokunma alanı)
export const GAP_MIN_H = 48;
export const GAP_MAX_H = 96;  // 3 saatten uzun boşluk sıkıştırılır
const LIST_ROW = 44, LIST_HEAD = 30;

// Çizelge yerleşimi: kümeler ve boşluklar üst üste dizilir (eksen doğrusal değil).
// Dönen: { items: [{ type: 'gap'|'blk'|'list', top, height, ... }], labels: [{ y, text, now }], breaks: [y],
//          nowY, height }. items kronolojik sıradadır (DOM sırası = okuma sırası).
export function layoutDay(inw, nowMin = null) {
  const items = [], labels = [], breaks = [];
  let y = 0, nowY = null;
  let cur = WS;
  const segs = [];
  for (const c of clusters(inw)) {
    if (c.start > cur) segs.push({ gap: [cur, c.start] });
    segs.push({ c });
    cur = c.end;
  }
  if (cur < WE) segs.push({ gap: [cur, WE] });

  for (const sg of segs) {
    if (sg.gap) {
      const [a, b] = sg.gap, d = b - a;
      const labeled = d >= GAP_LABEL_MIN;
      const h = labeled ? Math.min(Math.max(d * K, GAP_MIN_H), GAP_MAX_H) : d * K;
      if (labeled) {
        items.push({ type: 'gap', key: `g${a}`, top: y, height: h, a, b, d });
        if (d * K > GAP_MAX_H) breaks.push(y + h / 2);
      }
      labels.push({ y, text: hm(a), p: 1 });
      if (nowMin != null && nowMin >= a && nowMin < b) nowY = y + ((nowMin - a) / d) * h;
      y += h;
      continue;
    }
    const c = sg.c, cs = c.start;
    // Sütun ataması piksel kapsamına göre (en az 44 px bloklar da üst üste binmesin)
    const lanes = [];
    const placed = c.items.map((r) => {
      const ry = (r.cs - cs) * K, rh = Math.max(MIN_BLOCK, (r.ce - r.cs) * K);
      let lane = lanes.findIndex((bot) => bot <= ry + 0.5);
      if (lane < 0) { lane = lanes.length; lanes.push(ry + rh); } else lanes[lane] = ry + rh;
      return { r, ry, rh, lane };
    });
    const n = lanes.length;
    let H;
    if (n >= 4) {
      // 4+ yan yana okunmaz: liste kümesi
      H = LIST_HEAD + LIST_ROW * c.items.length + 6;
      items.push({ type: 'list', key: `l${c.items[0].ev.id}`, top: y, height: H, a: cs, b: c.end, rows: c.items });
    } else {
      H = Math.max(...lanes);
      for (const p of placed) {
        items.push({ type: 'blk', key: `e${p.r.ev.id}`, top: y + p.ry, height: p.rh, lane: p.lane, n, r: p.r });
      }
    }
    labels.push({ y, text: hm(cs), p: 1 });
    if (n < 4) {
      for (let hh = (Math.floor(cs / 60) + 1) * 60; hh < c.end; hh += 60) labels.push({ y: y + (hh - cs) * K, text: hm(hh), p: 2 });
    }
    if (nowMin != null && nowMin >= cs && nowMin < c.end) {
      nowY = n >= 4 ? y + ((nowMin - cs) / (c.end - cs)) * H : y + (nowMin - cs) * K;
    }
    y += H;
  }
  labels.push({ y, text: '22:00', p: 1 });

  // Eksen etiketleri: şu an > bölüm sınırı > tam saat; tutulan bir etikete 14 px'ten yakın olan çizilmez
  const keep = [];
  if (nowY != null) keep.push({ y: nowY, text: hm(nowMin), now: true });
  for (const l of [...labels].sort((a, b) => a.p - b.p || a.y - b.y)) {
    if (keep.every((k) => Math.abs(l.y - k.y) >= 14)) keep.push(l);
  }
  return { items, labels: keep, breaks, nowY, height: y };
}

// ---------- Hafta ızgarası ----------
export const WG_PX = 20 / 60; // 20 px/saat, sıkıştırma yok
export const WG_HEIGHT = (WE - WS) * WG_PX; // 300 px

// Bir gün sütunu: bloklar (top/height px, lane/n), boşluklar, şerit işaretleri
export function weekColumn(events) {
  const { untimed, before, after, inw } = classify(events);
  const blocks = [];
  for (const c of clusters(inw)) {
    const lanes = [];
    const placed = c.items.map((r) => {
      let lane = lanes.findIndex((e) => e <= r.cs);
      if (lane < 0) { lane = lanes.length; lanes.push(r.ce); } else lanes[lane] = r.ce;
      return { r, lane };
    });
    for (const p of placed) {
      blocks.push({ r: p.r, lane: p.lane, n: lanes.length, top: (p.r.cs - WS) * WG_PX, height: Math.max(8, (p.r.ce - p.r.cs) * WG_PX) });
    }
  }
  return {
    untimed, before, after, inw, blocks,
    gaps: gaps(inw),
    night: inw.some((r) => r.night && r.cutBot),
  };
}

// "Pazar 11 Ekim, bugün. Kurs 09:00–13:00; Veteriner randevusu, saati yok. Boş: 07:00–09:00, 13:00–20:00. Günü aç"
export function weekColumnLabel(head, col) {
  const evs = [
    ...col.before.map((r) => `${ariaShort(r)}, 07:00 öncesi`),
    ...col.inw.map((r) => ariaShort(r)),
    ...col.after.map((r) => `${ariaShort(r)}, 22:00 sonrası`),
    ...col.untimed.map((ev) => `${eventLabel(ev)}, saati yok`),
  ];
  const free = col.gaps.filter(([a, b]) => b - a >= GAP_LABEL_MIN).map(([a, b]) => `${hm(a)}–${hm(b)}`);
  return `${head}. ${evs.length ? evs.join('; ') : 'Aktivite yok'}. Boş: ${free.length ? free.join(', ') : 'yok'}. Günü aç`;
}

function ariaShort(r) {
  const name = eventLabel(r.ev);
  if (r.noEnd) return `${name} ${r.start}, süre belirsiz`;
  return `${name} ${r.start}–${r.end}${r.night ? ', ertesi gün biter' : ''}`;
}

// En uzun boşluğu en büyük 3 gün: [{ label: "Cum", a, b }]; hiç pencere içi kayıt yoksa null
export function longestGaps(cols, shortNames) {
  if (!cols.some((c) => c.inw.length)) return null;
  const list = [];
  cols.forEach((c, i) => {
    if (!c.gaps.length) return;
    const g = c.gaps.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
    list.push({ d: g[1] - g[0], i, a: g[0], b: g[1] });
  });
  list.sort((x, y) => y.d - x.d || x.i - y.i);
  return list.slice(0, 3).map((x) => `${shortNames[x.i]} ${hShort(x.a)}–${hShort(x.b)}`);
}

// ---------- Form yardımcıları ----------
// Formdaki aralıkla çakışan diğer kayıtlar (saatsizler ve excludeId hariç), başlangıca göre sıralı
export function overlapping(events, time, endTime, excludeId) {
  const r = span({ time, endTime });
  if (!r) return [];
  return events
    .filter((ev) => ev.id !== excludeId)
    .map(span)
    .filter((o) => o && o.S < r.E && r.S < o.E)
    .sort((a, b) => a.S - b.S);
}

// Çakışma uyarısı: "20:00 Antrenman ile çakışıyor." / "20:00 Antrenman ve 1 aktivite daha ile çakışıyor."
export function overlapText(list) {
  if (!list.length) return '';
  const first = `${list[0].start} ${eventLabel(list[0].ev)}`;
  return list.length === 1 ? `${first} ile çakışıyor.` : `${first} ve ${list.length - 1} aktivite daha ile çakışıyor.`;
}

// başlangıç + süre (24 saatte sarar)
export const addMinutes = (t, mins) => { const s = toMin(t); return s == null ? '' : hm(s + mins); };

export const iconOf = (ev) => kindInfo(ev.kind).icon;
