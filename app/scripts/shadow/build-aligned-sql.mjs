// 영상 라이브러리 대사표 시간 바로잡기(2026-10-04) — AI(Gemini)가 짐작한 문장 시간이 0.5~2초씩 어긋나
// (특히 끝 시간이 일러 문장 끝이 잘림) 유튜브 자동 자막의 낱말별 시간에 맞춘 값으로 바꾼다.
// 낱말 시간 맞추기는 브라우저(유튜브 페이지)에서 했고, 결과는 out/aligned-*.txt:
//   <영상id>@<옛 start_sec>|시작,끝;시작,끝;...   (0.1초 단위 정수, 대사표 줄 순서대로)
// 대사표 원문은 out/clip-library.sql 에서 읽어 시간만 갈아 끼운다 → out/clip-align-update.sql (git 제외)
//   node app/scripts/shadow/build-aligned-sql.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), 'out');

// 시간이 맞지 않는 장면(대본이 다른 편과 섞였거나 실제 말과 절반도 안 맞음) — 다시 만들 때까지 내린다
const HIDE = ['BWVrrBtqhLU@29.9', 'kioBK0l8w5w@375', 'mNt8QH-fyyY@352.5'];

const times = new Map();
for (const f of ['aligned-1.txt', 'aligned-2.txt']) {
  for (const line of readFileSync(join(out, f), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [key, body] = line.split('|');
    times.set(key, body.split(';').map((p) => p.split(',').map((n) => Number(n) / 10)));
  }
}

// clip-library.sql 의 insert 값 읽기(작은 따옴표 문자열 + 숫자)
function readValues(sql, from) {
  const vals = [];
  let i = from;
  while (i < sql.length) {
    while (sql[i] === ' ' || sql[i] === ',' || sql[i] === '\n' || sql[i] === '\r') i++;
    if (sql[i] === ')') break;
    if (sql[i] === "'") {
      let s = '';
      i++;
      for (;;) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (sql[i] === "'") {
          i++;
          break;
        } else s += sql[i++];
      }
      while (sql[i] && sql[i] !== ',' && sql[i] !== ')') i++; // ::jsonb 같은 꼬리
      vals.push(s);
    } else {
      let depth = 0;
      let s = '';
      while (i < sql.length && !(depth === 0 && (sql[i] === ',' || sql[i] === ')'))) {
        if (sql[i] === '[') depth++;
        if (sql[i] === ']') depth--;
        if (sql[i] === "'") {
          // array['a','b'] 안의 문자열
          s += sql[i++];
          while (!(sql[i] === "'" && sql[i + 1] !== "'")) s += sql[i++];
        }
        s += sql[i++];
      }
      vals.push(s.trim());
    }
  }
  return vals;
}

const sql = readFileSync(join(out, 'clip-library.sql'), 'utf8');
const rows = [];
let at = 0;
for (;;) {
  const k = sql.indexOf('values (', at);
  if (k < 0) break;
  const v = readValues(sql, k + 8);
  rows.push({ youtube_id: v[3], start_sec: Number(v[5]), script: v[9] });
  at = k + 8;
}

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(1).padStart(4, '0')}`;
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const stmts = [];
let fixed = 0;
for (const r of rows) {
  const key = `${r.youtube_id}@${r.start_sec}`;
  if (HIDE.includes(key)) {
    stmts.push(`update public.video_clips set hidden = true, hidden_reason = '대사 시간 다시 만들기(대본이 실제 말과 맞지 않음)', hidden_at = now() where youtube_id = ${q(r.youtube_id)} and start_sec = ${r.start_sec};`);
    continue;
  }
  const t = times.get(key);
  const lines = r.script.split(/\r?\n/).filter((l) => l.trim());
  if (!t || t.length !== lines.length) {
    console.log('건너뜀', key, t ? `${t.length} vs ${lines.length}` : '시간 없음');
    continue;
  }
  // 겹치는 줄 정리: 앞 줄이 끝나기 전에 시작하지 않게
  const fixedTimes = t.map((x) => [...x]);
  for (let i = 1; i < fixedTimes.length; i++) {
    const prev = fixedTimes[i - 1];
    const cur = fixedTimes[i];
    if (cur[0] < prev[1] - 0.05) cur[0] = prev[1];
    if (cur[1] < cur[0] + 0.5) cur[1] = cur[0] + 0.5;
  }
  const script = lines
    .map((l, i) => l.replace(/^\[[^\]]*\]/, `[${fmt(fixedTimes[i][0])}-${fmt(fixedTimes[i][1])}]`))
    .join('\n');
  const start = Math.max(0, Math.floor((fixedTimes[0][0] - 0.5) * 10) / 10);
  const end = Math.ceil((fixedTimes.at(-1)[1] + 0.5) * 10) / 10;
  stmts.push(`update public.video_clips set script = ${q(script)}, start_sec = ${start}, end_sec = ${end} where youtube_id = ${q(r.youtube_id)} and start_sec = ${r.start_sec};`);
  fixed++;
}

const file = join(out, 'clip-align-update.sql');
writeFileSync(file, `-- 영상 라이브러리 대사표 시간 바로잡기 (장면 ${fixed}개 고침, ${HIDE.length}개 내림). SQL Editor 에서 실행. 여러 번 실행해도 결과는 같다(시간만 다시 씀) — 단, 두 번째부터는 start_sec 이 바뀌어 일부 줄은 그냥 건너뛴다.\nbegin;\n${stmts.join('\n')}\ncommit;\n`);
console.log(`${rows.length}개 중 ${fixed}개 고침, ${HIDE.length}개 내림 → ${file}`);
