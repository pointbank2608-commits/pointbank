import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { pauseGameClock } from '../lib/gameClock';
import { openTicket, sendTicketMessage } from '../lib/support';
import AccessibleDialog from './AccessibleDialog';

const action = 'min-h-11 rounded-xl border border-outline-variant px-4 py-2 font-bold';

export default function GameReportButton({ gameName, className, onOpenChange }: {
  gameName: string;
  className: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return <>
    <button type="button" className={className} onClick={() => changeOpen(true)}>{t('help.contactTitle')}</button>
    {open && <GameReportForm gameName={gameName} pageUrl={window.location.origin + pathname} onClose={() => changeOpen(false)} />}
  </>;
}

function GameReportForm({ gameName, pageUrl, onClose }: { gameName: string; pageUrl: string; onClose: () => void }) {
  const { t } = useTranslation();
  const clockOwner = useId();
  const [category, setCategory] = useState<'bug' | 'idea'>('bug');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const pending = useRef(false);
  const ticketId = useRef<string | null>(null);
  const [ticketOpened, setTicketOpened] = useState(false);

  useEffect(() => {
    pauseGameClock(clockOwner, true);
    return () => pauseGameClock(clockOwner, false);
  }, [clockOwner]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !body.trim()) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (!ticketId.current) {
        const subject = t('help.gameReportSubject', { game: gameName }).slice(0, 120);
        ticketId.current = (await openTicket({ subject, category, pageUrl })).id;
        setTicketOpened(true);
      }
      await sendTicketMessage(ticketId.current, 'user', body.trim());
      setSentId(ticketId.current);
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function close() {
    if (!pending.current) onClose();
  }

  return <AccessibleDialog label={t('help.gameReportTitle')} onClose={close}>
    <div className="mx-auto max-w-xl space-y-4 p-4 text-left text-deep-navy sm:p-6">
      <div>
        <h2 className="text-xl font-extrabold">{t('help.gameReportTitle')}</h2>
        <p className="mt-1 text-sm font-bold">{gameName}</p>
      </div>
      {sentId ? <>
        <p role="status">{t('help.gameReportSent')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Link className={action} to={`/help?ticket=${encodeURIComponent(sentId)}`} target="_blank" rel="noreferrer">{t('help.myTickets')}</Link>
          <button type="button" className={`${action} bg-primary !text-white`} onClick={close}>{t('common.close')}</button>
        </div>
      </> : <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-bold">
          {t('help.gameReportCategory')}
          <select className="mt-1 w-full rounded-xl border border-outline-variant bg-white p-2" value={category}
            disabled={busy || ticketOpened} onChange={event => setCategory(event.target.value === 'idea' ? 'idea' : 'bug')}>
            <option value="bug">{t('help.gameReportBug')}</option>
            <option value="idea">{t('help.gameReportIdea')}</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          {t('help.gameReportDetails')}
          <textarea autoFocus className="mt-1 w-full rounded-xl border border-outline-variant bg-white p-3 font-normal"
            rows={5} maxLength={4000} value={body} disabled={busy} required
            placeholder={t(category === 'bug' ? 'help.bodyPlaceholderBug' : 'help.bodyPlaceholder')}
            onChange={event => setBody(event.target.value)} />
        </label>
        {failed && <p role="alert" className="text-sm text-error">{t('help.gameReportFailed')}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={action} disabled={busy} onClick={close}>{t('common.cancel')}</button>
          <button type="submit" className={`${action} bg-primary !text-white disabled:opacity-40`} disabled={busy || !body.trim()}>
            {t(busy ? 'common.loading' : 'help.send')}
          </button>
        </div>
      </form>}
    </div>
  </AccessibleDialog>;
}
