// 파닉스 음가 음원 만들기(구글 클라우드 음성 합성 + ffmpeg 다듬기). 검수 전 파일은 out/phonemes/ 에만 둔다.
//   node scripts/phonics/gen-phonemes.mjs            # 없는 것만 만든다(--force 로 전부 다시)
//   node scripts/phonics/gen-phonemes.mjs --only=b,c  # 일부만
//   node scripts/phonics/gen-phonemes.mjs --approve   # review.html 에서 내려받은 approved.json 의 규칙만 public/phonics-sounds/ 에 복사
// 글자 이름("에스")이 아니라 발음 기호(IPA)로 소리를 지정한다. 끊어지는 소리(b d g p t k)는 뒤에 붙는 "어"를 자른다.
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const v3 = process.argv.includes('--v3');
const v2 = process.argv.includes('--v2') || v3;
const out = join(here, 'out', v3 ? 'phonemes3' : v2 ? 'phonemes2' : 'phonemes');
const pub = join(app, 'public', 'phonics-sounds');
const rules = JSON.parse(readFileSync(join(app, 'src/data/phonics/curriculum.json'), 'utf8')).rules;
mkdirSync(out, { recursive: true });

// 규칙 id → [소리 기호(IPA), 만드는 방식]
// 구글 음성 합성은 모음이 없는 기호(예: ʃ 하나)를 무시하고 안쪽 글자를 그대로 읽는다. 그래서 자음은 모음 /ɑ/ 를 붙인 음절로 만든 뒤
// segment-phoneme.py 로 자음 부분만 잘라 낸다(cons=앞 자음, stop=끊어지는 앞 자음, final=모음 뒤 자음, vowel=소리 전체).
const L = (ipa, mode = 'cons', cap = 0.6) => [ipa, mode, cap];
const V = (ipa) => [ipa, 'vowel', 0.9];
const S = (ipa) => [ipa, 'stop', 0.16];
const IPA = {
  'letter-a': V('æ'), 'letter-b': S('bɑ'), 'letter-c': S('kɑ'), 'letter-d': S('dɑ'), 'letter-e': V('ɛ'),
  'letter-f': L('fɑ'), 'letter-g': S('ɡɑ'), 'letter-h': L('hɑ'), 'letter-i': V('ɪ'), 'letter-j': L('dʒɑ', 'cons', 0.35),
  'letter-k': S('kɑ'), 'letter-l': L('lɑ'), 'letter-m': L('mɑ'), 'letter-n': L('nɑ'), 'letter-o': V('ɑ'), 'letter-p': S('pɑ'),
  'letter-q': L('kwɑ'), 'letter-r': L('ɹɑ'), 'letter-s': L('sɑ'), 'letter-t': S('tɑ'), 'letter-u': V('ʌ'), 'letter-v': L('vɑ'),
  'letter-w': L('wɑ'), 'letter-x': L('ksɑ'), 'letter-y': L('jɑ'), 'letter-z': L('zɑ'),
  'short-a': V('æ'), 'short-e': V('ɛ'), 'short-i': V('ɪ'), 'short-o': V('ɑ'), 'short-u': V('ʌ'),
  'magic-a': V('eɪ'), 'magic-i': V('aɪ'), 'magic-o': V('oʊ'), 'magic-u': V('ju'),
  'blend-bl': L('blɑ', 'cluster'), 'blend-cl': L('klɑ', 'cluster'), 'blend-fl': L('flɑ', 'cluster'), 'blend-gl': L('ɡlɑ', 'cluster'), 'blend-pl': L('plɑ', 'cluster'),
  'blend-br': L('bɹɑ', 'cluster'), 'blend-cr': L('kɹɑ', 'cluster'), 'blend-dr': L('dɹɑ', 'cluster'), 'blend-fr': L('fɹɑ', 'cluster'), 'blend-gr': L('ɡɹɑ', 'cluster'),
  'blend-pr': L('pɹɑ', 'cluster'), 'blend-tr': L('tɹɑ', 'cluster'), 'blend-st_initial': L('stɑ', 'cluster'), 'blend-sk_initial': L('skɑ', 'cluster'),
  'blend-sk_final': L('skɑ', 'cluster'), 'blend-mp_final': L('mpɑ', 'cluster'), 'blend-nd_final': L('ndɑ', 'cluster'), 'blend-nk_final': L('ŋkɑ', 'cluster'),
  'blend-sh': L('ʃɑ'), 'blend-ch': L('tʃɑ', 'cons', 0.4), 'th-voiceless': L('θɑ'), 'th-voiced': L('ðɑ'), 'blend-wh': L('wɑ'), 'blend-ng': L('ŋɑ'),
  'vowel-ee': V('i'), 'vowel-ea': V('i'), 'vowel-ai': V('eɪ'), 'vowel-ay': V('eɪ'), 'vowel-oa': V('oʊ'),
  'ow-long-o': V('oʊ'), 'oo-short': V('ʊ'), 'oo-long': V('u'), 'vowel-oi': V('ɔɪ'), 'vowel-oy': V('ɔɪ'),
  'vowel-ou': V('aʊ'), 'ow-diphthong': V('aʊ'), 'vowel-ar': V('ɑɹ'), 'vowel-er': V('ɝ'), 'vowel-ir': V('ɝ'),
  'vowel-or': V('ɔɹ'), 'vowel-ur': V('ɝ'),
};
// 2차 방식(--v2): 1차에서 짧거나 반복돼 탈락한 18개만. 이어 붙이기(반복) 대신 한 번 만든 소리를 늘리거나(stretch), 끊어지는 소리는 약한 모음(ə)까지 살려 "크/트"처럼 들리게 한다(fixed).
const ST = (ipa) => [ipa, 'stretch', 0.6];
const FX = (ipa, cap) => [ipa, 'fixed', cap];
const SF = (ipa, cap) => [ipa, 'fstretch', cap]; // 길이를 고정해 자른 뒤 늘린다
const V2 = {
  'letter-c': FX('kə', 0.24), 'letter-k': FX('kə', 0.24), 'letter-g': FX('ɡə', 0.24), 'letter-t': FX('tə', 0.24), 'letter-x': FX('ksə', 0.4),
  'letter-f': SF('fɑ', 0.17), 'letter-h': SF('hɑ', 0.17), 'letter-l': ST('lɑ'), 'letter-m': SF('mɑ', 0.12), 'letter-n': ST('nɑ'), 'letter-r': ST('ɹɑ'),
  'letter-s': ST('sɑ'), 'letter-v': SF('vɑ', 0.14), 'letter-z': ST('zɑ'), 'blend-sh': ST('ʃɑ'), 'th-voiceless': SF('θɑ', 0.17), 'th-voiced': SF('ðɑ', 0.14), 'blend-ng': ST('ŋɑ'),
};
// 3차 방식(--v3): 2차에서 기계음처럼 들려 탈락한 7개. 시간을 늘리지 않고 원래 길이(0.2초 안팎)로 자음만 쓴다.
const C3 = (ipa) => [ipa, 'cons', 0.35];
const V3 = { 'letter-s': C3('sɑ'), 'letter-z': C3('zɑ'), 'letter-v': FX('vɑ', 0.15), 'blend-sh': C3('ʃɑ'), 'th-voiceless': FX('θɑ', 0.18), 'th-voiced': FX('ðɑ', 0.15), 'blend-ng': C3('ŋɑ') };
const VOICE = { languageCode: 'en-US', name: 'en-US-Neural2-H' };

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flag = (k) => process.argv.includes(`--${k}`);

