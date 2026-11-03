// Program yükleme (Görev 15): kâğıttaki programın fotoğrafını cihazda okur (Tesseract.js, Türkçe). Fotoğraf sunucuya gitmez.
// Tesseract yalnızca fotoğraf seçilince yüklenir (ana pakete girmez). Çalışma dosyaları (worker, wasm çekirdek, Türkçe dil
// verisi) kendi sitemizden gelir: vite.config.js bunları node_modules'tan /ocr/ altına koyar; dış CDN'e istek atılmaz.
// Dil verisi ilk kullanımda indirilir (~2 MB) ve tarayıcıda (IndexedDB) saklanır.
//
// readPhoto(file, { onProgress, signal }) → string[][] : kelimeler konumlarına göre satırlara, satırdaki boşluklara göre
// hücrelere ayrılır; sonuç Excel'den okunan tabloyla aynı biçimdedir (utils/importSchedule.parseSchedule).
// Güveni düşük kelimenin hücresi '\u0007' ile işaretlenir (önizlemede "kontrol et" olur).
export const LOW_MARK = '\u0007';
const MAX_SIDE = 2000;

export class PhotoError extends Error {}

// Bölgesel (uyarlanır) eşikleme: her piksel çevresindeki pencerenin ortalamasından %25 koyuysa yazıdır (Bradley). %25:
// defterin açık mavi çizgileri (~%20 koyu) yazı sayılmaz; çizgiyi silerken üstüne oturan harfler bozulmaz.
// Telefon fotoğrafında yandan gelen gölge ve sarı ışık tek eşikle yazıyı siler ya da kâğıdı karartır (Görev 15e).
// g: gri tonlar (0-255) → koyu maske (1 = yazı/çizgi).
export function adaptiveDark(g, w, h, t = 0.25) {
  const win = Math.max(15, Math.round(Math.max(w, h) / 16)) | 1;
  const r = win >> 1;
  const W = w + 1;
  const ii = new Uint32Array(W * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += g[y * w + x];
      ii[(y + 1) * W + x + 1] = ii[y * W + x + 1] + row;
    }
  }
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0];
      const mean = sum / ((y1 - y0) * (x1 - x0));
      dark[y * w + x] = g[y * w + x] < mean * (1 - t) ? 1 : 0;
    }
  }
  return dark;
}

// Tablo çizgilerini siler: yatayda ya da dikeyde uzun (genişliğin/yüksekliğin %4'ü, en az 50 px) kesintisiz koyu
// pikseller çizgidir, harf değildir. Eğik fotoğrafta çizgi satır atlar: koşu ararken bir alt/üst satır da sayılır
// (komşu satıra kayan çizgi kopmaz), silinen yalnızca gerçekten koyu pikseller (1 px payla). Kalın kenarlı tabloda
// Tesseract'ın sayfa bölümlemesi çizgiler yüzünden hücreleri kaçırıyordu (Görev 15e). dark yerinde değişir.
export function removeLines(dark, w, h) {
  const minH = Math.max(50, Math.round(w * 0.04)), minV = Math.max(50, Math.round(h * 0.04));
  const line = new Uint8Array(w * h);
  const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? dark[y * w + x] : 0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w;) {
      const on = (k) => at(k, y) || at(k, y - 1) || at(k, y + 1);
      if (!on(x)) { x += 1; continue; }
      let e = x;
      while (e < w && on(e)) e += 1;
      if (e - x >= minH) for (let k = x; k < e; k += 1) line[y * w + k] = 1;
      x = e;
    }
  }
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < h;) {
      const on = (k) => at(x, k) || at(x - 1, k) || at(x + 1, k);
      if (!on(y)) { y += 1; continue; }
      let e = y;
      while (e < h && on(e)) e += 1;
      if (e - y >= minV) for (let k = y; k < e; k += 1) line[k * w + x] = 1;
      y = e;
    }
  }
  let removed = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (!dark[i]) continue;
      if (line[i] || (x > 0 && line[i - 1]) || (x < w - 1 && line[i + 1]) || (y > 0 && line[i - w]) || (y < h - 1 && line[i + w])) {
        dark[i] = 0;
        removed += 1;
      }
    }
  }
  return removed;
}

