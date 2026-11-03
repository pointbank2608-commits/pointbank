import { newCanvasSlide, newTextElement, themeTextDefaults } from '../components/CanvasSlideEditor';
import { createGameTemplate } from './api';
import { GRAMMAR_SHEET_BANK } from '../data/grammarSheets';
import type { ChooseItem, GrammarSheetContent } from '../data/grammarSheets/types';
import { grammarPoint, plainText, sentencesForUnscramble } from './grammar';
import { newHelper } from './slideHelpers';
import { buildFactoryItems } from './sentenceFactory';
import type { GameType, LessonSlide, QuizQuestion, SlideHelper } from './types';
import '../i18n/grammarLessonLocales';

/**
 * 문법 30분 수업(2026-11-03): 도입 → 개념 → 개념 확인 문제 → 게임 ① → 심화 → 게임 ② 팀 대항 퀴즈 → 정리.
 * 재료는 문법 워크북 자료(A·B 세트: 규칙 발견·고르기·틀린 곳 고치기·조건 영작·배열 추가 예문)를 그대로 쓴다.
 * 문제 풀이는 새 슬라이드 종류 없이 기존 Q&A 슬라이드(질문 → 정답 보기 → 다음)를 쓰고, 슬라이드마다 시간 타이머를 단다.
 * 워크북 자료가 없는 문법은 예전 짧은 수업(칠판 + 문장 배열)으로 돌아간다.
 */
export type TFn = (k: string, o?: Record<string, unknown>) => string;

export interface GrammarGames {
  unscrambleId: string | null;
  teamQuizId: string | null;
}

const uid = () => crypto.randomUUID();
const timer = (seconds: number): SlideHelper => ({ ...newHelper('timer'), type: 'timer', seconds } as SlideHelper);
const scoreboard = (): SlideHelper => ({ ...newHelper('scoreboard'), type: 'scoreboard', teams: 2 } as SlideHelper);
const CIRCLED = ['①', '②', '③', '④'];

/** 이 문법에 30분 수업을 만들 자료가 있는지 */
export function hasGrammarLessonBank(grammarId: string): boolean {
  const s = GRAMMAR_SHEET_BANK[grammarId];
  return Boolean(s && s.choose.length >= 6 && s.correct.length >= 3 && s.review.length >= 3);
}

function board(title: string, lines: string[], size = 5): LessonSlide {
  const slide = newCanvasSlide('green');
  slide.elements = [
    newTextElement({ x: 6, y: 6, w: 88, h: 16, ...themeTextDefaults('green', 'title'), text: title }),
    ...lines.map((text, i) => ({
      ...newTextElement({ x: 8, y: 28 + i * 16, w: 84, h: 12, ...themeTextDefaults('green'), bold: false }),
      text,
      fontSize: size,
    })),
  ];
  return slide;
}

/** 고르기 문항 → 질문·정답·이유 */
export function chooseToQna(items: ChooseItem[], t: TFn): NonNullable<Extract<LessonSlide, { kind: 'qna' }>['questions']> {
  return items.map((it) => {
    const options = it.c.map((c, i) => `${CIRCLED[i] ?? i + 1} ${c}`).join('   ');
    return { q: `${it.p}   ( ${options} )`, a: `${CIRCLED[it.a] ?? it.a + 1} ${it.c[it.a]}`, aKo: it.why, qKo: t('grammarLesson.chooseHint') };
  });
}

/** 선택형 퀴즈(팀 대항 퀴즈용) — 빈칸 문장을 질문으로, 보기 순서는 그대로 */
export function chooseToQuiz(items: ChooseItem[]): QuizQuestion[] {
  return items.map((it) => ({ id: uid(), question: it.p, choices: it.c, correctIndex: it.a }));
}

