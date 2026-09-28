// 구글 AI(Vertex)로 게임 소리 만들기 — 받은 Google Cloud 크레딧에서 차감(2026-09-27).
//   배경음악·효과음: Lyria 3 clip(`lyria-3-clip-preview`, 약 30초 mp3, responseModalities 에 TEXT 도 넣어야 받아 준다)
//   목소리: Gemini TTS(`gemini-2.5-flash-tts`, 24kHz 16bit mono PCM → wav 로 감싼다)
//
// 준비: Google Cloud CLI 로그인(`gcloud auth login`). 조직 정책상 API 키를 못 만들어 로그인 토큰을 쓴다.
//   node app/scripts/sfx/google-audio.mjs <jobs.json> <출력 폴더>
//     jobs.json = [{ "id": "quiz-tension", "kind": "music", "prompt": "..." },
//                  { "id": "voice-great-job", "kind": "voice", "text": "Great job!", "voice": "Puck", "style": "cheerfully" }]
//   이미 있는 파일은 건너뛴다. 효과음처럼 짧게 쓸 소리는 만든 뒤 ffmpeg 로 잘라 쓴다.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const MUSIC_MODEL = process.env.MUSIC_MODEL ?? 'lyria-3-clip-preview';
const TTS_MODEL = process.env.TTS_MODEL ?? 'gemini-2.5-flash-tts';

function gcloudToken() {
  const gcloud = process.env.LOCALAPPDATA
    ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"`
    : 'gcloud';
  return execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();
}

/** 16bit mono PCM 에 wav 머리말을 붙인다 */
function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const [jobsPath, outDir] = process.argv.slice(2);
if (!jobsPath || !outDir) {
  console.error('사용법: node google-audio.mjs <jobs.json> <출력 폴더>');
  process.exit(1);
}
const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
let token = gcloudToken();
const base = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models`;
const failed = [];

for (const job of jobs) {
  const ext = job.kind === 'voice' ? 'wav' : 'mp3';
  const out = join(outDir, `${job.id}.${ext}`);
  if (existsSync(out)) continue;
  const body =
    job.kind === 'voice'
      ? {
          contents: [{ role: 'user', parts: [{ text: `Say ${job.style ?? 'cheerfully'}: ${job.text}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: job.voice ?? 'Puck' } } },
          },
        }
      : {
          contents: [{ role: 'user', parts: [{ text: `${job.prompt}. Instrumental only, no vocals, no singing, no spoken words.` }] }],
          generationConfig: { responseModalities: ['AUDIO', 'TEXT'] },
        };
  const model = job.kind === 'voice' ? TTS_MODEL : MUSIC_MODEL;
  let done = false;
  for (let attempt = 1; attempt <= 5 && !done; attempt++) {
    const res = await fetch(`${base}/${model}:generateContent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
      body: JSON.stringify(body),
    });
    if (res.status === 401) token = gcloudToken();
    if (!res.ok) {
      const msg = (await res.text()).slice(0, 200);
      if (attempt === 5) failed.push(`${job.id}: ${res.status} ${msg}`);
      await new Promise((r) => setTimeout(r, res.status === 429 ? 20000 * attempt : 3000 * attempt));
      continue;
    }
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) {
      if (attempt === 5) failed.push(`${job.id}: 소리 없음 (${json.candidates?.[0]?.finishReason})`);
      continue;
    }
    const buf = Buffer.from(part.inlineData.data, 'base64');
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1] ?? 24000);
    writeFileSync(out, job.kind === 'voice' ? pcmToWav(buf, rate) : buf);
    console.log('ok', job.id);
    done = true;
  }
}
console.log(`완료 ${jobs.length - failed.length}/${jobs.length}`);
if (failed.length) console.log('실패:\n' + failed.join('\n'));
