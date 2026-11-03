// Program yükleme (Görev 15): Excel (.xlsx) ve CSV dosyasını cihazda tabloya (satır × hücre metni) çevirir.
// Paket kullanılmaz: .xlsx bir zip arşividir; tarayıcının DecompressionStream('deflate-raw') ile açılır, XML'i DOMParser okur.
// Dosya sunucuya gönderilmez.
// readSheetFile(file) → string[][] (boş satırlar atılır, hücreler kırpılır). Excel saat değeri (gün kesri) "SS:dd" olur.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB: bir ders programı bunun çok altındadır

export class SheetFileError extends Error {}

export async function readSheetFile(file) {
  if (file.size > MAX_BYTES) throw new SheetFileError('Dosya çok büyük (en fazla 5 MB).');
  const buf = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLocaleLowerCase('tr');
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (isZip) return clean(await readXlsx(buf));
  if (name.endsWith('.xls')) throw new SheetFileError('Eski Excel biçimi (.xls) okunamıyor. Excel\'de "Farklı Kaydet → .xlsx" ile kaydedip yeniden dene.');
  if (name.endsWith('.xlsx')) throw new SheetFileError('Dosya açılamadı. Bozuk ya da şifreli olabilir.');
  return clean(parseCsv(decodeText(buf)));
}

function clean(rows) {
  return rows
    .map((r) => r.map((c) => (c == null ? '' : String(c).replace(/ /g, ' ').trim())))
    .filter((r) => r.some((c) => c));
}

// ---------- CSV ----------

// UTF-8 (BOM'lu ya da değil); geçersizse Türkçe Windows kodlaması (Excel'in "CSV" kaydı) denenir.
function decodeText(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1254').decode(buf);
  }
}

// Ayırıcı ilk satırdan seçilir: Türkçe Excel ";" kaydeder; "," ve sekme de olur. Tırnaklı alanlar ve "" kaçışı desteklenir.
export function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch) => first.split(ch).length - 1;
  const sep = [';', '\t', ','].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ';');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- Zip ----------

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// Merkezi dizinden dosya adı → { method, offset, size } haritası
function zipEntries(b) {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i -= 1) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new SheetFileError('Dosya açılamadı. Bozuk ya da şifreli olabilir.');
  const total = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const map = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < total && u32(b, p) === 0x02014b50; n += 1) {
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    map.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return map;
}

async function zipText(b, entries, name) {
  const e = entries.get(name);
  if (!e) return null;
  const start = e.local + 30 + u16(b, e.local + 26) + u16(b, e.local + 28);
  const data = b.subarray(start, start + e.size);
  let out;
  if (e.method === 0) out = data;
  else if (e.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new SheetFileError('Bu tarayıcı Excel dosyasını açamıyor. Dosyayı CSV olarak kaydedip yükle.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    out = new Uint8Array(await new Response(stream).arrayBuffer());
  } else throw new SheetFileError('Dosya açılamadı (desteklenmeyen sıkıştırma).');
  return new TextDecoder().decode(out);
}

// ---------- xlsx ----------

const xml = (text) => new DOMParser().parseFromString(text, 'application/xml');
const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)];

// "B12" → { col: 1, row: 11 }
function ref(r) {
  const m = /^([A-Z]+)(\d+)$/.exec(r ?? '');
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
  return { col: col - 1, row: Number(m[2]) - 1 };
}

const pad = (n) => String(n).padStart(2, '0');
// Excel saat değeri gün kesridir (0,354166 = 08:30). Tarih + saat (45231,354) de olabilir: kesirli kısım saattir.
export function excelTime(v) {
  const frac = v - Math.floor(v);
  const mins = Math.round(frac * 24 * 60) % (24 * 60);
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

async function readXlsx(b) {
  const entries = zipEntries(b);
  const wb = await zipText(b, entries, 'xl/workbook.xml');
  if (!wb) throw new SheetFileError('Bu dosya bir Excel çalışma kitabı değil.');
  // İlk sayfa (sekme sırasıyla). Hedef yolu ilişkiler dosyasından bulunur; yoksa sheet1.xml.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const firstSheet = tags(xml(wb), 'sheet')[0];
  const rid = firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    ?? firstSheet?.getAttribute('r:id');
  const rels = await zipText(b, entries, 'xl/_rels/workbook.xml.rels');
  if (rid && rels) {
    const target = tags(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sheet = await zipText(b, entries, sheetPath);
  if (!sheet) throw new SheetFileError('Excel dosyasında sayfa bulunamadı.');

  const sharedText = await zipText(b, entries, 'xl/sharedStrings.xml');
  // Paylaşılan metin: <si> içindeki bütün <t>'ler (zengin metin parçaları); okunuş (rPh) hariç
  const shared = sharedText ? tags(xml(sharedText), 'si').map((si) =>
    tags(si, 't').filter((t) => t.parentNode?.localName !== 'rPh').map((t) => t.textContent).join('')) : [];

  // Saat biçimli hücreler: stil numarası → biçim kodu saat içeriyor mu
  const timeStyles = new Set();
  const stylesText = await zipText(b, entries, 'xl/styles.xml');
  if (stylesText) {
    const st = xml(stylesText);
    const custom = new Map(tags(st, 'numFmt').map((f) => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '']));
    const isTimeFmt = (id) => (id >= 18 && id <= 21) || id === 45 || id === 46 || id === 47
      || /h/i.test((custom.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, ''));
    const xfs = tags(st, 'cellXfs')[0];
    if (xfs) tags(xfs, 'xf').forEach((xf, i) => { if (isTimeFmt(Number(xf.getAttribute('numFmtId')))) timeStyles.add(i); });
  }

  const doc = xml(sheet);
  const grid = [];
  for (const c of tags(doc, 'c')) {
    const pos = ref(c.getAttribute('r'));
    if (!pos || pos.row > 400 || pos.col > 40) continue;
    const t = c.getAttribute('t');
    const v = tags(c, 'v')[0]?.textContent ?? '';
    let value;
    if (t === 's') value = shared[Number(v)] ?? '';
    else if (t === 'inlineStr') value = tags(c, 't').map((x) => x.textContent).join('');
    else if (t === 'str' || t === 'e') value = v;
    else if (t === 'b') value = v === '1' ? 'DOĞRU' : 'YANLIŞ';
    else if (v !== '') {
      const n = Number(v);
      value = timeStyles.has(Number(c.getAttribute('s'))) && !Number.isNaN(n) ? excelTime(n) : v;
    } else value = '';
    (grid[pos.row] ??= [])[pos.col] = value;
  }
  // Birleştirilmiş hücreler (ör. iki ders saatine yayılan "Matematik") ilk hücrenin değeriyle doldurulur
  for (const mc of tags(doc, 'mergeCell')) {
    const [a, z] = (mc.getAttribute('ref') ?? '').split(':').map(ref);
    if (!a || !z || z.row - a.row > 50 || z.col - a.col > 20) continue;
    const value = grid[a.row]?.[a.col] ?? '';
    for (let r = a.row; r <= z.row; r += 1) for (let col = a.col; col <= z.col; col += 1) (grid[r] ??= [])[col] = value;
  }
  return Array.from(grid, (r) => Array.from(r ?? [], (x) => x ?? ''));
}
