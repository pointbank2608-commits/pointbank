/**
 * 노래 수업 자료(인쇄물) 만들기(2026-10-12) — 가사에서 고른 단어·숙어·문법으로 한 장짜리 학습지를 짠다.
 * 구성은 교재 같은 자료를 기준으로 했다: ① 단어·숙어 표(품사·뜻·쓰임) ② 이 노래의 문법 카드(설명·이럴 때 써요·
 * 틀리기 쉬운 것 ✗/✓·연습 예문·이 노래에서 찾은 줄) ③ 줄별 문법·표현 포인트.
 * AI 없이 만들고, 설명은 문법 라이브러리(검수된 데이터)에서 그대로 가져온다. 줄 해석은 선생님이 가사에
 * "| 해석"으로 붙여 넣은 것만 쓴다(없으면 비워 둔다). 결과는 앱 CSS가 필요 없는 완결된 HTML 문자열이다.
 * 가사는 이 화면·인쇄물 안에서만 쓰고 어디에도 저장하지 않는다.
 */
import { grammarLevelTag, plainText } from './grammar';
import type { LyricGrammar } from './lyricGrammar';
import { grammarMatchesOfLine } from './lyricGrammar';
import { cleanLyricLines } from './lyricWords';

export interface HandoutVocabRow {
  word: string;
  pos: string;
  meaning: string;
  /** 사전 예문(있으면) */
  example: string;
  /** 가사에서 나온 줄 */
  line: string;
}

export interface HandoutInput {
  title: string;
  /** 붙여 넣은 가사 원문(시간표·| 해석 포함) */
  source: string;
  rows: HandoutVocabRow[];
  grammar: LyricGrammar[];
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** **강조** → <b> (나머지는 이스케이프) */
const bold = (s: string): string => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** 가사에 붙은 "| 해석"을 줄별로 읽는다(영어 줄 → 해석) */
export function lyricTranslations(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of source.split(/\r?\n/)) {
    const bar = raw.indexOf('|');
    if (bar < 0) continue;
    const ko = raw.slice(bar + 1).trim();
    const en = cleanLyricLines(raw.slice(0, bar))[0];
    if (en && ko && !out.has(norm(en))) out.set(norm(en), ko);
  }
  return out;
}

/** 맞은 부분(풀어 쓴 꼴)이 아니라 원문 줄에서 눈에 띄게 하려고, 줄 전체를 보여 주고 찾은 부분은 옆에 적는다 */
function lineCell(line: string, translation: string | undefined): string {
  return `<div class="en">${esc(line)}</div>${translation ? `<div class="ko">${esc(translation)}</div>` : ''}`;
}

