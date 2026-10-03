// 남은 사전 그림을 구글 AI(Vertex)로 끝까지 채운다 — 커서가 하던 "그림 자리 전부 채우기"를 이어받는다(2026-10-03).
//   node app/scripts/vocab/gemini-fill.mjs [개수 제한]
// 대상: CURSOR_IMAGE_HANDOFF_FILL_ALL.md 표에서 "만들어졌나"가 비어 있고 그림 파일도 없는 단어.
// 단어마다 ① 예문을 글자 없는 "장면 묘사"로 바꾸고(예문을 그대로 넣으면 그림에 문장이 적혀 나온다)
//          ② 그림을 만들고 ③ 그림에 글자가 박혔는지 AI 로 검사해서 박혔으면 다시 만든다(최대 3번).
// 결과는 app/scripts/vocab/out/fill/<id>.png — WebP 변환·사전 폴더로 옮기기는 fill-to-webp.py 가 한다.
// 중간에 꺼져도 다시 돌리면 이어서 한다(이미 있는 파일은 건너뜀). 진행 기록: out/fill/_log.txt
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const imgDir = join(repo, 'app', 'public', 'word-bank-images');
const outDir = join(here, 'out', 'fill');
mkdirSync(outDir, { recursive: true });
const logFile = join(outDir, '_log.txt');
const scenesFile = join(outDir, '_scenes.json');
const log = (s) => {
  const line = `${new Date().toISOString().slice(11, 19)} ${s}`;
  console.log(line);
  appendFileSync(logFile, line + '\n');
};

const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const IMAGE_MODEL = 'gemini-3.1-flash-image';
const TEXT_MODEL = 'gemini-2.5-flash';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 2);
const LIMIT = Number(process.argv[2] ?? 0);

const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
let token = '';
let tokenAt = 0;
function auth() {
  if (Date.now() - tokenAt > 20 * 60 * 1000) {
    token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();
    tokenAt = Date.now();
  }
  return token;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(model, body) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${auth()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT }, body: JSON.stringify(body) });
    } catch {
      await sleep(5000 * attempt);
      continue;
    }
    if (res.status === 401) tokenAt = 0;
    if (!res.ok) {
      await sleep(res.status === 429 ? 20000 * attempt : 4000 * attempt);
      continue;
    }
    return res.json();
  }
  return null;
}

// ── 대상 읽기 ──
const md = readFileSync(join(repo, 'CURSOR_IMAGE_HANDOFF_FILL_ALL.md'), 'utf8');
const targets = [];
for (const line of md.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length < 8 || !/^`[^`]+`$/.test(cells[1])) continue;
  const id = cells[1].slice(1, -1);
  const [word, pos, meaning, scene, example] = cells.slice(2, 7);
  if (existsSync(join(imgDir, `${id}.webp`)) || existsSync(join(outDir, `${id}.png`))) continue;
  targets.push({ id, word, pos, meaning, scene, example });
}
const jobs = LIMIT ? targets.slice(0, LIMIT) : targets;
log(`대상 ${targets.length}개 중 ${jobs.length}개 시작`);

// ── ① 장면 묘사 ──
const scenes = existsSync(scenesFile) ? JSON.parse(readFileSync(scenesFile, 'utf8')) : {};
async function writeScenes(batch) {
  const list = batch.map((t) => `${t.id} | ${t.word} (${t.pos}) = ${t.meaning} | sentence: ${t.example}${t.scene ? ` | must show: ${t.scene}` : ''}`).join('\n');
  const prompt =
    'You write picture briefs for a children\'s English picture dictionary (clay-figure illustrations of cute chunky children and simple objects). ' +
    'For each line below, write ONE short English scene description (max 35 words) that makes the MEANING OF THE WORD obvious at a glance. ' +
    'Base it on the example sentence, or on the "must show" note if there is one (translate it faithfully). Describe only what is visible: who, where, what they are doing, facial expression, key objects. ' +
    'Never quote the sentence, never mention speech bubbles, signs, labels, writing, letters or numbers; if someone speaks, describe mouth and gestures instead. ' +
    'Keep it bright and safe for young children: no blood, injuries, weapons pointed at anyone, alcohol being drunk or smoking. ' +
    'Different words must get clearly different scenes. Answer as a JSON object mapping each id to its scene description, nothing else.\n\n' +
    list;
  const json = await call(TEXT_MODEL, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } });
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    const parsed = JSON.parse(text);
    for (const t of batch) if (typeof parsed[t.id] === 'string') scenes[t.id] = parsed[t.id];
    writeFileSync(scenesFile, JSON.stringify(scenes, null, 1));
  } catch {
    log(`장면 묘사 실패(묶음 ${batch[0].id}~)`);
  }
}
const need = jobs.filter((t) => !scenes[t.id]);
for (let i = 0; i < need.length; i += 40) await writeScenes(need.slice(i, i + 40));
log(`장면 묘사 ${Object.keys(scenes).length}개 준비`);

// ── ② 그림 ③ 글자 검사 ──
const refParts = ['lean', 'muscle'].map((w) => ({ inlineData: { mimeType: 'image/webp', data: readFileSync(join(imgDir, `${w}.webp`)).toString('base64') } }));
const STYLE =
  'You are illustrating an English picture dictionary for children. The two reference images show the ART STYLE ONLY: ' +
  'soft matte 3D plasticine clay with sculpted texture; chunky toddler-like clay figures with a big round head about half of the body height, short arms and legs, big round black eyes and rosy cheeks ' +
  '(adults have the same chunky clay-doll proportions, only a little taller); a plain soft pastel background in one light warm color (cream, peach, soft yellow, light mint or light sky blue); warm soft lighting; square 1:1. ' +
  'Do NOT copy the pose, clothes, hair or composition of the reference images, and do not add the reference children unless the scene needs children. ' +
  'Objects and scenery must also look sculpted from clay (never photorealistic or painted) and be brightly and variously colored. ' +
  'Show the idea clearly and large in the center. Vary the children: girls and boys, different hair colors and clothes. ' +
  'Absolutely NO text, letters, numbers, words, labels, signs with writing, captions or speech bubbles anywhere in the image. ' +
  'No apple, no clock, no bus, no backpack, no chair unless the scene explicitly asks for it.';

async function hasText(png) {
  const json = await call(TEXT_MODEL, {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: png } }, { text: 'Does this picture contain any readable letters, words, numbers or a speech bubble with writing? Answer with exactly one word: YES or NO.' }] }],
    generationConfig: { temperature: 0 },
  });
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return /yes/i.test(text);
}

let done = 0;
let failed = 0;
async function one(t) {
  const scene = scenes[t.id];
  if (!scene) {
    failed++;
    log(`건너뜀(장면 없음) ${t.id}`);
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const json = await call(IMAGE_MODEL, {
      contents: [{ role: 'user', parts: [...refParts, { text: `${STYLE}\n\nDraw: ${scene}` }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    });
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) continue;
    if (attempt < 3 && (await hasText(part.inlineData.data))) {
      log(`글자 있음 → 다시 ${t.id}`);
      continue;
    }
    writeFileSync(join(outDir, `${t.id}.png`), Buffer.from(part.inlineData.data, 'base64'));
    done++;
    if (done % 10 === 0) log(`진행 ${done}/${jobs.length} (실패 ${failed})`);
    return;
  }
  failed++;
  log(`실패 ${t.id}`);
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await one(queue.shift());
  }),
);
log(`끝: 만든 것 ${done}, 실패 ${failed}`);
