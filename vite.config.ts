import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/zika/',
  server: {
    host: '0.0.0.0', // 允许手机通过局域网访问
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      manifest: {
        name: '字卡 - 恋爱陪伴',
        short_name: '字卡',
        description: '温暖的字卡恋爱陪伴App',
        theme_color: '#faf0d8',
        background_color: '#faf0d8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/zika/',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
