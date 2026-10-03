// 영상 쉐도잉 라이브러리 채우기(2026-10-03) — 유튜브 영상 → 2~4분 장면 + 대사표 + 수업 묶음 → SQL.
//
//   node app/scripts/shadow/make-clip-library.mjs app/scripts/shadow/videos.json
//
// videos.json: [{ "url": "...", "series": "Peppa Pig", "level": 1, "from": 0, "to": 600 }, ...]
//   from/to(초)는 볼 구간(기본 0~600). 긴 모음 영상은 구간을 나눠 여러 줄로 넣는다.
// 하는 일(영상 하나마다):
//   ① 유튜브 oEmbed 로 채널 이름 확인 — 디즈니 계열이면 건너뛴다
//   ② Gemini(Vertex, gcloud 로그인)가 영상을 보고 대사표를 만든다(make-shadow-script.mjs 와 같은 형식)
//   ③ Gemini 가 대사표만 보고 2~4분 장면으로 나누고 장면마다 수업 묶음(질문·단어·문법 바꿔 말하기·빙고)을 만든다
// 결과: app/scripts/shadow/out/clips/<영상id>-<from>.json(이어 하기용) + out/clip-library.sql(SQL Editor 에서 실행).
// out/ 은 git 에 올리지 않는다(대본은 DB 에만).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out');
const CLIPS = join(OUT, 'clips');
mkdirSync(CLIPS, { recursive: true });

const listPath = process.argv[2] ?? join(here, 'videos.json');
const videos = JSON.parse(readFileSync(listPath, 'utf8'));

const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
let token = '';
let tokenAt = 0;
const getToken = () => {
  if (!token || Date.now() - tokenAt > 30 * 60 * 1000) {
    token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();
    tokenAt = Date.now();
  }
  return token;
};

const BLOCKED = ['disney', 'pixar', 'marvel', 'star wars', 'lucasfilm', 'national geographic', 'nat geo', '20th century', 'searchlight', 'hulu', 'espn'];

const grammarPoints = JSON.parse(readFileSync(join(here, '..', '..', 'src', 'data', 'grammarPoints.json'), 'utf8'));
const GRAMMAR_MENU = grammarPoints
  .filter((p) => p.stage === 'elementary' || p.stage === 'middle')
  .map((p) => `${p.id}: ${p.name}`)
  .join('\n');

async function gemini(parts, json = false) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, mediaResolution: 'MEDIA_RESOLUTION_LOW', ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    const data = await res.json();
    if (res.ok) return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    console.error(`  Gemini ${res.status} (시도 ${attempt}):`, JSON.stringify(data.error ?? data).slice(0, 200));
    if (res.status === 401) token = ''; // 열쇠가 만료됐으면 새로 받는다
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error('Gemini 실패');
}

const SCRIPT_PROMPT =
  'You are making a shadowing script for Korean elementary school students learning English. ' +
  'Watch the video and transcribe every spoken English sentence in order, one sentence per line, in exactly this format:\n' +
  '[m:ss.s-m:ss.s] Speaker: English sentence | 자연스러운 한국어 해석\n' +
  'Rules: times are positions in the FULL video, precise to 0.1 second (start when the sentence begins, end when it finishes); ' +
  'split long narration into short sentences; Speaker is the character who actually says it (listen carefully; use Narrator only for the storyteller); ' +
  'the Korean translation is short and natural for children; output only the lines.';

