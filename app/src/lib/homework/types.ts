/**
 * Classbank Student 숙제 2단계(2026-10-05, `supabase/041_homework_v2.sql`) — 숙제·활동·문제의 모양.
 * 문제 하나는 서버 채점 형식(qtype + correct)이고, 학생에게 갈 때 서버가 correct 를 뺀다.
 */

/** choice: 보기 번호 · text: 철자 입력('/'로 여러 답) · order: 낱말·글자 순서(배열) */
export type HwQType = 'choice' | 'text' | 'order';

/** 문제 화면 모양(채점과 무관, 그리기만) */
export type HwQStyle = 'meaning' | 'reverse' | 'picture' | 'listen' | 'blank' | 'spell' | 'letters' | 'sentence' | 'ox' | 'match' | 'content';

/** 문제를 만든 낱말 카드 스냅샷 — 학습 기록에 같이 남아 추천 숙제 재료가 된다 */
export interface HwCard {
  word: string;
  meaning: string;
  imageUrl?: string | null;
  example?: string | null;
}

export interface HwQuestion {
  id: string;
  qtype: HwQType;
  style?: HwQStyle;
  prompt: string;
  /** 작은 보조 글(뜻 힌트 등) */
  sub?: string;
  imageUrl?: string | null;
  /** 읽어 줄 영어(듣고 고르기·철자) */
  speak?: string | null;
  choices?: string[];
  /** order: 섞인 조각 */
  tokens?: string[];
  /** order: 정답을 보여 줄 때 이을 글자(글자 '' · 낱말 ' ') */
  joiner?: string;
  /** 정답 — 학생 화면에는 오지 않는다(선생님 미리보기·만들 때만) */
  correct?: number | string | string[];
  skill: string;
  word: string;
  contentId?: string;
  difficulty?: number;
  conceptTags?: string[];
  /** 문제 생성 버전 */
  gen: string;
  card?: HwCard;
  round?: string;
}

export type HwItemKind = 'quiz' | 'worksheet' | 'game' | 'shadowing';
export type HwGameKind = 'matchup' | 'anagram' | 'spelling';
export type HwSheetKind = 'choose' | 'blank' | 'order';

export interface HwShadowLine {
  s: number;
  e: number;
  en: string;
  ko?: string;
  speaker?: string | null;
}

export interface HwItemContent {
  questions: HwQuestion[];
  /** 쉐도잉 */
  videoId?: string;
  clipId?: string;
  lines?: HwShadowLine[];
}

export interface HwItemConfig {
  game?: HwGameKind;
  sheets?: HwSheetKind[];
  legacy?: boolean;
}

export interface HwItemDraft {
  kind: HwItemKind;
  title: string;
  config: HwItemConfig;
  content: HwItemContent;
}

export interface HwItem extends HwItemDraft {
  id: string;
}

/** 만들 숙제의 활동 구성(5·10·15분 추천 또는 직접 설정) */
export interface HwPlan {
  quizMeaning: number;
  quizListen: number;
  quizPicture: number;
  sheetChoose: number;
  sheetBlank: number;
  sheetOrder: number;
  gameMatchup: number;
  gameAnagram: number;
  gameSpelling: number;
  /** 쉐도잉 문장 수(0 이면 쉐도잉 없음) */
  shadowLines: number;
  /** 쉐도잉 뒤 내용 확인 문제 */
  contentCheck: boolean;
}

/* ---------- 서버 응답 ---------- */

export interface HwServerAnswer {
  item_id: string;
  q_index: number;
  correct: boolean;
  response: string | null;
  answer: string | null;
}

export interface HwServerItemAttempt {
  item_id: string;
  finished: boolean;
  score: number;
  total: number;
  meta: { listens?: number; repeats?: number; lines?: number };
}

export interface HwStudentState {
  title: string;
  name: string;
  due_at: string | null;
  finished: boolean;
  items: HwItem[];
  answers: HwServerAnswer[];
  item_attempts: HwServerItemAttempt[];
}

export interface HwOpenInfo {
  title: string;
  class_name: string | null;
  due_at: string | null;
  closed: boolean;
  past_due: boolean;
  count: number;
  kinds: HwItemKind[];
}

export interface HwSubmitResult {
  correct: boolean;
  answer: string | null;
  first: boolean;
}

/** 학생 화면의 오류 종류(서버 코드 → 쉬운 문구) */
export type HwErrorKind = 'not_found' | 'closed' | 'past_due' | 'bad_login' | 'locked' | 'network' | 'incomplete' | 'unknown';
