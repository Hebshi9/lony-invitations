import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // viteStaticCopy removed as public folder is auto-copied
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true
      }
    },
    hmr: {
      overlay: true,
      timeout: 5000,
    },
    watch: {
      // Ignore non-frontend files to prevent unnecessary reloads
      ignored: [
        '**/api/**',
        '**/scripts/**',
        '**/supabase/**',
        '**/docs/**',
        '**/tests/**',
        '**/dist/**',
        '**/agent-dist/**',
        '**/evolution-api/**',
        '**/evolution-api-local/**',
        '**/evo-release/**',
        '**/*.log',
        '**/*.txt',
        '**/*.md',
        '**/*.sql',
        '**/*.bat',
        '**/.wwebjs_auth/**',
        '**/.wwebjs_cache/**',
        '**/auth_info_baileys/**',
        '**/auth_sessions/**',
        '**/auth_pairing/**',
        '**/test-cards/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/node_modules/**',
      ],
      usePolling: false,
    },
  },
})
