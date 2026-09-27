import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
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

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') checkApiUrl(mode)
  return {
    plugins: [react(), guardSpaFallback],
  }
})
