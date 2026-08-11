import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase 환경변수가 없습니다. app/.env.local 에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 설정하세요.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Supabase 에러를 사용자에게 보여줄 한국어 메시지로 바꾼다. */
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const map: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'User already registered': '이미 가입된 이메일입니다. 로그인해 주세요.',
    'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해 주세요.',
  };
  for (const [needle, ko] of Object.entries(map)) {
    if (raw.includes(needle)) return ko;
  }
  if (raw.includes('Password should be at least')) {
    return '비밀번호는 6자 이상이어야 합니다.';
  }
  return raw;
}
