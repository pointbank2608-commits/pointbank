import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { grammarBoardContent, GRAMMAR_POINTS } from '../lib/grammar';
import { listMyGrammar, saveMyGrammar, type GrammarPreset, type SavedGrammar } from '../lib/myGrammar';
import GrammarContentEditor from './GrammarContentEditor';

export default function MyGrammarLibrary({ onPick, query = '' }: { onPick?: (block: GrammarPreset) => void; query?: string }) {
  const { academy, profile } = useAuth();
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<SavedGrammar[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [baseId, setBaseId] = useState(GRAMMAR_POINTS[0].id);
  const [editor, setEditor] = useState<{ block: GrammarPreset; previous?: SavedGrammar } | null>(null);
  useEffect(() => {
    let active = true;
    setRows([]);
    setStatus('loading');
    if (!academy || !profile) { setStatus('error'); return; }
    listMyGrammar(academy.id, profile.id).then(list => {
      if (active) { setRows(list); setStatus('ready'); }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [academy?.id, profile?.id, refresh]);
  const search = query.trim().toLowerCase();
  const visible = rows.filter(({ block: { content } }) => [content.name, content.pattern, content.explain].some(s => s.toLowerCase().includes(search)));
  return <section className="space-y-3">
    {!onPick && <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm font-bold">{t('myGrammar.base')}
        <select className="max-w-full rounded-lg border bg-white p-2" value={baseId} onChange={e => setBaseId(e.target.value)}>
          {GRAMMAR_POINTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <button type="button" className="rounded-lg border border-primary px-4 py-2 font-bold text-primary" onClick={() => {
        const point = GRAMMAR_POINTS.find(p => p.id === baseId)!;
        setEditor({ block: { grammarId: point.id, content: grammarBoardContent(point), boardTheme:'green' } });
      }}>{t('myGrammar.create')}</button>
    </div>}
    {status === 'loading' && <p role="status">{t('common.loading')}</p>}
    {status === 'error' && <p role="alert">{t('myGrammar.loadFailed')} <button type="button" className="text-primary underline" onClick={() => setRefresh(n => n+1)}>{t('guide.retry')}</button></p>}
    {status === 'ready' && !visible.length && <p>{t(search ? 'grammar.noResults' : 'myGrammar.empty')}</p>}
    <div className="grid gap-2 sm:grid-cols-2">{visible.map(row => <button key={row.id} type="button"
      className="rounded-xl border border-outline-variant bg-white p-3 text-left hover:border-primary"
      onClick={() => onPick ? onPick(structuredClone(row.block)) : setEditor({ block:row.block, previous:row })}>
      <strong className="block">{row.block.content.name}</strong><span className="text-sm">{row.block.content.pattern.replaceAll('**','')}</span>
    </button>)}</div>
    {editor && <GrammarContentEditor initial={editor.block.content} saveLabel={t('myGrammar.save')} onClose={() => setEditor(null)}
      onSave={async content => {
        if (!academy || !profile) throw new Error('Missing account');
        await saveMyGrammar(academy.id, profile.id, { ...editor.block, content }, editor.previous);
        setRefresh(n => n+1);
      }} />}
  </section>;
}
