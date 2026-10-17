import { useFeature } from '../lib/features';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { fetchStudentCode } from '../lib/studentPortal';

/**
 * 사이드바 맨 위 "학원 코드 보기"(2026-10-13) — 누르면 학생이 로그인할 때 쓰는 학원 코드와 선생님 초대 코드가
 * 펼쳐지고, 코드 옆 작은 아이콘으로 바로 복사한다. 코드는 눌렀을 때만 보인다(화면을 공유할 때 노출되지 않게).
 */
export default function AcademyCodeButton() {
  const { t } = useTranslation();
  const { academy } = useAuth();
  const soloOpen = useFeature('solo');
  const homeworkOpen = useFeature('homework');
  const studentAreaOpen = soloOpen || homeworkOpen;
  const [open, setOpen] = useState(false);
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<'student' | 'invite' | null>(null);
  const invite = academy?.invite_code ?? '';

  // 처음 열 때만 읽는다(045 전 서버면 학생 코드 줄만 숨는다)
  useEffect(() => {
    if (!open || studentCode !== null || failed) return;
    let alive = true;
    fetchStudentCode()
      .then((c) => alive && setStudentCode(c))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, studentCode, failed]);

  async function copy(which: 'student' | 'invite', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
    } catch {
      /* 복사가 막힌 브라우저면 눈으로 보고 옮겨 적는다 */
    }
  }

  const row = (which: 'student' | 'invite', label: string, code: string) => (
    <div className="space-y-1">
      <div className="font-caption text-caption text-on-surface-variant">{label}</div>
      <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-lg font-bold tracking-[0.2em] text-deep-navy">{code}</span>
        <button
          type="button"
          onClick={() => void copy(which, code)}
          aria-label={t('nav.codeCopy', { label })}
          title={t('nav.codeCopy', { label })}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary"
        >
          <span className="material-symbols-outlined text-[18px]">{copied === which ? 'check' : 'content_copy'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-4 mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/20 bg-white/5 px-4 py-2.5 font-label-md text-[15px] font-semibold text-white/90 transition-colors hover:bg-white/15"
      >
        <span className="material-symbols-outlined">{open ? 'expand_less' : 'key'}</span>
        {open ? t('nav.hideCodes') : t('nav.showCodes')}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-sm">
          {studentAreaOpen && studentCode !== null && row('student', t('nav.studentCodeLabel'), studentCode)}
          {studentAreaOpen && studentCode === null && !failed && <p className="font-caption text-caption text-on-surface-variant">{t('common.loading')}</p>}
          {invite && row('invite', t('nav.inviteCodeLabel'), invite)}
          <p className="font-caption text-caption text-on-surface-variant">{t('nav.codeHint')}</p>
        </div>
      )}
    </div>
  );
}
