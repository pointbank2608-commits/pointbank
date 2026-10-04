// 영상 라이브러리 대사표 2차 다듬기(2026-10-04) — 1차 맞춤(build-aligned-sql.mjs) 뒤에도 문장 끝 낱말보다 일찍 끝나는
// 줄을 자막 낱말 시간으로 늘리고, 늦게 시작하는 줄을 당긴다. 결과는 out/aligned-patch.txt:
//   <영상id>@<지금 start_sec>|줄번호:시작,끝;...   (0.1초 단위)
// 지금 DB 대사표는 out/clip-align-update.sql(1차 결과)에서 읽는다 → out/clip-align-patch.sql
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), 'out');
const patch = new Map();
for (const line of readFileSync(join(out, 'aligned-patch.txt'), 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [key, body] = line.split('|');
  patch.set(key, new Map(body.split(';').map((x) => {
    const [i, v] = x.split(':');
    return [Number(i), v.split(',').map((n) => Number(n) / 10)];
  })));
}

const sql = readFileSync(join(out, 'clip-align-update.sql'), 'utf8');
const re = /update public\.video_clips set script = '((?:[^']|'')*)', start_sec = ([\d.]+), end_sec = ([\d.]+) where youtube_id = '([\w-]{11})'/g;
const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(1).padStart(4, '0')}`;
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const stmts = [];
let lines = 0;
for (const m of sql.matchAll(re)) {
  const script = m[1].replace(/''/g, "'");
  const start = Number(m[2]);
  const id = m[4];
  const p = patch.get(`${id}@${start}`);
  if (!p) continue;
  const rows = script.split('\n');
  for (const [i, [s, e]] of p) {
    if (!rows[i]) continue;
    rows[i] = rows[i].replace(/^\[[^\]]*\]/, `[${fmt(s)}-${fmt(e)}]`);
    lines++;
  }
  const times = rows.map((r) => r.match(/^\[(\d+):([\d.]+)-(\d+):([\d.]+)\]/)).filter(Boolean).map((x) => [+x[1] * 60 + +x[2], +x[3] * 60 + +x[4]]);
  const newStart = Math.max(0, Math.floor((times[0][0] - 0.5) * 10) / 10);
  const newEnd = Math.ceil((times.at(-1)[1] + 0.5) * 10) / 10;
  stmts.push(`update public.video_clips set script = ${q(rows.join('\n'))}, start_sec = ${newStart}, end_sec = ${newEnd} where youtube_id = ${q(id)} and start_sec = ${start};`);
}

const file = join(out, 'clip-align-patch.sql');
writeFileSync(file, `-- 영상 라이브러리 대사표 2차 다듬기 (장면 ${stmts.length}개, ${lines}줄). clip-align-update.sql 다음에 한 번 실행.\nbegin;\n${stmts.join('\n')}\ncommit;\n`);
console.log(`장면 ${stmts.length}개 · ${lines}줄 고침 → ${file}`);
