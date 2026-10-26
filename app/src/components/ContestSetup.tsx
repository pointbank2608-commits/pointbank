import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildContestQuestions, contestAvailability, contestRoundNames, DEFAULT_CONTEST_ROUNDS } from '../lib/liveQuiz';
import { wordListToCards } from '../lib/gameFromWords';
import { useWordBankEnriched } from '../lib/wordBankCache';
import type { ContestRoundSetting, ContestRoundType, GameTemplate, GameTemplateConfig, WordList } from '../lib/types';

const field = 'w-full min-w-0 rounded-xl border border-outline-variant bg-white p-3 text-on-surface';
const primary = 'rounded-full bg-primary px-6 py-3 font-bold !text-white disabled:opacity-40';

/** A local draft: navigation never saves partial contests or loses round settings. */
export default function ContestSetup({ lists, loading, templates, onLoad, onSave, onCancel }: {
  lists: WordList[]; loading: boolean; templates: GameTemplate[];
  onLoad: (template: GameTemplate) => void;
  onSave: (name: string, config: GameTemplateConfig) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);
  const [listId, setListId] = useState('');
  const [kind, setKind] = useState<'word' | 'sentence'>('word');
  const [rounds, setRounds] = useState(() => DEFAULT_CONTEST_ROUNDS.map(r => ({ ...r })));
  const [open, setOpen] = useState<ContestRoundType | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const source = lists.find(l => l.id === listId);
  const raw = useMemo(() => wordListToCards(source), [source]);
  const cards = useWordBankEnriched(raw);
  const avail = useMemo(() => contestAvailability(cards), [cards]);
  const enabled = rounds.filter(r => r.on && avail[r.type] > 0);
  const count = enabled.reduce((n, r) => n + (r.count === -1 ? avail[r.type] : Math.min(r.count, avail[r.type])), 0);
  function patch(type: ContestRoundType, value: Partial<ContestRoundSetting>) {
    setRounds(rs => rs.map(r => r.type === type ? { ...r, ...value } : r));
  }
  async function save() {
    if (busy || !source) return;
    setBusy(true); setError('');
    try {
      const questions = buildContestQuestions(cards, contestRoundNames(t), rounds);
      if (!questions.length) throw new Error('empty');
      await onSave(name.trim() || t('contestSetup.defaultName', { name: source.name }), {
        liveQuestions: questions, liveContestRounds: rounds, liveSpeedBonus: true,
        classroomSource: { id: source.id, name: source.name, kind: source.kind || 'word', version: source.updated_at, cards },
      });
    } catch { setError(t('contestSetup.failed')); }
    finally { setBusy(false); }
  }
  return <section aria-label={t('contestSetup.title')} className="space-y-5 rounded-2xl border border-primary/25 bg-white p-4 md:p-6">
    <h3 className="text-xl font-bold">{t('contestSetup.title')}</h3>
    <ol className="flex flex-wrap gap-3 text-sm font-bold">{['material', 'games', 'review'].map((s, i) => <li key={s} aria-current={step === i ? 'step' : undefined} className={step === i ? 'text-primary' : 'text-on-surface-variant'}>{i + 1}. {t(`contestSetup.${s}`)}</li>)}</ol>
    {step === 0 && <div className="space-y-3">
      <button type="button" aria-expanded={savedOpen} onClick={() => setSavedOpen(value => !value)} className="min-h-12 rounded-xl border border-primary px-5 py-3 font-bold text-primary">{t('flow.savedGames')}</button>
      {savedOpen && <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <p>{t('contestSetup.savedHint')}</p>
        {templates.length === 0 ? <p>{t('contestSetup.noSaved')}</p> : templates.map(tpl => <button type="button" key={tpl.id} onClick={() => onLoad(tpl)} className="block w-full rounded-xl border border-outline-variant bg-white p-3 text-left font-bold text-on-surface">{tpl.name}<span className="ml-2 text-sm font-normal">{t('liveQuiz.countQuestions', { count: tpl.config.liveQuestions?.length ?? 0 })}</span></button>)}
      </div>}
      <div className="flex gap-2">{(['word', 'sentence'] as const).map(k => <button type="button" aria-pressed={kind === k} className={kind === k ? primary : 'rounded-full border px-5 py-3'} key={k} onClick={() => { setKind(k); setListId(''); }}>{t(`contestSetup.${k}`)}</button>)}</div>
      <label className="block space-y-2"><span>{t('contestSetup.material')}</span><select className={field} value={listId} disabled={loading} onChange={e => setListId(e.target.value)}><option value="">{t('contestSetup.pickMaterial')}</option>{lists.filter(l => (l.kind || 'word') === kind).map(l => <option key={l.id} value={l.id}>{l.name} ({l.items.length})</option>)}</select></label>
      <p>{t('contestSetup.fullHint')}</p>
      {source && <p role="status">{t('contestSetup.materialCount', { total: cards.length, usable: avail.text })}</p>}
    </div>}
    {step === 1 && <div className="space-y-3">
      <p>{t('contestSetup.gameHint')}</p>
      <div className="grid gap-3 md:grid-cols-2">{rounds.map((r, i) => <div key={r.type} className={`min-w-0 rounded-xl border p-3 ${r.on && avail[r.type] ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
        <div className="flex items-center gap-3"><input aria-label={t(`liveQuiz.roundName_${r.type}`)} type="checkbox" checked={r.on && avail[r.type] > 0} disabled={!avail[r.type]} onChange={e => patch(r.type, { on: e.target.checked })} className="h-5 w-5"/><button type="button" aria-expanded={open === r.type} onClick={() => setOpen(open === r.type ? null : r.type)} className="min-w-0 flex-1 text-left font-bold underline underline-offset-4">{t(`liveQuiz.roundName_${r.type}`)}</button></div>
        <p className="mt-2 text-sm">{avail[r.type] ? t('contestSetup.available', { count: avail[r.type] }) : t(`liveQuiz.unavailable_${r.type}`, { defaultValue: t('liveQuiz.unavailable') })}</p>
        {open === r.type && <div className="mt-3 space-y-3">
          <p className="text-sm">{t(`liveQuiz.roundDesc_${r.type}`)}</p>
          <label className="block">{t('liveQuiz.perRound')}<select className={field} value={r.count} onChange={e => patch(r.type, { count: Number(e.target.value) })}><option value={-1}>{t('contestSetup.all')}</option>{[3,5,10,20,30,50,100].map(n => <option key={n} value={n}>{t('liveQuiz.countQuestions', { count: n })}</option>)}</select></label>
          <label className="block">{t('contestSetup.seconds')}<input className={field} type="number" min={5} max={120} value={r.seconds ?? (r.type === 'text' || r.type === 'scramble' ? 30 : r.type === 'ox' ? 15 : r.type === 'blank' ? 25 : 20)} onChange={e => patch(r.type, { seconds: Math.max(5, Math.min(120, Number(e.target.value) || 20)) })}/></label>
          <label className="block">{t('contestSetup.points')}<input className={field} type="number" min={0} max={100000} step={100} value={r.points ?? (r.type === 'text' || r.type === 'scramble' ? 1500 : 1000)} onChange={e => patch(r.type, { points: Math.max(0, Math.min(100000, Number(e.target.value) || 0)) })}/></label>
          <div className="flex gap-3"><button type="button" disabled={i === 0} onClick={() => setRounds(rs => { const next = [...rs]; [next[i-1], next[i]] = [next[i], next[i-1]]; return next; })} className="rounded-lg border px-3 py-2 disabled:opacity-30">{t('liveQuiz.moveUp')}</button><button type="button" disabled={i === rounds.length-1} onClick={() => setRounds(rs => { const next = [...rs]; [next[i+1], next[i]] = [next[i], next[i+1]]; return next; })} className="rounded-lg border px-3 py-2 disabled:opacity-30">{t('liveQuiz.moveDown')}</button></div>
        </div>}
      </div>)}</div>
      <p role="status">{t('contestSetup.estimate', { games: enabled.length, count })}</p>
    </div>}
    {step === 2 && <div className="space-y-3"><label className="block">{t('gameAdmin.nameFieldLabel')}<input className={field} value={name} onChange={e => setName(e.target.value)} placeholder={t('contestSetup.defaultName', { name: source?.name })}/></label><p>{source?.name}</p><ul>{enabled.map(r => <li key={r.type}>{t(`liveQuiz.roundName_${r.type}`)} · {t('liveQuiz.countQuestions', { count: r.count === -1 ? avail[r.type] : Math.min(r.count, avail[r.type]) })}</li>)}</ul><p>{t('contestSetup.saveHint')}</p></div>}
    {error && <p role="alert" className="text-error">{error}</p>}
    <div className="sticky bottom-0 flex flex-wrap gap-3 border-t bg-white py-3"><button type="button" disabled={busy} onClick={step ? () => setStep(step - 1) : onCancel} className="rounded-full border px-6 py-3">{t(step ? 'contestSetup.back' : 'gameAdmin.cancel')}</button><button type="button" className={primary} disabled={busy || (step === 0 ? !source || !avail.text : !enabled.length)} onClick={step < 2 ? () => setStep(step + 1) : () => void save()}>{t(busy ? 'contestSetup.saving' : step === 2 ? 'contestSetup.save' : 'contestSetup.next')}</button></div>
  </section>;
}
