// 샘플 자료로 바로 시작할 수 있는 게임인지 확인한다(게임 들어가면 안내 화면 없이 바로 시작).
// 사용: node app/scripts/games/check-instant-start.mjs
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stub = { name: 's', enforce: 'pre', load(id) { if (id.split('\\').join('/').endsWith('/src/lib/supabase.ts')) return 'export const supabase = {};'; } };
const server = await createServer({ root, logLevel: 'error', plugins: [stub], server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { GAME_CATALOG } = await server.ssrLoadModule('/src/lib/gameCatalog.ts');
  const prep = await server.ssrLoadModule('/src/lib/gamePreparation.ts');
  const ws = await server.ssrLoadModule('/src/lib/gameWorkspace.ts');
  const guide = await server.ssrLoadModule('/src/lib/gameGuide.ts');
  const qa = await server.ssrLoadModule('/src/lib/quickActivity.ts');
  const bad = [];
  const dedicated = [];
  let ok = 0;
  for (const g of GAME_CATALOG) {
    if (!prep.instantStart(g.type)) continue;
    const kind = prep.gamePreparation(g.type).kinds.includes('word') || !prep.gamePreparation(g.type).kinds.length ? 'word' : 'sentence';
    const cards = qa.sampleActivityCards(kind);
    if (prep.gamePreparation(g.type).dedicated || g.type.startsWith('grammar') || g.type === 'groupsort') { dedicated.push(g.type); continue; }
    const content = ws.prepareClassroomGame(g.type, cards, kind);
    if (!content) { bad.push(`${g.type}: 샘플 카드로 만들 수 없음`); continue; }
    const draft = { id: 'x', game_type: g.type, items: content.items, config: { ...content.config } };
    const problem = guide.guideProblem(draft);
    const ready = prep.isNativeGameReady(draft);
    if (problem || !ready) bad.push(`${g.type}: ${problem || '준비 안 됨(isNativeGameReady)'}`);
    else ok++;
  }
  console.log(`바로 시작 가능: ${ok}종, 전용 샘플(페이지 기본값 사용): ${dedicated.length}종`);
  console.log('전용 샘플 게임:', dedicated.join(', '));
  if (bad.length) { console.log('\n바로 시작이 안 되는 게임:'); bad.forEach((b) => console.log(' -', b)); process.exitCode = 1; }
  else console.log('\n전부 통과');
} finally {
  await server.close();
}
