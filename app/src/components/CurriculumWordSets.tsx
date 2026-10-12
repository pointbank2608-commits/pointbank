import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCurriculumWords, type WordSchoolId, type WordSetItem } from '../lib/curriculumWords';
import type { WordBankEntry } from '../lib/types';
import { loadWordBank } from '../lib/wordBankCache';

/**
 * 교과과정 단어 — 새 수업 만들기의 "수업 세트" 안. 학교급(초등·중등·고등) → 학년군(교육부 800 DAY·Lv.1~4·중학·고등) → 주제 순으로 짠
 * 단어 묶음(10개)을 고르면 단어장과 단어 수업이 한 번에 만들어진다. 기존 "단어 수업"(그림 있는 낱말 15세트)은 그대로 둔다.
 */
export default function CurriculumWordSets({
  disabled,
  onPick,
  initialSchool = 'elementary',
}: {
  disabled: boolean;
  onPick: (title: string, entries: WordBankEntry[]) => void;
  /** 수업 만들기의 "대상"에 맞춰 처음 보일 학교급 */
  initialSchool?: WordSchoolId;
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const [bank, setBank] = useState<WordBankEntry[] | null>(null);
  const [school, setSchool] = useState<WordSchoolId>(initialSchool);
  const [bandId, setBandId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadWordBank().then((b) => alive && setBank(b));
    return () => {
      alive = false;
    };
  }, []);

  const schools = useMemo(() => (bank ? buildCurriculumWords(bank) : []), [bank]);
  const cur = schools.find((s) => s.id === school) ?? schools[0];
  const band = cur ? cur.bands.find((b) => b.id === bandId) ?? cur.bands[0] : undefined;
  const unit = band ? band.units.find((u) => u.id === unitId) ?? band.units[0] : undefined;

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;

  if (!bank) {
    return <div className="rounded-2xl border border-primary/30 bg-primary-fixed/15 p-4 font-caption text-caption text-on-surface-variant">{t('recipes.cwLoading')}</div>;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary-fixed/15 p-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">menu_book</span>
          <span className="font-label-md text-label-md font-bold text-deep-navy">{t('recipes.cwTitle')}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-caption text-caption text-primary">{t('recipes.cwSub')}</span>
        </div>
        <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('recipes.cwHint')}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {schools.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.count === 0}
            onClick={() => {
              setSchool(s.id);
              setBandId(null);
              setUnitId(null);
            }}
            className={`${chip(school === s.id)} disabled:opacity-40`}
          >
            {ko ? s.ko : s.en} <span className="opacity-70">{s.count}</span>
          </button>
        ))}
      </div>

      {cur && cur.bands.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {cur.bands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBandId(b.id);
                setUnitId(null);
              }}
              className={chip(band?.id === b.id)}
              title={b.hint}
            >
              {b.label}
              {b.hint && <span className="ml-1 opacity-70">{b.hint}</span>}
            </button>
          ))}
        </div>
      )}

      {band && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {band.units.map((u) => (
              <button key={u.id} type="button" onClick={() => setUnitId(u.id)} className={chip(unit?.id === u.id)}>
                {u.label} <span className="opacity-70">{u.count}</span>
              </button>
            ))}
          </div>
          {unit && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {unit.sets.map((s: WordSetItem) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(`${cur?.ko ?? ''} · ${s.title}`, s.entries)}
                  className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{s.title}</span>
                    <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('recipes.cwCount', { n: s.entries.length })}</span>
                  </div>
                  <div className="line-clamp-2 font-caption text-caption text-on-surface-variant">
                    {s.entries.slice(0, 6).map((e) => e.word).join(' · ')}
                    {s.entries.length > 6 ? ' …' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {schools.every((s) => s.count === 0) && <p className="font-caption text-caption text-on-surface-variant">{t('recipes.cwEmpty')}</p>}
    </div>
  );
}
