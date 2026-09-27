import { supabase } from './supabase';

/**
 * 공지·알림함·고객센터·관리자 도구(2026-09-27) — supabase/031_support_notices_admin.sql.
 */

/* ---------------- 공지 ---------------- */
export type AnnouncementLevel = 'info' | 'important' | 'maintenance';
export type AnnouncementAudience = 'all' | 'paid' | 'free' | 'academy';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  academy_id: string | null;
  popup: boolean;
  banner: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

/** 나에게 보이는(기간 안·대상 맞는) 공지 + 읽은 것 */
export async function fetchMyAnnouncements(): Promise<{ list: Announcement[]; readIds: Set<string> }> {
  const [{ data: list, error }, { data: reads }] = await Promise.all([
    supabase.from('announcements').select('*').order('starts_at', { ascending: false }).limit(50),
    supabase.from('announcement_reads').select('announcement_id'),
  ]);
  if (error) throw error;
  return {
    list: (list ?? []) as Announcement[],
    readIds: new Set((reads ?? []).map((r: { announcement_id: string }) => r.announcement_id)),
  };
}

export async function markAnnouncementsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from('announcement_reads').upsert(
    ids.map((announcement_id) => ({ announcement_id })),
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
  );
}

/* ---------------- 문의 ---------------- */
export type TicketCategory = 'howto' | 'bug' | 'billing' | 'idea' | 'other';
export type TicketStatus = 'open' | 'answered' | 'closed';

export interface SupportTicket {
  id: string;
  academy_id: string | null;
  user_id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  page_url: string | null;
  user_agent: string | null;
  user_unread: boolean;
  admin_unread: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender: 'user' | 'admin';
  body: string;
  attachment_path: string | null;
  created_at: string;
}

export const TICKET_CATEGORIES: TicketCategory[] = ['howto', 'bug', 'billing', 'idea', 'other'];

export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function fetchTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at');
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

/** 캡처 올리기(비공개 저장소, 내 폴더) → 저장 경로 */
export async function uploadSupportAttachment(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('not signed in');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('support-attachments').upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

/** 캡처 보기용 잠깐 쓰는 주소(비공개 저장소라 서명 주소) */
export async function supportAttachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('support-attachments').createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

/** 도움말로 오기 전에 보던 페이지(AppLayout 이 기록) — 오류 문의를 다시 확인하기 쉽게 */
export const LAST_PAGE_KEY = 'classbank.lastPage';
function lastPageBeforeHelp(): string {
  try {
    const p = sessionStorage.getItem(LAST_PAGE_KEY);
    if (p) return `${window.location.origin}${p}`;
  } catch {
    /* 무시 */
  }
  return window.location.href;
}

export async function createTicket(params: {
  category: TicketCategory;
  subject: string;
  body: string;
  attachmentPath: string | null;
}): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      category: params.category,
      subject: params.subject,
      page_url: lastPageBeforeHelp(),
      user_agent: navigator.userAgent.slice(0, 400),
    })
    .select('*')
    .single();
  if (error) throw error;
  const ticket = data as SupportTicket;
  await sendTicketMessage(ticket.id, 'user', params.body, params.attachmentPath);
  return ticket;
}

export async function sendTicketMessage(ticketId: string, sender: 'user' | 'admin', body: string, attachmentPath: string | null = null): Promise<void> {
  const { error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, sender, body, attachment_path: attachmentPath });
  if (error) throw error;
}

export async function markTicketSeen(ticketId: string, who: 'user' | 'admin'): Promise<void> {
  await supabase.from('support_tickets').update(who === 'user' ? { user_unread: false } : { admin_unread: false }).eq('id', ticketId);
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
  if (error) throw error;
}

/* ---------------- 관리자 ---------------- */
export interface AdminToday {
  new_tickets: number;
  open_tickets: number;
  billing_failures: number;
  expiring_soon: number;
  pending_cancel: number;
  signups_today: number;
  signups_7d: number;
  academies: number;
  paid: number;
  active_7d: number;
}

export interface AdminAcademyRow {
  academy_id: string;
  name: string;
  created_at: string;
  plan: 'free' | 'paid';
  plan_status: string;
  plan_expires_at: string | null;
  next_billing_at: string | null;
  billing_failure_count: number;
  owner_email: string | null;
  owner_name: string | null;
  teacher_count: number;
  student_count: number;
  lesson_count: number;
  last_active_at: string | null;
  open_tickets: number;
}

export interface AdminAcademyDetail {
  academy: {
    id: string;
    name: string;
    created_at: string;
    plan: 'free' | 'paid';
    plan_status: string;
    plan_started_at: string | null;
    plan_expires_at: string | null;
    next_billing_at: string | null;
    billing_failure_count: number;
    card_brand: string | null;
    card_last4: string | null;
    invite_code: string;
    point_unit: string;
  };
  members: { id: string; display_name: string; role: string; created_at: string; email: string; last_sign_in_at: string | null }[];
  usage: Record<string, number>;
  note: string | null;
  tickets: { id: string; subject: string; category: TicketCategory; status: TicketStatus; updated_at: string }[];
  actions: { action: string; detail: Record<string, unknown> | null; created_at: string }[];
}

export interface AdminTicketRow {
  id: string;
  academy_id: string | null;
  academy_name: string | null;
  user_email: string | null;
  user_name: string | null;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  admin_unread: boolean;
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export async function adminToday(): Promise<AdminToday | null> {
  const { data, error } = await supabase.rpc('admin_today');
  if (error) throw error;
  return data as AdminToday | null;
}

export async function adminAcademyRows(): Promise<AdminAcademyRow[]> {
  const { data, error } = await supabase.rpc('admin_academy_rows');
  if (error) throw error;
  return (data ?? []) as AdminAcademyRow[];
}

export async function adminAcademyDetail(academyId: string): Promise<AdminAcademyDetail | null> {
  const { data, error } = await supabase.rpc('admin_academy_detail', { p_academy_id: academyId });
  if (error) throw error;
  return data as AdminAcademyDetail | null;
}

export async function adminTickets(status: TicketStatus | null = null): Promise<AdminTicketRow[]> {
  const { data, error } = await supabase.rpc('admin_tickets', { p_status: status });
  if (error) throw error;
  return (data ?? []) as AdminTicketRow[];
}

export async function adminSaveNote(academyId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('academy_admin_notes')
    .upsert({ academy_id: academyId, note, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function adminLog(academyId: string | null, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  await supabase.from('admin_actions').insert({ academy_id: academyId, action, detail });
}

export async function adminListAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function adminCreateAnnouncement(a: Omit<Announcement, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('announcements').insert(a);
  if (error) throw error;
}

export async function adminEndAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').update({ ends_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function adminAnnouncementReadCount(id: string): Promise<number> {
  const { count } = await supabase.from('announcement_reads').select('announcement_id', { count: 'exact', head: true }).eq('announcement_id', id);
  return count ?? 0;
}
