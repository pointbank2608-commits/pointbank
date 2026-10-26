import { useTranslation } from 'react-i18next';
import type { WmCollectionWord, WmStageCounts, WmWordState } from '../../lib/wordMemory/types';
import { WM_STATES } from '../../lib/wordMemory/types';

/** 단계마다 모양(아이콘)과 글자를 함께 쓴다 — 색만으로 구분하지 않는다. */
const STATE_ICON: Record<WmWordState, string> = { unseen: 'help', seen: 'visibility', practicing: 'edit', alone: 'check_circle', kept: 'workspace_premium' };

export function StateChip({ state, dark = false }: { state: WmWordState; dark?: boolean }) {
  const { t } = useTranslation();
  const tone: Record<WmWordState, string> = dark
    ? { unseen: 'bg-white/10 text-white/70', seen: 'bg-sky-400/25 text-sky-100', practicing: 'bg-amber-400/25 text-amber-100', alone: 'bg-emerald-400/25 text-emerald-100', kept: 'bg-warm-yellow text-deep-navy' }
    : { unseen: 'bg-slate-100 text-slate-600', seen: 'bg-sky-100 text-sky-900', practicing: 'bg-amber-100 text-amber-900', alone: 'bg-emerald-100 text-emerald-900', kept: 'bg-warm-yellow text-deep-navy' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${tone[state]}`} data-wm-state={state}>
      <span className="material-symbols-outlined text-[18px]" aria-hidden style={{ fontVariationSettings: state === 'kept' || state === 'alone' ? "'FILL' 1" : undefined }}>
        {STATE_ICON[state]}
      </span>
      {t(`wordMemory.stage_${state}`)}
    </span>
  );
}

/** 학생의 단어 수집장: 만난 단어는 단계와 함께, 아직 안 만난 단어는 칸만 보인다(낱말을 미리 알려 주지 않는다). */
export default function WordMemoryCollection({ words, stages, onBack }: { words: WmCollectionWord[]; stages: WmStageCounts; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col gap-4 p-5" data-wm-collection>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{t('wordMemory.collection')}</h2>
        <button type="button" onClick={onBack} className="min-h-11 rounded-full bg-white/15 px-5 text-base font-bold">
          {t('wordMemory.collectionBack')}
        </button>
      </div>
      <p className="text-lg text-white/80">{t('wordMemory.collectionCount', { kept: stages.kept, total: stages.total })}</p>
      <ul className="flex flex-wrap gap-2" aria-label={t('wordMemory.collection')}>
        {WM_STATES.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-sm text-white/80">
            <StateChip state={s} dark />
            <span>{stages[s]}</span>
          </li>
        ))}
      </ul>
      <ul className="grid grid-cols-2 gap-3">
        {words.map((w, i) =>
          w.state === 'unseen' ? (
            <li key={i} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/25 p-3 text-center text-white/60">
              <span className="material-symbols-outlined text-[28px]" aria-hidden>
                help
              </span>
              <StateChip state="unseen" dark />
            </li>
          ) : (
            <li key={i} className="flex min-h-28 flex-col gap-1.5 rounded-2xl bg-white/10 p-3" data-wm-word={w.word}>
              {w.imageUrl && <img src={w.imageUrl} alt="" className="mx-auto h-14 w-14 rounded-lg bg-white object-contain" loading="lazy" />}
              <div lang="en" className="text-xl font-bold leading-tight">
                {w.word}
              </div>
              <div className="text-base text-white/80">{w.meaning}</div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                <StateChip state={w.state} dark />
                {w.relearning && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">{t('wordMemory.relearning')}</span>}
                {w.carried && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">{t('wordMemory.carried')}</span>}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
