/**
 * "영상 하나로 수업" 레시피(2026-10-03, 클래스5 무비 유닛을 참고)의 재료 고르기.
 * 쉐도잉 대사표에서 ① 사전(word_bank)에 있는 초등 낱말을 골라 수업 단어장을 만들고
 * ② 그 낱말을 비운 빈칸 듣기 원문 ③ 문장 배열하기에 쓸 짧은 문장을 뽑는다. AI 없이 규칙만으로.
 */
import { parseShadowText, type ShadowLine } from './shadowLines';
import type { FullCardItem, WordBankEntry } from './types';

/** 수업 낱말로 고르지 않는 품사 */
const SKIP_POS = new Set(['대명사', '전치사', '접속사', '관사', '조동사', '감탄사', '숙어', '표현', '한정사']);
const STOP = new Set(['the', 'and', 'you', 'are', 'was', 'have', 'has', 'his', 'her', 'she', 'they', 'this', 'that', 'what', 'there', 'some', 'very', 'too', 'not', 'yes', 'yay', 'wow', 'okay', 'oh']);

/** 낱말 꼴 → 사전 표제어 후보(복수·과거·진행·3인칭) */
function lemmas(w: string): string[] {
  const out = [w];
  if (w.endsWith('ies')) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) out.push(w.slice(0, -2));
  if (w.endsWith('s')) out.push(w.slice(0, -1));
  if (w.endsWith('ied')) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) out.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith('ing')) out.push(w.slice(0, -3), `${w.slice(0, -3)}e`);
  if (/(.)\1(ed|ing)$/.test(w)) out.push(w.replace(/(.)\1(ed|ing)$/, '$1'));
  return out;
}

/**
 * 리스닝 빙고(2026-10-03, 클래스5 "리스닝 빙고" 참고)용 — 대사표에서 빙고 낱말을 ** ** 로 감싼다.
 * 쉐도잉 칠판의 "빈칸 자막"이 이 낱말만 비우므로, 문장을 들으며 빙고판에서 찾아 표시한다. 영어 부분만 건드린다.
 */
export function markBingoWords(script: string, words: string[]): string {
  const set = new Set(words.map((w) => w.toLowerCase()));
  return script
    .split('\n')
    .map((line) => {
      const head = line.match(/^(\[[^\]]*\]\s*(?:[A-Za-z][\w .'-]{0,19}:\s+)?)/)?.[1] ?? '';
      const body = line.slice(head.length);
      const bar = body.indexOf('|');
      const en = bar >= 0 ? body.slice(0, bar) : body;
      const rest = bar >= 0 ? body.slice(bar) : '';
      return head + en.replace(/\*\*/g, '').replace(/[A-Za-z']+/g, (w) => (set.has(w.toLowerCase()) ? `**${w}**` : w)) + rest;
    })
    .join('\n');
}

export interface VideoLessonParts {
  lines: ShadowLine[];
  words: FullCardItem[];
  /** 노래·지문 "빈칸 듣기" 원문([분:초] 영어 | 해석, 고른 낱말은 **강조**) */
  clozeSource: string;
  /** 문장 배열하기에 쓸 문장(3~8낱말) */
  unscramble: string[];
}

export function buildVideoLessonParts(source: string, bank: WordBankEntry[], maxWords = 10): VideoLessonParts {
  const lines = parseShadowText(source);
  const byWord = new Map<string, WordBankEntry>();
  for (const e of bank) {
    const key = e.word.toLowerCase();
    if ((e.level ?? 1) > 4 || SKIP_POS.has(e.part_of_speech)) continue;
    const prev = byWord.get(key);
    // 같은 낱말이 여럿이면 그림 있는 것, 첫 뜻을 먼저
    if (!prev || (!prev.image_url && e.image_url) || (!!prev.image_url === !!e.image_url && e.sense_number < prev.sense_number)) byWord.set(key, e);
  }
  // 대사에 나온 낱말 → 사전 표제어, 몇 번 나왔는지
  const count = new Map<string, number>();
  const surface = new Map<string, Set<string>>();
  for (const l of lines) {
    for (const raw of l.en.replace(/\*\*/g, '').toLowerCase().match(/[a-z']+/g) ?? []) {
      const w = raw.replace(/'s$/, '');
      if (w.length < 3 || STOP.has(w)) continue;
      const hit = lemmas(w).find((x) => byWord.has(x));
      if (!hit) continue;
      count.set(hit, (count.get(hit) ?? 0) + 1);
      if (!surface.has(hit)) surface.set(hit, new Set());
      surface.get(hit)!.add(w);
    }
  }
  const picked = [...count.keys()]
    .sort((a, b) => {
      const ea = byWord.get(a)!;
      const eb = byWord.get(b)!;
      // 그림 있는 명사·동사를 먼저, 그다음 많이 나온 순
      const score = (e: WordBankEntry, k: string) => (e.image_url ? 4 : 0) + (e.part_of_speech === '명사' ? 2 : e.part_of_speech === '동사' ? 1 : 0) + Math.min(3, count.get(k) ?? 0);
      return score(eb, b) - score(ea, a);
    })
    .slice(0, maxWords);
  const words: FullCardItem[] = picked.map((k) => {
    const e = byWord.get(k)!;
    return { id: crypto.randomUUID(), word: e.word, meaning: e.meaning, imageUrl: e.image_url, category: e.category, partOfSpeech: e.part_of_speech, example: e.example_sentence };
  });

  const forms = new Set(picked.flatMap((k) => [...(surface.get(k) ?? [])]));
  const mm = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const clozeSource = lines
    .map((l) => {
      const en = l.en.replace(/\*\*/g, '').replace(/[A-Za-z']+/g, (w) => (forms.has(w.toLowerCase().replace(/'s$/, '')) ? `**${w}**` : w));
      return `[${mm(l.start)}] ${en}${l.ko ? ` | ${l.ko}` : ''}`;
    })
    .join('\n');

  const unscramble = [
    ...new Set(
      lines
        .map((l) => l.en.replace(/\*\*/g, '').trim())
        .filter((s) => {
          const n = s.split(/\s+/).length;
          return n >= 3 && n <= 8 && /^[A-Z]/.test(s);
        }),
    ),
  ].slice(0, 10);

  return { lines, words, clozeSource, unscramble };
}
