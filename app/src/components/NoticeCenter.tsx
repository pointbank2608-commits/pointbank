import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePresenting } from '../context/LessonRunnerContext';
import { fetchMyAnnouncements, fetchMyTickets, markAnnouncementsRead, type Announcement, type SupportTicket } from '../lib/support';

/**
 * 알림(2026-09-27) — 관리자 공지 + 내 문의 답변을 한 곳에 모은다.
 * - 상단 종(NotificationBell): 안 읽은 개수, 목록(공지 펼쳐 읽기·답변 온 문의로 가기)
 * - 첫 화면 팝업(popup 공지, 한 번만) · 상단 띠(banner 공지 = 점검 안내 등, 닫으면 읽음)
 * - 원장 결제 안내 띠(결제 실패·유료 만료 7일 전) — 데이터에서 바로 계산(따로 보내지 않아도 자동)
 * 발표 중에는 팝업·띠를 띄우지 않는다(수업 화면을 가리지 않게).
 */
interface NoticeValue {
  announcements: Announcement[];
  readIds: Set<string>;
  tickets: SupportTicket[];
  unreadCount: number;
  markRead: (ids: string[]) => void;
  refresh: () => void;
}

const NoticeContext = createContext<NoticeValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { session, isStaff } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const refresh = useCallback(() => {
    if (!session || !isStaff) return;
    fetchMyAnnouncements()
      .then(({ list, readIds: r }) => {
        setAnnouncements(list);
        setReadIds(r);
      })
      .catch(() => {
        /* 031 SQL 전이면 조용히 비워 둔다 */
      });
    fetchMyTickets()
      .then(setTickets)
      .catch(() => {});
  }, [session, isStaff]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 120_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const markRead = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => !readIds.has(id));
    if (fresh.length === 0) return;
    setReadIds((prev) => new Set([...prev, ...fresh]));
    void markAnnouncementsRead(fresh);
  }, [readIds]);

  const unreadCount = announcements.filter((a) => !readIds.has(a.id)).length + tickets.filter((t) => t.user_unread).length;
  const value = useMemo(
    () => ({ announcements, readIds, tickets, unreadCount, markRead, refresh }),
    [announcements, readIds, tickets, unreadCount, markRead, refresh],
  );
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export function useNotices(): NoticeValue | null {
  return useContext(NoticeContext);
}

const LEVEL_ICON: Record<Announcement['level'], string> = { info: 'campaign', important: 'priority_high', maintenance: 'build' };

