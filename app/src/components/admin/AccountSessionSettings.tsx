import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminSearchLoginAccounts, adminSetLoginAccountPolicy, errorText, useAdminQuery } from '../../lib/adminOps';
import { DataState } from './AdminUi';

const field = 'mt-1 block w-full rounded-lg border border-outline-variant bg-white px-3 py-2 font-normal';
const label = 'block min-w-0 flex-1 font-label-md text-label-md font-bold text-deep-navy';
const button = 'shrink-0 rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-bold text-white disabled:opacity-50';

export default function AccountSessionSettings() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <section aria-labelledby="account-session-title" className="space-y-3 rounded-xl border border-outline-variant bg-white p-5 shadow-card">
      <h2 id="account-session-title" className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('adminV2.settings.loginPolicy.title')}</h2>
      <form className="flex max-w-xl items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        setQuery(input.trim());
      }}>
        <label className={label}>
          {t('adminV2.settings.loginPolicy.searchLabel')}
          <input type="search" autoComplete="off" maxLength={320} value={input} disabled={saving}
            onChange={(event) => { setInput(event.target.value); setQuery(''); }} className={field} />
        </label>
        <button type="submit" disabled={saving || input.trim().length < 2} className={button}>{t('adminV2.settings.loginPolicy.search')}</button>
      </form>
      {query.length >= 2 && <AccountResults key={query} query={query} saving={saving} setSaving={setSaving} />}
    </section>
  );
}

function AccountResults({ query, saving, setSaving }: { query: string; saving: boolean; setSaving: (value: boolean) => void }) {
  const { t } = useTranslation();
  const state = useAdminQuery(() => adminSearchLoginAccounts(query), [query]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const account = state.data?.find((row) => row.user_id === selectedId);
  const current = account ? saved[account.user_id] ?? account.allow_multiple : null;

  async function save(userId: string, allowMultiple: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      await adminSetLoginAccountPolicy(userId, allowMultiple);
      setSaved((previous) => ({ ...previous, [userId]: allowMultiple }));
      setDraft(null);
      setMessage({ ok: true, text: t('adminOps.saved') });
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DataState state={state} empty={t('adminV2.settings.loginPolicy.empty')} compact>
      {(accounts) => (
        <div className="max-w-xl space-y-3">
          <label className={label}>
            {t('adminV2.settings.loginPolicy.accountLabel')}
            <select value={selectedId} disabled={saving} className={field} onChange={(event) => {
              setSelectedId(event.target.value);
              setDraft(null);
              setMessage(null);
            }}>
              <option value="">{t('adminV2.settings.loginPolicy.chooseAccount')}</option>
              {accounts.map((row) => (
                <option key={row.user_id} value={row.user_id}>
                  {[row.display_name, row.email ?? row.user_id].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
          {accounts.length === 25 && <p className="font-caption text-caption text-on-surface-variant">{t('adminV2.settings.loginPolicy.refine')}</p>}
          {account && (
            <form className="space-y-2" onSubmit={(event) => {
              event.preventDefault();
              if (!saving && draft !== null && draft !== current) void save(account.user_id, draft);
            }}>
              <div className="flex items-end gap-2">
                <label className={label}>
                  {t('adminV2.settings.loginPolicy.title')}
                  <select value={String(draft ?? current)} disabled={saving} className={field} onChange={(event) => {
                    setDraft(event.target.value === 'true');
                    setMessage(null);
                  }}>
                    <option value="false">{t('adminV2.settings.loginPolicy.deny')}</option>
                    <option value="true">{t('adminV2.settings.loginPolicy.allow')}</option>
                  </select>
                </label>
                <button type="submit" className={button} disabled={saving || draft === null || draft === current}>{t('common.save')}</button>
              </div>
              {draft === false && current && <p className="font-caption text-caption text-on-surface-variant">{t('adminV2.settings.loginPolicy.denyHint')}</p>}
              {message && <p role={message.ok ? 'status' : 'alert'} className={`break-words font-caption text-caption ${message.ok ? 'text-[#0f6b3e]' : 'text-error'}`}>{message.text}</p>}
            </form>
          )}
        </div>
      )}
    </DataState>
  );
}
