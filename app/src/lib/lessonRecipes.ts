import { newCanvasSlide, newTextElement, themeTextDefaults } from '../components/CanvasSlideEditor';
import { createGameTemplate } from './api';
import { grammarPoint, sentencesForUnscramble } from './grammar';
import type { LessonSlide } from './types';

/**
 * 수업 레시피(2026-09-27) — 기능이 많아 "뭐부터?" 막막한 선생님을 위해, 수업 종류를 고르면 슬라이드가 순서대로
 * 채워진 수업을 만들어 준다. 만든 뒤엔 평소처럼 슬라이드를 바꾸고·빼고·더한다(쓰면서 기능을 익힌다).
 * 게임 슬라이드는 템플릿 없이 넣고, 저장할 때 수업 단어장으로 게임 내용을 자동으로 만든다(gameFromWords).
 * 새 레시피는 여기 한 줄 + i18n(recipes.<id>Name/Desc) — AI 수업 만들기도 나중에 이 틀을 고르게 하면 된다.
 */
export type RecipeInput = 'grammar' | 'reading';

export interface RecipeContext {
  t: (k: string, o?: Record<string, unknown>) => string;
  hasWords: boolean;
  grammarId?: string;
  reading?: { source: string; title?: string; videoUrl?: string | null };
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
