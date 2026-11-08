import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { wmStudentLinks } from '../../lib/wordMemory/api';

type PortalLink = Awaited<ReturnType<typeof wmStudentLinks>>[number];

/** 성공한 빈 목록은 숨기고, 호출 실패는 학생이 다시 시도할 수 있게 한다. */
export default function WordMemoryPortalLinks({ token }: { token: string }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ token: string; attempt: number; links: PortalLink[] | null }>();
  useEffect(() => {
    let alive = true;
    wmStudentLinks(token)
      .then((rows) => alive && setResult({ token, attempt, links: Array.isArray(rows) ? rows : null }))
      .catch(() => alive && setResult({ token, attempt, links: null }));
    return () => {
      alive = false;
    };
  }, [token, attempt]);
  if (!result || result.token !== token || result.attempt !== attempt) return null;
  const { links } = result;
  if (links === null) return (
    <div role="status" className="mx-auto w-full max-w-xl rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-5" data-wm-portal-error>
      {t('wordMemory.portalLoadError')}{' '}
      <button type="button" onClick={() => setAttempt(n => n + 1)} className="min-h-11 font-bold underline">
        {t('studentPortal.retry')}
      </button>
    </div>
  );
  if (links.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-5" data-wm-portal>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
        <span className="material-symbols-outlined text-[24px] text-[#3b5bdb]" aria-hidden>
          event_repeat
        </span>
        {t('wordMemory.title')}
      </h2>
      <ul className="flex flex-col gap-3">
        {links.map((l) => (
          <li key={l.access}>
            <a href={`/wm/${l.access}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-deep-navy">
              <span className="material-symbols-outlined text-[26px]" aria-hidden>
                play_circle
              </span>
              <span className="min-w-0 flex-1 truncate text-lg font-bold">{l.title || t('wordMemory.title')}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
