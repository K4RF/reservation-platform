import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

const auditRoot = fileURLToPath(new URL('.', import.meta.url))
const server = await createServer({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  configFile: false,
  envDir: auditRoot,
  envPrefix: 'UI_AUDIT_PUBLIC_',
  plugins: [
    react(),
    {
      name: 'isolated-ui-audit',
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (request.url?.split('?')[0] !== '/') return next()
          try {
            const html = await readFile(new URL('./index.html', import.meta.url), 'utf8')
            response.setHeader('Content-Type', 'text/html; charset=utf-8')
            response.end(await vite.transformIndexHtml(request.url, html))
          } catch (error) {
            next(error)
          }
        })
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
})
await server.listen()
server.printUrls()
console.log('UI AUDIT ONLY: synthetic auth, fixture reads, writes blocked; no Backend proxy.')
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await server.close()
    process.exit(0)
  })
