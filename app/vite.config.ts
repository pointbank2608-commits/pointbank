import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 미리보기 도구가 PORT 로 빈 포트를 줄 때 그것을 쓴다(없으면 기본 5173 — 직접 `npm run dev` 할 때는 그대로)
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
