import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Üretim derlemesinde API adresini denetler: canlı sitenin sessizce localhost'a istek atmasını önler.
function checkApiUrl(mode) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = (process.env.VITE_API_URL ?? env.VITE_API_URL ?? '').trim()
  if (!apiUrl) {
    throw new Error(
      '\n[PlanToBee] VITE_API_URL tanımlı değil. Üretim derlemesi bu değişken olmadan yapılamaz.\n' +
        'Örnek: VITE_API_URL=https://<render-servis-adi>.onrender.com/api npm run build\n' +
        "Cloudflare Pages'te: Settings > Environment variables altına VITE_API_URL ekleyin ve yeniden derleyin.\n",
    )
  }
  let url
  try {
    url = new URL(apiUrl)
  } catch {
    throw new Error(`\n[PlanToBee] VITE_API_URL geçerli bir adres değil: "${apiUrl}". http(s):// ile başlayan tam adres girin.\n`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`\n[PlanToBee] VITE_API_URL http:// veya https:// ile başlamalı: "${apiUrl}".\n`)
  }
  const warn = (msg) => console.warn(`\x1b[33m[PlanToBee] Uyarı: ${msg}\x1b[0m`)
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    warn(`VITE_API_URL yerel bir adres (${apiUrl}). Bu derleme canlıya yüklenmemeli.`)
  } else if (url.protocol !== 'https:') {
    warn(`VITE_API_URL https değil (${apiUrl}). Canlıda https:// kullanın.`)
  }
  if (!url.pathname.replace(/\/+$/, '').endsWith('/api')) {
    warn(`VITE_API_URL "/api" ile bitmiyor (${apiUrl}). Beklenen biçim: https://<render-servis-adi>.onrender.com/api`)
  }
}

// Cloudflare Pages, çıktıda üst düzey 404.html yoksa projeyi SPA sayar ve bilinmeyen rotaları index.html'e yollar.
// Birisi ileride public/404.html eklerse derin linkler 404 verir; bunu build sırasında yakalar.
const guardSpaFallback = {
  name: 'plantobee-spa-fallback-guard',
  apply: 'build',
  closeBundle() {
    if (existsSync(resolve(process.cwd(), 'dist', '404.html'))) {
      throw new Error(
        "[PlanToBee] dist/404.html bulundu. Cloudflare Pages bu durumda SPA yönlendirmesini kapatır ve /invite gibi linkler 404 verir. 404.html'i kaldırın.",
      )
    }
  },
}

// Program yükleme (Görev 15): fotoğraf okuma (Tesseract.js) dosyaları sitenin kendi /ocr/ yolundan verilir; dış CDN'e istek
// atılmaz (gizlilik ve çevrimdışı Capacitor paketi). Geliştirmede node_modules'tan sunulur, derlemede dist/ocr altına kopyalanır.
// Yalnızca LSTM çekirdekleri (tesseract.js varsayılanı) ve sıkıştırılmış Türkçe dil verisi (best_int, ~2 MB).
const require = createRequire(import.meta.url)
const OCR_FILES = {
  'worker.min.js': () => resolve(dirname(require.resolve('tesseract.js/package.json')), 'dist/worker.min.js'),
  'tur.traineddata.gz': () => resolve(dirname(require.resolve('@tesseract.js-data/tur/package.json')), '4.0.0_best_int/tur.traineddata.gz'),
  ...Object.fromEntries(['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']
    .map((f) => [f, () => resolve(dirname(require.resolve('tesseract.js-core/package.json')), f)])),
}
function ocrAssets() {
  let base = '/'
  return {
    name: 'plantobee-ocr-assets',
    configResolved(config) { base = config.base },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        const prefix = `${base}ocr/`
        if (!path.startsWith(prefix)) return next()
        const file = OCR_FILES[path.slice(prefix.length)]
        if (!file) return next()
        res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        res.end(readFileSync(file()))
      })
    },
    generateBundle() {
      for (const [name, file] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(file()) })
      }
    },
  }
}

// https://vite.dev/config/
// Sitenin yayınlandığı alt yol. Cloudflare Pages / kendi alan adı: "/" (varsayılan).
// GitHub Pages: VITE_BASE_PATH=/PlanToBee/app/ (bkz. .github/workflows/pages.yml).
function basePath(mode) {
  const raw = (process.env.VITE_BASE_PATH ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH ?? '/').trim()
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') checkApiUrl(mode)
  return {
    base: basePath(mode),
    plugins: [react(), guardSpaFallback, ocrAssets()],
  }
})
