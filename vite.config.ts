import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  // 只额外放行 Devin 预览域名，其余主机名仍由 Vite 校验
  server: { host: true, allowedHosts: ['.devinapps.com'] },
  preview: { host: true, allowedHosts: ['.devinapps.com'] },
  // Phaser 的加载器不能解析 Vite 内联的非 base64 SVG data URI
  build: { chunkSizeWarningLimit: 1600, assetsInlineLimit: 0 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-180.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      manifest: {
        name: '虫虫花园',
        short_name: '虫虫花园',
        description: '昆虫村庄模拟经营小游戏',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#cdeffd',
        theme_color: '#8ecb52',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
