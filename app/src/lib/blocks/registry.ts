import { GAME_CATALOG } from '../gameCatalog';
import { MATERIALS_CATALOG } from '../materialsCatalog';
import { STEP_KINDS } from '../soloEdit';
import { PRINTABLE_STEP_TYPES } from '../soloPrint';
import type { GameType, LessonSlide } from '../types';
import type { SoloStep } from '../soloLessons';
import type { BlockCategory, BlockDef } from './types';

/**
 * 블록 레지스트리(BLOCK_SPEC §4·§7 단계 1) — 지금 있는 기능을 한곳에 블록으로 등록한다.
 * 새 기능은 여기에 등록해야 수업에 "블록"으로 들어간다. 이 파일은 기존 카탈로그(게임·자료실·개별수업 단계 종류)에서
 * 블록을 만들어 내므로, 카탈로그에 한 줄을 더하면 블록도 저절로 생긴다.
 */

/** 문제풀이로 묶어 보이는 게임 */
const PRACTICE_GAMES: GameType[] = ['quiz', 'truefalse', 'gameshowquiz', 'winlosequiz', 'quizshow'];

/** 단체수업 게임 ↔ 개별수업 문제로 같은 개념인 것 */
const GAME_CONCEPT: Partial<Record<GameType, string>> = {
  quiz: 'meaningPick',
  spellword: 'spelling',
  unscramble: 'sentenceOrder',
  shopping: 'roleplay',
  typeanswer: 'typeWord',
};

/** 개별수업 문제 종류 → 같은 개념 이름 */
const SOLO_CONCEPT: Partial<Record<SoloStep['t'], string>> = {
  meet: 'wordIntro',
  pickMeaning: 'meaningPick',
  pickWord: 'meaningPick',
  spell: 'spelling',
  typeWord: 'typeWord',
  unscramble: 'sentenceOrder',
  rule: 'grammarRule',
  example: 'grammarRule',
  rainbowSpeak: 'rainbowSpeak',
  rainbowStructure: 'rainbowStructure',
  lineSing: 'shadowLine',
  watch: 'videoListen',
  roleplay: 'roleplay',
  lyricBlank: 'clozeListen',
  gapType: 'clozeListen',
  lineOrder: 'lineOrder',
  test: 'test',
};

/** 개별수업 문제 중 서버가 채점하는 것 */
const SOLO_GRADED: SoloStep['t'][] = ['pickWord', 'pickMeaning', 'listenPick', 'pickPos', 'spell', 'typeWord', 'fillBlank', 'dictation', 'translatePick', 'pickCorrect', 'unscramble', 'lyricBlank', 'sayPick', 'gapType', 'lineOrder', 'test'];

const gameBlocks: BlockDef[] = GAME_CATALOG.map((g) => ({
  id: `${PRACTICE_GAMES.includes(g.type) ? 'practice' : 'game'}.${g.type}`,
  role: 'main',
  category: PRACTICE_GAMES.includes(g.type) ? 'practice' : 'game',
  icon: g.icon,
  uses: ['group'],
  status: 'ready',
  nameKey: g.nameKey,
  needs: { words: { min: g.minItems } },
  slide: { kind: 'game', gameType: g.type },
  concept: GAME_CONCEPT[g.type],
}));

const printBlocks: BlockDef[] = MATERIALS_CATALOG.map((m) => ({
  id: `print.${m.id}`,
  role: 'main',
  category: 'print',
  icon: m.icon,
  uses: ['group', 'print'],
  status: 'ready',
  nameKey: m.nameKey,
  slide: { kind: 'material', materialId: m.id },
}));

