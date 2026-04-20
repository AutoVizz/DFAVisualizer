import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/DFAVisualizer/',
  plugins: [
    tailwindcss(),
    react(),
  ],
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      usePolling: false,
    },
  },
})
