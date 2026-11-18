import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { webAppForPath, webApps } from './src/lib/webAppIdentity.ts'

const portalEntries = {
  student: 'student-entry.html',
  parent: 'parent-entry.html',
} as const

function withPortalIdentity(html: string, portal: keyof typeof portalEntries) {
  const app = webApps[portal]
  return html
    .replace('<title>' + webApps.teacher.title + '</title>', '<title>' + app.title + '</title>')
    .replace('href="' + webApps.teacher.manifest + '"', 'href="' + app.manifest + '"')
    .replace('href="' + webApps.teacher.touchIcon + '"', 'href="' + app.touchIcon + '"')
    .replace('name="theme-color" content="' + webApps.teacher.theme + '"', 'name="theme-color" content="' + app.theme + '"')
    .replace('name="apple-mobile-web-app-title" content="' + webApps.teacher.homeName + '"',
      'name="apple-mobile-web-app-title" content="' + app.homeName + '"')
}

function portalHtml(): Plugin {
  return {
    name: 'portal-html',
    transformIndexHtml(html, context) {
      if (!context.server) return html
      const portal = webAppForPath(new URL(context.originalUrl ?? context.path, 'http://localhost').pathname)
      return portal === 'teacher' ? html : withPortalIdentity(html, portal)
    },
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset' || typeof index.source !== 'string') this.error('Missing built HTML for the portal entry pages.')
        // Share Vite's compiled scripts and styles, while exposing the correct
        // manifest in each portal's initial HTML before any script runs.
        for (const portal of ['student', 'parent'] as const) {
          this.emitFile({ type: 'asset', fileName: portalEntries[portal], source: withPortalIdentity(index.source, portal) })
        }
      },
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && (req.method === 'GET' || req.method === 'HEAD')) {
          const portal = webAppForPath(new URL(req.url, 'http://localhost').pathname)
          if (portal !== 'teacher') req.url = '/' + portalEntries[portal]
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), portalHtml()],
  // 미리보기 도구가 PORT 로 빈 포트를 줄 때 그것을 쓴다(없으면 기본 5173 — 직접 `npm run dev` 할 때는 그대로)
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
