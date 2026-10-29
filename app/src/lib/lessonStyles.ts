import { createGameTemplate } from './api';
import { buildGameContent, canBuildFromWords, lessonGameTemplateName, wordListToCards } from './gameFromWords';
import { SENTENCE_LIST_GAMES, prepareWordListGame, type WordListGame } from './wordListLaunch';
import { enrichCards, loadWordBank } from './wordBankCache';
import type { FullCardItem, GameType, LessonSlide, WordList } from './types';

/**
 * 내 수업 틀(2026-10-30): 수업의 "구조"(슬라이드 종류·순서·게임 종류·보조 블록·고정 슬라이드)만 저장해 두고,
 * 다른 단어장·문장 모음을 고르면 그 재료로 같은 모양의 수업을 다시 만든다.
 *  - 단어 소개·카드로 외우기 = 낱말을 새 단어장으로 바꾼다.
 *  - 게임 = 같은 종류의 게임 내용을 새 재료로 만든다(게임 템플릿을 새로 만든다).
 *  - 자료실(워크시트 등) = 낱말을 비워 수업 단어장을 따라가게 한다.
 *  - 그 밖(직접 만들기·영상·노래·문법 …) = 그대로 복사한다(고정).
 * 문장 모음에는 문장 게임(문장 배열하기·문장 스플래시)만 만들고 낱말 슬라이드·단어 게임은 건너뛴다(단어/문장 입력 분리 규칙).
 * 틀은 이 브라우저(학원별 localStorage)에 저장한다 — 서버 표는 아직 없다(학원 공유는 다음 단계).
 */
export interface LessonStyle {
  id: string;
  name: string;
  createdAt: string;
  /** 틀을 만든 수업 이름(참고용) */
  fromLesson: string;
  /** 재료를 뺀 슬라이드 */
  slides: LessonSlide[];
}

export type StyleRole = 'words' | 'game' | 'material' | 'fixed';

export function roleOf(slide: LessonSlide): StyleRole {
  if (slide.kind === 'wordshow' || slide.kind === 'study') return 'words';
  if (slide.kind === 'game') return 'game';
  if (slide.kind === 'material') return 'material';
  return 'fixed';
}

const newId = () => crypto.randomUUID();

/** 수업에서 틀을 만든다: 재료(낱말·게임 내용 연결)를 빼고 나머지는 그대로 둔다. */
export function styleFromLesson(name: string, lessonName: string, slides: LessonSlide[]): LessonStyle {
  const stripped = slides.map((slide) => {
    const copy = JSON.parse(JSON.stringify(slide)) as LessonSlide;
    delete copy.ownWordListId;
    if (copy.kind === 'game') {
      delete copy.templateId;
      delete copy.autoWordListId;
    } else if (copy.kind === 'wordshow' || copy.kind === 'study' || copy.kind === 'material') {
      delete (copy as { words?: FullCardItem[] }).words;
    }
    return copy;
  });
  return { id: newId(), name: name.trim() || lessonName, createdAt: new Date().toISOString(), fromLesson: lessonName, slides: stripped };
}

export type PlanStep =
  | { slide: LessonSlide; action: 'keep' }
  | { slide: LessonSlide; action: 'words' }
  | { slide: LessonSlide; action: 'game' }
  | { slide: LessonSlide; action: 'skip'; reason: 'sentenceList' | 'wordGameOnSentences' | 'cannotBuild' };

/** 재료 종류에 따라 각 슬라이드를 어떻게 처리할지(순수 함수 — 화면 미리보기·테스트가 같이 쓴다). */
export function planStyle(style: LessonStyle, listKind: 'word' | 'sentence'): PlanStep[] {
  return style.slides.map((slide): PlanStep => {
    const role = roleOf(slide);
    if (role === 'fixed') return { slide, action: 'keep' };
    if (listKind === 'sentence') {
      if (role === 'game') {
        return (SENTENCE_LIST_GAMES as readonly string[]).includes((slide as { gameType: string }).gameType)
          ? { slide, action: 'game' }
          : { slide, action: 'skip', reason: 'wordGameOnSentences' };
      }
      return { slide, action: 'skip', reason: 'sentenceList' };
    }
    if (role === 'words') return { slide, action: 'words' };
    if (role === 'material') return { slide, action: 'keep' };
    return canBuildFromWords((slide as { gameType: GameType }).gameType) ? { slide, action: 'game' } : { slide, action: 'skip', reason: 'cannotBuild' };
  });
}

