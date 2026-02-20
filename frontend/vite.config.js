import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev only: proxy /api/* → FastAPI on port 8000
    // Has no effect on production builds or Render.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
