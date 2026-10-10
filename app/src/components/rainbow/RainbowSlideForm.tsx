import { useTranslation } from 'react-i18next';
import { SPEAKING_ITEMS, STRUCTURE_ITEMS, type SpeakingItem, type StructureItem } from '../../lib/rainbow';

export type RainbowMode = 'speak' | 'structure';

export interface RainbowDraft {
  mode: RainbowMode;
  /** 비어 있으면 모든 문장 */
  itemIds: string[];
  showKo: boolean;
}

/** 슬라이드·개별수업이 쓰는 문장 목록(고른 것만, 없으면 전부) */
export function pickSpeaking(ids: string[] | undefined): SpeakingItem[] {
  const list = ids?.length ? SPEAKING_ITEMS.filter((i) => ids.includes(i.id)) : SPEAKING_ITEMS;
  return list.length ? list : SPEAKING_ITEMS;
}
export function pickStructure(ids: string[] | undefined): StructureItem[] {
  const list = ids?.length ? STRUCTURE_ITEMS.filter((i) => ids.includes(i.id)) : STRUCTURE_ITEMS;
  return list.length ? list : STRUCTURE_ITEMS;
}

/** 무지개 문법 슬라이드 설정 — 방식(그림 말하기/구조 보기)과 문장 고르기 */
export default function RainbowSlideForm({
  value,
  onChange,
  onAdd,
}: {
  value: RainbowDraft;
  onChange: (next: RainbowDraft) => void;
  /** 추가 패널에서만: 슬라이드 넣기 */
  onAdd?: () => void;
}) {
  const { t } = useTranslation();
  const pool = value.mode === 'speak' ? SPEAKING_ITEMS.map((i) => ({ id: i.id, text: i.englishAnswer })) : STRUCTURE_ITEMS.map((i) => ({ id: i.id, text: i.sentence }));
  const all = value.itemIds.length === 0;
  const toggle = (id: string) => {
    const base = all ? pool.map((p) => p.id) : value.itemIds;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    onChange({ ...value, itemIds: next.length === pool.length ? [] : next });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('rainbow.mode')}>
        {(['speak', 'structure'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value.mode === m}
            onClick={() => onChange({ ...value, mode: m, itemIds: [] })}
            className={`rounded-xl border-2 px-3 py-2 text-left ${value.mode === m ? 'border-primary bg-primary/10' : 'border-outline-variant hover:bg-surface-container-low'}`}
          >
            <span className="block font-label-md text-label-md font-bold text-deep-navy">{t(`rainbow.mode_${m}`)}</span>
            <span className="block font-caption text-caption text-on-surface-variant">{t(`rainbow.modeHint_${m}`)}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-3 font-caption text-caption text-on-surface-variant">
          <span>{t('rainbow.pickSentences')}</span>
          <button type="button" onClick={() => onChange({ ...value, itemIds: [] })} className="text-primary hover:underline">
            {t('rainbow.allSentences')}
          </button>
        </div>
        <ul className="space-y-1">
          {pool.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-container-low">
                <input type="checkbox" checked={all || value.itemIds.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-primary" />
                <span className="font-label-md text-label-md text-on-surface">{p.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {value.mode === 'speak' && (
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          <input type="checkbox" checked={value.showKo} onChange={(e) => onChange({ ...value, showKo: e.target.checked })} className="h-4 w-4 accent-primary" />
          {t('rainbow.showKoFinal')}
        </label>
      )}

      {onAdd && (
        <button type="button" onClick={onAdd} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container">
          {t('rainbow.addSlide')}
        </button>
      )}
    </div>
  );
}
