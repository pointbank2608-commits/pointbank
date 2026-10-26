import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { wmStudentLinks } from '../../lib/wordMemory/api';

/** 학생 포털(/s) 홈: 내가 받은 단어암기숙제 링크. 서버에 기능이 없거나 목록이 비면 아무것도 그리지 않는다. */
export default function WordMemoryPortalLinks({ token }: { token: string }) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<{ title: string; access: string; phase: 'study' | 'review' }[]>([]);
  useEffect(() => {
    let alive = true;
    wmStudentLinks(token)
      .then((rows) => alive && setLinks(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setLinks([]));
    return () => {
      alive = false;
    };
  }, [token]);
  if (links.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl bg-white/10 p-5" data-wm-portal>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
        <span className="material-symbols-outlined text-[24px] text-warm-yellow" aria-hidden>
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
