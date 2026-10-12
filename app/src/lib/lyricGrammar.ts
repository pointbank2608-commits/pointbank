/**
 * 노래 가사에서 "이 노래로 가르칠 수 있는 문법"을 찾는다(2026-10-12). AI 없이 규칙만으로:
 * 가사 줄을 풀어 쓴 꼴(I'm → i am, don't → do not, leavin' → leaving)로 바꿔 문법 규칙을 맞춰 보고,
 * 맞은 규칙은 문법 라이브러리(grammarPoints.json)의 항목과 이어서 설명·틀리기 쉬운 것·예문을 그대로 보여 준다.
 * 가사 원문은 저장하지 않는다 — 화면과 인쇄물 안에서만 쓰고, 선생님이 고른 문법만 단어장에 담긴다.
 * 규칙은 "틀릴 수 있는 자동 감지"라서 화면이 맞은 줄을 같이 보여 주고 선생님이 고른다.
 */
import { GRAMMAR_POINTS, type GrammarPoint } from './grammar';
import { cleanLyricLines } from './lyricWords';

export interface LyricGrammarHit {
  /** 가사 줄(정리된 원문) */
  line: string;
  /** 규칙이 맞은 부분(풀어 쓴 꼴) — 예: "have been" */
  match: string;
}

export interface LyricGrammar {
  id: string;
  point: GrammarPoint;
  count: number;
  /** 처음 나온 줄 번호 */
  firstAt: number;
  hits: LyricGrammarHit[];
}

const MAX_HITS = 4;

/** -ing 로 끝나지만 동사 진행형이 아닌 낱말 */
const NOT_VERBING = new Set([
  'thing', 'things', 'something', 'anything', 'nothing', 'everything', 'morning', 'evening', 'ceiling', 'during', 'building',
  'wedding', 'king', 'ring', 'spring', 'string', 'wing', 'swing', 'sing', 'bring', 'sting', 'feeling', 'darling', 'meaning',
  'beginning', 'ending', 'amazing', 'boring', 'exciting', 'interesting', 'surprising',
]);
/** -ed 로 끝나지만 수동태가 아니라 형용사로 쓰는 말 */
const ADJ_ED = new Set([
  'tired', 'scared', 'excited', 'bored', 'worried', 'married', 'interested', 'surprised', 'afraid', 'confused', 'shocked',
  'pleased', 'satisfied', 'frightened', 'annoyed', 'amazed', 'disappointed', 'embarrassed', 'crazy', 'blessed',
]);
const IRREGULAR_PAST =
  'went came saw took gave got made said knew thought told felt left kept found ran sang fell broke heard met brought bought built wrote ate drank flew grew held lost paid sat slept stood taught won wore did had was were';
const PRONOUN = '(?:i|you|he|she|it|we|they|who|what)';
const OBJ = '(?:me|you|him|her|us|them|it)';