export interface ApplyResult {
  slides: LessonSlide[];
  made: number;
  skipped: { gameType?: string; kind: string; reason: 'sentenceList' | 'wordGameOnSentences' | 'cannotBuild' }[];
}

/** 틀 + 단어장/문장 모음 → 새 수업의 슬라이드. 게임은 새 게임 템플릿을 만든다(게임 센터에도 보인다). */
export async function applyStyle(params: {
  style: LessonStyle;
  list: WordList;
  lessonName: string;
  academyId: string;
  classId: string | null;
  teacherId: string;
}): Promise<ApplyResult> {
  const { style, list, lessonName, academyId, classId, teacherId } = params;
  const listKind: 'word' | 'sentence' = list.kind === 'sentence' ? 'sentence' : 'word';
  const plan = planStyle(style, listKind);
  const cards = wordListToCards(list);
  const enriched = listKind === 'word' && plan.some((p) => p.action === 'game') ? enrichCards(cards, await loadWordBank()) : cards;
  const slides: LessonSlide[] = [];
  const skipped: ApplyResult['skipped'] = [];
  let made = 0;
  for (const step of plan) {
    const base = { ...(JSON.parse(JSON.stringify(step.slide)) as LessonSlide), id: newId() } as LessonSlide;
    if (step.action === 'skip') {
      skipped.push({ kind: step.slide.kind, gameType: step.slide.kind === 'game' ? step.slide.gameType : undefined, reason: step.reason });
      continue;
    }
    if (step.action === 'keep') { slides.push(base); continue; }
    if (step.action === 'words') {
      slides.push({ ...base, words: cards, ownWordListId: list.id } as LessonSlide);
      continue;
    }
    // game
    const gameType = (step.slide as Extract<LessonSlide, { kind: 'game' }>).gameType;
    const content = listKind === 'sentence'
      ? (() => { const prepared = prepareWordListGame(list.items, gameType as WordListGame); return prepared.ready ? { items: prepared.items, config: prepared.config } : null; })()
      : buildGameContent(gameType, enriched);
    if (!content) { skipped.push({ kind: 'game', gameType, reason: 'cannotBuild' }); continue; }
    const tpl = await createGameTemplate({
      academyId, classId, gameType,
      name: lessonGameTemplateName(lessonName, list.name),
      items: content.items, config: content.config, teacherId,
    });
    slides.push({ ...base, templateId: tpl.id, autoWordListId: undefined, ownWordListId: list.id } as LessonSlide);
    made += 1;
  }
  return { slides, made, skipped };
}

/* ---------------- 이 브라우저에 저장 ---------------- */
const key = (academyId: string) => `classbank.lessonStyles.${academyId}`;

export function loadStyles(academyId: string): LessonStyle[] {
  try {
    const raw = localStorage.getItem(key(academyId));
    const parsed = raw ? (JSON.parse(raw) as LessonStyle[]) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.id && Array.isArray(s.slides)) : [];
  } catch {
    return [];
  }
}

function persist(academyId: string, styles: LessonStyle[]): boolean {
  try { localStorage.setItem(key(academyId), JSON.stringify(styles)); return true; } catch { return false; }
}

/** 저장에 성공하면 새 목록, 저장소를 못 쓰면 null */
export function saveStyle(academyId: string, style: LessonStyle): LessonStyle[] | null {
  const next = [style, ...loadStyles(academyId).filter((s) => s.id !== style.id)].slice(0, 30);
  return persist(academyId, next) ? next : null;
}

export function deleteStyle(academyId: string, id: string): LessonStyle[] {
  const next = loadStyles(academyId).filter((s) => s.id !== id);
  persist(academyId, next);
  return next;
}

export function renameStyle(academyId: string, id: string, name: string): LessonStyle[] {
  const next = loadStyles(academyId).map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s));
  persist(academyId, next);
  return next;
}

/** 틀 한눈에 보기: 재료 슬라이드 n · 게임 n · 고정 n */
export function styleSummary(style: LessonStyle): { words: number; games: number; material: number; fixed: number } {
  const out = { words: 0, games: 0, material: 0, fixed: 0 };
  for (const s of style.slides) {
    const r = roleOf(s);
    if (r === 'words') out.words++; else if (r === 'game') out.games++; else if (r === 'material') out.material++; else out.fixed++;
  }
  return out;
}
