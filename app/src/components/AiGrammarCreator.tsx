import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractGrammar } from '../lib/textbooks';
import { insertGrammarDraft, type GrammarPreset } from '../lib/myGrammar';
import AccessibleDialog from './AccessibleDialog';
import StudyListSourceForm from './StudyListSourceForm';
import '../styles/textbooks.css';

export default function AiGrammarCreator({ academy, owner, onSaved, onClose }: {
  academy: string; owner: string; onSaved: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [pending, setPending] = useState<{ id: string; block: GrammarPreset } | null>(null);
  const [failed, setFailed] = useState(false);
  async function persist(draft: NonNullable<typeof pending>) {
    setFailed(false);
    try {
      await insertGrammarDraft(academy, owner, draft.id, draft.block);
      onSaved();
    } catch {
      setPending(draft);
      setFailed(true);
    }
  }
  return <AccessibleDialog label={t('myGrammar.aiCreate')} onClose={() => { if (!busy) onClose(); }}>
    <div className="grid gap-3 p-5">
      <h2 className="text-xl font-bold">{t('myGrammar.aiCreate')}</h2>
      {pending ? <>
        <strong>{pending.block.content.name}</strong>
        {failed && <p role="alert">{t('myGrammar.saveFailed')}</p>}
        <button disabled={busy} className="textbook-button" onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true);
          try { await persist(pending); } finally { lock.current = false; setBusy(false); }
        }}>{t('guide.retry')}</button>
      </> : <StudyListSourceForm academy={academy} busy={busy} onBusy={setBusy}
        onGrammar={async (files, first, last, audience) => {
          if (lock.current) return;
          lock.current = true;
          try {
            const content = await extractGrammar(academy, files, first, last, audience);
            const id = crypto.randomUUID();
            await persist({ id, block: { grammarId: 'custom-' + id, content, boardTheme: 'green' } });
          } finally { lock.current = false; }
        }} />}
      <button type="button" disabled={busy} onClick={onClose} className="justify-self-end rounded-lg border px-4 py-2">{t('common.close')}</button>
    </div>
  </AccessibleDialog>;
}
