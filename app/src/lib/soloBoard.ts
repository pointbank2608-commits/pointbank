import type { SoloStep } from './soloLessons';

/**
 * 개별수업의 "블록 보드"(BLOCK_SPEC §2, 4단계) — 저장된 문제 목록(steps)을 그룹 > 블록 > 문제로 읽는다.
 * 저장 형식은 그대로다(서버는 문제만 채점·저장):
 *  - 그룹 = 숫자로 시작하는 `intro` 문제("1. 오늘의 낱말 만나기" · 본문 "8분 · 안내") — 표준 50분 흐름의 단계 나눔
 *  - 블록 = 그룹 안에서 같은 종류 문제가 이어진 것
 *  - 첫 `intro`(맨 앞)는 수업 소개 화면이라 그룹이 아니다
 * 그룹 이름·시간·순서를 바꾸면 이 `intro` 문제와 번호를 고쳐 쓴다.
 */

/** 문제에 붙는 출처(블록 옵션 저장) — 이 문제를 만든 단어장. 문제와 같이 옮겨지고 복사돼서, 보드가 블록의 단어장을 다시 읽는다. */
export interface StepSource {
  id?: string;
  name: string;
}

export type BlockSource = StepSource | 'mixed' | null;

export interface BoardBlock {
  type: SoloStep['t'];
  /** steps 안 위치(start..end 포함) */
  start: number;
  end: number;
  count: number;
  /** 선생님이 손으로 고친 문제 수(다시 만들면 사라진다는 경고에 쓴다) */
  edited: number;
  /** 낱말 몇 개 미리보기 */
  words: string[];
  seconds: number;
  /** 이 블록을 만든 단어장 — 없으면 null("수업 낱말"), 여러 곳에서 섞였으면 'mixed' */
  source: BlockSource;
}

export interface BoardGroup {
  /** 단계 나눔 intro 의 위치 — 그룹 앞 "이름 없는 묶음"이면 null */
  intro: number | null;
  no: number | null;
  title: string;
  /** 목표 시간(분) — 단계 나눔 본문에서 읽는다 */
  minutes: number | null;
  /** 단계 나눔 본문에서 시간을 뺀 안내 글 */
  hint: string;
  start: number;
  end: number;
  blocks: BoardBlock[];
  seconds: number;
}

export interface Board {
  /** 이 수업의 기본 단어장 — 문제에 가장 많이 붙은 출처 */
  lessonSource: StepSource | null;
  /** 맨 앞 수업 소개 화면(있으면 0) */
  head: number | null;
  groups: BoardGroup[];
  totalSteps: number;
  totalSeconds: number;
}

const STAGE_RE = /^(\d+)\.\s*(.*)$/;
const MIN_RE = /^(\d+)분\s*·\s*(.*)$/;

export const isStageIntro = (steps: SoloStep[], i: number): boolean => i > 0 && steps[i].t === 'intro' && STAGE_RE.test((steps[i] as { title: string }).title);

/** 문제 하나에 걸리는 시간(초) — 예상 시간 표시용 어림(아이가 읽고 듣고 누르는 시간까지, 표준 50분 수업이 약 46분으로 나온다) */
const SECONDS: Partial<Record<SoloStep['t'], number>> = {
  intro: 8,
  meet: 40,
  pickWord: 25,
  pickMeaning: 25,
  listenPick: 25,
  pickPos: 25,
  spell: 45,
  typeWord: 45,
  fillBlank: 30,
  dictation: 45,
  rule: 60,
  example: 30,
  translatePick: 30,
  pickCorrect: 30,
  unscramble: 50,
  gapType: 35,
  lineOrder: 60,
  fixError: 50,
  fadeRead: 90,
  sayPick: 30,
  roleplay: 240,
  watch: 150,
  lyricBlank: 35,
  lineSing: 60,
  rainbowSpeak: 150,
  rainbowStructure: 120,
};
export const stepSeconds = (t: SoloStep['t']): number => SECONDS[t] ?? 20;
/** 문제 하나의 예상 시간 — 시험 블록은 안에 든 문제들의 제한 시간 합 */
export const secondsOf = (s: SoloStep): number => (s.t === 'test' ? s.items.reduce((n, it) => n + it.sec + 4, 0) + 20 : stepSeconds(s.t));

