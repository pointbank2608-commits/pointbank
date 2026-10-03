import { newCanvasSlide, newTextElement, themeTextDefaults } from '../components/CanvasSlideEditor';
import { createGameTemplate } from './api';
import { grammarPoint, sentencesForUnscramble } from './grammar';
import { loadWordBank } from './wordBankCache';
import { buildVideoLessonParts, markBingoWords } from './videoLesson';
import type { FullCardItem, LessonSlide, WordBankEntry } from './types';
import type { VideoClip } from './videoClips';

/**
 * 수업 레시피(2026-09-27) — 기능이 많아 "뭐부터?" 막막한 선생님을 위해, 수업 종류를 고르면 슬라이드가 순서대로
 * 채워진 수업을 만들어 준다. 만든 뒤엔 평소처럼 슬라이드를 바꾸고·빼고·더한다(쓰면서 기능을 익힌다).
 * 게임 슬라이드는 템플릿 없이 넣고, 저장할 때 수업 단어장으로 게임 내용을 자동으로 만든다(gameFromWords).
 * 새 레시피는 여기 한 줄 + i18n(recipes.<id>Name/Desc) — AI 수업 만들기도 나중에 이 틀을 고르게 하면 된다.
 */
export type RecipeInput = 'grammar' | 'reading' | 'video';

export interface RecipeContext {
  t: (k: string, o?: Record<string, unknown>) => string;
  hasWords: boolean;
  grammarId?: string;
  reading?: { source: string; title?: string; videoUrl?: string | null };
  /** 영상 레시피: 유튜브 주소 + 쉐도잉 대사표 */
  video?: { source: string; title?: string; videoUrl: string; clip?: VideoClip | null };
  /** 영상 레시피: 대사에서 고른 낱말로 수업 단어장을 만들어 고른다(이미 단어장이 있으면 부르지 않는다) */
  makeWordList?: (words: FullCardItem[], name: string) => Promise<boolean>;
  /** 영상 레시피: 대사 문장으로 "문장 배열하기" 게임 내용을 만든다 */
  makeUnscrambleFromSentences?: (sentences: string[], name: string) => Promise<string | null>;
  /** 문법 레시피: 예문으로 "문장 배열하기" 게임 내용을 만든다(없으면 null) */
  makeUnscramble: (grammarId: string) => Promise<string | null>;
}

export interface LessonRecipe {
  id: string;
  icon: string;
  minutes: number;
  /** 단어장이 있어야 하는 레시피 */
  needsWords: boolean;
  input?: RecipeInput;
  /** 미리보기용 슬라이드 아이콘 */
  preview: string[];
  build: (ctx: RecipeContext) => Promise<LessonSlide[]>;
}

const uid = () => crypto.randomUUID();
const attendance = (): LessonSlide => ({ id: uid(), kind: 'attendance', boardTheme: 'green' });
const wordshow = (): LessonSlide => ({ id: uid(), kind: 'wordshow', boardTheme: 'green' });
const study = (): LessonSlide => ({ id: uid(), kind: 'study' });
const game = (gameType: Extract<LessonSlide, { kind: 'game' }>['gameType'], templateId?: string): LessonSlide =>
  templateId ? { id: uid(), kind: 'game', gameType, templateId } : { id: uid(), kind: 'game', gameType };
const worksheet = (tab: string): LessonSlide => ({ id: uid(), kind: 'material', materialId: 'worksheet', worksheetTab: tab, boardTheme: 'whiteboard' });

/** 제목 슬라이드(칠판) — 큰 제목 + 작은 부제 */
function titleSlide(title: string, subtitle: string): LessonSlide {
  const slide = newCanvasSlide('green');
  slide.elements = [
    newTextElement({ x: 8, y: 30, w: 84, h: 26, ...themeTextDefaults('green', 'title'), text: title }),
    { ...newTextElement({ x: 15, y: 60, w: 70, h: 14, ...themeTextDefaults('green'), bold: false }), text: subtitle },
  ];
  return slide;
}

