import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the build works both locally and
// when served from a GitHub Pages project path (https://lorenaredondo.github.io/LipidHub/).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: Number(process.env.PORT) || 5173 },
})
