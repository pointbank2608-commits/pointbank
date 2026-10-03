// 유튜브 영상 → 쉐도잉 대사표(로컬, Vertex AI·gcloud 로그인). 앱의 "AI로 대사표 만들기"(Edge Function)가
// 배포되기 전에 이걸로 만들어 슬라이드에 붙여넣는다(2026-10-03).
//   node app/scripts/shadow/make-shadow-script.mjs <유튜브 주소> [시작초] [끝초] > script.txt
// 결과: 한 줄에 "[m:ss.s-m:ss.s] 배역: 영어 | 한국어 해석". 대본은 수업 안에만 저장한다(저장소에 넣지 않는다).
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const [url, from = '0', to = '600'] = process.argv.slice(2);
const id = url?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(url ?? '') ? url : null);
if (!id) {
  console.error('사용법: node make-shadow-script.mjs <유튜브 주소> [시작초] [끝초]');
  process.exit(1);
}
const PROJECT = process.env.GCP_PROJECT ?? 'project-01c6d808-a517-4177-82f';
const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
const token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();

const prompt =
  'You are making a shadowing script for Korean elementary school students learning English. ' +
  'Watch the video and transcribe every spoken English sentence in order, one sentence per line, in exactly this format:\n' +
  '[m:ss.s-m:ss.s] Speaker: English sentence | 자연스러운 한국어 해석\n' +
  'Rules: times are positions in the FULL video, precise to 0.1 second (start when the sentence begins, end when it finishes); ' +
  'split long narration into short sentences; Speaker is the character who actually says it (listen carefully: a parent talking to the child is Mommy or Daddy, not Narrator; use Narrator only for the storyteller); ' +
  'the Korean translation is short and natural for children; output only the lines.';

const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${id}`, mimeType: 'video/*' }, videoMetadata: { startOffset: `${from}s`, endOffset: `${to}s` } }, { text: prompt }] }],
    generationConfig: { temperature: 0, mediaResolution: 'MEDIA_RESOLUTION_LOW' },
  }),
});
const data = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(data.error ?? data).slice(0, 400));
  process.exit(1);
}
const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
console.log(text.split('\n').map((l) => l.trim()).filter((l) => /^\[\d{1,2}:\d{2}/.test(l)).join('\n'));
