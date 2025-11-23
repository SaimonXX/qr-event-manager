import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      {
        name: 'html-env-transform',
        transformIndexHtml(html) {
          return html.replace(/%VITE_APP_URL%/g, env.VITE_APP_URL)
        }
      }
    ],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true
    },
  
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
    }
  }
})
