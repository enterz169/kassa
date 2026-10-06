import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'

// Сборка в ОДИН html-файл: весь JS, CSS и шрифт для PDF внутри — подходит для публикации артефактом.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 4000, assetsInlineLimit: 100_000_000 },
})