export const LESSON_RECIPES: LessonRecipe[] = [
  {
    id: 'vocab',
    icon: 'abc',
    minutes: 40,
    needsWords: true,
    preview: ['how_to_reg', 'menu_book', 'style', 'sync_alt', 'quiz', 'print'],
    build: async () => [attendance(), wordshow(), study(), game('matchup'), game('quiz'), worksheet('match')],
  },
  {
    id: 'phonics',
    icon: 'spellcheck',
    minutes: 40,
    needsWords: true,
    preview: ['how_to_reg', 'menu_book', 'style', 'sync_alt', 'print'],
    build: async () => [
      attendance(),
      wordshow(),
      study(),
      game('matchup'),
      { id: uid(), kind: 'material', materialId: 'phonics', phonicsTab: 'phonicsBlank' },
    ],
  },
  {
    id: 'grammar',
    icon: 'rule',
    minutes: 30,
    needsWords: false,
    input: 'grammar',
    preview: ['how_to_reg', 'rule', 'reorder', 'menu_book'],
    build: async (ctx) => {
      if (!ctx.grammarId) return [];
      const slides: LessonSlide[] = [attendance(), { id: uid(), kind: 'grammar', grammarId: ctx.grammarId, useWordList: ctx.hasWords, boardTheme: 'green' }];
      const tplId = await ctx.makeUnscramble(ctx.grammarId);
      if (tplId) slides.push(game('unscramble', tplId));
      if (ctx.hasWords) slides.push(wordshow());
      return slides;
    },
  },
  {
    id: 'reading',
    icon: 'lyrics',
    minutes: 40,
    needsWords: false,
    input: 'reading',
    preview: ['lyrics', 'hearing', 'menu_book', 'quiz'],
    build: async (ctx) => {
      if (!ctx.reading?.source.trim()) return [];
      const base = { source: ctx.reading.source, title: ctx.reading.title, videoUrl: ctx.reading.videoUrl ?? null, boardTheme: 'green' as const };
      const slides: LessonSlide[] = [
        { id: uid(), kind: 'reading', mode: 'lines', ...base },
        { id: uid(), kind: 'reading', mode: 'cloze', ...base },
      ];
      if (ctx.hasWords) slides.push(wordshow(), game('quiz'));
      return slides;
    },
  },
  {
    // 영상 하나로 수업(2026-10-03, 클래스5 무비 유닛 참고): 영상 보기 → 단어 소개 → 쉐도잉 → 빈칸 듣기 → 문장 배열하기 → 퀴즈 → 배역 나눠 따라하기
    id: 'video',
    icon: 'movie',
    minutes: 45,
    needsWords: false,
    input: 'video',
    preview: ['smart_display', 'menu_book', 'record_voice_over', 'hearing', 'reorder', 'quiz', 'groups'],
    build: async (ctx) => {
      if (!ctx.video?.source.trim() || !ctx.video.videoUrl.trim()) return [];
      if (ctx.video.clip) return buildClipLesson(ctx, ctx.video.clip);
      const { videoUrl, title, source } = ctx.video;
      const parts = buildVideoLessonParts(source, await loadWordBank());
      let hasWords = ctx.hasWords;
      if (!hasWords && parts.words.length >= 3 && ctx.makeWordList) hasWords = await ctx.makeWordList(parts.words, title || ctx.t('recipes.videoName'));
      const slides: LessonSlide[] = [{ id: uid(), kind: 'video', videoUrl }];
      if (hasWords) slides.push(wordshow());
      slides.push({ id: uid(), kind: 'shadow', title, videoUrl, source, flow: 'auto', repeat: 1, speed: 1, subtitle: 'both', roleTeams: 0 });
      slides.push({ id: uid(), kind: 'reading', mode: 'cloze', title, videoUrl, source: parts.clozeSource, boardTheme: 'green' });
      if (parts.unscramble.length >= 3 && ctx.makeUnscrambleFromSentences) {
        const tplId = await ctx.makeUnscrambleFromSentences(parts.unscramble, title || ctx.t('recipes.videoName'));
        if (tplId) slides.push(game('unscramble', tplId));
      }
      if (hasWords) slides.push(game('quiz'));
      const speakers = new Set(parts.lines.map((l) => l.speaker).filter(Boolean));
      if (speakers.size > 1) slides.push({ id: uid(), kind: 'shadow', title, videoUrl, source, flow: 'manual', repeat: 1, speed: 1, subtitle: 'ko', roleTeams: Math.min(4, Math.max(2, speakers.size)) });
      return slides;
    },
  },
  {
    id: 'contest',
    icon: 'emoji_events',
    minutes: 40,
    needsWords: true,
    preview: ['dashboard_customize', 'menu_book', 'style', 'emoji_events'],
    build: async (ctx) => [titleSlide(ctx.t('recipes.contestTitle'), ctx.t('recipes.contestSubtitle')), wordshow(), study(), game('quizshow')],
  },
  {
    id: 'online',
    icon: 'cast_for_education',
    minutes: 40,
    needsWords: true,
    preview: ['dashboard_customize', 'how_to_reg', 'menu_book', 'style', 'emoji_events'],
    build: async (ctx) => [
      titleSlide(ctx.t('recipes.onlineTitle'), ctx.t('recipes.onlineSubtitle')),
      attendance(),
      wordshow(),
      study(),
      game('quizshow'),
    ],
  },
  {
    id: 'review',
    icon: 'bolt',
    minutes: 10,
    needsWords: true,
    preview: ['style', 'sync_alt'],
    build: async () => [study(), game('matchup')],
  },
];

/** 영상 묶음 단어 → 카드(사전에 같은 낱말이 있으면 그림·분류를 빌린다) */
export function clipWordCards(clip: VideoClip, bank: WordBankEntry[]): FullCardItem[] {
  const byWord = new Map<string, WordBankEntry>();
  for (const e of bank) {
    const k = e.word.toLowerCase();
    const prev = byWord.get(k);
    if (!prev || (!prev.image_url && e.image_url) || ((prev.level ?? 9) > (e.level ?? 9) && !!e.image_url === !!prev.image_url)) byWord.set(k, e);
  }
  return (clip.pack?.words ?? []).map((w) => {
    const hit = byWord.get(w.word.toLowerCase());
    return {
      id: uid(),
      word: w.word,
      meaning: w.meaning,
      imageUrl: hit?.image_url ?? null,
      category: hit?.category ?? null,
      partOfSpeech: w.pos ?? hit?.part_of_speech ?? null,
      example: w.example,
      exampleKo: w.exampleKo ?? null,
      sceneTime: w.time,
    };
  });
}

