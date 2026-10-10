import type { RoleplayLine, SoloClip, SoloStep } from './soloLessons';
import { SPEAKING_ITEMS, STRUCTURE_ITEMS } from './rainbow';

/**
 * 개별수업 편집기(2026-10-08)의 도우미 — 단계 종류 이름·아이콘, 새 단계 기본값, 저장 전 검사, 목록 요약.
 * 서버는 저장된 단계를 그대로 채점하므로(047·050·052) 고친 문제의 정답·보기가 맞는지 저장 전에 여기서 막는다.
 */

export interface StepKind {
  t: SoloStep['t'];
  icon: string;
  /** 새 단계 추가 팔레트에 보이는 묶음 */
  group: 'learn' | 'quiz' | 'speak' | 'grammar' | 'video';
}

export const STEP_KINDS: StepKind[] = [
  { t: 'intro', icon: 'flag', group: 'learn' },
  { t: 'meet', icon: 'style', group: 'learn' },
  { t: 'rule', icon: 'menu_book', group: 'grammar' },
  { t: 'example', icon: 'record_voice_over', group: 'grammar' },
  { t: 'pickWord', icon: 'image_search', group: 'quiz' },
  { t: 'pickMeaning', icon: 'translate', group: 'quiz' },
  { t: 'listenPick', icon: 'hearing', group: 'quiz' },
  { t: 'spell', icon: 'abc', group: 'quiz' },
  { t: 'typeWord', icon: 'keyboard', group: 'quiz' },
  { t: 'fillBlank', icon: 'edit_note', group: 'quiz' },
  { t: 'dictation', icon: 'headphones', group: 'quiz' },
  { t: 'translatePick', icon: 'g_translate', group: 'grammar' },
  { t: 'pickCorrect', icon: 'rule', group: 'grammar' },
  { t: 'unscramble', icon: 'reorder', group: 'grammar' },
  { t: 'fadeRead', icon: 'mic', group: 'speak' },
  { t: 'sayPick', icon: 'forum', group: 'speak' },
  { t: 'roleplay', icon: 'theater_comedy', group: 'speak' },
  { t: 'rainbowSpeak', icon: 'palette', group: 'speak' },
  { t: 'rainbowStructure', icon: 'account_tree', group: 'grammar' },
  { t: 'watch', icon: 'smart_display', group: 'video' },
  { t: 'lyricBlank', icon: 'lyrics', group: 'video' },
  { t: 'lineSing', icon: 'mic_external_on', group: 'video' },
];

export const kindOf = (t: SoloStep['t']): StepKind => STEP_KINDS.find((k) => k.t === t) ?? STEP_KINDS[0];

const emptyClip = (): SoloClip => ({ videoId: '', start: 0, end: 5 });
const emptyLine = (who: 'other' | 'me'): RoleplayLine => ({ who, speaker: who === 'me' ? 'Me' : 'Clerk', en: '', ko: '' });

/** 새 단계의 기본값(빈 칸이 있어 저장 전에 채워야 한다) */
export function newStep(t: SoloStep['t']): SoloStep {
  switch (t) {
    case 'intro':
      return { t, title: '', text: '' };
    case 'meet':
      return { t, word: '', meaning: '', imageUrl: null, example: null };
    case 'pickWord':
      return { t, imageUrl: null, meaning: '', options: ['', '', '', ''], answer: 0 };
    case 'pickMeaning':
      return { t, word: '', imageUrl: null, options: ['', '', '', ''], answer: 0 };
    case 'listenPick':
      return { t, word: '', options: ['', '', '', ''], images: [null, null, null, null], answer: 0 };
    case 'spell':
      return { t, word: '', meaning: '', imageUrl: null, letters: [] };
    case 'typeWord':
      return { t, word: '', meaning: '', imageUrl: null, length: 0, first: '' };
    case 'fillBlank':
      return { t, sentence: '', meaning: '', options: ['', '', '', ''], answer: 0 };
    case 'dictation':
      return { t, word: '', length: 0 };
    case 'rule':
      return { t, title: '', pattern: '', explain: '', lines: [], tip: '' };
    case 'example':
      return { t, sentence: '', ko: '' };
    case 'translatePick':
      return { t, sentence: '', options: ['', '', ''], answer: 0 };
    case 'pickCorrect':
      return { t, options: ['', ''], answer: 0, why: '' };
    case 'unscramble':
      return { t, sentence: '', words: [] };
    case 'watch':
      return { t, title: '', clip: emptyClip(), mode: 'listen' };
    case 'lyricBlank':
      return { t, clip: emptyClip(), sentence: '', ko: '', options: ['', '', '', ''], answer: 0 };
    case 'lineSing':
      return { t, clip: emptyClip(), en: '', ko: '' };
    case 'fadeRead':
      return { t, sentence: '', ko: '' };
    case 'sayPick':
      return { t, situation: '', options: ['', '', '', ''], answer: 0 };
    case 'roleplay':
      return { t, title: '', lines: [emptyLine('other'), emptyLine('me')] };
    case 'rainbowSpeak':
      return { t, itemId: SPEAKING_ITEMS[0].id };
    case 'rainbowStructure':
      return { t, itemId: STRUCTURE_ITEMS[0].id };
  }
}