/** 단체수업의 배우기 화면 — 슬라이드 종류 하나 = 블록 하나 */
const learnBlocks: BlockDef[] = [
  { id: 'learn.wordShow', role: 'main', category: 'learn', icon: 'style', uses: ['group'], status: 'ready', name: { ko: '단어 소개', en: 'Word introduction' }, needs: { words: { min: 1 } }, slide: { kind: 'wordshow' }, concept: 'wordIntro' },
  { id: 'learn.study', role: 'main', category: 'learn', icon: 'view_carousel', uses: ['group'], status: 'ready', name: { ko: '카드로 외우기', en: 'Study cards' }, needs: { words: { min: 1 } }, slide: { kind: 'study' } },
  { id: 'learn.grammar', role: 'main', category: 'learn', icon: 'rule', uses: ['group'], status: 'ready', name: { ko: '문법 칠판', en: 'Grammar board' }, slide: { kind: 'grammar' }, concept: 'grammarRule' },
  { id: 'learn.reading.lines', role: 'main', category: 'learn', icon: 'lyrics', uses: ['group'], status: 'ready', name: { ko: '노래·지문 한 줄씩', en: 'Song or text, line by line' }, slide: { kind: 'reading', mode: 'lines' } },
  { id: 'learn.reading.cloze', role: 'main', category: 'learn', icon: 'hearing', uses: ['group'], status: 'ready', name: { ko: '빈칸 듣기', en: 'Listening cloze' }, slide: { kind: 'reading', mode: 'cloze' }, concept: 'clozeListen' },
  { id: 'learn.shadow', role: 'main', category: 'learn', icon: 'record_voice_over', uses: ['group'], status: 'ready', name: { ko: '쉐도잉', en: 'Shadowing' }, slide: { kind: 'shadow' }, concept: 'shadowLine' },
  { id: 'learn.qna', role: 'main', category: 'learn', icon: 'help', uses: ['group'], status: 'ready', name: { ko: '내용 질문(Q&A)', en: 'Q&A' }, slide: { kind: 'qna' } },
  { id: 'learn.drill', role: 'main', category: 'learn', icon: 'repeat', uses: ['group'], status: 'ready', name: { ko: '바꿔 말하기', en: 'Substitution drill' }, slide: { kind: 'drill' } },
  { id: 'learn.rainbow.speak', role: 'main', category: 'learn', icon: 'palette', uses: ['group'], status: 'ready', name: { ko: '무지개 문법: 그림 보고 말하기', en: 'Rainbow grammar: speak from a picture' }, slide: { kind: 'rainbow', mode: 'speak' }, concept: 'rainbowSpeak' },
  { id: 'learn.rainbow.structure', role: 'main', category: 'learn', icon: 'account_tree', uses: ['group'], status: 'ready', name: { ko: '무지개 문법: 구조 보기', en: 'Rainbow grammar: structure' }, slide: { kind: 'rainbow', mode: 'structure' }, concept: 'rainbowStructure' },
  { id: 'learn.attendance', role: 'main', category: 'learn', icon: 'how_to_reg', uses: ['group'], status: 'ready', name: { ko: '출석 체크', en: 'Attendance' }, slide: { kind: 'attendance' } },
];

const mediaBlocks: BlockDef[] = [
  { id: 'media.image', role: 'main', category: 'media', icon: 'image', uses: ['group'], status: 'ready', name: { ko: '그림', en: 'Image' }, slide: { kind: 'image' } },
  { id: 'media.video', role: 'main', category: 'media', icon: 'smart_display', uses: ['group'], status: 'ready', name: { ko: '영상', en: 'Video' }, slide: { kind: 'video' }, concept: 'videoListen' },
  { id: 'media.web', role: 'main', category: 'media', icon: 'public', uses: ['group'], status: 'ready', name: { ko: '웹페이지', en: 'Web page' }, slide: { kind: 'web' } },
];

const freeBlocks: BlockDef[] = [
  { id: 'free.canvas', role: 'main', category: 'free', icon: 'dashboard_customize', uses: ['group'], status: 'ready', name: { ko: '직접 만들기', en: 'Free canvas' }, slide: { kind: 'canvas' } },
];

/** 보조 블록 — 주 블록 곁에 놓인다(제목·타이머·점수판은 슬라이드의 helpers 로 저장, lib/slideHelpers.ts) */
const helperBlocks: BlockDef[] = [
  { id: 'helper.title', role: 'helper', category: 'helper', icon: 'title', uses: ['group'], status: 'ready', name: { ko: '제목', en: 'Title' } },
  { id: 'helper.timer', role: 'helper', category: 'helper', icon: 'timer', uses: ['group'], status: 'ready', name: { ko: '타이머', en: 'Timer' } },
  { id: 'helper.scoreboard', role: 'helper', category: 'helper', icon: 'scoreboard', uses: ['group'], status: 'ready', name: { ko: '점수판', en: 'Scoreboard' } },
  { id: 'helper.textbox', role: 'helper', category: 'helper', icon: 'text_fields', uses: ['group'], status: 'ready', name: { ko: '글상자', en: 'Text box' } },
  { id: 'helper.picture', role: 'helper', category: 'helper', icon: 'add_photo_alternate', uses: ['group'], status: 'ready', name: { ko: '그림 넣기', en: 'Picture' } },
  { id: 'helper.annotation', role: 'helper', category: 'helper', icon: 'edit', uses: ['group'], status: 'ready', name: { ko: '판서(필기)', en: 'Annotation' } },
  { id: 'helper.points', role: 'helper', category: 'helper', icon: 'redeem', uses: ['group'], status: 'ready', name: { ko: '포인트 주기', en: 'Give points' } },
];