const wordOf = (s: SoloStep): string => {
  if ('word' in s && typeof s.word === 'string') return s.word;
  if (s.t === 'pickWord' || s.t === 'fillBlank') return s.options[s.answer] ?? '';
  return '';
};
const isEdited = (s: SoloStep): boolean => !!(s as { edited?: boolean }).edited;
export const stepSource = (s: SoloStep): StepSource | null => (s as { src?: StepSource }).src ?? null;

/** 단어 문제(소개 화면 제외)에 단어장 출처를 붙인다 — 같은 값이면 그대로 둔다 */
export function withSource<T extends { t: SoloStep['t'] }>(steps: T[], src: StepSource): T[] {
  return steps.map((s) => (s.t === 'intro' ? s : ({ ...s, src } as T)));
}

const sameSource = (a: BlockSource, b: StepSource | null): boolean => (a === null ? b === null : a !== 'mixed' && b !== null && a.name === b.name && a.id === b.id);

/** 저장된 문제 목록 → 보드 */
export function buildBoard(steps: SoloStep[]): Board {
  const head = steps.length > 0 && steps[0].t === 'intro' ? 0 : null;
  const bounds: number[] = [];
  steps.forEach((_, i) => {
    if (isStageIntro(steps, i)) bounds.push(i);
  });

  const makeBlocks = (from: number, to: number): BoardBlock[] => {
    const blocks: BoardBlock[] = [];
    for (let i = from; i <= to; i++) {
      const s = steps[i];
      const last = blocks[blocks.length - 1];
      if (last && last.type === s.t && s.t !== 'intro') {
        last.end = i;
        last.count += 1;
        last.seconds += secondsOf(s);
        if (isEdited(s)) last.edited += 1;
        if (!sameSource(last.source, stepSource(s))) last.source = 'mixed';
        const w = wordOf(s);
        if (w && last.words.length < 4 && !last.words.includes(w)) last.words.push(w);
      } else {
        const w = wordOf(s);
        blocks.push({ type: s.t, start: i, end: i, count: 1, edited: isEdited(s) ? 1 : 0, words: w ? [w] : [], seconds: secondsOf(s), source: stepSource(s) });
      }
    }
    return blocks;
  };

  const groups: BoardGroup[] = [];
  const firstBound = bounds.length > 0 ? bounds[0] : steps.length;
  const loose0 = head === null ? 0 : 1;
  if (firstBound > loose0) {
    const blocks = makeBlocks(loose0, firstBound - 1);
    groups.push({ intro: null, no: null, title: '', minutes: null, hint: '', start: loose0, end: firstBound - 1, blocks, seconds: blocks.reduce((n, b) => n + b.seconds, 0) });
  }
  bounds.forEach((b, k) => {
    const end = (bounds[k + 1] ?? steps.length) - 1;
    const intro = steps[b] as { title: string; text: string };
    const m = STAGE_RE.exec(intro.title);
    const mm = MIN_RE.exec(intro.text ?? '');
    const blocks = end > b ? makeBlocks(b + 1, end) : [];
    groups.push({
      intro: b,
      no: m ? Number(m[1]) : null,
      title: m ? m[2] : intro.title,
      minutes: mm ? Number(mm[1]) : null,
      hint: mm ? mm[2] : intro.text ?? '',
      start: b,
      end,
      blocks,
      seconds: blocks.reduce((n, x) => n + x.seconds, 0),
    });
  });
  return { lessonSource: lessonSourceOf(steps), head, groups, totalSteps: steps.length, totalSeconds: steps.reduce((n, s) => n + secondsOf(s), 0) };
}

