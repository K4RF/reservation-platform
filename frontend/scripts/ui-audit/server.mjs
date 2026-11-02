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
          // Only synthetic audit content, never a proxy into the development DB/storage.
          const asset = {
            '/api/v1/media/2001/content': 'coast-concept.png',
            '/api/v1/media/2002/content': 'room-concept.png',
          }[request.url?.split('?')[0]]
          if (asset && request.method === 'GET') {
            response.setHeader('Content-Type', 'image/png')
            response.setHeader('Cache-Control', 'no-store')
            response.end(
              await readFile(
                new URL(
                  '../../../docs/ui/prototypes/premium-travel/assets/' + asset,
                  import.meta.url,
                ),
              ),
            )
            return
          }
          if (request.url?.startsWith('/api/v1/media/')) {
            response.statusCode = 404
            response.end()
            return
          }
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
