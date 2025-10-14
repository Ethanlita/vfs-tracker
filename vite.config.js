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
  // Vitest 测试配置
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-utils/setup.js',
    // 设置测试环境变量
    // 注意：单元测试和集成测试使用 MSW mock，不会真正调用这些端点
    // 但契约测试会调用真实的 API，所以需要使用真实的端点配置
    env: {
      VITE_COGNITO_USER_POOL_ID: 'us-east-1_Bz6JC9ko9',
      VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: '1nkup2vppbuk3n2d4575vbcoa0',
      VITE_AWS_REGION: 'us-east-1',
      VITE_API_ENDPOINT: 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com',
      VITE_API_STAGE: 'dev',
      VITE_S3_BUCKET: 'vfs-tracker-objstor',
    },
    include: [
      'tests/**/*.test.{js,jsx}',
      'src/**/*.test.{js,jsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'tests/legacy/**',
      'tests/contract/**', // 排除契约测试，契约测试使用专门的配置
      '.idea',
      '.git',
      'build'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/**/*.test.{js,jsx}',
        'src/test-utils/**',
        'src/mock_data.json',
        'src/assets/**',
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})