/** 개별수업의 문제 종류 — 블록 하나가 이 문제를 N개 만들어 낸다 */
const soloBlocks: BlockDef[] = STEP_KINDS.filter((k) => k.t !== 'intro').map((k) => ({
  id: `solo.${k.t}`,
  role: 'main',
  category: (['quiz'].includes(k.group) ? 'practice' : k.group === 'video' ? 'media' : 'learn') as BlockCategory,
  icon: k.icon,
  // 인쇄할 수 있는 문제 종류는 인쇄에도 쓴다(soloPrint.ts 가 같은 문제로 시트를 만든다)
  uses: PRINTABLE_STEP_TYPES.includes(k.t) ? ['solo', 'homework', 'print'] : ['solo', 'homework'],
  status: 'ready',
  nameKey: `soloEdit.stepType_${k.t}`,
  soloStep: k.t,
  concept: SOLO_CONCEPT[k.t],
}));

export const BLOCKS: BlockDef[] = [...gameBlocks, ...printBlocks, ...learnBlocks, ...mediaBlocks, ...freeBlocks, ...helperBlocks, ...soloBlocks];

const byId = new Map(BLOCKS.map((b) => [b.id, b]));
export const findBlock = (id: string): BlockDef | null => byId.get(id) ?? null;

/** 서버가 채점하는 개별수업 문제 블록인지 */
export const isGradedSolo = (b: BlockDef): boolean => !!b.soloStep && SOLO_GRADED.includes(b.soloStep);

/** 단체수업 슬라이드가 어떤 블록인지 — 기존 수업을 그대로 읽는다(저장 형식 변경 없음). 몰라보면 null. */
export function blockOfSlide(slide: LessonSlide): BlockDef | null {
  switch (slide.kind) {
    case 'game':
      return findBlock(`${PRACTICE_GAMES.includes(slide.gameType) ? 'practice' : 'game'}.${slide.gameType}`);
    case 'material':
      return findBlock(`print.${slide.materialId}`) ?? findBlock('print.worksheet');
    case 'reading':
      return findBlock(`learn.reading.${slide.mode}`);
    case 'rainbow':
      return findBlock(`learn.rainbow.${slide.mode}`);
    case 'wordshow':
      return findBlock('learn.wordShow');
    case 'study':
      return findBlock('learn.study');
    case 'grammar':
      return findBlock('learn.grammar');
    case 'shadow':
      return findBlock('learn.shadow');
    case 'qna':
      return findBlock('learn.qna');
    case 'drill':
      return findBlock('learn.drill');
    case 'attendance':
      return findBlock('learn.attendance');
    case 'image':
      return findBlock('media.image');
    case 'video':
      return findBlock('media.video');
    case 'web':
      return findBlock('media.web');
    case 'canvas':
      return findBlock('free.canvas');
  }
}

/** 슬라이드에 놓인 보조 블록들 */
export function helperBlocksOf(slide: LessonSlide): BlockDef[] {
  return (slide.helpers ?? []).map((h) => findBlock(`helper.${h.type}`)).filter((b): b is BlockDef => !!b);
}

export function blockOfSoloStep(t: SoloStep['t']): BlockDef | null {
  return t === 'intro' ? null : findBlock(`solo.${t}`);
}

/** 범주별 목록(블록 보관함의 재료) */
export function blocksByCategory(): Map<BlockCategory, BlockDef[]> {
  const m = new Map<BlockCategory, BlockDef[]>();
  for (const b of BLOCKS) m.set(b.category, [...(m.get(b.category) ?? []), b]);
  return m;
}

/** 같은 개념의 단체·개별 블록 짝 */
export function blocksOfConcept(concept: string): BlockDef[] {
  return BLOCKS.filter((b) => b.concept === concept);
}
