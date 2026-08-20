import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Life',
        short_name: 'Life',
        description: 'Dashboard da vida: saúde, faculdade, cursos e finanças.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        // TODO: gerar PNGs 192/512 antes de publicar na loja/instalação real.
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Gráficos e o cliente do Supabase saem do bundle inicial.
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          return undefined
        },
      },
    },
  },
})