const PACK_PROMPT = (title, series, level, script) => `You are an English curriculum designer for Korean elementary school English academies.
Below is the timed script of a YouTube video ("${title}", series "${series}"). Split it into self-contained scenes of about 2 to 4 minutes
(a short video can be one scene; never cut in the middle of a conversation). For EACH scene make a lesson pack.

Return JSON: {"clips":[{
 "start": seconds (start of the scene's first line, minus 0.5),
 "end": seconds (end of the scene's last line, plus 0.5),
 "title": short English scene title (e.g. "Muddy Puddles"),
 "summary": one Korean sentence describing the scene for teachers,
 "level": 1-4 (1 = very easy words/short lines, 4 = upper elementary),
 "tags": 2-4 Korean topic tags (e.g. "날씨","가족"),
 "words": 8-12 key words useful for elementary students that APPEAR in the scene: [{"word": base form, "meaning": Korean meaning, "pos": Korean part of speech (명사/동사/형용사/부사/숙어/표현), "example": the exact script sentence where it appears, "exampleKo": Korean of that sentence, "time": start seconds of that line}],
 "questions": exactly 3 simple comprehension questions in English answerable from the scene, in story order: [{"q": question, "a": short full-sentence answer, "qKo": Korean, "aKo": Korean, "time": seconds where the answer is shown}],
 "grammar": pick ONE sentence from the scene that shows a useful grammar pattern for children: {"grammarId": the best matching id from the menu below or null, "sentence": that exact sentence, "sentenceKo": Korean, "time": its start seconds, "point": one short Korean explanation of the pattern (e.g. "should + 동사원형: ~해야 한다"), "drills": 4-6 substitution drills using the same pattern with new simple content: [{"cue": a short English cue in parentheses style like "study English" or "late", "answer": the full new sentence, "answerKo": Korean}]},
 "bingo": 16-25 distinct words (lowercase, as they appear) from the scene's lines suitable for a listening bingo (no names, no "a/the/is")
}]}
Rules: use only words and sentences that really appear in the script for words/example/grammar.sentence; keep English simple and natural; Korean must be natural for children.
The target level hint for this series is ${level}.

Grammar menu (id: name):
${GRAMMAR_MENU}

Script:
${script}`;

const sec = (m, s) => Number(m) * 60 + Number(s);
function linesOf(script) {
  return script
    .split('\n')
    .map((l) => {
      const m = l.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)(?:\s*-\s*(\d{1,2}):(\d{2}(?:\.\d+)?))?\]/);
      return m ? { line: l.trim(), start: sec(m[1], m[2]), end: m[3] ? sec(m[3], m[4]) : sec(m[1], m[2]) + 2 } : null;
    })
    .filter(Boolean);
}

