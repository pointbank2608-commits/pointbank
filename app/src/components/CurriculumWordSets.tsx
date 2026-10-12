import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCurriculumWords, type WordBand, type WordSchoolId, type WordSetItem } from '../lib/curriculumWords';
import { useToast } from '../context/ToastContext';
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
  onBulk,
}: {
  disabled: boolean;
  onPick: (title: string, entries: WordBankEntry[]) => void;
  /** 정렬·개수로 단어장을 한꺼번에 만들어 그룹에 저장(없으면 이 기능을 숨긴다). 만든 개수를 돌려준다. */
  onBulk?: (lists: { name: string; entries: WordBankEntry[] }[], group: string) => Promise<number>;
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

      {band && onBulk && <BulkListMaker band={band} school={cur?.ko ?? ''} disabled={disabled} onBulk={onBulk} />}

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

/**
 * 정렬(진도순·알파벳순)과 단어장 하나의 단어 수를 고르면 그 묶음의 단어장을 내 단어장에 한꺼번에 만들고
 * 같은 그룹에 넣는다. 진도순은 사전이 정한 순서(교육부 번호·학년군), 빈도수순은 빈도 목록을 구한 뒤 더한다.
 */
function BulkListMaker({
  band,
  school,
  disabled,
  onBulk,
}: {
  band: WordBand;
  school: string;
  disabled: boolean;
  onBulk: (lists: { name: string; entries: WordBankEntry[] }[], group: string) => Promise<number>;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [sort, setSort] = useState<'progress' | 'alpha'>('progress');
  const [per, setPer] = useState(20);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(0);
  const [busy, setBusy] = useState(false);

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const out: WordBankEntry[] = [];
    for (const u of band.units) for (const s of u.sets) for (const e of s.entries) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    return sort === 'alpha' ? [...out].sort((a, b) => a.word.localeCompare(b.word)) : out;
  }, [band, sort]);
  const chunks = Math.max(1, Math.ceil(pool.length / per));
  const last = to > 0 ? Math.min(to, chunks) : chunks;
  const first = Math.min(Math.max(1, from), last);
  const count = last - first + 1;
  const sortLabel = t(sort === 'progress' ? 'recipes.bulkSortProgress' : 'recipes.bulkSortAlpha');
  const base = `${school} ${band.label}`.trim();

  async function make() {
    if (count > 20 && !confirm(t('recipes.bulkConfirm', { count }))) return;
    setBusy(true);
    try {
      const lists: { name: string; entries: WordBankEntry[] }[] = [];
      for (let i = first; i <= last; i++) {
        const entries = pool.slice((i - 1) * per, i * per);
        if (entries.length > 0) lists.push({ name: `${base} · ${sortLabel} · ${(i - 1) * per + 1}~${(i - 1) * per + entries.length}`, entries });
      }
      const made = await onBulk(lists, `${base} · ${sortLabel} · ${t('recipes.bulkPer', { n: per })}`);
      notify(t('recipes.bulkDone', { count: made }));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) => `rounded-full px-3 py-1 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;
  const num = 'w-16 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-center text-sm text-on-surface';
  return (
    <div className="space-y-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3">
      <div className="font-label-md text-label-md font-bold text-deep-navy">{t('recipes.bulkTitle')}</div>
      <p className="font-caption text-caption text-on-surface-variant">{t('recipes.bulkHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-caption text-caption text-on-surface-variant">{t('recipes.bulkSort')}</span>
        <button type="button" onClick={() => setSort('progress')} className={chip(sort === 'progress')}>{t('recipes.bulkSortProgress')}</button>
        <button type="button" onClick={() => setSort('alpha')} className={chip(sort === 'alpha')}>{t('recipes.bulkSortAlpha')}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-caption text-caption text-on-surface-variant">{t('recipes.bulkPerLabel')}</span>
        {[10, 15, 20, 25, 30, 50].map((n) => (
          <button key={n} type="button" onClick={() => { setPer(n); setFrom(1); setTo(0); }} className={chip(per === n)}>{n}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 font-caption text-caption text-on-surface-variant">
        {t('recipes.bulkRange')}
        <input type="number" min={1} max={chunks} value={first} onChange={(e) => setFrom(Number(e.target.value) || 1)} className={num} />
        ~
        <input type="number" min={1} max={chunks} value={last} onChange={(e) => setTo(Number(e.target.value) || 0)} className={num} />
        <span>{t('recipes.bulkOf', { total: chunks, words: pool.length })}</span>
      </div>
      <button
        type="button"
        disabled={disabled || busy || pool.length === 0}
        onClick={() => void make()}
        className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
      >
        {busy ? t('common.loading') : t('recipes.bulkMake', { count })}
      </button>
    </div>
  );
}
