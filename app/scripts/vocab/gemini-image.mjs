// Gemini(Nano Banana 2)로 클레이 화풍 단어 그림을 만든다 — Vertex AI 경유(받은 Google Cloud 크레딧에서 차감).
//
// 준비(한 번만): Google Cloud CLI 설치 → `gcloud auth login`(또는 `gcloud init`). API 키는 조직 정책상 못 만들어서
// gcloud 로그인 토큰을 쓴다. AI Studio 키(GEMINI_API_KEY)는 선불 충전이 있어야 해서 쓰지 않는다.
//
//   node app/scripts/vocab/gemini-image.mjs <jobs.json> <출력 폴더>
//     jobs.json = [{ "id": "cat", "prompt": "a cute cat sitting" }, ...]
//   → <출력 폴더>/<id>.png (이미 있으면 건너뜀). WebP 변환·저장 위치 결정은 따로 한다(기존 그림을 덮어쓰지 않게).
//
// 그림 안 글자 금지(AI가 글자를 깨뜨린다), 화풍은 기존 사전 그림 두 장을 참고 그림으로 넣어 맞춘다.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imgDir = join(here, '..', '..', 'public', 'word-bank-images');

const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
const REFS = (process.env.STYLE_REFS ?? 'lean,muscle').split(',');
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 1); // 새 프로젝트는 분당 한도가 낮아(429) 기본은 하나씩

// 참고 그림은 아이 한 명만 서 있는 두 장(lean·muscle) — 물건이 있는 그림을 주면 그 물건이 엉뚱한 단어에 끼어든다.
// 사전 그림이 아닌 것(게임 배경 등)을 만들 때는 STYLE_TEXT·ASPECT 환경 변수로 지시문과 비율을 바꾼다.
const ASPECT = process.env.ASPECT ?? '1:1';
const STYLE =
  process.env.STYLE_TEXT ??
  'You are illustrating an English picture dictionary for children. The two reference images show the ART STYLE ONLY: ' +
  'soft matte 3D plasticine clay with sculpted texture; chunky toddler-like clay figures with a big round head about half of the body height, ' +
  'short arms and legs, big round black eyes and rosy cheeks (adults have the same chunky clay-doll proportions, only a little taller); ' +
  'a plain soft pastel background in one light warm color (cream, peach, soft yellow, light mint or light sky blue); warm soft lighting; square 1:1. ' +
  'Do NOT copy the pose, clothes, hair or composition of the reference images, and do not add the reference children unless the scene needs children. ' +
  'Objects and scenery must also look sculpted from clay (never photorealistic or painted) and be brightly and variously colored. ' +
  'Show the idea clearly and large in the center. Vary the children: girls and boys, different hair colors and clothes. ' +
  'Absolutely NO text, letters, numbers, words, labels, signs with writing, captions or speech bubbles anywhere in the image. ' +
  'No apple, no clock, no bus, no backpack, no chair unless the scene explicitly asks for it.';

function gcloudToken() {
  const gcloud = process.env.LOCALAPPDATA
    ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"`
    : 'gcloud';
  return execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();
}

const [jobsPath, outDir] = process.argv.slice(2);
if (!jobsPath || !outDir) {
  console.error('사용법: node gemini-image.mjs <jobs.json> <출력 폴더>');
  process.exit(1);
}
const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
// 참고 그림: 사전 그림 id(예: lean) 또는 파일 경로(예: C:/.../scene.png — 이미 만든 그림을 고쳐 그릴 때)
const refParts = REFS.filter(Boolean).map((w) => {
  const isPath = /[\/]/.test(w);
  const file = isPath ? w : join(imgDir, `${w}.webp`);
  const mimeType = file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  return { inlineData: { mimeType, data: readFileSync(file).toString('base64') } };
});
let token = gcloudToken();
const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;

let inTok = 0;
let outTok = 0;
const failed = [];

async function one(job) {
  const out = join(outDir, `${job.id}.png`);
  if (existsSync(out)) return;
  const body = {
    contents: [{ role: 'user', parts: [...refParts, { text: `${STYLE}\n\nDraw: ${job.prompt}` }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ASPECT } },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
      body: JSON.stringify(body),
    });
    if (res.status === 401) token = gcloudToken();
    if (!res.ok) {
      const msg = (await res.text()).slice(0, 300);
      if (attempt === 5) failed.push(`${job.id}: ${res.status} ${msg}`);
      await new Promise((r) => setTimeout(r, res.status === 429 ? 20000 * attempt : 3000 * attempt));
      continue;
    }
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) {
      if (attempt === 5) failed.push(`${job.id}: 그림 없음 (${json.candidates?.[0]?.finishReason})`);
      continue;
    }
    inTok += json.usageMetadata?.promptTokenCount ?? 0;
    outTok += json.usageMetadata?.candidatesTokenCount ?? 0;
    writeFileSync(out, Buffer.from(part.inlineData.data, 'base64'));
    console.log('ok', job.id);
    return;
  }
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await one(queue.shift());
  }),
);
// Vertex 정가 기준 어림(입력 $0.5/1M, 출력 이미지 $60/1M 토큰) — 실제 청구는 결제 콘솔에서 확인
const usd = (inTok * 0.5 + outTok * 60) / 1e6;
console.log(`완료 ${jobs.length - failed.length}/${jobs.length}, 토큰 입력 ${inTok} 출력 ${outTok}, 약 $${usd.toFixed(2)}`);
if (failed.length) console.log('실패:\n' + failed.join('\n'));
