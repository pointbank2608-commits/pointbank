import { supabase } from './supabase';

export type ParentSession = { id: string; token: string; student_id: string };
export type ParentHomework = {
  assignment_id: string;
  source: 'online' | 'solo' | 'grammar' | 'words';
  title: string;
  published_at: string;
  due_at: string | null;
  completed_at: string | null;
  status: 'pending' | 'started' | 'review' | 'completed' | 'overdue' | 'closed' | 'untracked';
};
export type ParentHome = {
  name: string;
  academy: string;
  homework: ParentHomework[];
  read_through: string;
  snapshot: string;
  push_enabled: boolean;
  push_key?: string | null;
};

const storageKey = 'classbank.parentSessions';
const secretPattern = /^[0-9a-f]{64}$/;
export const pushKey = import.meta.env.VITE_PARENT_PUSH_PUBLIC_KEY as string | undefined;
export const inviteFromText = (text: string) => text.trim().match(/^(?:https?:\/\/[^/#\s]+\/p#invite=)?([a-f0-9]{64})$/)?.[1];
export const inviteFromHash = () => inviteFromText(new URLSearchParams(location.hash.slice(1)).get('invite') ?? '');

export function parentSessions(): ParentSession[] {
  try {
    const result = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(result)
      ? result.filter((x) => x && typeof x.id === 'string' && typeof x.student_id === 'string' && secretPattern.test(x.token))
      : [];
  } catch { return []; }
}

export function storeParentSessions(sessions: ParentSession[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(sessions)); } catch { /* This visit only. */ }
}

export class ParentError extends Error {
  readonly kind: 'expired' | 'invalid_invite' | 'unavailable' | 'failed';
  constructor(kind: ParentError['kind']) { super(kind); this.kind = kind; }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ParentError(error.code === 'PGRST202' ? 'unavailable' : 'failed');
  if (data?.error) throw new ParentError(data.error === 'expired' || data.error === 'invalid_invite' ? data.error : 'failed');
  return data as T;
}

export async function createParentInvite(student: string) {
  const secret = await rpc<string>('parent_make_invite', { p_student: student });
  return `${location.origin}/p#invite=${secret}`;
}
export const disconnectParent = (student: string) => rpc<void>('parent_disconnect', { p_student: student });
export type ParentAccount = { name: string; last4: string };
export const loadParentAccount = (student: string) => rpc<ParentAccount | null>('parent_account_status', { p_student: student });
export const saveParentAccount = (student: string, name: string, phone: string, consent: boolean) =>
  rpc<void>('parent_save_account', { p_student: student, p_name: name, p_phone: phone, p_consent: consent });
export const removeParentAccount = (student: string) => rpc<void>('parent_remove_account', { p_student: student });
export const connectParent = (invite: string) => rpc<ParentSession>('parent_connect', { p_invite: invite });
export const loadParent = (token: string, endpoint?: string) =>
  rpc<ParentHome>('parent_home', { p_token: token, p_endpoint: endpoint ?? null });
export const readParentNotices = (token: string, through: string) =>
  rpc<void>('parent_read', { p_token: token, p_through: through });
export const logoutParent = (token: string) => rpc<void>('parent_logout', { p_token: token });

export function setParentPush(token: string, sub: PushSubscription, enabled: boolean, lang: string) {
  const keys = sub.toJSON().keys;
  return rpc<{ enabled: boolean }>('parent_set_push', {
    p_token: token, p_endpoint: sub.endpoint, p_enabled: enabled,
    p_p256dh: keys?.p256dh, p_auth: keys?.auth, p_lang: lang,
  });
}

export function iosNeedsInstall() {
  const installed = matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  return !installed && (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}

export function applicationServerKey(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}
