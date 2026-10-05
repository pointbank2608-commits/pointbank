/** 숙제 진행 화면들이 같이 쓰는 모양 */

/** 답 하나의 결과. correct=null 은 인터넷이 끊겨 아직 채점 전(이 기기에 저장해 둠) */
export interface AnswerResult {
  correct: boolean | null;
  /** 정답 글(채점한 뒤에만) */
  answer: string | null;
}

/** 진행 화면이 서버(또는 미리보기)를 부르는 방법 */
export interface RunnerApi {
  submit: (itemId: string, qIndex: number, response: string, ms: number) => Promise<AnswerResult>;
  progress: (itemId: string, event: 'shadow_line' | 'item_complete', meta: Record<string, unknown>) => Promise<void>;
  /** 끝내기. answers 가 오면(서버가 다시 채점한 결과) 결과 화면이 그걸 쓴다 */
  finish: () => Promise<{ score: number; total: number; answers?: Map<string, AnswerResult> }>;
}

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

export const answerKey = (itemId: string, qIndex: number) => `${itemId}:${qIndex}`;
