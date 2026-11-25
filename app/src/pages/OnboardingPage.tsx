import { useState, type FormEvent } from 'react';
import { createSampleStarter } from '../lib/sampleStarter';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { claimAdmin, createAcademy } from '../lib/api';
import i18n from '../i18n';

// 이 이메일로 로그인한 사람에게는 일반 온보딩 대신 "관리자로 시작하기"를 보여준다.
// 실제 권한 부여는 claim_admin() RPC 가 서버에서 auth.users.email 로 다시 확인하므로,
// 여기서 이메일을 비교하는 건 화면 분기용일 뿐 보안 경계가 아니다.
const ADMIN_EMAIL = 'likesea85@naver.com';

export default function OnboardingPage() {
  const { t } = useTranslation();
  const { refresh, session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminEmail = session?.user.email?.toLowerCase() === ADMIN_EMAIL;

  async function handleClaimAdmin() {
    setBusy(true);
    setError(null);
    try {
      await claimAdmin();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // 원장
  const [academyName, setAcademyName] = useState('');
  const [pointUnit, setPointUnit] = useState(i18n.t('onboarding.pointUnitDefault'));
  const [ownerName, setOwnerName] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const academyId = await createAcademy(academyName, pointUnit, ownerName);
      // 첫 수업 1분 체험: 샘플 반·샘플 수업을 만들어 둔다(실패해도 가입은 계속).
      try {
        if (session?.user.id) await createSampleStarter(academyId, session.user.id, i18n.language);
      } catch {
        /* 샘플은 덤이라 못 만들어도 괜찮다 */
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-margin-mobile bg-background py-10">
      <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-xl shadow-card border border-surface-container-highest p-8">
        <div className="flex items-center gap-3 mb-6">
          <BrandMark className="h-10 w-10" />
          <div>
            <div className="font-title-md text-title-md text-deep-navy">{t('onboarding.startTitle')}</div>
            <div className="font-caption text-caption text-on-surface-variant">{session?.user.email}</div>
          </div>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 mb-4 font-body-md text-sm">
            {error}
          </div>
        )}

        {isAdminEmail ? (
          <>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              {t('onboarding.adminIntro')}
            </p>
            <button
              disabled={busy}
              onClick={() => void handleClaimAdmin()}
              className="w-full bg-warm-yellow hover:brightness-95 disabled:opacity-60 text-tertiary-container font-title-md text-title-md py-3 rounded-lg shadow-sm transition-all"
            >
              {busy ? t('onboarding.processing') : t('onboarding.startAsAdmin')}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="aname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                {t('onboarding.academyNameLabel')}
              </label>
              <input
                id="aname"
                required
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
                placeholder={t('onboarding.academyNamePlaceholder')}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label htmlFor="punit" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                {t('onboarding.pointUnitLabel')}
              </label>
              <input
                id="punit"
                required
                value={pointUnit}
                onChange={(e) => setPointUnit(e.target.value)}
                placeholder={t('onboarding.pointUnitPlaceholder')}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label htmlFor="oname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
                {t('onboarding.myNameLabel')}
              </label>
              <input
                id="oname"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t('onboarding.ownerNamePlaceholder')}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-title-md text-title-md py-3 rounded-lg shadow-sm transition-colors"
            >
              {busy ? t('onboarding.processing') : t('onboarding.submit')}
            </button>
          </form>
        )}

        <button
          onClick={() => void signOut()}
          className="w-full mt-4 font-caption text-caption text-on-surface-variant hover:text-primary transition-colors"
        >
          {t('onboarding.signInOtherAccount')}
        </button>
      </div>
    </div>
  );
}
