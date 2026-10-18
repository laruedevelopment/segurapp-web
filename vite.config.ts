import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// VITE_BASE: ruta donde se publica la app. En GitHub Pages es
// /SegurAppRSAS/ (o la ruta de pruebas); en local, la raíz.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Las copias de trabajo de agentes (.claude/) no son parte del proyecto.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', '.codex/**'],
  },
})