export function buildGrammarLessonSlides(params: { t: TFn; grammarId: string; hasWords: boolean; games: GrammarGames }): LessonSlide[] {
  const { t, grammarId, hasWords, games } = params;
  const point = grammarPoint(grammarId);
  const sheet = GRAMMAR_SHEET_BANK[grammarId] as GrammarSheetContent | undefined;
  const attendance: LessonSlide = { id: uid(), kind: 'attendance', boardTheme: 'green' };
  const grammarBoard: LessonSlide = { id: uid(), kind: 'grammar', grammarId, useWordList: hasWords, boardTheme: 'green' };
  const unscramble = (): LessonSlide[] => (games.unscrambleId ? [{ id: uid(), kind: 'game', gameType: 'unscramble', templateId: games.unscrambleId }] : []);
  // 워크북 자료가 없는 문법은 예전 짧은 수업
  if (!point || !sheet || !hasGrammarLessonBank(grammarId)) {
    return [attendance, grammarBoard, ...unscramble(), ...(hasWords ? [{ id: uid(), kind: 'wordshow', boardTheme: 'green' } as LessonSlide] : [])];
  }
  const b = sheet.b;
  const qna = (title: string, questions: ReturnType<typeof chooseToQna>, seconds: number, extra: SlideHelper[] = []): LessonSlide =>
    ({ id: uid(), kind: 'qna', title, questions, boardTheme: 'green', showKo: true, helpers: [timer(seconds), ...extra] }) as LessonSlide;

  const conceptQs = chooseToQna(sheet.choose.slice(0, 10), t);
  const fixQs = [...sheet.correct, ...(b?.correct ?? [])].slice(0, 8).map((c) => ({ q: `${t('grammarLesson.fixPrompt')} ${c.w}`, a: c.r, aKo: c.why }));
  const writeQs = sheet.review.slice(0, 6).map((r) => ({ q: `${r.ko}   [${r.cond}]`, a: r.model }));
  const exitSource = (b?.review?.length ? b.review : sheet.review.slice(3)).slice(0, 3);
  const exitQs = exitSource.map((r) => ({ q: `${r.ko}   [${r.cond}]`, a: r.model }));
  const teamQuizOk = Boolean(games.teamQuizId);
  // 문장 공장: 예문·추가 예문을 규칙으로 변형한 연속 미션(바꿀 수 있는 문장이 4개 이상일 때만)
  const factorySources = [...point.examples.map((e) => plainText(e)), ...(sheet.buildExtra ?? []).map((x) => plainText(x.en))];
  const factoryItems = buildFactoryItems(factorySources, { perSentence: 3, max: 12 });
  const factoryQs = factoryItems.map((it) => ({ q: `${t(`grammarLesson.factory.${it.kind}`)} →  ${it.from}`, a: it.to }));

  const slides: LessonSlide[] = [
    // 도입 0~3분
    { ...attendance, helpers: [timer(60)] } as LessonSlide,
    { ...board(point.name, [point.pattern, t('grammarLesson.warmUp')], 5.4), helpers: [timer(120)] } as LessonSlide,
    // 개념 3~10분: 문법 칠판 + 규칙 발견 질문
    { ...grammarBoard, helpers: [timer(300)] } as LessonSlide,
    qna(t('grammarLesson.discoverTitle'), [{ q: sheet.discover.q, a: sheet.discover.a }], 120),
    // 개념 이해 문제 10~16분
    qna(t('grammarLesson.conceptTitle'), conceptQs, 360, [scoreboard()]),
    // 게임 ① 16~19분
    ...unscramble().map((s) => ({ ...s, helpers: [timer(180)] }) as LessonSlide),
    // 심화 19~26분: 틀린 곳 고치기 + 조건 영작
    qna(t('grammarLesson.fixTitle'), fixQs, 240),
    qna(t('grammarLesson.writeTitle'), writeQs, 180),
    ...(factoryQs.length >= 6 ? [qna(t('grammarLesson.factoryTitle'), factoryQs, 180)] : []),
    // 게임 ② 26~28분: 팀 대항 퀴즈
    ...(teamQuizOk ? [{ id: uid(), kind: 'game', gameType: 'gameshowquiz', templateId: games.teamQuizId as string, helpers: [timer(120)] } as LessonSlide] : []),
    // 정리 28~30분
    {
      ...board(t('grammarLesson.wrapTitle'), [point.tip ?? point.explain, point.pattern, t('grammarLesson.wrapPoints')], 5),
      helpers: [timer(60)],
    } as LessonSlide,
    qna(t('grammarLesson.exitTitle'), exitQs, 60),
  ];
  return slides;
}

/** 문법 수업이 쓰는 게임 내용 두 가지를 만든다: 문장 배열하기(예문 + 추가 예문) · 팀 대항 퀴즈(B 세트 고르기, 없으면 A 뒷부분) */
export async function makeGrammarGameTemplates(params: {
  grammarId: string;
  academyId: string;
  classId: string | null;
  teacherId: string;
  name: (pointName: string) => string;
  teamName: (pointName: string) => string;
}): Promise<GrammarGames> {
  const point = grammarPoint(params.grammarId);
  const sheet = GRAMMAR_SHEET_BANK[params.grammarId] as GrammarSheetContent | undefined;
  const out: GrammarGames = { unscrambleId: null, teamQuizId: null };
  if (!point) return out;
  const base = sentencesForUnscramble(point, []);
  const extra = (sheet?.buildExtra ?? []).concat(sheet?.b?.build ?? []).map((x) => plainText(x.en));
  const sentences = [...new Set([...base, ...extra.flatMap((s) => s.split(/(?<=[.?!])\s+(?=[A-Z])/)).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3 && /[.?!]$/.test(s))])];
  if (sentences.length > 0) {
    const tpl = await createGameTemplate({
      academyId: params.academyId, classId: params.classId, gameType: 'unscramble', name: params.name(point.name),
      items: sentences.map((label) => ({ id: uid(), label })), teacherId: params.teacherId,
    });
    out.unscrambleId = tpl.id;
  }
  const quizSource = sheet?.b?.choose?.length ? sheet.b.choose : sheet?.choose.slice(10) ?? [];
  const quiz = (quizSource.length >= 6 ? quizSource : sheet?.choose ?? []).slice(0, 10);
  if (quiz.length >= 6) {
    const tpl = await createGameTemplate({
      academyId: params.academyId, classId: params.classId, gameType: 'gameshowquiz' as GameType, name: params.teamName(point.name),
      items: [], config: { questions: chooseToQuiz(quiz) }, teacherId: params.teacherId,
    });
    out.teamQuizId = tpl.id;
  }
  return out;
}
