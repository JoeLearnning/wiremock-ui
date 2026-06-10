import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/__admin': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // Playground 请求代理：通过 Vite 转发到 WireMock，解决 CORS
      '/__wiremock-ui': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/test-mock': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/test-mock/, '')
      }
    }
  }
})
