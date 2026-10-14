import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassNotice } from '../../lib/soloChat';

/**
 * 반 전체 공지 띠(2026-10-14, 채팅 3차) — 선생님이 반 학생 모두에게 띄운 한 줄을 화면 위쪽에 보여 준다.
 * 30초마다 다시 읽고, 학생이 "알겠어요"를 누르면 그 공지는 접는다(같은 글은 다시 안 띄운다, 새 공지는 띄운다).
 */
export default function ClassNoticeBanner({ load }: { load: () => Promise<ClassNotice | null> }) {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<ClassNotice | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    const run = () => {
      loadRef.current()
        .then((n) => alive && setNotice(n))
        .catch(() => undefined);
    };
    run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!notice || !notice.text || dismissed === `${notice.text}|${notice.until}`) return null;
  return (
    <div className="mx-auto flex w-full max-w-xl items-start gap-3 rounded-2xl bg-warm-yellow px-4 py-3 text-deep-navy shadow-lg" role="status">
      <span className="text-2xl" aria-hidden="true">📢</span>
      <p className="min-w-0 flex-1 text-lg font-bold leading-snug">{notice.text}</p>
      <button
        type="button"
        onClick={() => setDismissed(`${notice.text}|${notice.until}`)}
        className="shrink-0 rounded-full bg-deep-navy px-3 py-1.5 text-sm font-bold text-white"
      >
        {t('solo.noticeOk')}
      </button>
    </div>
  );
}
