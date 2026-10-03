// 그리지 않는 단어(death·murder 등)의 대체 그림 — "그림 대신 X 카드를 든 아이" 한 장을 같이 쓴다(2026-10-04 사용자 요청).
//   node app/scripts/vocab/make-placeholder.mjs   → out/placeholder-1~3.png (골라서 public/word-bank-images/_no-picture.webp 로)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imgDir = join(here, '..', '..', 'public', 'word-bank-images');
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
const token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();

const refs = ['lean', 'muscle'].map((w) => ({ inlineData: { mimeType: 'image/webp', data: readFileSync(join(imgDir, `${w}.webp`)).toString('base64') } }));
const prompt =
  'You are illustrating an English picture dictionary for children. The reference images show the ART STYLE ONLY: soft matte 3D plasticine clay, ' +
  'chunky toddler-like clay figure with a big round head, big round black eyes and rosy cheeks, plain soft pastel light gray-blue background, warm soft lighting, square 1:1. ' +
  'Draw: one calm, gentle child standing in the center and holding up with both hands a big round white card that shows only a large, simple, soft red X mark. ' +
  'The child has a calm, kind, slightly serious face (not scared, not sad). Nothing else in the scene. ' +
  'Absolutely NO text, letters, numbers or words anywhere — the X mark is the only symbol.';

for (let i = 1; i <= 3; i++) {
  const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/gemini-3.1-flash-image:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [...refs, { text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } } }),
  });
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    console.log(i, '실패', res.status);
    continue;
  }
  writeFileSync(join(out, `placeholder-${i}.png`), Buffer.from(part.inlineData.data, 'base64'));
  console.log(i, 'ok');
}
