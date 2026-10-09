import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// No GitHub Pages o site fica em luanps2.github.io/mydecks-pokemon/ (só no build; no npm run dev continua na raiz)
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mydecks-pokemon/' : '/',
  plugins: [react()],
}))
