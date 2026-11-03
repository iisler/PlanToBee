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

// Fotoğraf küçültülür, griye çevrilir ve kontrastı artırılır (EXIF yönü uygulanır).
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
  // Gri ton + basit kontrast germe (en koyu ve en açık %2 dışında)
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    d[i] = g; hist[g] += 1;
  }
  const total = w * h;
  const cut = total * 0.02;
  let lo = 0, hi = 255;
  for (let acc = hist[0]; lo < 255 && acc < cut; acc += hist[lo]) lo += 1;
  for (let acc = hist[255]; hi > 0 && acc < cut; acc += hist[hi]) hi -= 1;
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
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
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
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
