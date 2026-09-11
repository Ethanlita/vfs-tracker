import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import wasm from 'vite-plugin-wasm'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { createProductionConsoleGuardPlugin, getBuildLoggingOptions } from './config/buildLogging.js'

/** 将公开文档作为构建资源输出，遵守实际outDir且在SW生成前可见。 */
const copyPostsPlugin = () => {
  return {
    name: 'copy-posts',
    generateBundle() {
      const emitRecursive = (src, assetPath) => {
        const stat = statSync(src)
        if (stat.isDirectory()) {
          const files = readdirSync(src)
          files.forEach(file => {
            emitRecursive(join(src, file), `${assetPath}/${file}`)
          })
        } else {
          this.emitFile({ type: 'asset', fileName: assetPath, source: readFileSync(src) })
        }
      }

      // 不再写死dist目录或忽略复制错误，缺失文档应使构建失败。
      emitRecursive('posts', 'posts')
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: '/', // Set base to root ('/') for custom domain deployment
  esbuild: getBuildLoggingOptions(command),
  plugins: [
    createProductionConsoleGuardPlugin(),
    wasm(),  // WASM 支持（RubberBand, World.JS）
    react(),
    copyPostsPlugin(),
    VitePWA({
      registerType: 'prompt',
      cleanupOutdatedCaches: true, // Automatically delete old caches
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'VFS Tracker',
        short_name: 'VFS Tracker',
        description: 'Voice Feminization Surgery Tracker',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // 仅补充公开文档目录与正文，不扩大到其他JSON文件。
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,woff,woff2}', 'posts.json', 'posts/**/*.md'],
        // 大尺寸源图没有运行时引用；管理后台依赖在线 AWS 服务，不进入面向用户的离线安装包。
        globIgnores: ['icons/icon.png', 'icons/icon_origin.png', 'assets/AdminApp-*.js']
      }
    })
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        /** 将稳定的状态与认证依赖独立缓存，业务入口更新时避免重复下载这些库。 */
        manualChunks(id) {
          if (id.includes('node_modules/@tanstack/')) return 'query-state';
          if (id.includes('node_modules/aws-amplify/') || id.includes('node_modules/@aws-amplify/')) {
            return 'amplify-auth';
          }
          return undefined;
        },
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
    // 覆盖率工具会显著降低执行速度（5-10倍），需要更长的超时时间
    testTimeout: process.env.COVERAGE ? 30000 : 10000,  // coverage模式: 30s, 普通模式: 10s
    hookTimeout: process.env.COVERAGE ? 20000 : 10000,  // coverage模式: 20s, 普通模式: 10s
  },
}))
