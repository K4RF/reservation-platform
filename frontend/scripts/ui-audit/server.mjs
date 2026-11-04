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
          // Unchanged prototype + one external CSS rule: omit Studio from equal-origin captures.
          // Keep its CSP intact, allowlist files and never rewrite the approved source on disk.
          const referencePath = request.url?.split('?')[0]
          if (referencePath?.startsWith('/__reference/')) {
            const file = referencePath.slice('/__reference/'.length)
            const types = {
              'index.html': 'text/html',
              'style.css': 'text/css',
              'app.js': 'text/javascript',
              'assets/coast-concept.png': 'image/png',
              'assets/room-concept.png': 'image/png',
              'capture.css': 'text/css',
            }
            if (request.method !== 'GET' || !Object.hasOwn(types, file)) {
              response.statusCode = request.method === 'GET' ? 404 : 405
              response.end()
              return
            }
            try {
              let body =
                file === 'capture.css'
                  ? '.studio, .demo-note, .state-demo { display: none !important; }'
                  : await readFile(
                      new URL(
                        '../../../docs/ui/prototypes/premium-travel/' + file,
                        import.meta.url,
                      ),
                    )
              if (file === 'index.html')
                body = body
                  .toString()
                  .replace('</head>', '<link rel="stylesheet" href="capture.css"></head>')
              response.setHeader('Content-Type', types[file])
              response.setHeader('Cache-Control', 'no-store')
              response.end(body)
            } catch (error) {
              next(error)
            }
            return
          }
          // Audit-only fault injection for the decorative Hero, not a production query or API.
          if (
            /\/home-a1-(800|1600)\.webp(?:\?|$)/.test(request.url ?? '') &&
            new URL(request.headers.referer ?? '/', 'http://127.0.0.1:5174').searchParams.get(
              'hero',
            ) === 'failed'
          ) {
            response.statusCode = 404
            response.setHeader('Cache-Control', 'no-store')
            response.end()
            return
          }
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
console.log(
  'UI AUDIT ONLY: synthetic auth and fixtures; writes blocked by default, opt-in Booking simulation; no Backend proxy.',
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await server.close()
    process.exit(0)
  })