if (flag('approve')) {
  const file = join(out, 'approved.json');
  if (!existsSync(file)) { console.error(`${file} 이 없습니다. review.html 에서 "합격 목록 내려받기" 후 이 폴더에 넣어 주세요.`); process.exit(1); }
  const ok = JSON.parse(readFileSync(file, 'utf8'));
  mkdirSync(pub, { recursive: true });
  let n = 0;
  for (const id of ok) { const src = join(out, `${id}.mp3`); if (existsSync(src)) { copyFileSync(src, join(pub, `${id}.mp3`)); n++; } }
  console.log(`합격 ${ok.length}개 중 ${n}개를 public/phonics-sounds/ 에 복사했습니다. 이어서: node scripts/phonics/sync-phonemes.mjs`);
  process.exit(0);
}

const gcloud = process.env.LOCALAPPDATA ? `"${join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd')}"` : 'gcloud';
const token = execSync(`${gcloud} auth print-access-token`, { encoding: 'utf8' }).trim();
const project = execSync(`${gcloud} config get-value project`, { encoding: 'utf8' }).trim();
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const baseline = { md5: null };
async function request(ssml) {
  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { ssml }, voice: VOICE, audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return Buffer.from((await res.json()).audioContent, 'base64');
}
const md5 = (b) => createHash('md5').update(b).digest('hex');
/** 소리 기호를 읽게 한다. 안쪽 글자는 "banana" — 기호가 무시되면 banana 를 읽으므로(=기준 소리와 같음) 바로 알아챈다. */
async function synth(ipa, slow) {
  baseline.md5 ??= md5(await request('<speak><prosody rate="slow"><phoneme alphabet="ipa" ph="">banana</phoneme></prosody></speak>'));
  const ssml = `<speak><prosody rate="${slow}"><phoneme alphabet="ipa" ph="${ipa}">banana</phoneme></prosody></speak>`;
  const wav = await request(ssml);
  const plain = md5(await request(`<speak><prosody rate="${slow}">banana</prosody></speak>`));
  if (md5(wav) === plain) throw new Error('소리 기호가 무시됨(banana 를 읽음)');
  return wav;
}
const python = process.env.PYTHON || 'python';
const SUSTAIN = new Set(['blend-ng', 'letter-f', 'letter-h', 'letter-l', 'letter-m', 'letter-n', 'letter-r', 'letter-s', 'letter-v', 'letter-z', 'letter-x', 'blend-sh', 'th-voiceless', 'th-voiced']);
function polish(wav, id, mode, cap, template) {
  const raw = join(out, `${id}.raw.wav`), seg = join(out, `${id}.seg.wav`);
  writeFileSync(raw, wav);
  const segMode = mode === 'stretch' ? 'cons' : mode === 'fstretch' ? 'fixed' : mode;
  const r1 = spawnSync(python, [join(here, 'segment-phoneme.py'), raw, seg, segMode, String(mode === 'stretch' ? 0.5 : cap), template, ...(!v2 && SUSTAIN.has(id) ? ['sustain'] : [])], { encoding: 'utf8' });
  if (r1.status !== 0) throw new Error(`segment: ${r1.stderr.slice(-200)}`);
  const secs = Number(r1.stdout.trim());
  let stretch = '';
  if (mode === 'stretch' || mode === 'fstretch') { // 한 번 만든 소리를 약 0.7초가 되게 늘린다(이어 붙이기 없이 시간만 늘림)
    let tempo = Math.min(1, Math.max(0.2, secs / 0.7)); const parts = [];
    while (tempo < 0.5) { parts.push(0.5); tempo /= 0.5; }
    parts.push(tempo); stretch = parts.map((t) => `atempo=${t.toFixed(3)}`).join(',') + ',';
  }
  const af = `${stretch}loudnorm=I=-18:TP=-2:LRA=7,apad=pad_dur=0.05`;
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', seg, '-af', af, '-ar', '44100', '-ac', '1', '-b:a', '96k', join(out, `${id}.mp3`)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  for (const f of (process.env.KEEP_RAW ? [seg] : [raw, seg])) { try { unlinkSync(f); } catch { /* 임시 파일 */ } }
  return secs;
}