// Fotoğraf küçültülür, griye çevrilir, bölgesel eşikle siyah-beyaz yapılır ve tablo çizgileri silinir (EXIF yönü
// uygulanır). Eğiklik Tesseract'ta düzeltilir (rotateAuto).
async function prepare(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('Fotoğraf açılamadı. JPG ya da PNG bir fotoğraf seç.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const g = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) g[p] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  const dark = adaptiveDark(g, w, h);
  removeLines(dark, w, h);
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) d[i] = d[i + 1] = d[i + 2] = dark[p] ? 0 : 255;
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const ocrBase = () => new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;

// Tesseract satırları → tablo satırları → hücreler. Tesseract eğik fotoğrafta da satırı doğru bulur, ama tablo hücrelerini
// ayrı satır olarak verebilir: dikeyde çoğunlukla örtüşen ve yatayda çakışmayan satırlar aynı tablo satırında birleşir.
// Hücre: aralarında kelime yüksekliğinin ~1,6 katından büyük boşluk olmayan kelimeler. Izgara fotoğrafında gün başlıkları
// varsa her kelime en yakın gün sütununa (başlık kelimesinin yatay konumuna) yerleşir; böylece boş hücreler de doğru sütunda kalır.
// tLines: [[{ text, confidence, bbox: { x0, y0, x1, y1 } }]]
export function wordsToTable(tLines, dayOf) {
  const word = (w) => ({
    text: w.text.trim(), conf: w.confidence, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1,
    h: w.bbox.y1 - w.bbox.y0,
  });
  // Tablo çizgileri "|", "—" gibi tek işaretli kelime olarak okunur: atılır
  const raw = tLines.map((l) => l.filter((w) => /[\p{L}\p{N}]/u.test(w.text)).map(word)).filter((l) => l.length);
  if (!raw.length) return [];
  const hs = raw.flat().map((w) => w.h).sort((a, b) => a - b);
  const mh = hs[hs.length >> 1] || 10;
  const box = (ws) => ({ y0: Math.min(...ws.map((w) => w.y0)), y1: Math.max(...ws.map((w) => w.y1)),
    x0: Math.min(...ws.map((w) => w.x0)), x1: Math.max(...ws.map((w) => w.x1)) });
  const items = raw.map((ws) => ({ words: ws, ...box(ws) })).sort((a, b) => a.y0 - b.y0);
  const lines = [];
  for (const it of items) {
    const target = lines.find((l) => {
      const overlap = Math.min(l.y1, it.y1) - Math.max(l.y0, it.y0);
      const xClash = l.words.some((w) => w.x1 > it.x0 && w.x0 < it.x1);
      return !xClash && overlap > 0.5 * Math.min(l.y1 - l.y0, it.y1 - it.y0);
    });
    if (target) Object.assign(target, { words: [...target.words, ...it.words] }, box([...target.words, ...it.words]));
    else lines.push({ ...it });
  }
  lines.sort((a, b) => a.y0 - b.y0);
  lines.forEach((l) => l.words.sort((a, b) => a.x0 - b.x0));

  const cellText = (list) => list.map((w) => w.text).join(' ') + (list.some((w) => w.conf < 60) ? LOW_MARK : '');

  // Izgara: gün adı olan en az 2 kelimeli başlık satırı
  const header = lines.find((l) => l.words.filter((w) => dayOf(w.text)).length >= 2);
  if (header) {
    const cols = header.words.filter((w) => dayOf(w.text)).map((w) => ({ cx: (w.x0 + w.x1) / 2, x0: w.x0, name: w.text }));
    const left = Math.min(...cols.map((c) => c.x0)) - mh;
    const table = [['', ...cols.map((c) => c.name)]];
    for (const l of lines.slice(lines.indexOf(header) + 1)) {
      const cells = Array.from({ length: cols.length + 1 }, () => []);
      for (const w of l.words) {
        const cx = (w.x0 + w.x1) / 2;
        if (w.x1 < left) { cells[0].push(w); continue; }
        let best = 0;
        cols.forEach((c, i) => { if (Math.abs(c.cx - cx) < Math.abs(cols[best].cx - cx)) best = i; });
        cells[best + 1].push(w);
      }
      table.push(cells.map((c) => (c.length ? cellText(c) : '')));
    }
    return table;
  }

  // Liste: satır içinde büyük boşluk hücre ayırır
  return lines.map((l) => {
    const cells = [];
    let cur = [];
    for (const w of l.words) {
      const prev = cur[cur.length - 1];
      if (prev && w.x0 - prev.x1 > mh * 1.6) { cells.push(cur); cur = []; }
      cur.push(w);
    }
    if (cur.length) cells.push(cur);
    return cells.map(cellText);
  });
}

export async function readPhoto(file, { onProgress, signal, dayOf } = {}) {
  if (!file.type.startsWith('image/')) throw new PhotoError('Bu bir fotoğraf değil.');
  if (file.size > 25 * 1024 * 1024) throw new PhotoError('Fotoğraf çok büyük (en fazla 25 MB).');
  onProgress?.({ step: 'prepare', progress: 0 });
  const canvas = await prepare(file);
  if (signal?.aborted) throw new DOMException('Vazgeçildi', 'AbortError');

  const { createWorker } = await import('tesseract.js');
  const base = ocrBase();
  const worker = await createWorker('tur', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.({ step: 'read', progress: m.progress });
      else if (m.status?.startsWith('loading')) onProgress?.({ step: 'load', progress: m.progress });
    },
  });
  const stop = () => worker.terminate();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    if (signal?.aborted) throw new DOMException('Vazgeçildi', 'AbortError');
    // Otomatik sayfa bölümleme (PSM 3): tablo ve satır listesi için en iyisi. tesseract.js varsayılanı tek blok (6), tabloyu karıştırır.
    await worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
    // rotateAuto: Tesseract'ın bulduğu eğiklik kadar döndürülür; eğik çekilmiş tabloda satırlar karışmaz
    const { data } = await worker.recognize(canvas, { rotateAuto: true }, { blocks: true });
    if (signal?.aborted) throw new DOMException('Vazgeçildi', 'AbortError');
    const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => l.words)));
    return wordsToTable(lines, dayOf ?? (() => null));
  } catch (err) {
    if (signal?.aborted) throw new DOMException('Vazgeçildi', 'AbortError');
    throw err instanceof PhotoError ? err : new PhotoError('Fotoğraf okunamadı. İnternet bağlantını kontrol edip yeniden dene.');
  } finally {
    signal?.removeEventListener('abort', stop);
    worker.terminate().catch(() => {});
  }
}