const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

/** 철자 타일(글자 섞기) */
export function lettersOf(word: string): string[] {
  const l = word.toLowerCase().replace(/[^a-z]/g, '').split('');
  if (l.length < 2) return l;
  for (let i = 0; i < 6; i++) {
    const s = shuffle(l);
    if (s.join('') !== l.join('')) return s;
  }
  return l;
}

/** 문장 배열하기: 문장의 낱말을 섞어 보여 줄 조각으로 */
export function wordsOfSentence(sentence: string): string[] {
  const w = sentence.split(/\s+/).filter(Boolean);
  if (w.length < 2) return w;
  for (let i = 0; i < 6; i++) {
    const s = shuffle(w);
    if (s.join(' ') !== w.join(' ')) return s;
  }
  return w;
}

/** 저장 전에 맞춰 둘 값(글자 수·섞인 낱말 같은 파생 칸) */
export function normalizeStep(step: SoloStep): SoloStep {
  switch (step.t) {
    case 'spell': {
      const word = step.word.trim().toLowerCase();
      const same = [...step.letters].sort().join('') === word.replace(/[^a-z]/g, '').split('').sort().join('');
      return { ...step, word, letters: same && step.letters.length > 0 ? step.letters : lettersOf(word) };
    }
    case 'typeWord': {
      const word = step.word.trim().toLowerCase();
      return { ...step, word, length: word.length, first: word[0] ?? '' };
    }
    case 'dictation': {
      const word = step.word.trim().toLowerCase();
      return { ...step, word, length: word.length };
    }
    case 'unscramble': {
      const sentence = step.sentence.trim().replace(/\s+/g, ' ');
      const same = [...step.words].sort().join(' ') === sentence.split(' ').sort().join(' ');
      return { ...step, sentence, words: same && step.words.length > 0 ? step.words : wordsOfSentence(sentence) };
    }
    default:
      return step;
  }
}

/** 단계 목록 한 줄 요약(왼쪽 목록에 보인다) */
export function stepSummary(step: SoloStep): string {
  switch (step.t) {
    case 'intro':
      return step.title || step.text;
    case 'meet':
    case 'dictation':
    case 'typeWord':
    case 'spell':
    case 'pickMeaning':
    case 'listenPick':
      return step.word || ('meaning' in step ? step.meaning : '');
    case 'pickWord':
      return step.meaning;
    case 'fillBlank':
    case 'translatePick':
    case 'unscramble':
    case 'example':
    case 'fadeRead':
      return step.sentence;
    case 'lyricBlank':
      return step.sentence;
    case 'lineSing':
      return step.en;
    case 'rule':
    case 'watch':
    case 'roleplay':
      return step.title;
    case 'pickCorrect':
      return step.options[step.answer] ?? '';
    case 'sayPick':
      return step.situation;
    case 'rainbowSpeak':
      return SPEAKING_ITEMS.find((i) => i.id === step.itemId)?.englishAnswer ?? '';
    case 'rainbowStructure':
      return STRUCTURE_ITEMS.find((i) => i.id === step.itemId)?.sentence ?? '';
  }
}

const blank = (s: string | null | undefined) => !s || !s.trim();

