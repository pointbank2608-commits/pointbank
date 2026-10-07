import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import SoloPlayer, { type SoloPlayerApi } from '../components/solo/SoloPlayer';
import { forgetStudentToken, savedToken } from '../lib/studentPortal';
import { SoloError, soloAdvance, soloAnswer, soloOpen, soloReveal, type SoloOpenResult } from '../lib/soloApi';

const shell = 'flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#16213e] p-6 text-center text-white';

/** 학생이 "오늘의 수업" 하나를 혼자 하는 화면(/s/lesson/:id). 로그인 열쇠가 없거나 끝났으면 학생 홈으로 돌려보낸다. */
export default function StudentSoloPage() {
  const { t } = useTranslation();
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const token = savedToken();
  const [lesson, setLesson] = useState<SoloOpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !assignmentId) {
      navigate('/s', { replace: true });
      return;
    }
    let alive = true;
    soloOpen(token, assignmentId)
      .then((r) => alive && setLesson(r))
      .catch((e) => {
        if (!alive) return;
        if (e instanceof SoloError && e.kind === 'expired') {
          forgetStudentToken();
          navigate('/s', { replace: true });
        } else {
          setError(e instanceof SoloError ? e.kind : 'unknown');
        }
      });
    return () => {
      alive = false;
    };
  }, [token, assignmentId, navigate]);

  const api = useMemo<SoloPlayerApi | null>(() => {
    if (!token || !assignmentId) return null;
    return {
      answer: (step, value) => soloAnswer(token, assignmentId, step, value),
      advance: async (step, unsure) => {
        const r = await soloAdvance(token, assignmentId, step, unsure);
        return { answer: r.answer };
      },
      reveal: (step) => soloReveal(token, assignmentId, step),
    };
  }, [token, assignmentId]);

  if (error) {
    return (
      <div className={shell}>
        <p className="text-xl font-bold">{t(`solo.err_${error}`, { defaultValue: t('solo.error') })}</p>
        <button type="button" onClick={() => navigate('/s')} className="min-h-12 rounded-full bg-warm-yellow px-8 text-lg font-bold text-deep-navy">
          {t('solo.backHome')}
        </button>
      </div>
    );
  }
  if (!lesson || !api) return <div className={`${shell} text-lg text-white/70`}>{t('common.loading')}</div>;
  return (
    <SoloPlayer
      steps={lesson.steps}
      startAt={lesson.done ? 0 : lesson.progress}
      api={api}
      onExit={() => navigate('/s')}
    />
  );
}
