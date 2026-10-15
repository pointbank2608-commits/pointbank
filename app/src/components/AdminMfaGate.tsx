import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

/**
 * 관리자 2단계 인증(TOTP, 2026-10-17). 관리자 화면 전체를 이 문 안에 둔다.
 *  - 인증 앱(구글 OTP·Authy 등)을 등록하지 않았으면 QR 로 등록하게 하고,
 *  - 등록했는데 이번 로그인에서 코드를 안 넣었으면 6자리 코드를 받는다.
 * 서버에서도 강제하려면 supabase/082c 를 실행한다(is_platform_admin 이 aal2 만 인정).
 */
type Phase = 'checking' | 'ok' | 'enroll' | 'challenge';

interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('checking');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  const check = useCallback(async () => {
    setError(null);
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError || !aal) {
      setError(aalError?.message ?? t('adminMfa.unavailable'));
      setCanSkip(true);
      setPhase('enroll');
      return;
    }
    if (aal.currentLevel === 'aal2') {
      setPhase('ok');
      return;
    }
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.[0];
    if (verified) {
      setFactorId(verified.id);
      setPhase('challenge');
      return;
    }
    // 등록하다 만 흔적이 있으면 지우고 새로 시작
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'classbank-admin' });
    if (enrollError || !data) {
      setError(enrollError?.message ?? t('adminMfa.unavailable'));
      setCanSkip(true);
    } else {
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setFactorId(data.id);
    }
    setPhase('enroll');
  }, [t]);

  useEffect(() => {
    void check();
  }, [check]);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError(t('adminMfa.wrongCode'));
      setCode('');
      return;
    }
    setCode('');
    await check();
  }

  if (phase === 'ok') return <>{children}</>;
  if (phase === 'checking') return <p className="py-16 text-center text-on-surface-variant">{t('common.loading')}</p>;

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">
        {phase === 'enroll' ? t('adminMfa.enrollTitle') : t('adminMfa.challengeTitle')}
      </h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {phase === 'enroll' ? t('adminMfa.enrollHint') : t('adminMfa.challengeHint')}
      </p>

      {phase === 'enroll' && enrollment && (
        <div className="space-y-2">
          <img src={enrollment.qr} alt="" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
          <p className="break-all text-center font-caption text-caption text-on-surface-variant">
            {t('adminMfa.secret')}: <span className="select-all font-mono">{enrollment.secret}</span>
          </p>
        </div>
      )}

      {(phase === 'challenge' || enrollment) && (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && void verify()}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void verify()}
            className="w-full rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary disabled:opacity-40"
          >
            {busy ? t('common.loading') : t('adminMfa.verify')}
          </button>
        </>
      )}

      {error && <p className="font-caption text-caption text-error">{error}</p>}
      {canSkip && (
        <button type="button" onClick={() => setPhase('ok')} className="font-label-md text-label-md text-on-surface-variant underline">
          {t('adminMfa.skip')}
        </button>
      )}
    </div>
  );
}
