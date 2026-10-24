import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GRAMMAR_POINTS, GRAMMAR_STAGES, grammarLevelTag, type GrammarPoint, type GrammarStage } from '../../lib/grammar';
import GrammarBoard from '../GrammarBoard';

/** 문법 불러오기: 학교급 탭 + 검색으로 항목을 고르면 문법 칠판이 크게 뜬다(오늘 자료 없이 쓴다). */
export default function BoardGrammar() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<GrammarStage>('elementary');
  const [query, setQuery] = useState('');
  const [point, setPoint] = useState<GrammarPoint | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GRAMMAR_POINTS.filter((g) => (q ? `${g.name} ${g.pattern}`.toLowerCase().includes(q) : g.stage === stage));
  }, [stage, query]);

  if (point) {
    return (
      <div className="flex h-full flex-col gap-2 p-3" data-board-grammar-view>
        <div className="flex items-center gap-3">
          <button type="button" className="min-h-11 rounded-xl border-2 border-outline-variant bg-white px-4 font-bold text-deep-navy" onClick={() => setPoint(null)} data-board-grammar-list>
            ☰ {t('whiteboard.grammarChoose')}
          </button>
          <span className="truncate text-lg font-extrabold text-deep-navy">{point.name}</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
            <GrammarBoard key={point.id} point={point} themeId="green" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-3 p-4" data-board-grammar-picker>
      <h2 className="text-2xl font-black text-deep-navy">{t('whiteboard.grammarTitle')}</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('whiteboard.grammarSearch')}
        aria-label={t('whiteboard.grammarSearch')}
        className="min-h-12 rounded-xl border-2 border-outline-variant bg-white px-4 text-lg"
      />
      {!query && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {GRAMMAR_STAGES.map((st) => (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={stage === st}
              onClick={() => setStage(st)}
              className={`min-h-11 rounded-full px-4 font-bold ${stage === st ? 'bg-primary text-white' : 'bg-white text-deep-navy border border-outline-variant'}`}
            >
              {t(`grammar.stage_${st}`)}
            </button>
          ))}
        </div>
      )}
      <ul className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto sm:grid-cols-2">
        {list.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => setPoint(g)}
              data-grammar-id={g.id}
              className="w-full rounded-xl border border-outline-variant bg-white p-3 text-left shadow-card hover:border-primary focus-visible:outline-4 focus-visible:outline-primary"
            >
              <span className="block text-xs font-bold text-primary">{grammarLevelTag(g)}</span>
              <span className="block text-lg font-extrabold text-deep-navy">{g.name}</span>
              <span className="block truncate text-sm text-on-surface-variant">{g.pattern.replace(/\*\*/g, '')}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="p-4 text-on-surface-variant">{t('whiteboard.grammarEmpty')}</li>}
      </ul>
    </div>
  );
}
