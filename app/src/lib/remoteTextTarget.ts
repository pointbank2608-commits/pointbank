import type { RemoteTextTarget } from './remote';

const REMOTE_TEXT_LIMIT = 2000;
const TEXT_FIELDS = 'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="tel"]';
const BLOCKED_FIELDS = '[data-no-remote-text], [data-no-remote-click], [inert], [autocomplete~="one-time-code"], [autocomplete~="current-password"], [autocomplete~="new-password"]';

export type RemoteTextField = HTMLInputElement | HTMLTextAreaElement;

export interface RemoteTextSession {
  target: RemoteTextTarget;
  field: RemoteTextField;
  fieldKey: string | null;
  step: number;
  prefix: string;
  suffix: string;
  lastValue: string;
}

function isEditable(field: HTMLElement | null): field is RemoteTextField {
  return (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
    && field.isConnected
    && field.matches(TEXT_FIELDS)
    && !field.matches(':disabled')
    && !field.readOnly
    && !field.closest(BLOCKED_FIELDS)
    && !!field.closest('[data-remote-click-area]');
}

export function startRemoteTextSession(field: HTMLElement | null, step: number): RemoteTextSession | null {
  if (!isEditable(field) || document.activeElement !== field) return null;

  const value = field.value;
  const from = field.selectionStart ?? value.length;
  const to = field.selectionEnd ?? from;
  const prefix = value.slice(0, from);
  const suffix = value.slice(to);
  const limit = field.maxLength < 0
    ? REMOTE_TEXT_LIMIT
    : Math.min(REMOTE_TEXT_LIMIT, field.maxLength - prefix.length - suffix.length);
  if (limit <= 0) return null;

  return {
    target: { id: crypto.randomUUID(), limit, multiline: field instanceof HTMLTextAreaElement },
    field, fieldKey: field.getAttribute('data-remote-text-key'), step, prefix, suffix, lastValue: value,
  };
}

export function canWriteRemoteText(session: RemoteTextSession, step: number | undefined): boolean {
  const { field } = session;
  return session.step === step
    && isEditable(field)
    && document.activeElement === field
    && field.getAttribute('data-remote-text-key') === session.fieldKey
    && field.value === session.lastValue;
}

export function applyRemoteTextDraft(session: RemoteTextSession, draft: string): void {
  const { field, prefix, suffix, target } = session;
  const limit = field.maxLength < 0
    ? target.limit
    : Math.max(0, Math.min(target.limit, field.maxLength - prefix.length - suffix.length));
  const text = (target.multiline ? draft : draft.replace(/[\r\n]/g, '')).slice(0, limit);
  const value = prefix + text + suffix;
  if (field.value === value) return;

  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  // Use the native setter so controlled React fields see and handle the input event.
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!setValue) return;
  setValue.call(field, value);
  field.setSelectionRange(prefix.length + text.length, prefix.length + text.length);
  session.lastValue = field.value;
  field.dispatchEvent(new InputEvent('input', {
    bubbles: true, composed: true, inputType: 'insertReplacementText', data: text,
  }));
  session.lastValue = field.value;
}