export function NotificationBell() {
  const { t } = useTranslation();
  const n = useNotices();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!n) return null;
  const answered = n.tickets.filter((tk) => tk.user_unread);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
        aria-label={t('nav.notifications')}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined">notifications</span>
        {n.unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-on-error">
            {n.unreadCount > 9 ? '9+' : n.unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-xl">
          <div className="flex items-center gap-2 border-b border-outline-variant/40 px-4 py-3">
            <span className="font-title-md text-title-md text-deep-navy">{t('notice.title')}</span>
            <button
              type="button"
              onClick={() => n.markRead(n.announcements.map((a) => a.id))}
              className="ml-auto font-label-md text-label-md text-primary hover:underline"
            >
              {t('notice.markAllRead')}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {answered.map((tk) => (
              <button
                key={tk.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(`/help?ticket=${tk.id}`);
                }}
                className="flex w-full items-start gap-3 border-b border-outline-variant/20 bg-primary-fixed/30 px-4 py-3 text-left hover:bg-primary-fixed/50"
              >
                <span className="material-symbols-outlined text-[20px] text-primary">mark_chat_unread</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-label-md text-label-md text-on-surface">{t('notice.answered')}</span>
                  <span className="block truncate font-caption text-caption text-on-surface-variant">{tk.subject}</span>
                </span>
              </button>
            ))}
            {n.announcements.length === 0 && answered.length === 0 && (
              <div className="px-4 py-8 text-center font-body-md text-body-md text-on-surface-variant">{t('notice.empty')}</div>
            )}
            {n.announcements.map((a) => {
              const unread = !n.readIds.has(a.id);
              const isOpen = expanded === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setExpanded(isOpen ? null : a.id);
                    n.markRead([a.id]);
                  }}
                  className={`flex w-full items-start gap-3 border-b border-outline-variant/20 px-4 py-3 text-left hover:bg-surface-container-low ${unread ? '' : 'opacity-75'}`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${a.level === 'info' ? 'text-primary' : 'text-error'}`}>{LEVEL_ICON[a.level]}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-label-md text-label-md ${unread ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>{a.title}</span>
                    <span className="block font-caption text-caption text-on-surface-variant">{new Date(a.starts_at).toLocaleDateString()}</span>
                    {isOpen && a.body && <span className="mt-2 block whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">{a.body}</span>}
                  </span>
                  {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-error" />}
                </button>
              );
            })}
          </div>
          <Link to="/help" onClick={() => setOpen(false)} className="block border-t border-outline-variant/40 px-4 py-3 text-center font-label-md text-label-md text-primary hover:bg-surface-container-low">
            {t('notice.toHelp')}
          </Link>
        </div>
      )}
    </div>
  );
}

/** 첫 화면 팝업(중요 공지, 한 번만) + 상단 띠(점검 등) + 원장 결제 안내 띠 */
export function NoticeOverlays() {
  const { t } = useTranslation();
  const n = useNotices();
  const presenting = usePresenting();
  const { academy, profile } = useAuth();
  const [billingHidden, setBillingHidden] = useState(false);
  if (!n || presenting) return null;

  const popup = n.announcements.find((a) => a.popup && !n.readIds.has(a.id));
  const banners = n.announcements.filter((a) => a.banner && !n.readIds.has(a.id));

  // 원장 결제 안내(자동): 결제 실패, 또는 유료 기간이 7일 안에 끝남
  let billingMsg: string | null = null;
  if (profile?.role === 'owner' && academy && !billingHidden) {
    if ((academy.billing_failure_count ?? 0) > 0) billingMsg = t('notice.billingFailed');
    else if (academy.plan === 'paid' && academy.plan_expires_at) {
      const days = Math.ceil((Date.parse(academy.plan_expires_at) - Date.now()) / 86_400_000);
      if (days <= 7 && days >= 0) billingMsg = t('notice.planExpiring', { days });
    }
  }

  return (
    <>
      {billingMsg && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border-2 border-error/40 bg-error-container/40 px-4 py-2.5 font-label-md text-label-md text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-error">credit_card_off</span>
          <span className="min-w-0 flex-1">{billingMsg}</span>
          <Link to="/settings/billing" className="rounded-full bg-error px-3 py-1 text-on-error">
            {t('notice.toBilling')}
          </Link>
          <button type="button" onClick={() => setBillingHidden(true)} aria-label={t('common.cancel')} className="rounded-full p-1 hover:bg-black/5">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
      {banners.map((a) => (
        <div
          key={a.id}
          className={`no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 font-label-md text-label-md ${
            a.level === 'info' ? 'bg-primary-fixed/50 text-on-surface' : 'bg-warm-yellow/40 text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">{LEVEL_ICON[a.level]}</span>
          <span className="font-bold">{a.title}</span>
          {a.body && <span className="min-w-0 flex-1 truncate text-on-surface-variant">{a.body}</span>}
          <button type="button" onClick={() => n.markRead([a.id])} aria-label={t('common.cancel')} className="ml-auto rounded-full p-1 hover:bg-black/5">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
      {popup && (
        <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[26px] ${popup.level === 'info' ? 'text-primary' : 'text-error'}`}>{LEVEL_ICON[popup.level]}</span>
              <h2 className="font-title-md text-title-md font-bold text-deep-navy">{popup.title}</h2>
            </div>
            {popup.body && <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-body-md text-body-md text-on-surface">{popup.body}</p>}
            <button type="button" onClick={() => n.markRead([popup.id])} className="w-full rounded-full bg-primary py-2.5 font-label-md text-label-md text-on-primary">
              {t('notice.confirm')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
