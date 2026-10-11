import type { GameType, LessonSlide } from '../types';
import type { SoloStep } from '../soloLessons';

/**
 * 블록 규격(BLOCK_SPEC.md) — 단계 1: 기존 기능을 블록으로 "등록"만 한다. 화면·저장 형식은 바뀌지 않는다.
 * 용어: 블록 = 수업에 넣는 기능 단위(주 블록 하나 + 보조 블록), 그룹 = 블록·슬라이드를 담는 상자, 문제 = 개별수업의 화면 한 장.
 */

export type BlockCategory =
  /** 게임 하나 = 블록 하나(돌림판·사다리 …) */
  | 'game'
  /** 문제풀이(퀴즈·참거짓·게임쇼 퀴즈 …) */
  | 'practice'
  /** 배우기 화면(단어 소개·문법 칠판·쉐도잉 …) */
  | 'learn'
  /** 인쇄물(워크시트·플래시카드·빙고 …) */
  | 'print'
  /** 영상·웹페이지·그림 */
  | 'media'
  /** 직접 만들기(캔버스) */
  | 'free'
  /** 보조 블록(제목·타이머·판서 …) */
  | 'helper';

/** 어디서 쓰나: 단체수업 슬라이드 / 개별수업 문제 / 숙제 / 인쇄 */
export type BlockUse = 'group' | 'solo' | 'homework' | 'print';

/** 주 블록은 화면과 키보드를 쓰고, 보조 블록은 곁에 놓이며 키보드를 쓰지 않는다 */
export type BlockRole = 'main' | 'helper';

/** ready = 지금 쓸 수 있음, planned = 규격에만 있고 아직 없음 */
export type BlockStatus = 'ready' | 'planned';

export interface BlockNeeds {
  /** 이 블록이 쓰는 낱말 조건 — 못 맞추면 "단어가 부족해요"로 알린다 */
  words?: { min: number; image?: boolean; example?: boolean; pos?: boolean };
  sentences?: number;
}

/** 단체수업 슬라이드에서 이 블록을 가리키는 열쇠 */
export interface BlockSlideRef {
  kind: LessonSlide['kind'];
  /** kind 가 game 일 때 */
  gameType?: GameType;
  /** kind 가 material 일 때(수업 자료실 id) */
  materialId?: string;
  /** kind 가 reading·rainbow 일 때의 화면 */
  mode?: string;
}

export interface BlockDef {
  /** 'game.wheel' · 'practice.quiz' · 'learn.wordShow' · 'print.worksheet' · 'solo.pickMeaning' · 'helper.timer' */
  id: string;
  role: BlockRole;
  category: BlockCategory;
  icon: string;
  uses: BlockUse[];
  status: BlockStatus;
  /** 이름: i18n 열쇠가 있으면 그것, 없으면 직접 쓴 한·영 */
  nameKey?: string;
  name?: { ko: string; en: string };
  needs?: BlockNeeds;
  slide?: BlockSlideRef;
  /** 개별수업 문제 종류(SoloStep.t) */
  soloStep?: SoloStep['t'];
  /** 같은 개념을 단체·개별에서 다르게 그리는 블록끼리 묶는 이름(BLOCK_SPEC §5) */
  concept?: string;
}
