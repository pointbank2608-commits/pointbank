import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { fmtKst, useAdminQuery } from '../../lib/adminOps';
import { DataState } from './AdminUi';

interface AuthEvent {
  id: string;
  occurred_at: string;
  event: 'login' | 'logout';
  account: string;
  method: string | null;
}

export default function AdminAuthActivity() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [page, setPage] = useState(0);
  const events = useAdminQuery(async () => {
    const { data, error } = await supabase.rpc('admin_auth_activity', { p_page: page });
    if (error) throw error;
    return (data ?? []) as AuthEvent[];
  }, [page]);

  return (
    <section className="space-y-3 rounded-xl border border-outline-variant bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-title-md text-[18px] font-extrabold text-deep-navy">{en ? 'Sign-in and sign-out history' : '로그인·로그아웃 기록'}</h2>
        <button type="button" onClick={events.reload} className="rounded-full border border-outline-variant px-3 py-1 text-sm">{en ? 'Refresh' : '새로고침'}</button>
      </div>
      <p className="text-sm text-on-surface-variant">{en ? 'Authentication events recorded by the server. Closing a tab does not record a sign-out.' : '서버에서 기록한 인증 이력이에요. 탭을 닫는 동작은 로그아웃으로 기록되지 않아요.'}</p>
      <DataState state={events} empty={en ? 'No authentication history.' : '접속 기록이 없어요.'}>
        {(rows) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-outline-variant">
                <th className="py-2">{en ? 'Time' : '시각'}</th>
                <th>{en ? 'Account' : '계정'}</th>
                <th>{en ? 'Event' : '구분'}</th>
              </tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-outline-variant/40">
                <td className="whitespace-nowrap py-2 pr-3">{fmtKst(row.occurred_at, i18n.language)}</td>
                <td className="break-all pr-3">{row.account}</td>
                <td className="whitespace-nowrap">{row.event === 'login' ? (en ? 'Sign in' : '로그인') : (en ? 'Sign out' : '로그아웃')}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </DataState>
      <div className="flex items-center justify-end gap-3 text-sm">
        <button type="button" disabled={page === 0 || events.status === 'loading'} onClick={() => setPage(page - 1)} className="disabled:opacity-40">{en ? 'Previous' : '이전'}</button>
        <span>{page + 1}</span>
        <button type="button" disabled={events.status !== 'ready' || events.data.length < 50} onClick={() => setPage(page + 1)} className="disabled:opacity-40">{en ? 'Next' : '다음'}</button>
      </div>
    </section>
  );
}
