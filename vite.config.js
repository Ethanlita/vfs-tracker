import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Use relative paths for custom domain GitHub Pages
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    emptyOutDir: true, // Ensure the output directory is cleared before each build
    copyPublicDir: true, // Copy public directory to the output directory
  },
  server: {
    host: true,
    port: 3000,
  },
})
