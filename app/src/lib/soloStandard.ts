import { plainText, sentencesForUnscramble, type GrammarPoint } from './grammar';
import { buildSoloGrammarLesson, buildWordBlock, blankSentence, evenIndexes, type SoloClip, type SoloStep } from './soloLessons';
import type { SoloScenario } from './soloScenarios';
import { parseShadowText } from './shadowLines';
import type { VideoClip } from './videoClips';
import type { FullCardItem, WordBankEntry } from './types';

/**
 * 개별수업 "표준 50분 흐름"(2026-10-11, 선생님이 정한 1회 기본 플로우):
 *  숙제·복습 → 누적 테스트 → 개념 영상 → 단어 → 문법 설명 → 더빙 → 스피킹 → 라이팅 → 게임 → 숙제 안내.
 * 수업 종류(단어·문법·영상·주제)마다 같은 틀에 내용만 바꿔 끼우고, 필요 없는 단계는 빼고 필요한 단계는 더한다.
 * 단계 사이는 `intro` 단계(번호·제목·시간)로 나눠 아이가 지금 어디쯤인지 알게 한다 — 새 단계 종류가 없어 서버·편집기 변경이 없다.
 *
 * 아직 이 틀에 없는 것: ① 어제 수업 복습·누적 테스트(학생별 낱말 기록이 필요 — 개별수업 결과가 기록에 안 쌓인다)
 * ② 한글 보고 영어 문장 쓰기·내 문장 만들기(서버 채점 목록 추가 필요) ③ 영상 더빙(영상 소리를 끄고 내 목소리를 얹기 —
 * 지금은 "한 줄씩 듣고 따라 말하기 녹음"으로 대신한다).
 */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return arr.length <= n ? arr : evenIndexes(arr.length, n).map((i) => arr[i]);
}

/** 단계 나눔 화면 — 번호·제목·시간을 보여 준다 */
function stage(no: number, title: string, minutes: number, hint: string): SoloStep {
  return { t: 'intro', title: `${no}. ${title}`, text: `${minutes}분 · ${hint}` };
}

/** 단계 나눔 화면에 적힌 시간의 합 — 빠진 단계는 시간에서도 빠진다 */
function totalMinutes(steps: SoloStep[]): number {
  return steps.reduce((n, s) => {
    const m = s.t === 'intro' ? /^(\d+)분 · / .exec(s.text) : null;
    return n + (m ? Number(m[1]) : 0);
  }, 0);
}

function scramble(sentence: string): SoloStep | null {
  const ws = sentence.trim().split(/\s+/);
  if (ws.length < 3 || ws.length > 10) return null;
  let sc = shuffle(ws);
  for (let i = 0; i < 5 && sc.join(' ') === ws.join(' '); i++) sc = shuffle(ws);
  return { t: 'unscramble', sentence: ws.join(' '), words: sc };
}

function options<T>(correct: T, pool: T[], n = 4): { list: T[]; answer: number } {
  const others = shuffle(pool.filter((x) => x !== correct)).slice(0, n - 1);
  const list = shuffle([correct, ...others]);
  return { list, answer: list.indexOf(correct) };
}