const templatePath = join(out, '_vowel-template.wav');
const only = arg('only')?.split(',');
const force = flag('force');
const report = [];
for (const r of rules) {
  if (only && !only.includes(r.id)) continue;
  const dest = join(out, `${r.id}.mp3`);
  if (!force && existsSync(dest)) continue;
  const table = v3 ? V3 : v2 ? V2 : IPA;
  const [ipa, mode, cap] = table[r.id] ?? [];
  if (v2 && !table[r.id]) continue;
  if (!ipa) { console.log(`✗ ${r.id}: 소리 기호 표에 없음`); report.push({ id: r.id, error: 'no ipa' }); continue; }
  try {
    const wav = await synth(ipa, mode === 'stop' ? 'x-slow' : 'slow');
    if (!existsSync(templatePath)) writeFileSync(templatePath, await synth('ɑ', 'slow'));
    const secs = polish(wav, r.id, mode, cap, templatePath);
    report.push({ id: r.id, ipa, mode, secs });
    console.log(`✓ ${r.id.padEnd(18)} /${ipa}/ ${mode} ${secs}s`);
  } catch (e) { console.log(`✗ ${r.id}: ${e.message}`); report.push({ id: r.id, ipa, error: e.message }); }
}

// 검수 페이지(들어 보고 합격에 체크 → "합격 목록 내려받기" → approved.json 을 이 폴더에 두고 --approve)
const meta = rules.map((r) => ({ id: r.id, name: r.name, ipa: (IPA[r.id]?.[0] ?? '').replace(/ɑ/g, (m, i, str) => (IPA[r.id]?.[1] === 'vowel' ? m : '')), ex: [...new Set(r.groups.flatMap((g) => g.patterns))].slice(0, 3).map((p) => p.replace(/[{}]/g, '')).join(', '), has: existsSync(join(out, `${r.id}.mp3`)) }));
writeFileSync(join(out, 'review.html'), `<!doctype html><meta charset="utf-8"><title>파닉스 음가 검수</title>
<style>body{font:16px system-ui;margin:20px;max-width:900px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}button{font-size:16px;padding:4px 12px}audio{height:34px;width:220px}.bad td{background:#fff3f0}</style>
<h1>파닉스 음가 검수 (${meta.filter((m) => m.has).length} / ${meta.length})</h1>
<p>재생 막대를 눌러 들어 보고(소리가 안 나면 컴퓨터 볼륨과, 이 파일을 크롬·엣지 같은 일반 브라우저에서 여는지 확인하세요) <b>그 글자의 소리(/s/ 같은)가 정확할 때만</b> 합격에 체크하세요. "버", "에스"처럼 들리면 체크하지 마세요. 끝나면 아래 버튼으로 approved.json 을 내려받아 이 폴더에 두세요.</p>
<button onclick="dl()">합격 목록 내려받기</button> <span id="n"></span>
<table><tr><th>합격</th><th>듣기</th><th>규칙</th><th>소리</th><th>예시 낱말</th></tr>
${meta.map((m) => `<tr><td><input type="checkbox" data-id="${m.id}" ${m.has ? '' : 'disabled'} onchange="cnt()"></td><td>${m.has ? `<audio controls preload="none" src="data:audio/mpeg;base64,${readFileSync(join(out, `${m.id}.mp3`)).toString('base64')}"></audio>` : '-'}</td><td>${m.id}</td><td>/${m.ipa}/</td><td>${m.ex}</td></tr>`).join('\n')}
</table>
<script>function ids(){return [...document.querySelectorAll('input:checked')].map(i=>i.dataset.id)}
function cnt(){document.getElementById('n').textContent=ids().length+'개 선택'}
function dl(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(ids(),null,1)],{type:'application/json'}));a.download='approved.json';a.click()}</script>`);
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(`\n완료: ${report.filter((x) => !x.error).length}개 만듦, 실패 ${report.filter((x) => x.error).length}개 → ${join(out, 'review.html')}`);