// 리스닝 빙고 낱말: AI 가 대사 낱말을 통째로 주는 경우가 있어 여기서 24개로 추린다 —
// 핵심 단어 → AI 빙고 목록 순서로, 대사에 실제로 나온 3글자 이상 내용어만(이름·기능어 제외)
const STOP = new Set(
  'the and you are was were have has had his her him she they them this that these those what when where who why how there here some very too not yes yay wow okay oh ooh uh but for with from into onto over just can could will would shall should may might must does did doing done been being its it’s it\'s i\'m you\'re we\'re they\'re that\'s what\'s let\'s don\'t can\'t isn\'t aren\'t didn\'t won\'t our your their my mine yours ours then than also only even about again all any each every both either more most much many such own same other another out off our now one two three'.split(' '),
);
function bingoWords(c, inside) {
  const spoken = new Set(inside.flatMap((l) => (l.line.replace(/^\[[^\]]*\]\s*([A-Za-z][\w .'-]{0,19}:\s+)?/, '').split('|')[0].toLowerCase().match(/[a-z']+/g) ?? [])));
  const speakers = new Set(inside.map((l) => l.line.match(/^\[[^\]]*\]\s*([A-Za-z][\w .'-]{0,19}):/)?.[1]?.toLowerCase()).filter(Boolean));
  const out = [];
  for (const w of [...(c.words ?? []).map((x) => x.word), ...(c.bingo ?? [])]) {
    const k = String(w).toLowerCase().trim();
    if (k.length < 3 || k.includes(' ') || STOP.has(k) || speakers.has(k) || !spoken.has(k) || out.includes(k)) continue;
    out.push(k);
    if (out.length >= 24) break;
  }
  return out;
}

const q = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`;
const arr = (a) => `array[${(a ?? []).map(q).join(',')}]::text[]`;

const rows = [];
for (const [i, v] of videos.entries()) {
  const id = v.url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? v.url;
  const from = v.from ?? 0;
  const to = v.to ?? 600;
  const cacheFile = join(CLIPS, `${id}-${from}.json`);
  console.log(`[${i + 1}/${videos.length}] ${v.series} ${id} ${from}-${to}s`);
  let cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null;
  if (!cache) {
    const oembed = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`).then((r) => (r.ok ? r.json() : null));
    if (!oembed) {
      console.log('  건너뜀: 영상을 찾지 못함(비공개·삭제·퍼가기 금지)');
      continue;
    }
    const channel = oembed.author_name ?? '';
    if (BLOCKED.some((w) => `${channel} ${oembed.title}`.toLowerCase().includes(w))) {
      console.log(`  건너뜀: 디즈니 계열(${channel})`);
      continue;
    }
    const raw = await gemini([
      { fileData: { fileUri: `https://www.youtube.com/watch?v=${id}`, mimeType: 'video/*' }, videoMetadata: { startOffset: `${from}s`, endOffset: `${to}s` } },
      { text: SCRIPT_PROMPT },
    ]);
    const script = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\[\d{1,2}:\d{2}/.test(l))
      .join('\n');
    if (!script) {
      console.log('  건너뜀: 대사를 찾지 못함');
      continue;
    }
    // 수업 묶음 JSON 이 가끔 깨져 와서(따옴표·잘림) 세 번까지 다시 받는다
    let packs = null;
    for (let tryN = 1; tryN <= 3 && !packs; tryN++) {
      const packText = await gemini([{ text: PACK_PROMPT(oembed.title, v.series, v.level ?? 2, script) }], true);
      try {
        packs = JSON.parse(packText.replace(/^```(?:json)?\s*|\s*```$/g, '')).clips ?? [];
      } catch {
        writeFileSync(join(OUT, `bad-${id}-${tryN}.txt`), packText);
        console.log(`  수업 묶음 JSON 을 읽지 못함(시도 ${tryN})`);
      }
    }
    if (!packs) {
      console.log('  건너뜀: 수업 묶음 JSON 을 읽지 못함');
      continue;
    }
    cache = { id, from, to, series: v.series, channel, videoTitle: oembed.title, script, clips: packs };
    writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
  }
  if (!cache.clips.length) console.log('  장면이 없음 — 캐시를 지우고 다시 돌리세요');
  const all = linesOf(cache.script);
  // 장면이 겹치면 앞 장면 끝에서 자르고, 볼 구간 끝에 걸린 마지막 장면은 중간에 잘렸을 수 있어 뺀다
  const ordered = [...cache.clips].sort((a, b) => a.start - b.start);
  let prevEnd = -1;
  for (const [n, c] of ordered.entries()) {
    const lastLine = all.filter((l) => l.start < c.end).at(-1);
    const cut = cache.clips.length > 1 && n === ordered.length - 1 && lastLine && lastLine.end >= cache.to - 8 && cache.to < 3600 && !v.whole;
    if (cut) {
      console.log(`  장면 ${n + 1} 뺌: 구간 끝에서 잘렸을 수 있음(${c.title})`);
      continue;
    }
    const inside = all.filter((l) => l.start >= Math.max(c.start - 0.6, prevEnd) && l.start < c.end);
    if (inside.length < 6 || inside.at(-1).end - inside[0].start < 40) continue;
    prevEnd = inside.at(-1).end;
    const start = Math.max(0, Math.floor((inside[0].start - 0.5) * 10) / 10);
    const end = Math.ceil((inside.at(-1).end + 0.5) * 10) / 10;
    const pack = { questions: c.questions ?? [], words: c.words ?? [], grammar: c.grammar ?? null, bingo: bingoWords(c, inside) };
    if (!pack.grammar) delete pack.grammar;
    rows.push(
      `insert into public.video_clips (series, title, summary, youtube_id, channel, start_sec, end_sec, level, tags, script, words, pack, sort_order)
values (${q(cache.series)}, ${q(c.title)}, ${q(c.summary)}, ${q(id)}, ${q(cache.channel)}, ${start}, ${end}, ${Math.min(4, Math.max(1, Number(c.level) || 2))}, ${arr(c.tags)}, ${q(inside.map((l) => l.line).join('\n'))}, ${arr((c.words ?? []).map((w) => w.word))}, ${q(JSON.stringify(pack))}::jsonb, ${i * 100 + n})
on conflict (youtube_id, start_sec) do update set series = excluded.series, title = excluded.title, summary = excluded.summary, channel = excluded.channel, end_sec = excluded.end_sec, level = excluded.level, tags = excluded.tags, script = excluded.script, words = excluded.words, pack = excluded.pack, sort_order = excluded.sort_order;`,
    );
    console.log(`  장면 ${n + 1}: ${c.title} (${Math.round(end - start)}초, ${inside.length}문장)`);
  }
}

const sqlPath = join(OUT, 'clip-library.sql');
writeFileSync(sqlPath, `-- 영상 쉐도잉 라이브러리 장면 ${rows.length}개 (make-clip-library.mjs 가 만듦). 039 실행 뒤 SQL Editor 에서 실행.\n\n${rows.join('\n\n')}\n`);
console.log(`\n${rows.length}개 장면 → ${sqlPath}`);
