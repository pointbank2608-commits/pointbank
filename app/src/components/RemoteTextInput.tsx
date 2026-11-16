import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { writeRemoteText, type RemotePairing, type RemoteTextTarget } from '../lib/remote';

type Editor = HTMLInputElement | HTMLTextAreaElement;

export default function RemoteTextInput({ pair, target }: { pair: RemotePairing; target: RemoteTextTarget | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const editor = useRef<Editor | null>(null);
  const composing = useRef(false);
  const pending = useRef<string | null>(null);
  const lastSent = useRef('');
  const sending = useRef(false);
  const timer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    return () => {
      request.abort();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      sending.current = false;
    };
  }, []);

  function schedule() {
    if (pending.current === null || timer.current !== null || sending.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void flushDraft();
    }, 100);
  }

  async function flushDraft() {
    const signal = controller.current?.signal;
    const value = pending.current;
    if (!target || !signal || signal.aborted || value === null || sending.current) return;
    pending.current = null;
    if (value === lastSent.current) {
      setFailed(false);
      return;
    }

    sending.current = true;
    let sent = false;
    try {
      await writeRemoteText(pair, target.id, value, signal);
      if (!signal.aborted) {
        lastSent.current = value;
        setFailed(false);
        sent = true;
      }
    } catch {
      if (!signal.aborted) {
        pending.current ??= value;
        setFailed(true);
      }
    } finally {
      if (!signal.aborted) {
        sending.current = false;
        if (sent) schedule();
      }
    }
  }

  function updateDraft(value: string) {
    setDraft(value);
    if (composing.current) return;
    pending.current = value;
    schedule();
  }

  function openEditor() {
    if (!target) return;
    // Mobile browsers open the keyboard only when focus stays inside this user gesture.
    if (!open) flushSync(() => setOpen(true));
    editor.current?.focus();
  }

  function closeEditor() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    void flushDraft();
    composing.current = false;
    setOpen(false);
  }

  const fieldProps = {
    value: draft,
    maxLength: target?.limit,
    'aria-label': t('remote.textInput'),
    placeholder: t('remote.textPlaceholder'),
    autoComplete: 'off',
    onChange: (event: ChangeEvent<Editor>) => updateDraft(event.currentTarget.value),
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: (event: CompositionEvent<Editor>) => {
      composing.current = false;
      updateDraft(event.currentTarget.value);
    },
    className: 'w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-base text-on-surface focus:border-primary focus:outline-none',
  };

  return (
    <section className="space-y-2" aria-label={t('remote.textInput')}>
      {open && target ? (
        <div className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container-low px-3 py-3">
          {target.multiline ? (
            <textarea {...fieldProps} ref={(node) => { editor.current = node; }} rows={3} />
          ) : (
            <input
              {...fieldProps}
              ref={(node) => { editor.current = node; }}
              type="text"
              enterKeyHint="done"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  closeEditor();
                }
              }}
            />
          )}
          <button type="button" onClick={closeEditor} className="min-h-11 w-full rounded-full bg-primary px-4 font-label-md text-label-md text-on-primary">
            {t('remote.textDone')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={!target}
            onClick={openEditor}
            className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-full bg-secondary-container px-4 font-label-md text-label-md text-on-secondary-container disabled:opacity-50"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">keyboard</span>
            {t('remote.textInput')}
          </button>
          {!target && <p className="text-center font-caption text-caption text-on-surface-variant">{t('remote.textSelectField')}</p>}
        </>
      )}
      {failed && (
        <div className="flex items-center justify-between gap-2 text-on-error-container">
          <span role="status" className="font-caption text-caption">{t('remote.textSendError')}</span>
          <button type="button" onClick={() => void flushDraft()} className="min-h-11 shrink-0 px-2 font-label-md text-label-md underline">
            {t('remote.textRetry')}
          </button>
        </div>
      )}
    </section>
  );
}
