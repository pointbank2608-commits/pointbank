import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GRAMMAR_POINTS, grammarLevelTag, grammarPoint } from '../lib/grammar';
import type { GrammarGameType } from '../lib/grammarGames';
import { grammarGameSupport, MIN_ROUNDS } from '../lib/grammarGamesB';
import type { GameWorkspaceBridge } from '../context/GameWorkspaceContext';
import { guideButton as button } from './GameCreateButton';

/** 문법 게임의 "게임 준비" 첫 화면: 단어·문장 대신 문법 항목을 고르면 문제가 규칙으로 만들어진다. */
export default function GrammarGuideStep({ info, busy, onApply, onSample }: {
  info: GameWorkspaceBridge;
  busy: boolean;
  onApply: (content: Parameters<GameWorkspaceBridge['applyGuide']>[0]) => void;
  onSample: () => void;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const type = info.gameType as GrammarGameType;
  const options = useMemo(() => GRAMMAR_POINTS.filter((p) => grammarGameSupport(p.id)[type] >= MIN_ROUNDS[type]), [type]);
  const current = (info.selected?.config.grammarId as string | undefined) ?? 'third-s';
  const [id, setId] = useState(options.some((p) => p.id === current) ? current : options[0]?.id ?? current);
  const apply = () => onApply({
    items: [{ id: `grammar-${id}`, label: grammarPoint(id)?.name ?? id }],
    config: { ...(info.selected?.config ?? {}), grammarId: id },
  });
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-sky-50 p-4 text-lg">
        {en ? 'Pick a grammar point. The questions are made automatically from its examples, common mistakes and workbook items.' : '문법 항목을 고르면 그 문법의 예문·틀리기 쉬운 것·워크북 문제로 문제가 자동으로 만들어져요.'}
      </p>
      <label className="block font-bold">{en ? 'Grammar point' : '문법 항목'}
        <select className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 font-normal" value={id} onChange={(e) => setId(e.target.value)}>
          {options.map((p) => <option key={p.id} value={p.id}>{grammarLevelTag(p)} · {p.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={`${button} bg-primary! text-white!`} disabled={busy || info.loading} onClick={apply}>{en ? 'Use this grammar' : '이 문법으로 만들기'}</button>
        <button className={button} disabled={busy || info.loading} onClick={onSample}>{en ? 'Try the sample first' : '샘플로 먼저 해보기'}</button>
      </div>
    </div>
  );
}
