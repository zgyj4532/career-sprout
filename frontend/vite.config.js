import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaOptions } from './pwaOptions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, __dirname, 'VITE_'), ...process.env }
  const campusLocal = env.VITE_APP_PROFILE === 'campus-local'
  return {
  base: env.VITE_CDN_URL || '/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.jsx',
    globals: true,
  },

  plugins: [
    react(),
    ...(campusLocal ? [] : [tailwindcss(), VitePWA(pwaOptions)]),
    {
      name: 'campus-html',
      transformIndexHtml(html) {
        if (!campusLocal) return html
        return html
          .replace(/<script src="https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js"><\/script>\s*/, '')
          .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/, '')
          .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/, '')
          .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]+" rel="stylesheet">\s*/, '')
          .replace(/<title>[^<]*<\/title>/, '<title>职芽 · CareerSprout — 大学生 AI 职业成长助手</title>')
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app-entry': path.resolve(__dirname, campusLocal ? './src/campus/CampusApp.jsx' : './src/fullAppEntry.jsx'),
      '@app-styles': path.resolve(__dirname, campusLocal ? './src/campus/base.css' : './src/index.css'),
    },
  },
  server: {
    host: process.env.IS_DOCKER ? true : (process.env.VITE_BIND_LOOPBACK === '1' ? '127.0.0.1' : undefined),
    port: 5173,
    strictPort: process.env.VITE_BIND_LOOPBACK === '1',
    proxy: {
      '/api': {
        target: process.env.IS_DOCKER ? 'http://backend_container:5002' : 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
    },
  },
  }
})