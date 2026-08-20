import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

/**
 * O Tauri define `TAURI_ENV_PLATFORM` durante o build do programa de desktop.
 *
 * O PWA não faz sentido ali: o service worker existe para servir o app por HTTP
 * quando não há rede, e dentro da janela nativa os arquivos já estão em disco.
 * Mantê-lo ligado colocaria um cache entre o app e ele mesmo — a origem exata
 * das telas em branco depois de cada atualização.
 */
const noTauri = Boolean(process.env.TAURI_ENV_PLATFORM)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    !noTauri &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Life — dashboard da vida',
          short_name: 'Life',
          description: 'Dashboard da vida: saúde, faculdade, cursos e finanças.',
          lang: 'pt-BR',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['health', 'productivity', 'finance'],
          icons: [
            // PNG 192 e 512 não são preferência de estilo: sem os dois, o Chrome
            // não considera o app instalável e nunca oferece a instalação.
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // O Android recorta o ícone na forma do sistema. Sem uma versão
            // `maskable`, ele desenha o quadrado inteiro dentro de um círculo
            // branco — o efeito "adesivo" que denuncia PWA mal configurado.
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // As fontes vêm do Google; a primeira visita offline ficaria sem elas.
          // Depois de baixadas uma vez, ficam no cache por um ano.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'fontes',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          },
        }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Porta fixa: o `devUrl` do tauri.conf.json aponta para ela, e o Vite
    // saltando para 5175 quando a 5174 está ocupada deixaria a janela nativa
    // apontando para o nada.
    port: 5174,
    strictPort: true,
  },
  build: {
    // O WebView2 do Windows 11 é Chromium recente; não há motivo para o Vite
    // gastar transformação com navegador antigo aqui.
    target: 'chrome110',
    rollupOptions: {
      output: {
        // Os gráficos saem do bundle inicial: só duas telas os usam, e o
        // Recharts sozinho pesa mais do que todo o resto do app.
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          return undefined
        },
      },
    },
  },
})
