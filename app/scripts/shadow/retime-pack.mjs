// 영상 라이브러리 수업 묶음(pack)의 "장면 보기" 시간 바로잡기(2026-10-05 사용자 제보: Q&A 두 번째 문제의 장면 보기가 엉뚱한 장면).
// 질문·단어·문법의 time 은 AI(Gemini)가 짐작한 값이라 대사표(자막으로 맞춘 뒤)와 어긋난다. 대사표 줄에서 다시 찾는다:
//  - 질문: 답(과 질문)의 내용어가 가장 많이 겹치는 줄의 시작. 장면 안에서 못 찾으면 time 을 지운다(장면 보기 버튼이 안 뜬다).
//  - 단어: 예문과 같은 줄 → 그 낱말이 들어 있는 줄 → 없으면 time 을 지운다.
//  - 문법: 본보기 문장과 같은 줄.
// DB(공개 읽기)에서 지금 대사표를 읽어 out/clip-pack-retime.sql 을 만든다(git 제외 폴더).
//   node app/scripts/shadow/retime-pack.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '..', '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/video_clips?select=youtube_id,start_sec,script,pack&order=youtube_id,start_sec`, {
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
});
const clips = await res.json();

const STOP = new Set('a an the is are was were be been am i you he she it we they my your his her its our their me him us them to of in on at for with and or but so do does did not no yes what who where when why how this that there here can will would could should have has had get got go going let lets oh okay ok just very too'.split(' '));
const toks = (s) => (s.toLowerCase().match(/[a-z']+/g) ?? []).map((w) => w.replace(/'s$/, '').replace(/^'|'$/g, '')).filter(Boolean);
const content = (s) => toks(s).filter((w) => !STOP.has(w) && w.length > 1);
const stem = (w) => w.replace(/(ies|es|s|ed|ing)$/, '');

function parse(script) {
  return script.split(/\r?\n/).map((l) => {
    const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)(?:-(\d+):(\d+(?:\.\d+)?))?\]\s*(.*)$/);
    if (!m) return null;
    const sp = m[5].match(/^([A-Za-z][\w .'-]{0,19}):\s+/);
    const en = (sp ? m[5].slice(sp[0].length) : m[5]).split('|')[0].replace(/\*\*/g, '').trim();
    return { s: +m[1] * 60 + +m[2], en, set: new Set(content(en).map(stem)), all: toks(en).join(' ') };
  }).filter(Boolean);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const stmts = [];
const report = { qFixed: 0, qDropped: 0, wFixed: 0, wDropped: 0, gFixed: 0, gDropped: 0 };
for (const c of clips) {
  const lines = parse(c.script);
  const pack = structuredClone(c.pack ?? {});
  // 장면에 자주 나오는 낱말(ball 등)은 가볍게, 드문 낱말(tree 등)은 무겁게. AI 가 짐작한 시간 근처를 조금 더 믿는다.
  const df = new Map();
  for (const ln of lines) for (const w of ln.set) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = (w) => Math.log((lines.length + 1) / ((df.get(w) ?? 0) + 0.5));
  for (const it of pack.questions ?? []) {
    const ans = [...new Set(content(it.a).map(stem))];
    const qu = [...new Set(content(it.q).map(stem))].filter((w) => !ans.includes(w));
    let best = null;
    let bestScore = 0;
    let bestRaw = 0;
    for (const ln of lines) {
      const raw = ans.filter((w) => ln.set.has(w)).length + 0.5 * qu.filter((w) => ln.set.has(w)).length;
      const weighted = ans.reduce((a, w) => a + (ln.set.has(w) ? idf(w) : 0), 0) + 0.5 * qu.reduce((a, w) => a + (ln.set.has(w) ? idf(w) : 0), 0);
      const near = typeof it.time === 'number' ? 0.01 * Math.abs(ln.s - it.time) : 0;
      const score = weighted - near;
      if (score > bestScore) {
        bestScore = score;
        bestRaw = raw;
        best = ln;
      }
    }
    if (best && bestRaw >= 1) {
      it.time = Math.round(best.s * 10) / 10;
      report.qFixed++;
    } else {
      delete it.time;
      report.qDropped++;
    }
  }
  for (const w of pack.words ?? []) {
    const ex = toks(w.example ?? '').join(' ');
    const word = stem(toks(w.word)[0] ?? '');
    const hit = lines.find((ln) => ex && ln.all === ex) ?? lines.find((ln) => ex && (ln.all.includes(ex) || ex.includes(ln.all)) && ln.all.length > 6) ?? lines.find((ln) => word && ln.set.has(word));
    if (hit) {
      w.time = Math.round(hit.s * 10) / 10;
      report.wFixed++;
    } else {
      delete w.time;
      report.wDropped++;
    }
  }
  if (pack.grammar) {
    const sent = toks(pack.grammar.sentence ?? '').join(' ');
    const hit = lines.find((ln) => ln.all === sent) ?? lines.find((ln) => sent && (ln.all.includes(sent) || sent.includes(ln.all)) && ln.all.length > 6);
    if (hit) {
      pack.grammar.time = Math.round(hit.s * 10) / 10;
      report.gFixed++;
    } else {
      delete pack.grammar.time;
      report.gDropped++;
    }
  }
  stmts.push(`update public.video_clips set pack = ${q(JSON.stringify(pack))}::jsonb where youtube_id = ${q(c.youtube_id)} and start_sec = ${c.start_sec};`);
}

const file = join(here, 'out', 'clip-pack-retime.sql');
writeFileSync(file, `-- 영상 라이브러리 "장면 보기" 시간 바로잡기 (장면 ${stmts.length}개). SQL Editor 에서 실행, 여러 번 실행해도 같다.\nbegin;\n${stmts.join('\n')}\ncommit;\n`);
console.log(JSON.stringify(report), '→', file);
