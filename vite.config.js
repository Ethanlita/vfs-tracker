import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'

// 自定义插件：复制posts目录到构建输出
const copyPostsPlugin = () => {
  return {
    name: 'copy-posts',
    generateBundle() {
      const copyRecursive = (src, dest) => {
        try {
          const stat = statSync(src)
          if (stat.isDirectory()) {
            mkdirSync(dest, { recursive: true })
            const files = readdirSync(src)
            files.forEach(file => {
              copyRecursive(join(src, file), join(dest, file))
            })
          } else {
            mkdirSync(dirname(dest), { recursive: true })
            copyFileSync(src, dest)
          }
        } catch (error) {
          console.warn(`Warning: Could not copy ${src} to ${dest}:`, error.message)
        }
      }
      
      // 复制posts目录到dist/posts
      copyRecursive('posts', 'dist/posts')
      console.log('✅ Posts directory copied to dist/posts')
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Set base to root ('/') for custom domain deployment
  plugins: [react(), copyPostsPlugin()],
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
