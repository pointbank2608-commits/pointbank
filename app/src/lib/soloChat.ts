import { supabase } from './supabase';

/**
 * 개별수업 선생님 ↔ 학생 1:1 채팅(2026-10-13, `supabase/072_solo_chat.sql`).
 * 반마다 방식을 고른다: off(끔) / quick(빠른 문장만 — 유치원) / free(자유 입력 + 빠른 문장).
 * 새 메시지는 실시간 신호(broadcast)로 "다시 읽어라"만 알리고, 내용은 항상 서버 함수로 읽는다(신호에는 글이 없다).
 */
export type ChatMode = 'off' | 'quick' | 'free';

export interface ChatMessage {
  id: number;
  sender: 'student' | 'teacher';
  body: string;
  at: string;
}

/** 학생이 보낼 수 있는 빠른 문장 — 서버 `solo_chat_quick_ok` 의 목록과 같아야 한다 */
export const STUDENT_QUICK = ['모르겠어요', '도와주세요', '다 했어요', '화장실 가도 돼요?', '다시 설명해 주세요', '잘 안 들려요'] as const;
/** 선생님이 한 번에 보내는 답 */
export const TEACHER_QUICK = ['잠깐만 기다려 줘', '지금 갈게', '잘했어요!', '다시 한 번 해 볼까요?', '천천히 해도 괜찮아요', '쉬는 시간이에요'] as const;

export interface StudentChatState {
  mode: ChatMode;
  academy_id?: string;
  /** 숙제 대화의 대화 번호(선생님 쪽이 같은 번호로 연다) */
  thread?: string;
  unread?: number;
  messages?: ChatMessage[];
  error?: string;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await supabase.rpc(fn, args);
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------------- 학생 ---------------- */

export const studentChatState = (token: string, assignment: string, mark = false) =>
  rpc<StudentChatState>('solo_chat_state', { p_token: token, p_assignment: assignment, p_mark: mark });

export async function studentChatSend(token: string, assignment: string, body: string, quick: boolean): Promise<{ ok?: boolean; error?: string }> {
  return rpc('solo_chat_send', { p_token: token, p_assignment: assignment, p_body: body, p_quick: quick });
}

/** 숙제 화면(2차, 073) — 숙제 열쇠로 대화 읽기·보내기 */
export const hwChatState = (token: string, mark = false) => rpc<StudentChatState>('hw_chat_state', { p_token: token, p_mark: mark });
export const hwChatSend = (token: string, body: string, quick: boolean) =>
  rpc<{ ok?: boolean; error?: string }>('hw_chat_send', { p_token: token, p_body: body, p_quick: quick });

/* ---------------- 선생님 ---------------- */

export interface ChatThread {
  assignment_id: string;
  student_id: string;
  name: string;
  lesson_name: string;
  class_id: string | null;
  /** 숙제 대화면 true(073 이후) */
  is_homework?: boolean;
  unread: number;
  last_body: string;
  last_sender: 'student' | 'teacher';
  last_at: string;
}

export const fetchChatThreads = () => rpc<ChatThread[]>('solo_chat_threads', {});
export const fetchChatMessages = (assignment: string) => rpc<ChatMessage[]>('solo_chat_thread', { p_assignment: assignment });
export const postChatMessage = (assignment: string, body: string) => rpc<void>('solo_chat_post', { p_assignment: assignment, p_body: body });
export const setChatMode = (classId: string, mode: ChatMode) => rpc<void>('solo_chat_set_mode', { p_class: classId, p_mode: mode });

export async function fetchChatMode(classId: string): Promise<ChatMode> {
  const { data } = await supabase.from('classes').select('chat_mode').eq('id', classId).maybeSingle();
  const m = (data as { chat_mode?: string } | null)?.chat_mode;
  return m === 'quick' || m === 'free' ? m : 'off';
}

/* ---------------- 실시간 신호(글 없이 "새 메시지" 알림만) ---------------- */

export const studentChannelName = (assignment: string) => `solo-chat-${assignment}`;
export const teacherChannelName = (academy: string) => `solo-chat-t-${academy}`;

/** 채널을 구독하고 신호가 오면 onPing 을 부른다. 돌려주는 함수는 구독 해제 + 신호 보내기 */
export function openPingChannel(name: string, onPing: () => void) {
  const ch = supabase.channel(name, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'ping' }, () => onPing());
  ch.subscribe();
  return {
    send: () => void ch.send({ type: 'broadcast', event: 'ping', payload: {} }),
    close: () => void supabase.removeChannel(ch),
  };
}
