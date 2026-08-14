export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: false },

  modules: ['@nuxt/ui', '@pinia/nuxt', 'nuxt-auth-utils', '@vite-pwa/nuxt'],

  css: ['@fontsource-variable/inter', '~/assets/css/main.css'],

  // Do not fetch Inter from fonts.bunny.net at build time (fails on many VPS).
  ui: {
    fonts: false,
  },

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  app: {
    head: {
      title: 'Arus — Personal Spending Tracker',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#09090b' },
        { name: 'description', content: 'Fast personal spending tracker with installments, budgets and reports.' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  runtimeConfig: {
    databaseUrl: '', // NUXT_DATABASE_URL
    aiEncryptionKey: '', // NUXT_AI_ENCRYPTION_KEY
    session: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
    public: {
      appName: 'Arus',
    },
  },

  sourcemap: {
    server: false,
    client: false,
  },

  nitro: {
    minify: false,
    sourceMap: false,
    compressPublicAssets: false,
    experimental: {
      tasks: false,
      // Avoids a node-externals cache miss that makes Rollup re-resolve every module.
      legacyExternals: true,
    },
    // Docker sets NUXT_DOCKER_BUILD=1 so PGlite (WASM) is not traced into the server bundle.
    replace: {
      __ARUS_ALLOW_PGLITE__: process.env.NUXT_DOCKER_BUILD === '1' ? 'false' : 'true',
    },
    externals: {
      external: ['postgres'],
    },
  },

  vite: {
    build: {
      sourcemap: false,
      reportCompressedSize: false,
      minify: 'esbuild',
    },
    optimizeDeps: {
      exclude: ['@electric-sql/pglite'],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Arus — Spending Tracker',
      short_name: 'Arus',
      description: 'Fast personal spending tracker',
      theme_color: '#09090b',
      background_color: '#09090b',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
    },
  },
})
