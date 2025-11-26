import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@assets': resolve('src/renderer/src/assets'),
        '@components': resolve('src/renderer/src/components'),
        '@router': resolve('src/renderer/src/router'),
        '@api': resolve('src/renderer/src/api'),
        '@utils': resolve('src/renderer/src/utils'),
        '@stores': resolve('src/renderer/src/stores'),
        '@types': resolve('src/renderer/src/types.ts'),
        '@services': resolve('src/renderer/src/services')
      }
    },
    plugins: [vue()],
    server: {
      proxy: {
        '/api/hg': {
          target: 'https://as.hypergryph.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/hg/, ''),
          secure: true
        },
        '/api/skland': {
          target: 'https://zonai.skland.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/skland/, ''),
          secure: true
        },
        '/api/web': {
          target: 'https://web-api.hypergryph.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/web/, ''),
          secure: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('代理请求头 Cookie:', req.headers.cookie);
              // 确保Cookie头被正确转发
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
              }
            });
            proxy.on('proxyRes', (proxyRes) => {
              console.log('代理响应状态:', proxyRes.statusCode);
              console.log('代理响应头:', proxyRes.headers);
            });
          }
        },
        '/api/ak': {
          target: 'https://ak.hypergryph.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ak/, ''),
          secure: true
        }
      }
    }
  }
})