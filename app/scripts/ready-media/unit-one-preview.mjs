import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer } from 'vite';

export const previewPath = '/scripts/ready-media/unit-one-preview.html?unit=course-2-1&lesson=1&slide=course-2-1%3A6';

export async function openUnitOnePreview(port) {
  process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.VITE_SUPABASE_ANON_KEY = 'ready-class-preview';
  process.env.VITE_LEARNING_SENSORS = 'false';
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: false,
    cacheDir: await mkdtemp(join(tmpdir(), 'ready-class-vite-')),
    server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [react(), tailwindcss(), {
      name: 'ready-class-local-bank',
      configureServer(vite) {
        vite.middlewares.use('/rest/v1/phonics_bank', (_request, response) => {
          response.writeHead(200, { 'Content-Type': 'application/json' }).end('[]');
        });
      },
    }],
  });
  await server.listen();
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 5224);
  await openUnitOnePreview(port);
  console.log(`http://127.0.0.1:${port}${previewPath}`);
}
