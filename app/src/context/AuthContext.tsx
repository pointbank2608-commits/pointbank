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
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Academy, Profile } from '../lib/types';
import { trialInfo, type TrialInfo } from '../lib/trial';

interface AuthValue {
  /** 세션/프로필을 처음 확인하는 중인지 */
  loading: boolean;
  session: Session | null;
  sessionReplaced: boolean;
  profile: Profile | null;
  academy: Academy | null;
  isStaff: boolean;
  isAdmin: boolean;
  isPaid: boolean;
  /** 무료 체험 상태(080) */
  trial: TrialInfo;
  /** 유료이거나 체험 중 — 기능 열림·한도 판단은 이 값을 쓴다(결제 화면만 isPaid) */
  hasFullAccess: boolean;
  pointUnit: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function disconnectTeacherPush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/attendance');
    if (reg && new URL(reg.scope).pathname === '/attendance') {
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
    }
  } catch { /* Sign-out must also work offline. */ }
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReplaced, setSessionReplaced] = useState(false);
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
      if (_event === 'SIGNED_IN' && next) setSessionReplaced(false);
      setSession(next);
      setSessionReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const accessToken = session?.access_token;
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    let checking = false;
    async function check() {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const { error } = await supabase.rpc('classbank_current_session').abortSignal(controller.signal);
        if (controller.signal.aborted || error?.code !== 'PT409' || error.message !== 'classbank_session_replaced') return;
        const { data } = await supabase.auth.getSession();
        if (controller.signal.aborted || data.session?.access_token !== accessToken) return;
        setSessionReplaced(true);
        await disconnectTeacherPush();
        await supabase.auth.signOut({ scope: 'local' });
      } finally {
        checking = false;
      }
    }
    void check();
    const timer = window.setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [accessToken]);

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
      if (error.code === 'PT409' && error.message === 'classbank_session_replaced') return;
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
    await disconnectTeacherPush();
    await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
    setAcademy(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading: !sessionReady || !profileReady,
      session,
      sessionReplaced,
      profile,
      academy,
      isStaff: profile?.role === 'owner' || profile?.role === 'teacher',
      isAdmin: profile?.role === 'admin',
      isPaid: academy?.plan === 'paid',
      trial: trialInfo(academy),
      hasFullAccess: academy?.plan === 'paid' || trialInfo(academy).active,
      pointUnit: academy?.point_unit ?? t('common.pointsFallback'),
      refresh: loadProfile,
      signOut,
    }),
    [sessionReady, profileReady, session, sessionReplaced, profile, academy, loadProfile, signOut, t],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
