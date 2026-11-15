import type { SoloLesson } from './soloApi';
import { ICE_SKATING_CLIP_ID } from './soloVideoTemplate';

export const CAILLOU_TRANSFER_PROMPT = '학교 갈 준비를 하는 중이에요. 내 가방은 혼자 챙기고 싶다고 영어로 말해 보세요. 한 문장으로 써 주세요.';

export type TransferGrade = 'matched' | 'missing' | 'review';
export type StudentTransferAction = 'first' | 'retry' | 'hint';
export type TransferState = {
  assignment_id: string;
  item_version: string;
  rule_version: string;
  opens_at: string | null;
  available: boolean;
  first_grade: TransferGrade | null;
  hint_used: boolean;
  hint: string | null;
  retry_grade: TransferGrade | null;
  done: boolean;
};
export type FollowupPlan = { lesson: string; homework: string };
export type FollowupRow = {
  assignment_id: string;
  name: string;
  enabled: boolean;
  target_selected: boolean;
  lesson_changed: boolean;
  state: TransferState | null;
  first_answer: string | null;
  first_at: string | null;
  retry_answer: string | null;
  lesson_version_recorded: boolean;
  approved_lesson: string | null;
  approved_homework: string | null;
};
export type TeacherTransferApi = (action: 'list' | 'enable' | 'approve', id?: string, plan?: FollowupPlan) => Promise<FollowupRow[]>;

export function isCaillouFirstLesson(lesson: SoloLesson) {
  return new RegExp(`^verified-video-${ICE_SKATING_CLIP_ID}-v\\d+-(10|20|40)-1$`).test(lesson.source ?? '');
}

export function transferDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(value));
}

export const transferGradeLabels: Record<TransferGrade, string> = {
  matched: '목표 표현을 상황에 맞게 사용',
  missing: '목표 표현이 나오지 않음',
  review: '목표 표현 포함 · 문장 확인 필요',
};

export function recommendCaillouFollowup(state: TransferState): { reason: string; plan: FollowupPlan } | null {
  if (!state.done) return null;
  if (state.first_grade === 'matched') return {
    reason: '가방을 챙기는 새 상황에서 첫 답에 목표 표현을 썼어요.',
    plan: {
      lesson: '3분 · 카이유의 by myself와 새 표현 on my own을 비교하고, 새 상황에 맞는 문장 한 개를 말해요.',
      homework: '2분 · 다음 날 친구에게 혼자 퍼즐을 풀고 싶다고 영어로 써요. 첫 답은 단서 없이 확인해요.',
    },
  };
  if (state.retry_grade === 'matched' && !state.hint_used) return {
    reason: '첫 답에서는 확인이 필요했지만, 힌트 없이 다시 써서 목표 표현을 사용했어요.',
    plan: {
      lesson: '4분 · I want to …와 by myself를 이어 붙여 새 문장 두 개를 소리 내어 말해요.',
      homework: '2분 · 다음 날 혼자 책상을 정리하고 싶다는 문장을 처음부터 단서 없이 써요.',
    },
  };
  if (state.retry_grade === 'matched') return {
    reason: '힌트를 연 뒤 재시도에서 목표 표현을 사용했어요.',
    plan: {
      lesson: '5분 · 짧은 원음에서 by myself를 다시 듣고, 예문을 덩어리로 따라 말한 뒤 예문 없이 한 문장을 말해요.',
      homework: '2분 · 다음 날 혼자 그림을 그리고 싶다는 상황을 주고 첫 답에서 by myself를 떠올리는지 확인해요.',
    },
  };
  if (state.first_grade === 'review' || state.retry_grade === 'review') return {
    reason: '목표 표현이 들어간 답변은 문맥 확인이 필요해요. 답안을 보고 아래 복습안을 조정할 수 있어요.',
    plan: {
      lesson: '3분 · 학생 문장을 확인하고, 필요한 경우 by myself가 들어가는 예문 한 개를 함께 다듬어요.',
      homework: '2분 · 다음 날 혼자 도시락을 챙기고 싶다는 상황에서 영어 한 문장을 단서 없이 써요.',
    },
  };
  return {
    reason: state.hint_used ? '힌트를 연 뒤에도 답에서 목표 표현이 나오지 않았어요.' : '두 답에서 목표 표현이 나오지 않았어요.',
    plan: {
      lesson: '5분 · 원음으로 by myself의 뜻을 다시 확인하고, 쉬운 예문을 듣고 따라 한 뒤 한 문장을 말해요.',
      homework: '2분 · 다음 날 혼자 그림을 그리고 싶다는 상황에서 영어 한 문장을 먼저 단서 없이 써요.',
    },
  };
}
