import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deletionDaysLeft, myDeletionRequest } from '../lib/account';

/** 학원 삭제가 예약돼 있으면 모든 화면 위에 알린다(수업 중에는 AppLayout 이 안 그린다) */
export default function DeletionBanner() {
  const { t } = useTranslation();
  const { isStaff, profile } = useAuth();
  const [requestedAt, setRequestedAt] = useState<string | null>(null);

  useEffect(() => {
    if (isStaff) void myDeletionRequest().then(setRequestedAt);
  }, [isStaff]);

  if (!requestedAt) return null;
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-error/40 bg-error-container/50 px-4 py-3">
      <span className="material-symbols-outlined text-error" aria-hidden>
        warning
      </span>
      <p className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-error-container">
        {t('account.pending', { n: deletionDaysLeft(requestedAt) })}
      </p>
      {profile?.role === 'owner' && (
        <Link to="/settings" className="shrink-0 rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary">
          {t('account.cancel')}
        </Link>
      )}
    </div>
  );
}