/** 가사 줄을 규칙이 읽기 쉬운 꼴로: 소문자, 줄임말 풀기 */
export function expandLyricLine(line: string): string {
  let s = line.toLowerCase().replace(/[’‘`´]/g, "'");
  s = s
    .replace(/\bcan't\b/g, 'can not')
    .replace(/\bcannot\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bain't\b/g, 'is not')
    .replace(/\b([a-z]+)n't\b/g, '$1 not')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\b([a-z]+)'re\b/g, '$1 are')
    .replace(/\b([a-z]+)'ve\b/g, '$1 have')
    .replace(/\b([a-z]+)'ll\b/g, '$1 will')
    .replace(/\b(it|he|she|that|there|what|who|where|how)'s\b/g, '$1 is')
    .replace(/\bgonna\b/g, 'going to')
    .replace(/\bwanna\b/g, 'want to')
    .replace(/\bgotta\b/g, 'got to')
    .replace(/\b([a-z]+)in'(?=\s|$|[,.!?])/g, '$1ing')
    .replace(/(^|\s)'cause\b/g, '$1because');
  return s.replace(/\s+/g, ' ').trim();
}

type Matcher = (line: string) => string | null;

const re = (pattern: string, flags = ''): Matcher => {
  const r = new RegExp(pattern, flags);
  return (line) => {
    const m = line.match(r);
    return m ? m[0] : null;
  };
};

/** 정규식으로 맞춘 뒤 맞은 낱말이 조건을 통과해야 할 때 */
const reWhen = (pattern: string, ok: (m: RegExpMatchArray) => boolean): Matcher => {
  const r = new RegExp(pattern, 'g');
  return (line) => {
    for (const m of line.matchAll(r)) if (ok(m)) return m[0];
    return null;
  };
};

const RULES: { id: string; match: Matcher }[] = [
  // 시제
  {
    id: 'm-present-perfect',
    match: re(
      "\\b(?:have|has)\\s+(?:(?:never|ever|just|already|not|still|always)\\s+)?(?:been|gone|done|seen|known|had|made|said|got(?:ten)?|found|felt|left|lost|met|come|become|taken|given|written|broken|chosen|forgotten|tried|heard|kept|held|told|thought|brought|stood|sung|run|[a-z]{3,}ed)\\b",
    ),
  },
  {
    id: 'present-progressive',
    match: reWhen('\\b(?:am|is|are)\\s+(?:not\\s+|still\\s+|always\\s+|just\\s+|really\\s+)?([a-z]{3,})ing\\b', (m) => !NOT_VERBING.has(`${m[1]}ing`)),
  },
  {
    id: 'm-past-progressive',
    match: reWhen('\\b(?:was|were)\\s+(?:not\\s+|still\\s+|just\\s+)?([a-z]{3,})ing\\b', (m) => !NOT_VERBING.has(`${m[1]}ing`)),
  },
  { id: 'past-irregular', match: re(`\\b${PRONOUN}\\s+(?:${IRREGULAR_PAST.split(' ').join('|')})\\b`) },
  { id: 'past-regular', match: re('\\b(?:i|you|he|she|it|we|they)\\s+[a-z]{3,}ed\\b') },
  { id: 'future', match: re('\\b(?:will|going to)\\s+(?:not\\s+)?[a-z]+') },
  // 접속사·절
  { id: 'as-long-as', match: re('\\bas long as\\b') },
  { id: 'so-that-purpose', match: re('\\bso that\\b') },
  { id: 'm-because-although', match: re('\\b(?:although|though)\\b') },
  { id: 'because', match: re('\\bbecause\\b') },
  { id: 'm-if-conditional', match: re('\\bif\\b(?!\\s+only)') },
  { id: 'm-subjunctive', match: re('\\bif\\s+(?:i|you|he|she|it|we|they)\\s+(?:were|had|could|would)\\b') },
  { id: 'h-wish-as-if', match: re('\\bi wish\\b|\\bas if\\b|\\bas though\\b') },
  {
    id: 'm-conj-when-if-that',
    match: re(
      '\\b(?:when|while)\\s+(?:i|you|he|she|it|we|they|the|a|my|your)\\b|\\band that\\s+(?:i|you|he|she|it|we|they)\\b|\\b(?:say|says|said|know|think|believe|hope|guess|feel|wish)\\s+that\\b',
    ),
  },
  {
    id: 'm-indirect-question',
    match: re(
      "\\b(?:care|know|knows|knew|tell|tells|told|wonder|wonders|understand|ask|asked|see|remember|guess|show|shows)\\s+(?:me\\s+|you\\s+)?(?:who|what|where|when|why|how|which)\\b|^(?:and\\s+)?(?:who|what|where|when|why|how)\\s+(?:you|i|he|she|it|we|they)\\s+[a-z]+",
    ),
  },
  { id: 'wh-questions', match: (line) => (/\?\s*$/.test(line) ? line.match(/^(?:who|what|where|when|why|how|which)\b/)?.[0] ?? null : null) },
  // 동사 모양
  { id: 'm-modals', match: re('\\b(?:can|could|may|might|must|should|would|shall)\\s+(?:not\\s+)?[a-z]+') },
  { id: 'have-to-should', match: re('\\b(?:have|has|had)\\s+to\\s+[a-z]+|\\bshould\\b|\\bought to\\b') },
  {
    id: 'm-to-inf-noun',
    match: re(
      '\\b(?:want|wants|wanted|need|needs|needed|try|tried|tries|hope|hoped|plan|decide|decided|learn|learned|love|loved|like|liked|start|started|begin|began|wish|wished|promise|promised|used|seem|seems|seemed|meant|mean|means)\\s+to\\s+[a-z]+',
    ),
  },
  {
    id: 'm-gerund',
    match: reWhen(
      '\\b(?:enjoy|enjoys|enjoyed|stop|stops|stopped|keep|keeps|kept|finish|finished|mind|avoid|imagine|love|like|start|begin|hate|miss|remember|of|for|about|without|by|in|on|at|from)\\s+([a-z]{3,})ing\\b',
      (m) => !NOT_VERBING.has(`${m[1]}ing`),
    ),
  },
  {
    id: 'm-passive',
    match: reWhen(
      '\\b(?:is|are|was|were|be|been|being)\\s+(?:not\\s+)?((?:[a-z]{3,}ed)|born|made|written|known|given|taken|seen|broken|chosen|found|left|lost|done|called|hidden|forgotten|stolen)\\b',
      (m) => !ADJ_ED.has(m[1]),
    ),
  },
  { id: 'm-causative', match: re(`\\b(?:make|makes|made|making|let|lets|letting)\\s+${OBJ}\\s+(?:be|go|feel|see|know|smile|cry|stay|do|have|take|come|hold|say|think|believe|fly|dance|sing)\\b`) },
  {
    id: 'm-object-complement',
    match: re(
      `\\b(?:get|gets|got|getting|keep|keeps|kept|find|finds|found|leave|leaves|left|make|makes|made|drive|drives|drove)\\s+${OBJ}\\s+(?:blind|crazy|mad|happy|sad|ready|free|alone|lost|wrong|right|angry|tired|sick|hot|cold|strong|hard|easy|better|worse|[a-z]+y)\\b`,
    ),
  },
  { id: 'h-participle-clause', match: re('(?:^|,\\s*)(?:and\\s+)?[a-z]{4,}ing\\s+(?:it|the|a|an|my|your|his|her|all|them|me|you|our|their)\\b') },
  { id: 'm-linking-verbs', match: re('\\b(?:feel|feels|felt|look|looks|looked|sound|sounds|sounded|seem|seems|seemed|smell|smells|taste|tastes)\\s+(?:like|so|really|very|good|bad|great|nice|right|wrong|strange|sweet|sad|happy)\\b') },
  { id: 'm-it-to', match: re('\\bit\\s+(?:is|was)\\s+[a-z]+\\s+to\\s+[a-z]+') },
  { id: 'm-too-enough-so', match: re('\\btoo\\s+[a-z]{3,}\\s+to\\b|\\bso\\s+[a-z]+\\s+that\\b|\\b[a-z]{3,}\\s+enough\\s+to\\b') },
  // 관계사
  { id: 'm-relative-subject', match: re('\\b(?:someone|everyone|anyone|people|person|man|woman|girl|boy|one|somebody)\\s+who\\b|\\b(?:thing|things|place|man|woman|girl|boy)\\s+(?:that|which|who)\\s+(?:is|are|was|were|has|have|makes?|made|can|will)\\b') },
  { id: 'm-relative-object', match: re('\\b(?:thing|things|someone|one|man|woman|girl|boy|place|song|word|words|day|time)\\s+(?:that|which)\\s+(?:i|you|he|she|it|we|they)\\b') },
  // 비교
  { id: 'comparative', match: re('\\b(?:[a-z]{3,}er|more\\s+[a-z]+|less\\s+[a-z]+)\\s+than\\b') },
  { id: 'superlative', match: re('\\bthe\\s+(?:most\\s+[a-z]+|[a-z]{3,}est|best|worst|least)\\b') },
  // 기본 문형
  { id: 'there-is', match: re('\\bthere\\s+(?:is|are|was|were)\\b') },
  { id: 'lets', match: re('\\blet(?:\\s+us|\\s+is)\\s+[a-z]+') },
  { id: 'i-dont', match: re('\\b(?:do|does|did)\\s+not\\s+[a-z]+') },
  { id: 'frequency', match: re('\\b(?:always|usually|often|sometimes|never)\\b') },
];

const POINT_BY_ID = new Map(GRAMMAR_POINTS.map((p) => [p.id, p]));

/** 규칙 id 가 라이브러리에 실제로 있는지(테스트가 확인) */
export const LYRIC_GRAMMAR_RULE_IDS: string[] = RULES.map((r) => r.id);

/** 가사 한 줄에서 맞은 문법 규칙들 */
export function grammarMatchesOfLine(line: string): { id: string; match: string }[] {
  const expanded = expandLyricLine(line);
  const out: { id: string; match: string }[] = [];
  for (const rule of RULES) {
    const m = rule.match(expanded);
    if (m) out.push({ id: rule.id, match: m });
  }
  return out;
}

export function extractLyricGrammar(source: string): LyricGrammar[] {
  const lines = cleanLyricLines(source);
  const map = new Map<string, LyricGrammar>();
  const seenLine = new Set<string>();
  lines.forEach((line, li) => {
    // 후렴이 반복되면 같은 줄은 한 번만 센다
    const key = line.toLowerCase().replace(/\s+/g, ' ');
    if (seenLine.has(key)) return;
    seenLine.add(key);
    for (const hit of grammarMatchesOfLine(line)) {
      const point = POINT_BY_ID.get(hit.id);
      if (!point) continue;
      let g = map.get(hit.id);
      if (!g) {
        g = { id: hit.id, point, count: 0, firstAt: li, hits: [] };
        map.set(hit.id, g);
      }
      g.count += 1;
      if (g.hits.length < MAX_HITS) g.hits.push({ line, match: hit.match });
    }
  });
  // 학년이 낮은(쉬운) 것부터, 같으면 많이 나온 것부터
  return [...map.values()].sort((a, b) => a.point.level - b.point.level || b.count - a.count || a.firstAt - b.firstAt);
}
