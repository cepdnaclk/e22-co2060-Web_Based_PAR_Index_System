import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // BUG FIX: was http://localhost:8081 — inside the par-frontend
        // container, localhost is the container itself, not the par-backend
        // container, so every proxied API call failed with ECONNREFUSED.
        // VITE_API_TARGET still lets this be overridden for non-Docker runs.
        target: process.env.VITE_API_TARGET || 'http://par-backend:8081',
        changeOrigin: true,
        timeout: 1200000,          // 2 minutes for large STL files
        proxyTimeout: 1200000,
        secure: false
      }
    }
  }
})