/** 수업의 기본 단어장 — 문제에 가장 많이 붙은 출처(없으면 null) */
export function lessonSourceOf(steps: SoloStep[]): StepSource | null {
  const count = new Map<string, { src: StepSource; n: number }>();
  for (const s of steps) {
    const src = stepSource(s);
    if (!src) continue;
    const k = `${src.id ?? ''}|${src.name}`;
    const cur = count.get(k);
    if (cur) cur.n += 1;
    else count.set(k, { src, n: 1 });
  }
  let best: { src: StepSource; n: number } | null = null;
  for (const v of count.values()) if (!best || v.n > best.n) best = v;
  return best ? best.src : null;
}

export const sameStepSource = (a: StepSource | null, b: StepSource | null): boolean => (a === null ? b === null : b !== null && a.name === b.name && a.id === b.id);

/** 단계 나눔 번호를 앞에서부터 다시 매긴다("1. …", "2. …") */
export function renumber(steps: SoloStep[]): SoloStep[] {
  let n = 0;
  return steps.map((s, i) => {
    if (!isStageIntro(steps, i)) return s;
    n += 1;
    const intro = s as Extract<SoloStep, { t: 'intro' }>;
    const m = STAGE_RE.exec(intro.title);
    return { ...intro, title: `${n}. ${m ? m[2] : intro.title}` };
  });
}

const stageStep = (no: number, title: string, minutes: number | null, hint: string): SoloStep => ({
  t: 'intro',
  title: `${no}. ${title}`,
  text: minutes ? `${minutes}분 · ${hint}` : hint,
});

/** 그룹 이름·목표 시간·안내를 고친다 */
export function updateGroup(steps: SoloStep[], intro: number, patch: { title?: string; minutes?: number | null; hint?: string }): SoloStep[] {
  const board = buildBoard(steps);
  const g = board.groups.find((x) => x.intro === intro);
  if (!g) return steps;
  const next = [...steps];
  next[intro] = stageStep(g.no ?? 1, patch.title ?? g.title, patch.minutes === undefined ? g.minutes : patch.minutes, patch.hint ?? g.hint);
  return renumber(next);
}

/** 그룹(단계 나눔 + 그 아래 블록들)을 위·아래로 옮긴다 */
export function moveGroup(steps: SoloStep[], gi: number, dir: -1 | 1): SoloStep[] {
  const board = buildBoard(steps);
  const to = gi + dir;
  if (gi < 0 || to < 0 || gi >= board.groups.length || to >= board.groups.length) return steps;
  const parts = board.groups.map((g) => steps.slice(g.start, g.end + 1));
  const [p] = parts.splice(gi, 1);
  parts.splice(to, 0, p);
  const head = board.head === null ? [] : [steps[0]];
  return renumber([...head, ...parts.flat()]);
}

/** 그룹과 그 아래 블록을 모두 지운다 */
export function removeGroup(steps: SoloStep[], gi: number): SoloStep[] {
  const board = buildBoard(steps);
  const g = board.groups[gi];
  if (!g) return steps;
  const next = [...steps.slice(0, g.start), ...steps.slice(g.end + 1)];
  return renumber(next);
}

/** 맨 끝에 새 그룹을 더한다 */
export function addGroup(steps: SoloStep[], title: string, minutes = 5, hint = ''): SoloStep[] {
  const count = buildBoard(steps).groups.filter((g) => g.intro !== null).length;
  return [...steps, stageStep(count + 1, title, minutes, hint)];
}

/** 그룹 맨 끝 다음 위치(블록을 그룹에 넣을 자리) */
export function groupInsertAt(steps: SoloStep[], gi: number): number {
  const g = buildBoard(steps).groups[gi];
  return g ? g.end + 1 : steps.length;
}

export const formatMinutes = (seconds: number): number => Math.max(1, Math.round(seconds / 60));
