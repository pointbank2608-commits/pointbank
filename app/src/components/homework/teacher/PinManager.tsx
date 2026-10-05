import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import { fetchPinStatus, resetStudentPin, teacherErrorKey } from '../../../lib/homework';
import AccessibleDialog from '../../AccessibleDialog';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * 학생 PIN 관리 — 서버엔 해시만 있어서 지금 PIN 은 아무도 볼 수 없다. "새 PIN 만들기"를 누른 그 순간에만
 * 새 번호가 이 창에 보이고(창을 닫으면 사라짐), 그 번호들을 쪽지로 인쇄할 수 있다.
 */
export default function PinManager({ classId, className, onClose }: { classId: string; className: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [rows, setRows] = useState<{ student_id: string; name: string; has_pin: boolean }[] | null>(null);
  const [fresh, setFresh] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchPinStatus(classId).then(setRows, (e) => setErr(t(teacherErrorKey(e))));
  }, [classId, t]);
  useEffect(load, [load]);

  async function reset(ids: string[]) {
    setBusy(ids.length > 1 ? 'all' : ids[0]);
    try {
      const next = new Map(fresh);
      for (const id of ids) next.set(id, await resetStudentPin(id));
      setFresh(next);
      setRows((r) => r?.map((x) => (ids.includes(x.student_id) ? { ...x, has_pin: true } : x)) ?? r);
      notify(t('studentHw.pinsMade', { count: ids.length }));
    } catch (e) {
      notify(t(teacherErrorKey(e)), 'error');
    } finally {
      setBusy(null);
    }
  }

  function printSlips() {
    const list = (rows ?? []).filter((r) => fresh.has(r.student_id));
    const w = window.open('', '_blank');
    if (!w) {
      notify(t('studentHw.popupBlocked'), 'error');
      return;
    }
    w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(className)} PIN</title>
<style>@page{size:A4;margin:10mm}body{font-family:'Pretendard','Malgun Gothic',sans-serif;margin:0;color:#142a46}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}.s{border:1.5px dashed #9aa3b5;border-radius:3mm;padding:4mm;text-align:center;break-inside:avoid}
.n{font-size:14pt;font-weight:800}.p{font-size:26pt;font-weight:800;letter-spacing:4mm;margin-top:2mm}.h{font-size:8pt;color:#666}</style></head>
<body><div class="grid">${list
      .map((r) => `<div class="s"><div class="n">${escapeHtml(r.name)}</div><div class="p">${fresh.get(r.student_id)}</div><div class="h">${escapeHtml(t('studentHw.pinSlipHint'))}</div></div>`)
      .join('')}</div><script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
    w.document.close();
  }

  const missing = (rows ?? []).filter((r) => !r.has_pin).map((r) => r.student_id);
  const btn = 'flex min-h-11 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md disabled:opacity-40';
  return (
    <AccessibleDialog label={t('studentHw.pinsTitle')} onClose={onClose}>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-title-md text-title-md text-deep-navy">
              {t('studentHw.pinsTitle')} · {className}
            </h2>
            <p className="text-base text-on-surface-variant">{t('studentHw.pinsHint')}</p>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
            {t('common.close')}
          </button>
        </div>
        {err && <p className="text-base text-error">{err}</p>}
        {!rows && !err && <p className="text-base text-on-surface-variant">{t('common.loading')}</p>}
        {rows && rows.length === 0 && <p className="text-base text-on-surface-variant">{t('studentHw.noStudentsTeacher')}</p>}
        {rows && rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {missing.length > 0 && (
                <button type="button" disabled={!!busy} onClick={() => void reset(missing)} className={`${btn} bg-primary text-on-primary`}>
                  <span className="material-symbols-outlined text-[18px]">key</span>
                  {t('studentHw.makeMissingPins', { count: missing.length })}
                </button>
              )}
              {fresh.size > 0 && (
                <button type="button" onClick={printSlips} className={`${btn} border border-outline-variant text-on-surface`}>
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  {t('studentHw.printPins', { count: fresh.size })}
                </button>
              )}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {rows.map((r) => (
                <li key={r.student_id} className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-outline-variant/60 px-3">
                  <span className="min-w-0 truncate text-base font-bold">{r.name}</span>
                  <span className="flex items-center gap-2">
                    {fresh.has(r.student_id) ? (
                      <b className="text-2xl tabular-nums tracking-[0.3em] text-deep-navy" aria-label={t('studentHw.newPinIs', { pin: fresh.get(r.student_id) })}>
                        {fresh.get(r.student_id)}
                      </b>
                    ) : (
                      <span className={`text-sm ${r.has_pin ? 'text-on-surface-variant' : 'text-error'}`}>{r.has_pin ? t('studentHw.pinSet') : t('studentHw.pinNone')}</span>
                    )}
                    <button type="button" disabled={!!busy} onClick={() => void reset([r.student_id])} className={`${btn} border border-outline-variant px-3 text-on-surface`}>
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      {busy === r.student_id ? t('common.loading') : t('studentHw.newPin')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {fresh.size > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-base text-amber-900">{t('studentHw.pinOnce')}</p>}
          </>
        )}
      </div>
    </AccessibleDialog>
  );
}
