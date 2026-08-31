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

/** Supabase 에러를 사용자에게 보여줄 메시지로 바꾼다. t 는 useTranslation() 의 t 함수. */
export function friendlyError(err: unknown, t: (key: string) => string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const map: Record<string, string> = {
    'Invalid login credentials': 'auth.errorInvalidCredentials',
    'User already registered': 'auth.errorAlreadyRegistered',
    'Email not confirmed': 'auth.errorEmailNotConfirmed',
  };
  for (const [needle, key] of Object.entries(map)) {
    if (raw.includes(needle)) return t(key);
  }
  if (raw.includes('Password should be at least')) {
    return t('auth.errorPasswordTooShort');
  }
  return raw;
}
