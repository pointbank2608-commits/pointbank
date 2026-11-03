import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useGameEmbed } from '../context/GameEmbedContext';
import EditOnly from '../components/EditOnly';
import GameThemeFrame from '../components/GameThemeFrame';
import GrammarGame from '../components/GrammarGames';
import GrammarGameB from '../components/GrammarGamesB';
import { useGameTemplates } from '../lib/useGameTemplates';
import { createGameTemplate, updateGameTemplate } from '../lib/api';
import { GRAMMAR_POINTS, grammarLevelTag, grammarPoint } from '../lib/grammar';
import type { GrammarGameType } from '../lib/grammarGames';
import { grammarGameSupport, MIN_ROUNDS } from '../lib/grammarGamesB';
import type { GameItem } from '../lib/types';

/** 문법별 게임 4종이 같이 쓰는 페이지: 문법 항목 하나를 고르면 문제는 규칙으로 만들어진다(config.grammarId). */
export const DEFAULT_GRAMMAR_ID = 'third-s';
const input = 'min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2';
const button = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 font-semibold disabled:opacity-40';

const itemsFor = (grammarId: string): GameItem[] => [{ id: `grammar-${grammarId}`, label: grammarPoint(grammarId)?.name ?? grammarId }];

export const GrammarLabPage = () => <GrammarGamePage type="grammarlab" />;
export const GrammarVerbPage = () => <GrammarGamePage type="grammarverb" />;
export const GrammarAuctionPage = () => <GrammarGamePage type="grammarauction" />;
export const GrammarWritePage = () => <GrammarGamePage type="grammarwrite" />;
export const GrammarPosPage = () => <GrammarGamePage type="grammarpos" />;
export const GrammarFramePage = () => <GrammarGamePage type="grammarframe" />;
export const GrammarComparePage = () => <GrammarGamePage type="grammarcompare" />;
export const GrammarLinkPage = () => <GrammarGamePage type="grammarlink" />;
export const GrammarHabitPage = () => <GrammarGamePage type="grammarhabit" />;

export default function GrammarGamePage({ type }: { type: GrammarGameType }) {
  const { i18n } = useTranslation();
  const text = (ko: string, en: string) => (i18n.language.startsWith('en') ? en : ko);
  const navigate = useNavigate();
  const { academy, profile } = useAuth();
  const embed = useGameEmbed();
  const { notify } = useToast();
  const g = useGameTemplates({
    gameType: type,
    defaultItems: () => itemsFor(DEFAULT_GRAMMAR_ID),
    defaultConfig: () => ({ grammarId: DEFAULT_GRAMMAR_ID }),
  });
  const [restart, setRestart] = useState(0);
  const [name, setName] = useState('');
  const [draftId, setDraftId] = useState(DEFAULT_GRAMMAR_ID);
  const [busy, setBusy] = useState(false);
  const grammarId = (g.selected?.config.grammarId as string | undefined) ?? draftId;
  const options = useMemo(
    () => GRAMMAR_POINTS.filter((p) => grammarGameSupport(p.id)[type] >= MIN_ROUNDS[type]),
    [type],
  );

  async function choose(next: string) {
    if (busy) return;
    setBusy(true);
    try {
      const items = itemsFor(next);
      if (g.selected) {
        const config = { ...g.selected.config, grammarId: next };
        await updateGameTemplate(g.selected.id, { items, config });
        g.setTemplates((old) => old.map((t) => (t.id === g.selected!.id ? { ...t, items, config } : t)));
      } else if (embed && academy && profile) {
        const row = await createGameTemplate({
          academyId: academy.id, classId: g.classId, gameType: type, teacherId: profile.id,
          name: name.trim() || grammarPoint(next)?.name || type, items, config: { grammarId: next },
        });
        g.setTemplates((old) => [...old, row]);
        g.setSelectedId(row.id);
      } else setDraftId(next);
      setRestart((k) => k + 1);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveCopy() {
    if (!academy || !profile || busy || !name.trim()) return;
    setBusy(true);
    try {
      const tpl = await createGameTemplate({
        academyId: academy.id, classId: g.classId, gameType: type, teacherId: profile.id,
        name: name.trim(), items: itemsFor(grammarId), config: { grammarId },
      });
      g.setTemplates((old) => [...old, tpl]);
      g.setSelectedId(tpl.id);
      setName('');
      notify(text('게임을 저장했어요.', 'Game saved.'));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!g.loading && (
        <GameThemeFrame gameType={type} roster={g.roster} onRestart={() => setRestart((k) => k + 1)}>
          {(['grammarpos', 'grammarframe', 'grammarcompare', 'grammarlink', 'grammarhabit'] as const).some((b) => b === type)
            ? <GrammarGameB key={`${g.selected?.id ?? 'draft'}:${grammarId}:${restart}`} type={type as 'grammarpos'} grammarId={grammarId} seed={restart + 1} onExit={() => navigate('/games')} />
            : <GrammarGame key={`${g.selected?.id ?? 'draft'}:${grammarId}:${restart}`} type={type} grammarId={grammarId} seed={restart + 1} onExit={() => navigate('/games')} />}
        </GameThemeFrame>
      )}
      {g.loading && <p role="status">{text('불러오는 중…', 'Loading…')}</p>}
      {g.isStaff && (
        <EditOnly>
          <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4" aria-label={text('문법 게임 설정', 'Grammar game settings')}>
            <Link to="/games" className="text-primary underline">{text('게임 목록으로', 'Back to games')}</Link>
            <p>{text('문법 항목을 고르면 그 문법의 예문·틀리기 쉬운 것·워크북 문제로 문제가 자동으로 만들어져요.', 'Pick a grammar point and the questions are built from its examples, common mistakes and workbook items.')}</p>
            {g.classes.length > 0 && (
              <label className="block">{text('반 선택', 'Class')}
                <select className={input} value={g.staffClassId || ''} onChange={(e) => g.selectClass(e.target.value)}>
                  {g.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {g.templates.length > 0 && (
              <label className="block">{text('저장한 게임', 'Saved game')}
                <select className={input} value={g.selectedId || ''} onChange={(e) => g.setSelectedId(e.target.value)}>
                  <option value="" disabled>{text('게임 선택', 'Choose game')}</option>
                  {g.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">{text('문법 항목', 'Grammar point')}
              <select className={input} value={grammarId} disabled={busy} onChange={(e) => void choose(e.target.value)}>
                {options.map((p) => <option key={p.id} value={p.id}>{grammarLevelTag(p)} · {p.name}</option>)}
              </select>
            </label>
            <div className="space-y-2 border-t border-outline-variant pt-4">
              <label className="block">{text('새 게임 이름', 'New game name')}
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={grammarPoint(grammarId)?.name} />
              </label>
              <button className={button} disabled={busy || !name.trim()} onClick={() => void saveCopy()}>{text('이 문법으로 새 게임 저장', 'Save as new game')}</button>
              {g.selected && <button className={`${button} ml-2`} onClick={() => void g.handleRename(name.trim() || undefined)}>{text('이름 바꾸기', 'Rename')}</button>}
            </div>
          </section>
        </EditOnly>
      )}
    </div>
  );
}