/**
 * 영상 라이브러리 장면 하나로 수업(클래스5 무비 수업 8단계 참고): 장면 보기 → Q&A → 단어 소개(영화 예문·장면 보기) →
 * 쉐도잉 → 빈칸 듣기 → 문법 칠판 → 문장 배열하기 → 퀴즈 → 배역 나눠 따라하기.
 */
async function buildClipLesson(ctx: RecipeContext, clip: VideoClip): Promise<LessonSlide[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${clip.youtube_id}`;
  const title = clip.title;
  const bank = await loadWordBank();
  const words = clipWordCards(clip, bank);
  let hasWords = ctx.hasWords;
  if (!hasWords && words.length >= 3 && ctx.makeWordList) hasWords = await ctx.makeWordList(words, `${clip.series} · ${title}`);
  const parts = buildVideoLessonParts(clip.script, bank);
  const slides: LessonSlide[] = [{ id: uid(), kind: 'video', videoUrl, startSec: Number(clip.start_sec), endSec: Number(clip.end_sec) }];
  if (clip.pack?.questions?.length) slides.push({ id: uid(), kind: 'qna', title, questions: clip.pack.questions, videoUrl, boardTheme: 'green', clipId: clip.id });
  if (words.length) slides.push({ id: uid(), kind: 'wordshow', boardTheme: 'green', words, videoUrl });
  slides.push({ id: uid(), kind: 'shadow', title, videoUrl, source: clip.script, flow: 'auto', repeat: 1, speed: 1, subtitle: 'both', roleTeams: 0, clipId: clip.id });
  slides.push({ id: uid(), kind: 'reading', mode: 'cloze', title, videoUrl, source: parts.clozeSource, boardTheme: 'green' });
  const g = clip.pack?.grammar;
  if (g?.grammarId && grammarPoint(g.grammarId)) slides.push({ id: uid(), kind: 'grammar', grammarId: g.grammarId, useWordList: false, boardTheme: 'green' });
  if (g?.drills?.length)
    slides.push({ id: uid(), kind: 'drill', title, sentence: g.sentence, sentenceKo: g.sentenceKo, point: g.point, drills: g.drills, time: g.time, videoUrl, boardTheme: 'green', clipId: clip.id });
  if (parts.unscramble.length >= 3 && ctx.makeUnscrambleFromSentences) {
    const tplId = await ctx.makeUnscrambleFromSentences(parts.unscramble, title);
    if (tplId) slides.push(game('unscramble', tplId));
  }
  if (hasWords) slides.push(game('quiz'));
  const speakers = new Set(parts.lines.map((l) => l.speaker).filter(Boolean));
  if (speakers.size > 1)
    slides.push({ id: uid(), kind: 'shadow', title, videoUrl, source: clip.script, flow: 'manual', repeat: 1, speed: 1, subtitle: 'ko', roleTeams: Math.min(4, Math.max(2, speakers.size)), clipId: clip.id });
  // 리스닝 빙고: 학생마다 다른 빙고판 인쇄(자료실 빙고) → 빙고 낱말만 비운 빈칸 자막으로 한 문장씩 듣기
  const bingo = [...new Set((clip.pack?.bingo ?? []).map((w) => w.toLowerCase()))];
  if (bingo.length >= 9) {
    slides.push({ id: uid(), kind: 'material', materialId: 'bingo', words: bingo.map((w) => ({ id: uid(), word: w, meaning: '', imageUrl: null })) });
    slides.push({ id: uid(), kind: 'shadow', title: `${title} · ${ctx.t('recipes.bingoListen')}`, videoUrl, source: markBingoWords(clip.script, bingo), flow: 'manual', repeat: 2, speed: 1, subtitle: 'cloze', roleTeams: 0, clipId: clip.id });
  }
  return slides;
}

/** 문법 레시피가 쓰는 "문장 배열하기" 게임 내용 만들기(예문으로) */
export async function makeUnscrambleTemplate(params: {
  grammarId: string;
  academyId: string;
  classId: string | null;
  teacherId: string;
  name: (pointName: string) => string;
}): Promise<string | null> {
  const point = grammarPoint(params.grammarId);
  if (!point) return null;
  const sentences = sentencesForUnscramble(point, []);
  if (sentences.length === 0) return null;
  const tpl = await createGameTemplate({
    academyId: params.academyId,
    classId: params.classId,
    gameType: 'unscramble',
    name: params.name(point.name),
    items: sentences.map((label) => ({ id: uid(), label })),
    teacherId: params.teacherId,
  });
  return tpl.id;
}
