import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { cimGElementPlugin } from './vite-plugins/cimGElement'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), cimGElementPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '.'), path.resolve(__dirname, 'scripts')],
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