/** 한 단계의 문제점(없으면 빈 배열). 키는 i18n `soloEdit.err_<key>` */
export function stepProblems(step: SoloStep): string[] {
  const p: string[] = [];
  const choice = (opts: string[], answer: number) => {
    if (opts.some(blank)) p.push('optionEmpty');
    if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length) p.push('optionDup');
    if (answer < 0 || answer >= opts.length) p.push('answerMissing');
  };
  switch (step.t) {
    case 'intro':
      if (blank(step.title)) p.push('titleEmpty');
      break;
    case 'meet':
      if (blank(step.word) || blank(step.meaning)) p.push('wordMeaning');
      break;
    case 'pickWord':
      if (blank(step.meaning) && !step.imageUrl) p.push('promptEmpty');
      choice(step.options, step.answer);
      break;
    case 'pickMeaning':
      if (blank(step.word)) p.push('wordEmpty');
      choice(step.options, step.answer);
      break;
    case 'listenPick':
      if (blank(step.word)) p.push('wordEmpty');
      choice(step.options, step.answer);
      break;
    case 'spell':
    case 'typeWord':
      if (blank(step.word) || !/^[a-z' .-]+$/i.test(step.word.trim())) p.push('wordEnglish');
      if (blank(step.meaning)) p.push('meaningEmpty');
      break;
    case 'dictation':
      if (blank(step.word) || !/^[a-z' .-]+$/i.test(step.word.trim())) p.push('wordEnglish');
      break;
    case 'fillBlank':
      if (!step.sentence.includes('_____')) p.push('blankMissing');
      choice(step.options, step.answer);
      break;
    case 'lyricBlank':
      if (!step.sentence.includes('_____')) p.push('blankMissing');
      if (!step.clip.videoId.trim()) p.push('clipEmpty');
      choice(step.options, step.answer);
      break;
    case 'translatePick':
      if (blank(step.sentence)) p.push('sentenceEmpty');
      choice(step.options, step.answer);
      break;
    case 'pickCorrect':
      choice(step.options, step.answer);
      break;
    case 'sayPick':
      if (blank(step.situation)) p.push('situationEmpty');
      choice(step.options, step.answer);
      break;
    case 'rule':
      if (blank(step.title) || blank(step.pattern)) p.push('ruleEmpty');
      break;
    case 'example':
    case 'fadeRead':
      if (blank(step.sentence)) p.push('sentenceEmpty');
      break;
    case 'unscramble':
      if (step.sentence.trim().split(/\s+/).filter(Boolean).length < 3) p.push('sentenceShort');
      break;
    case 'watch':
      if (!step.clip.videoId.trim()) p.push('clipEmpty');
      if (step.clip.end <= step.clip.start) p.push('clipRange');
      break;
    case 'lineSing':
      if (blank(step.en)) p.push('sentenceEmpty');
      if (!step.clip.videoId.trim()) p.push('clipEmpty');
      if (step.clip.end <= step.clip.start) p.push('clipRange');
      break;
    case 'rainbowSpeak':
      if (!SPEAKING_ITEMS.some((i) => i.id === step.itemId)) p.push('rainbowMissing');
      break;
    case 'rainbowStructure':
      if (!STRUCTURE_ITEMS.some((i) => i.id === step.itemId)) p.push('rainbowMissing');
      break;
    case 'roleplay':
      if (step.lines.length < 2) p.push('rpShort');
      if (!step.lines.some((l) => l.who === 'me')) p.push('rpNoMe');
      if (step.lines.some((l) => blank(l.en))) p.push('rpEmpty');
      break;
  }
  if (step.t === 'lyricBlank' && step.clip.end <= step.clip.start) p.push('clipRange');
  return p;
}

/** 전체 검사: 문제 있는 단계 번호(0부터)와 이유 */
export function lessonProblems(steps: SoloStep[]): { index: number; keys: string[] }[] {
  const out: { index: number; keys: string[] }[] = [];
  steps.forEach((s, index) => {
    const keys = stepProblems(s);
    if (keys.length) out.push({ index, keys });
  });
  if (steps.length === 0) out.push({ index: -1, keys: ['noSteps'] });
  return out;
}
