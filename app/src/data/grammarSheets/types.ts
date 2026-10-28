/**
 * 문법 워크북(의도별 시트) 검수 자료. 문법 항목(grammarPoints.json) 하나당 한 건이며,
 * 규칙 발견·빈칸·배열은 grammarPoints 의 검수된 예문(굵은 표시 `**`)과 해석에서 만들고
 * 여기에는 그 데이터만으로는 만들 수 없는 문항(고르기·오류 고치기 추가분·말하기·총정리)을 둔다.
 * 정답이 하나인지, 영어가 맞는지는 scripts/grammar-sheets/check-bank.mjs 와 독립 검수(검수 보고서)로 확인한다.
 */
export interface ChooseItem {
  /** 빈칸은 ____ 한 곳 */
  p: string;
  /** 보기 2~3개(정답은 하나뿐이어야 한다) */
  c: string[];
  /** 정답 보기 번호(0부터) */
  a: number;
  /** 왜 그것이 정답인지 한 줄(한국어) */
  why: string;
}
export interface CorrectItem {
  /** 틀린 문장(틀린 곳은 한 군데) */
  w: string;
  /** 고친 문장 */
  r: string;
  why: string;
}
export interface SayItem {
  /** 학생이 할 일(한국어 한 줄) */
  task: string;
  /** 말할 때 쓰는 영어 문장 틀 */
  frame: string;
}
export interface ReviewItem {
  /** 우리말 뜻 */
  ko: string;
  /** 지켜야 할 조건(한국어, 한 줄) */
  cond: string;
  /** 모범 답(영어 한 문장) */
  model: string;
}
/** 빈칸·배열·규칙 발견에 쓰는 예문: 바뀌는 부분을 ** ** 로 감싼다 */
export interface BuildItem {
  en: string;
  ko: string;
}
/** 세트 하나(B 세트는 이 전체를 새로 쓰고, A 세트는 아래 GrammarSheetContent 의 최상위 칸이 같은 역할을 한다) */
export interface SetContent {
  discover: { q: string; a: string };
  choose: ChooseItem[];
  build: BuildItem[];
  correct: CorrectItem[];
  say: SayItem[];
  mission: { title: string; scene: string; steps: string[] };
  review: ReviewItem[];
}
/**
 * 세트 A = 문법 데이터의 예문·틀리기 쉬운 것 + 이 파일의 최상위 칸. 세트 B = `b`(전혀 다른 문장).
 */
export interface GrammarSheetContent {
  id: string;
  /** 규칙 발견: 굵게 표시된 부분을 보고 규칙을 말하게 하는 질문과 모범 답 */
  discover: { q: string; a: string };
  /** 고르기 10문항(보기 순서는 화면에서 섞는다) */
  choose: ChooseItem[];
  /** 세트 A 빈칸·배열 추가 예문(문법 데이터의 예문 5개와 합쳐 쓴다) */
  buildExtra?: BuildItem[];
  /** 틀리기 쉬운 문장 추가분(데이터의 pitfalls 와 합쳐 최대 6개) */
  correct: CorrectItem[];
  /** 문법 데이터의 틀리기 쉬운 문장 중 시트에서 뺄 것(틀린 문장 `wrong` 원문 — 문맥에 따라 맞는 문장이 될 수 있는 경우) */
  dropPitfalls?: string[];
  /** 말하기 6개 */
  say: SayItem[];
  /** 말하기 미션(역할·상황이 있는 짝 활동) */
  mission: { title: string; scene: string; steps: string[] };
  /** 총정리 조건 영작 6개 */
  review: ReviewItem[];
  /** 세트 B */
  b?: SetContent;
}
