// 파닉스 음가 음원 목록·누락 확인·매니페스트 갱신:  node scripts/phonics/sync-phonemes.mjs
//  - public/phonics-sounds/<ruleId>.mp3 가 있는 규칙을 src/data/phonics/phoneme-audio.json 에 적는다.
//  - docs/phonics-sound-list.md (녹음할 목록 표)를 다시 쓴다.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const rules = JSON.parse(readFileSync(join(app, 'src/data/phonics/curriculum.json'), 'utf8')).rules;
const stageName = { alphabet: '알파벳', 'short-vowels': '단모음', 'magic-e': '매직 e', consonants: '자음군·묶음', 'vowel-teams': '모음 조합' };
// 소리 설명(들려줄 때 주의할 점) — 비어 있으면 알파벳 소리 그대로
const NOTE = {
  'letter-c': '/k/ (cat)', 'letter-g': '/g/ (go)', 'letter-q': '/kw/ (queen) 또는 /k/', 'letter-x': '/ks/ (box)', 'letter-y': '/y/ (yes)',
  'short-a': '/æ/ apple', 'short-e': '/e/ egg', 'short-i': '/ɪ/ igloo', 'short-o': '/ɒ/ octopus', 'short-u': '/ʌ/ umbrella',
  'magic-a': '/eɪ/ cake', 'magic-i': '/aɪ/ bike', 'magic-o': '/oʊ/ nose', 'magic-u': '/juː/ cube',
  'blend-sh': '/ʃ/ ship', 'blend-ch': '/tʃ/ chip', 'th-voiceless': '/θ/ thin (숨만)', 'th-voiced': '/ð/ this (성대 울림)', 'blend-wh': '/w/ whale', 'blend-ng': '/ŋ/ ring',
  'vowel-ee': '/iː/ bee', 'vowel-ea': '/iː/ eat', 'vowel-ai': '/eɪ/ rain', 'vowel-ay': '/eɪ/ day', 'vowel-oa': '/oʊ/ boat', 'ow-long-o': '/oʊ/ snow',
  'oo-short': '/ʊ/ book', 'oo-long': '/uː/ moon', 'vowel-oi': '/ɔɪ/ coin', 'vowel-oy': '/ɔɪ/ boy', 'vowel-ou': '/aʊ/ out', 'ow-diphthong': '/aʊ/ cow',
  'vowel-ar': '/ɑːr/ car', 'vowel-er': '/ɜːr/ her', 'vowel-ir': '/ɜːr/ bird', 'vowel-or': '/ɔːr/ fork', 'vowel-ur': '/ɜːr/ turn',
};
const dir = join(app, 'public/phonics-sounds');
const files = existsSync(dir) ? readdirSync(dir) : [];
const have = new Set(files.filter((f) => /\.mp3$/i.test(f)).map((f) => f.replace(/\.mp3$/i, '')));
const ids = new Set(rules.map((r) => r.id));
const extra = [...have].filter((id) => !ids.has(id));
const available = rules.map((r) => r.id).filter((id) => have.has(id));
writeFileSync(join(app, 'src/data/phonics/phoneme-audio.json'), JSON.stringify({ available }, null, 2) + '\n');
const rows = rules.map((r) => {
  const ex = [...new Set(r.groups.flatMap((g) => g.patterns))].slice(0, 3).map((p) => p.replace(/[{}]/g, '')).join(', ');
  return `| ${have.has(r.id) ? '✅' : '⬜'} | \`${r.id}\` | ${stageName[r.stageId] ?? r.stageId} | ${r.name} | ${NOTE[r.id] ?? ''} | ${ex} |`;
});
writeFileSync(join(app, '..', 'docs/phonics-sound-list.md'), `# 파닉스 음가 녹음 목록

규칙 ${rules.length}개 × 파일 1개. 파일 이름은 \`app/public/phonics-sounds/<규칙 id>.mp3\`, 길이 1초 안팎(소리만, "에스" 같은 글자 이름 말고 /s/ 소리), 앞뒤 무음 최소, 같은 목소리·같은 크기로.
녹음 뒤 \`node app/scripts/phonics/sync-phonemes.mjs\` 를 실행하면 이 표와 \`src/data/phonics/phoneme-audio.json\`이 갱신되고, 파일이 있는 규칙에만 게임에 "소리 듣기" 버튼이 나온다.
자음군(bl·cl 등)은 두 소리를 이어서 한 번에(/bl/) 녹음한다. 음원은 직접 녹음하거나 CC0·CC-BY 파일(출처 표시)만 쓴다 — 비상업(NC) 라이선스는 쓰지 않는다.

완료 ${available.length} / ${rules.length}

| 완료 | 규칙 id | 단계 | 이름 | 소리 | 예시 낱말 |
|---|---|---|---|---|---|
${rows.join('\n')}
`);
console.log(`규칙 ${rules.length}개 · 음원 ${available.length}개 · 누락 ${rules.length - available.length}개`);
if (extra.length) console.log('규칙에 없는 파일(이름 확인):', extra.join(', '));