export function buildLyricHandoutHtml(input: HandoutInput): string {
  const trans = lyricTranslations(input.source);
  const lines = cleanLyricLines(input.source);
  const seen = new Set<string>();
  const uniqueLines = lines.filter((l) => {
    const k = norm(l);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // ① 단어·숙어 표
  const vocabRows = input.rows
    .map(
      (r, i) => `<tr>
  <td class="num">${i + 1}</td>
  <td class="w">${esc(r.word)}</td>
  <td class="pos">${esc(r.pos)}</td>
  <td>${esc(r.meaning)}</td>
  <td class="use">${r.example ? `<div>${esc(r.example)}</div>` : ''}<div class="song">♪ ${esc(r.line)}</div></td>
</tr>`,
    )
    .join('\n');
  const vocabSection =
    input.rows.length > 0
      ? `<h2>UNIT 1 · 단어와 표현</h2>
<table><thead><tr><th>#</th><th>영단어 / 표현</th><th>품사</th><th>뜻</th><th>쓰임 (♪ = 이 노래에서)</th></tr></thead>
<tbody>${vocabRows}</tbody></table>`
      : '';

  // ② 문법 카드
  const grammarCards = input.grammar
    .map((g) => {
      const p = g.point;
      const list = (items: string[] | undefined): string =>
        items && items.length > 0 ? `<ul>${items.map((x) => `<li>${bold(x)}</li>`).join('')}</ul>` : '';
      const pit = (p.pitfalls ?? [])
        .slice(0, 2)
        .map(
          (x) =>
            `<div class="pit"><span class="bad">✗ ${bold(x.wrong)}</span><span class="good">✓ ${bold(x.right)}</span><span class="why">${esc(x.why)}</span></div>`,
        )
        .join('');
      const ex = p.examples
        .slice(0, 3)
        .map((e, i) => `<li>${bold(e)}${p.translations?.[i] ? `<span class="ko"> — ${esc(p.translations[i])}</span>` : ''}</li>`)
        .join('');
      const hits = g.hits
        .slice(0, 3)
        .map((h) => `<li>♪ ${esc(h.line)} <span class="found">→ ${esc(h.match)}</span></li>`)
        .join('');
      return `<section class="card">
  <h3>${esc(plainText(p.name))} <span class="tag">${esc(grammarLevelTag(p))}</span></h3>
  <p class="lead">${bold(p.explain)}</p>
  ${p.usage && p.usage.length ? `<h4>이럴 때 써요</h4>${list(p.usage)}` : ''}
  ${p.detail && p.detail.length ? `<h4>쉽게 이해하기</h4>${list(p.detail)}` : p.rule && p.rule.length ? `<h4>규칙</h4>${list(p.rule)}` : ''}
  ${pit ? `<h4>틀리기 쉬운 것</h4>${pit}` : ''}
  ${ex ? `<h4>연습 예문</h4><ul>${ex}</ul>` : ''}
  ${hits ? `<h4>이 노래에서 찾은 곳</h4><ul class="hits">${hits}</ul>` : ''}
  ${p.tip ? `<p class="tipbox">한 줄 정리 · ${esc(p.tip)}</p>` : ''}
</section>`;
    })
    .join('\n');
  const grammarSection = input.grammar.length > 0 ? `<h2>UNIT 2 · 이 노래로 배우는 문법</h2>\n${grammarCards}` : '';

  // ③ 줄별 포인트 — 고른 숙어·문법이 들어 있는 줄만
  const chosen = new Set(input.grammar.map((g) => g.id));
  const phraseWords = input.rows.map((r) => ({ word: r.word, line: norm(r.line) }));
  const lineRows: string[] = [];
  uniqueLines.forEach((line) => {
    const k = norm(line);
    const gram = grammarMatchesOfLine(line).filter((m) => chosen.has(m.id));
    const gramNames = gram
      .map((m) => input.grammar.find((g) => g.id === m.id))
      .filter((g): g is LyricGrammar => !!g)
      .map((g) => `<span class="chip g">${esc(plainText(g.point.name))}</span>`);
    const vocab = phraseWords.filter((r) => r.line === k).map((r) => `<span class="chip v">${esc(r.word)}</span>`);
    if (gramNames.length + vocab.length === 0) return;
    lineRows.push(`<tr><td class="num">${lineRows.length + 1}</td><td>${lineCell(line, trans.get(k))}</td><td>${[...vocab, ...gramNames].join(' ')}</td></tr>`);
  });
  const lineSection =
    lineRows.length > 0
      ? `<h2>UNIT 3 · 줄별 표현·문법 포인트</h2>
<table><thead><tr><th>#</th><th>가사</th><th>단어·표현 / 문법</th></tr></thead><tbody>${lineRows.join('\n')}</tbody></table>`
      : '';

  const title = esc(input.title.trim() || '노래 수업 자료');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif; color: #1c2a3a; font-size: 12.5px; line-height: 1.6; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 2px; color: #0b3a6b; }
  .sub { color: #5b6b7c; margin: 0 0 14px; }
  h2 { font-size: 15px; margin: 18px 0 8px; padding: 5px 10px; background: #e6f0fb; color: #0b3a6b; border-left: 4px solid #2765a8; }
  h3 { font-size: 15px; margin: 0 0 4px; color: #0b3a6b; }
  h4 { font-size: 12px; margin: 8px 0 2px; color: #2765a8; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #c8d4e2; padding: 5px 7px; vertical-align: top; text-align: left; }
  th { background: #f1f6fc; font-size: 12px; }
  td.num { width: 28px; text-align: center; color: #5b6b7c; }
  td.w { font-weight: 700; white-space: nowrap; }
  td.pos { color: #5b6b7c; white-space: nowrap; }
  td.use .song { color: #5b6b7c; font-size: 11.5px; }
  .card { border: 1px solid #c8d4e2; border-radius: 8px; padding: 10px 12px; margin: 0 0 10px; break-inside: avoid; }
  .lead { margin: 0 0 4px; font-weight: 600; }
  ul { margin: 2px 0 4px; padding-left: 18px; }
  li { margin: 1px 0; }
  .tag { font-size: 11px; font-weight: 400; color: #5b6b7c; border: 1px solid #c8d4e2; border-radius: 10px; padding: 0 7px; margin-left: 4px; }
  .pit { display: flex; flex-wrap: wrap; gap: 2px 10px; margin: 2px 0; }
  .bad { color: #b3261e; } .good { color: #17653a; } .why { color: #5b6b7c; }
  .ko { color: #5b6b7c; }
  .found { color: #2765a8; font-weight: 600; }
  .tipbox { margin: 6px 0 0; padding: 5px 8px; background: #fff6d6; border-radius: 6px; }
  .chip { display: inline-block; border-radius: 10px; padding: 0 8px; margin: 1px 2px 1px 0; font-size: 11.5px; }
  .chip.v { background: #e6f0fb; color: #0b3a6b; } .chip.g { background: #fde8c8; color: #7a4a00; }
  .en { font-weight: 600; }
  footer { margin-top: 14px; color: #8a97a6; font-size: 10.5px; }
</style></head>
<body>
<h1>${title}</h1>
<p class="sub">노래로 배우는 영어 · 클래스뱅크 수업 자료</p>
${vocabSection}
${grammarSection}
${lineSection}
<footer>가사의 저작권은 원저작자에게 있습니다. 이 자료는 수업 목적의 학습용으로만 사용하세요.</footer>
</body></html>`;
}
