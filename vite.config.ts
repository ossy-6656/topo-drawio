import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // server: {
  //   proxy: {
  //     '/pwtmzxPbulicPath': {
  //       target: 'http://25.213.110.169:18055',
  //       ws: false,
  //       changeOrigin: true,
  //       rewrite: (path: String) => path.replace(/^\/pwtmzxPbulicPath/, 'pwtmzxPbulicPath')
  //     }
  //   }
  // }
})
