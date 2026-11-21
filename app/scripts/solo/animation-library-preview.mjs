import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const file = process.argv[2];
if (!file) throw new Error('Pass a read-only video library JSON snapshot');
const clips = JSON.parse(await readFile(file, 'utf8'));
const port = Number(process.argv[3] ?? 5237);
process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.VITE_SUPABASE_ANON_KEY = 'local-preview';
process.env.VITE_LEARNING_SENSORS_ENABLED = 'false';
const saved = [];
const server = await createServer({
  root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
  cacheDir: await mkdtemp(join(tmpdir(), 'animation-solo-preview-')),
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [react(), tailwindcss(), {
    name: 'animation-preview-only',
    configureServer(vite) {
      vite.middlewares.use('/rest/v1', async (request, response) => {
        let data = [];
        if (request.url?.startsWith('/video_clips')) data = clips;
        if ((request.url?.startsWith('/solo_lessons') || request.url?.startsWith('/word_lists')) && request.method === 'POST') {
          let body = '';
          for await (const chunk of request) body += chunk;
          const lesson = { id: crypto.randomUUID(), ...JSON.parse(body) };
          saved.push(lesson);
          data = lesson;
        }
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));
      });
    },
  }],
});
await server.listen();
console.log(`http://127.0.0.1:${port}/scripts/solo/animation-library.html`);
