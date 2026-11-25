import { useState } from 'react';
import { matchesGrammarSearch } from '../lib/grammar';
import { useTranslation } from 'react-i18next';
import { GRAMMAR_LEVELS_BY_STAGE, GRAMMAR_POINTS, GRAMMAR_STAGES, grammarLevelTag, type GrammarStage } from '../lib/grammar';

/** 문법 고르기(슬라이드 추가 패널) — 레벨 칩 + 목록, 누르면 바로 슬라이드가 된다. */
export default function GrammarPickerPanel({ onPick, searchQuery }: { onPick: (grammarId: string) => void; searchQuery?: string }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<GrammarStage>('elementary');
  const [level, setLevel] = useState<number>(1);
  const [query, setQuery] = useState('');
  const q = (searchQuery ?? query).trim().toLowerCase();
  // 검색어가 있으면 과정·레벨과 상관없이 전체 127개에서 찾는다.
  const list = q
    ? GRAMMAR_POINTS.filter((g) => matchesGrammarSearch(g, q))
    : GRAMMAR_POINTS.filter((g) => g.level === level);
  return (
    <div className="space-y-3">
      <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.grammarSlide.addIntro')}</p>
      {searchQuery === undefined && <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('grammar.searchPlaceholder')}
        className="w-full max-w-sm rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />}
      <div className={`flex flex-wrap gap-1.5 ${q ? 'hidden' : ''}`}>
        {GRAMMAR_STAGES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setStage(st);
              setLevel(GRAMMAR_LEVELS_BY_STAGE[st][0]);
            }}
            className={`rounded-lg border px-3 py-1.5 font-label-md text-label-md ${
              stage === st ? 'border-primary bg-primary-fixed text-primary' : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            {t(`grammar.stage_${st}`)}
          </button>
        ))}
      </div>
      <div className={`flex flex-wrap gap-1.5 ${!q && GRAMMAR_LEVELS_BY_STAGE[stage].length > 1 ? '' : 'hidden'}`}>
        {GRAMMAR_LEVELS_BY_STAGE[stage].map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevel(lv)}
            className={`rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
              level === lv ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {stage === 'elementary' ? `Lv.${lv} ${t(`grammar.level${lv}`)}` : t(`grammar.level${lv}`)}
          </button>
        ))}
      </div>
      <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {list.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('grammar.noResults')}</p>}
        {list.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onPick(g.id)}
            className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-left transition-colors hover:border-primary hover:bg-secondary-container/30"
          >
            <div className="font-label-md text-label-md text-on-surface">{g.name}</div>
            <div className="font-caption text-caption text-on-surface-variant">
              {q ? `${t(`grammar.stage_${g.stage}`)} · ` : ''}
              {grammarLevelTag(g)} · {g.pattern.replace(/\*\*/g, '')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
