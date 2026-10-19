export const pwaOptions = {
  registerType: 'autoUpdate',
  includeAssets: ['user.svg', 'pwa-192x192.jpg', 'pwa-512x512.jpg'],
  manifest: {
    name: '职芽 · CareerSprout',
    short_name: '职芽',
    description: '从现在开始，让每一次练习长成未来。',
    lang: 'zh-CN',
    theme_color: '#0f6e56',
    background_color: '#f4efe6',
    display: 'standalone',
    icons: [
      {
        src: 'pwa-192x192.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any'
      },
      {
        src: 'pwa-512x512.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any'
      },
      {
        src: 'pwa-192x192.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'maskable'
      },
      {
        src: 'pwa-512x512.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable'
      }
    ]
  },
  workbox: {
    globPatterns: ['index.html', 'manifest.webmanifest', 'user.svg', 'pwa-*.jpg'],
    globIgnores: ['templates/**/*', 'template-previews/**/*'],
    maximumFileSizeToCacheInBytes: 5000000
  }
}
