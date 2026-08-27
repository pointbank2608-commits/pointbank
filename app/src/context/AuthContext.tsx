import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Academy, Profile } from '../lib/types';

interface AuthValue {
  /** 세션/프로필을 처음 확인하는 중인지 */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  academy: Academy | null;
  isStaff: boolean;
  isAdmin: boolean;
  pointUnit: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  // 1) 세션 추적.
  //    onAuthStateChange 콜백 안에서 supabase 를 다시 호출하면 교착이 생길 수 있어,
  //    여기서는 상태만 갱신하고 실제 조회는 아래 effect 에서 한다.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setAcademy(null);
      setProfileReady(true);
      return;
    }

    const { data: prof, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('프로필 조회 실패', error);
    }

    setProfile((prof as Profile) ?? null);

    if (prof?.academy_id) {
      const { data: aca } = await supabase
        .from('academies')
        .select('*')
        .eq('id', prof.academy_id)
        .maybeSingle();
      setAcademy((aca as Academy) ?? null);
    } else {
      setAcademy(null);
    }

    setProfileReady(true);
  }, [userId]);

  // 2) 로그인한 사용자가 바뀌면 프로필/학원을 다시 읽는다.
  useEffect(() => {
    setProfileReady(false);
    void loadProfile();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAcademy(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading: !sessionReady || !profileReady,
      session,
      profile,
      academy,
      isStaff: profile?.role === 'owner' || profile?.role === 'teacher',
      isAdmin: profile?.role === 'admin',
      pointUnit: academy?.point_unit ?? '포인트',
      refresh: loadProfile,
      signOut,
    }),
    [sessionReady, profileReady, session, profile, academy, loadProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