/** 예문 문장 하나에서 가장 긴 낱말을 비우고 보기를 만든다(풀은 다른 문장의 낱말) */
function blankFromSentence(sentence: string, poolWords: string[]): SoloStep | null {
  const cand = sentence.split(/\s+/).map((w) => w.replace(/[^A-Za-z']/g, '')).filter((w) => w.length >= 3);
  if (cand.length === 0) return null;
  const target = [...cand].sort((a, b) => b.length - a.length)[0];
  const blank = blankSentence(sentence, target);
  if (!blank) return null;
  const o = options(target.toLowerCase(), [target.toLowerCase(), ...poolWords.filter((w) => w.toLowerCase() !== target.toLowerCase())]);
  if (o.list.length < 3) return null;
  return { t: 'fillBlank', sentence: blank, meaning: '', options: o.list, answer: o.answer };
}

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'am', 'was', 'were', 'do', 'does', 'did', 'to', 'of', 'in', 'on', 'at', 'it', 'its', 'this', 'that', 'and', 'or', 'but', 'my', 'your', 'his', 'her', 'we', 'you', 'they', 'he', 'she', 'i', 'me', 'be', 'not', 'no', 'yes', 'for', 'with', 'what', 'who', 'how', 'can', 'have', 'has']);

/** 문장들에 나오는 낱말 중 사전에 있는 것(그림 있는 명사·동사 먼저) */
function wordsFromSentences(sentences: string[], bank: WordBankEntry[], max: number): FullCardItem[] {
  const byWord = new Map<string, WordBankEntry>();
  for (const e of bank) {
    if ((e.level ?? 9) > 6 || e.part_of_speech === '숙어' || e.part_of_speech === '표현' || !e.meaning) continue;
    const k = e.word.toLowerCase();
    const prev = byWord.get(k);
    if (!prev || (!prev.image_url && e.image_url) || (!!prev.image_url === !!e.image_url && e.sense_number < prev.sense_number)) byWord.set(k, e);
  }
  const seen = new Set<string>();
  const hits: WordBankEntry[] = [];
  for (const s of sentences) {
    for (const raw of s.toLowerCase().match(/[a-z']+/g) ?? []) {
      const w = raw.replace(/'s$/, '');
      if (w.length < 3 || STOP.has(w) || seen.has(w)) continue;
      const e = byWord.get(w) ?? byWord.get(w.replace(/s$/, '')) ?? byWord.get(w.replace(/ing$/, ''));
      if (!e) continue;
      seen.add(w);
      hits.push(e);
    }
  }
  const score = (e: WordBankEntry) => (e.image_url ? 4 : 0) + (e.part_of_speech === '명사' ? 2 : e.part_of_speech === '동사' ? 1 : 0);
  return hits
    .sort((a, b) => score(b) - score(a))
    .slice(0, max)
    .map((e) => ({ id: e.id, word: e.word, meaning: e.meaning, imageUrl: e.image_url, category: e.category, example: e.example_sentence, partOfSpeech: e.part_of_speech }));
}

interface Built {
  name: string;
  steps: SoloStep[];
  minutes: number;
}

/* ---------------- 단어형 ---------------- */

/**
 * 단어 수업 50분 — 시작 → 낱말 만나기(그림) → 소리 듣고 고르기 → 뜻·품사 → 문장 속 낱말(읽기·빈칸) → 쓰기 → 마무리 게임 → 정리.
 * 영상·문법·더빙 단계는 뺐다(낱말이 주인공). 낱말은 6개 이상이어야 한다.
 */
export function buildStandardWordLesson(title: string, words: FullCardItem[]): Built | null {
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  if (usable.length < 6) return null;
  const steps: SoloStep[] = [{ t: 'intro', title, text: `${usable.length}` }];
  let n = 1;

  steps.push(stage(n++, '오늘의 낱말 만나기', 8, '소리를 듣고 따라 말해요'));
  steps.push(...buildWordBlock('meet', usable));
  steps.push(...buildWordBlock('pickWord', usable));

  steps.push(stage(n++, '소리 듣고 찾기', 5, '잘 듣고 알맞은 그림을 골라요'));
  steps.push(...buildWordBlock('listenPick', usable));

  steps.push(stage(n++, '뜻과 품사', 5, '낱말의 뜻과 어떤 말인지 알아봐요'));
  steps.push(...pick(buildWordBlock('pickMeaning', usable), 8));
  steps.push(...pick(buildWordBlock('pickPos', usable), 5));

  const withExample = usable.filter((w) => w.example && w.example.trim().split(/\s+/).length >= 3 && w.example.trim().split(/\s+/).length <= 10);
  if (withExample.length >= 3) {
    steps.push(stage(n++, '문장 속 낱말', 9, '문장을 읽고 빈칸을 채워요'));
    for (const w of pick(shuffle(withExample), 5)) steps.push({ t: 'example', sentence: (w.example as string).trim(), ko: '' });
    steps.push(...pick(buildWordBlock('fillBlank', usable), 6));
  }

  steps.push(stage(n++, '써 보기', 12, '철자를 만들고, 직접 써요'));
  steps.push(...pick(buildWordBlock('spell', usable), 6));
  steps.push(...pick(buildWordBlock('typeWord', usable), 8));
  steps.push(...pick(buildWordBlock('dictation', usable), 6));

  steps.push(stage(n++, '오늘 배운 낱말 게임', 7, '빠르게 한 번 더 확인해요'));
  const quick: SoloStep[] = [...buildWordBlock('pickWord', usable), ...buildWordBlock('listenPick', usable)];
  steps.push(...pick(shuffle(quick), 10));

  return { name: title, steps, minutes: totalMinutes(steps) };
}

/* ---------------- 문법형 ---------------- */

/**
 * 문법 수업 50분 — 시작(오늘의 문장 틀) → 예문 속 낱말 → 문법 설명(규칙·예문) → 이해 확인 → 말하기(지우며 읽기) → 쓰기(순서 배열·빈칸) → 마무리.
 * 영상·더빙은 뺀다. 예문 속 낱말은 사전에서 찾아 4~6개를 먼저 만난다.
 */
export function buildStandardGrammarLesson(point: GrammarPoint, bank: WordBankEntry[]): Built {
  const base = buildSoloGrammarLesson(point);
  const steps: SoloStep[] = [];
  let n = 1;
  const examples = base.steps.filter((s): s is Extract<SoloStep, { t: 'fadeRead' }> => s.t === 'fadeRead');
  const sentences = examples.map((e) => e.sentence);
  const rule = base.steps.find((s) => s.t === 'rule');
  const pool = sentencesForUnscramble(point, []).concat(point.examples.map(plainText));

  steps.push({ t: 'intro', title: point.name, text: point.tip ?? point.explain });

  const words = wordsFromSentences([...sentences, ...pool], bank, 6);
  if (words.length >= 4) {
    steps.push(stage(n++, '예문에 나오는 낱말', 6, '문장에서 쓰이는 낱말을 먼저 만나요'));
    steps.push(...buildWordBlock('meet', words));
    steps.push(...buildWordBlock('pickMeaning', words));
  }

  steps.push(stage(n++, '오늘의 문법', 7, '규칙을 보고 예문을 읽어요'));
  if (rule) steps.push(rule);
  for (const e of examples.slice(0, 4)) steps.push({ t: 'example', sentence: e.sentence, ko: e.ko });

  const check = base.steps.filter((s) => s.t === 'translatePick' || s.t === 'pickCorrect');
  if (check.length > 0) {
    steps.push(stage(n++, '이해 확인', 8, '뜻을 고르고 맞는 문장을 찾아요'));
    steps.push(...check);
  }

  steps.push(stage(n++, '말해 보기', 10, '문장을 소리 내어 말해요'));
  steps.push(...examples);

  const allSentences = [...new Set(pool.map((s) => s.trim()).filter(Boolean))];
  steps.push(stage(n++, '문장 만들기', 12, '낱말을 순서대로 놓고, 빈칸을 채워요'));
  for (const s of shuffle(allSentences).slice(0, 8)) {
    const u = scramble(s);
    if (u) steps.push(u);
  }
  const poolWords = [...new Set(allSentences.flatMap((s) => (s.match(/[A-Za-z']+/g) ?? []).filter((w) => w.length >= 3)))];
  for (const s of shuffle(allSentences).slice(0, 6)) {
    const b = blankFromSentence(s, poolWords);
    if (b) steps.push(b);
  }

  steps.push(stage(n++, '오늘의 정리', 7, '배운 문장을 다시 한 번 확인해요'));
  const again = shuffle(base.steps.filter((s) => s.t === 'unscramble' || s.t === 'translatePick' || s.t === 'pickCorrect'));
  steps.push(...again.slice(0, 5));

  return { name: point.name, steps, minutes: totalMinutes(steps) };
}

/* ---------------- 주제(상황·대화)형 ---------------- */

/**
 * 주제 수업 50분 — 상황 소개 → 낱말 → 소리 듣고 고르기 → 표현 말하기 → 상황 보고 표현 고르기 → 쓰기(순서·빈칸) → 역할극 두 번.
 * 영상·문법 설명은 뺀다. 역할극이 더빙 자리를 대신한다.
 */
export function buildStandardTopicLesson(sc: SoloScenario, bank: WordBankEntry[], lang: string): Built | null {
  const ko = lang.startsWith('ko');
  const name = ko ? sc.ko : sc.en;
  const key = sc.id.replace(/^talk-/, '');
  const img = (s: string) => `/solo-images/talk/${key}-${s}.webp`;
  const byWord = new Map<string, WordBankEntry>();
  for (const e of bank) {
    const k = e.word.toLowerCase();
    const prev = byWord.get(k);
    if (!prev || (!prev.image_url && e.image_url)) byWord.set(k, e);
  }
  const entries = sc.words.map((w) => byWord.get(w.toLowerCase())).filter((e): e is WordBankEntry => !!e && !!e.meaning);
  if (entries.length < 4) return null;
  const words: FullCardItem[] = entries.map((e) => ({ id: e.id, word: e.word, meaning: e.meaning, imageUrl: e.image_url, category: e.category, example: e.example_sentence, partOfSpeech: e.part_of_speech }));

  const steps: SoloStep[] = [{ t: 'intro', title: name, text: ko ? sc.koDesc : sc.enDesc, imageUrl: img('scene') }];
  let n = 1;

  steps.push(stage(n++, '상황에 나오는 낱말', 7, '낱말을 듣고 말하고 골라요'));
  steps.push(...buildWordBlock('meet', words));
  steps.push(...buildWordBlock('pickWord', words));
  steps.push(...buildWordBlock('listenPick', words));

  steps.push(stage(n++, '이럴 때 이렇게 말해요', 10, '표현을 따라 읽고, 끝말부터 가리며 말해요'));
  sc.chunks.forEach((c, i) => steps.push({ t: 'fadeRead', sentence: c.en, ko: c.ko, imageUrl: img(String(i + 1)) }));

  steps.push(stage(n++, '알맞은 말 고르기', 8, '그림 속 상황에 맞는 말을 골라요'));
  for (const c of shuffle(sc.chunks.map((x, i) => ({ x, i }))).slice(0, 5)) {
    const others = shuffle(sc.chunks.filter((y) => y.en !== c.x.en)).slice(0, 3).map((y) => y.en);
    const list = shuffle([c.x.en, ...others]);
    steps.push({ t: 'sayPick', situation: c.x.situation, options: list, answer: list.indexOf(c.x.en), imageUrl: img(String(c.i + 1)) });
  }

  steps.push(stage(n++, '문장 만들기', 12, '낱말을 순서대로 놓고, 빈칸을 채워요'));
  for (const c of shuffle(sc.chunks).slice(0, 5)) {
    const u = scramble(c.en);
    if (u) steps.push(u);
  }
  const poolWords = [...new Set(sc.chunks.flatMap((c) => (c.en.match(/[A-Za-z']+/g) ?? []).filter((w) => w.length >= 3)))];
  for (const c of shuffle(sc.chunks).slice(0, 4)) {
    const b = blankFromSentence(c.en, poolWords);
    if (b) steps.push(b);
  }

  steps.push(stage(n++, '대화 역할극', 10, '점원·친구가 되어 대화해요'));
  steps.push({ t: 'roleplay', title: name, imageUrl: img('scene'), lines: sc.dialogue.map((l) => ({ ...l })) });

  steps.push(stage(n++, '오늘 배운 말 한 번 더', 3, '낱말을 다시 확인해요'));
  steps.push(...pick(shuffle([...buildWordBlock('pickMeaning', words), ...buildWordBlock('pickWord', words)]), 6));

  return { name, steps, minutes: totalMinutes(steps) };
}

/* ---------------- 영상형 ---------------- */

/**
 * 영상 장면 수업 50분 — 개념 영상(장면 보기) → 핵심 단어 → 장면 속 문법 → 대사 따라 말하기(더빙 대신) → 말하기 → 쓰기 → 게임.
 * 장면은 영상 라이브러리(video_clips)에 있는 것. 대사 시간이 있어야 한 줄씩 들려줄 수 있다.
 */
export function buildStandardVideoLesson(clip: VideoClip, bank: WordBankEntry[]): Built | null {
  const lines = parseShadowText(clip.script)
    .map((l) => ({ ...l, en: l.en.replace(/\*\*/g, '').trim() }))
    .filter((l) => l.en.split(/\s+/).length >= 3 && l.end - l.start >= 1 && l.end - l.start <= 20);
  if (lines.length < 4) return null;
  const videoId = clip.youtube_id;
  const clipOf = (l: { start: number; end: number }): SoloClip => ({ videoId, start: l.start, end: l.end });
  const name = clip.title;
  const steps: SoloStep[] = [{ t: 'intro', title: name, text: clip.summary || name }];
  let n = 1;

  steps.push(stage(n++, '오늘의 영상', 5, '영상을 처음부터 끝까지 잘 봐요'));
  steps.push({ t: 'watch', title: name, clip: { videoId, start: Number(clip.start_sec), end: Number(clip.end_sec) }, mode: 'listen' });

  // 핵심 단어: 수업 묶음이 있으면 그것, 없으면 대사에서 사전 낱말
  const packWords: FullCardItem[] = (clip.pack?.words ?? []).map((w) => ({
    id: crypto.randomUUID(),
    word: w.word,
    meaning: w.meaning,
    imageUrl: bank.find((e) => e.word.toLowerCase() === w.word.toLowerCase() && e.image_url)?.image_url ?? null,
    example: w.example,
    partOfSpeech: w.pos ?? null,
  }));
  const words = packWords.length >= 4 ? packWords : wordsFromSentences(lines.map((l) => l.en), bank, 8);
  if (words.length >= 4) {
    steps.push(stage(n++, '핵심 단어', 8, '영상에 나온 낱말을 만나요'));
    steps.push(...buildWordBlock('meet', words));
    steps.push(...buildWordBlock('pickMeaning', words));
    steps.push(...pick(buildWordBlock('listenPick', words), 5));
  }

  const g = clip.pack?.grammar;
  if (g?.sentence) {
    steps.push(stage(n++, '오늘의 문장 틀', 6, '영상 속 문장을 바꿔 말해요'));
    if (g.point) steps.push({ t: 'rule', title: name, pattern: g.sentence, explain: g.point, lines: [], tip: '' });
    steps.push({ t: 'example', sentence: g.sentence, ko: g.sentenceKo ?? '' });
    for (const d of (g.drills ?? []).slice(0, 4)) steps.push({ t: 'fadeRead', sentence: d.answer, ko: d.answerKo ?? d.cue });
  }

  const spoken = pick(lines, 8);
  steps.push(stage(n++, '대사 따라 말하기', 10, '한 줄씩 듣고, 내 목소리로 말해요'));
  for (const l of spoken) steps.push({ t: 'lineSing', clip: clipOf(l), en: l.en, ko: l.ko });

  steps.push(stage(n++, '문장 다시 말하기', 6, '끝말부터 가리며 말해요'));
  // 한국어 뜻이 있는 줄만(끝까지 가려지면 뜻을 보고 말해야 하므로)
  for (const l of pick(lines.filter((x) => x.ko), 5)) steps.push({ t: 'fadeRead', sentence: l.en, ko: l.ko });

  steps.push(stage(n++, '써 보기', 10, '낱말을 순서대로 놓고, 빈칸을 채워요'));
  for (const l of shuffle(lines).slice(0, 5)) {
    const u = scramble(l.en);
    if (u) steps.push({ ...u, clip: clipOf(l) } as SoloStep);
  }
  const contentWords = [...new Set(lines.flatMap((l) => (l.en.match(/[A-Za-z']+/g) ?? []).filter((w) => w.length >= 4)))];
  for (const l of shuffle(lines).slice(0, 6)) {
    const b = blankFromSentence(l.en, contentWords);
    if (b && b.t === 'fillBlank') steps.push({ t: 'lyricBlank', clip: clipOf(l), sentence: b.sentence, ko: l.ko, options: b.options, answer: b.answer });
  }

  steps.push(stage(n++, '오늘 배운 내용 확인', 5, '낱말과 문장을 한 번 더 확인해요'));
  if (words.length >= 4) steps.push(...pick(shuffle(buildWordBlock('pickWord', words)), 4));
  const koPool = lines.map((l) => l.ko).filter(Boolean);
  for (const l of shuffle(lines.filter((x) => x.ko)).slice(0, 3)) {
    const o = options(l.ko, koPool);
    if (o.list.length >= 3) steps.push({ t: 'translatePick', sentence: l.en, options: o.list, answer: o.answer });
  }

  return { name, steps, minutes: totalMinutes(steps) };
}
