import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { deleteBlockPreset, fetchBlockPresets, saveBlockPreset, type BlockPreset } from '../../lib/soloApi';
import { kindOf, stepSummary } from '../../lib/soloEdit';
import { evenIndexes, type SoloStep } from '../../lib/soloLessons';

export interface AssembleLesson {
  name: string;
  steps: SoloStep[];
  minutes: number;
}

/**
 * 블록 조립기 — 만들어질 수업을 "활동 블록"(만나기·그림 고르기·쓰기·말하기 …)으로 나눠 보여 주고,
 * 필요한 블록만 켜서 만든다. 블록 = 같은 종류의 단계 묶음이라 순서(권장 흐름)는 그대로 지켜진다.
 * 더 세밀한 수정(문제 하나, 순서 바꾸기)은 만든 뒤 "고치기" 편집기에서 한다.
 * 소개 화면은 늘 들어가고, 단계가 하나도 안 남는 조합은 만들 수 없다.
 */
export default function SoloBlockAssembler({
  academyId,
  title,
  lessons,
  busy,
  onMake,
}: {
  academyId: string;
  title: string;
  lessons: AssembleLesson[];
  busy: boolean;
  onMake: (lessons: AssembleLesson[]) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [off, setOff] = useState<Set<string>>(new Set());
  /** 블록별 "수업당 단계 수" — 없으면 전부 */
  const [limit, setLimit] = useState<Record<string, number>>({});

  /** 종류별 묶음(처음 나온 순서) */
  const blocks = useMemo(() => {
    const order: SoloStep['t'][] = [];
    const info = new Map<SoloStep['t'], { count: number; sample: string; perLesson: number }>();
    for (const l of lessons) {
      const own = new Map<string, number>();
      for (const s of l.steps) {
        if (s.t === 'intro') continue;
        own.set(s.t, (own.get(s.t) ?? 0) + 1);
        const cur = info.get(s.t);
        if (cur) cur.count += 1;
        else {
          order.push(s.t);
          info.set(s.t, { count: 1, sample: stepSummary(s), perLesson: 0 });
        }
      }
      for (const [t, n] of own) {
        const cur = info.get(t as SoloStep['t']);
        if (cur) cur.perLesson = Math.max(cur.perLesson, n);
      }
    }
    return order.map((type) => ({ type, ...(info.get(type) as { count: number; sample: string; perLesson: number }) }));
  }, [lessons]);

  /* ---------- 내 블록 조합 ---------- */
  const [presets, setPresets] = useState<BlockPreset[] | null>(null);
  const [presetsError, setPresetsError] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPresets = useCallback(async () => {
    try {
      setPresets(await fetchBlockPresets(academyId));
      setPresetsError(false);
    } catch {
      // 054 를 아직 안 돌렸으면 표가 없다 — 조합 기능만 조용히 숨긴다
      setPresets([]);
      setPresetsError(true);
    }
  }, [academyId]);
  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  function applyPreset(p: BlockPreset) {
    const types = new Set(blocks.map((b) => b.type as string));
    setOff(new Set((p.config.off ?? []).filter((x) => types.has(x))));
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.config.limit ?? {})) {
      const b = blocks.find((x) => x.type === k);
      if (b) next[k] = Math.max(1, Math.min(b.perLesson, Math.round(Number(v) || 1)));
    }
    setLimit(next);
  }

  async function saveCurrent() {
    const name = presetName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const limits: Record<string, number> = {};
      for (const b of blocks) {
        const v = limit[b.type];
        if (v !== undefined && v < b.perLesson) limits[b.type] = v;
      }
      await saveBlockPreset(academyId, name, { off: [...off], limit: limits });
      setPresetName('');
      notify(t('solo.preset_saved', { name }));
      await loadPresets();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removePreset(p: BlockPreset) {
    if (!window.confirm(t('solo.preset_deleteConfirm', { name: p.name }))) return;
    try {
      await deleteBlockPreset(p.id);
      await loadPresets();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  /** 수업 하나에서 그 블록이 실제로 남길 단계 수 */
  const capOf = (type: string, own: number) => Math.min(own, Math.max(1, limit[type] ?? own));
  const countsPerLesson = lessons.map((l) => {
    const m = new Map<string, number>();
    for (const s of l.steps) if (s.t !== 'intro') m.set(s.t, (m.get(s.t) ?? 0) + 1);
    return m;
  });
  const total = blocks.reduce((n, b) => n + b.count, 0);
  const keptOf = (type: string) => countsPerLesson.reduce((n, m) => n + capOf(type, m.get(type) ?? 0), 0);
  const kept = blocks.filter((b) => !off.has(b.type)).reduce((n, b) => n + keptOf(b.type), 0);
  const sumMinutes = lessons.reduce((n, l) => n + l.minutes, 0);
  const minutes = total === 0 ? 0 : Math.max(5 * lessons.length, Math.round((sumMinutes * kept) / total));

  const toggle = (type: string) =>
    setOff((cur) => {
      const n = new Set(cur);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });

  // 처음 만나는 단계 없이 문제만 있으면 알려 준다
  const has = (type: string) => blocks.some((b) => b.type === type && !off.has(b.type));
  const quizOn = ['pickWord', 'pickMeaning', 'listenPick', 'spell', 'typeWord', 'fillBlank', 'dictation'].some(has);
  const warnNoMeet = blocks.some((b) => b.type === 'meet') && !has('meet') && quizOn;

  function make() {
    const made = lessons.map((l) => {
      // 블록별 한도: 그 종류 단계를 앞뒤 고르게 뽑는다
      const keepIdx = new Set<number>();
      const byType = new Map<string, number[]>();
      l.steps.forEach((s, i) => {
        if (s.t === 'intro') return;
        byType.set(s.t, [...(byType.get(s.t) ?? []), i]);
      });
      for (const [type, idxs] of byType) {
        if (off.has(type)) continue;
        const cap = capOf(type, idxs.length);
        for (const k of evenIndexes(idxs.length, cap)) keepIdx.add(idxs[k]);
      }
      const steps = l.steps.filter((s, i) => s.t === 'intro' || keepIdx.has(i));
      const non = steps.filter((s) => s.t !== 'intro').length;
      const origin = l.steps.filter((s) => s.t !== 'intro').length || 1;
      return { ...l, steps, minutes: Math.max(5, Math.round((l.minutes * non) / origin)) };
    });
    onMake(made);
  }

  const allOn = off.size === 0 && Object.keys(limit).every((k) => limit[k] >= (blocks.find((b) => b.type === k)?.perLesson ?? 0));

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-primary-fixed/25 p-3">
        <div className="font-label-md text-label-md font-bold text-deep-navy">{title}</div>
        <p className="font-caption text-caption text-on-surface-variant">
          {lessons.length > 1 ? t('solo.asm_hintMany', { count: lessons.length }) : t('solo.asm_hint')}
        </p>
      </div>

      {!presetsError && presets !== null && (
        <div className="space-y-2 rounded-xl border border-outline-variant/50 p-3">
          <div className="font-label-md text-label-md font-bold text-on-surface">{t('solo.preset_title')}</div>
          {presets.length === 0 ? (
            <p className="font-caption text-caption text-on-surface-variant">{t('solo.preset_empty')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <span key={p.id} className="inline-flex items-center overflow-hidden rounded-full border border-primary/50 bg-primary/5">
                  <button type="button" onClick={() => applyPreset(p)} className="px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10" title={t('solo.preset_apply')}>
                    {p.name}
                    <span className="ml-1 font-caption text-caption text-on-surface-variant">
                      {t('solo.preset_meta', { off: (p.config.off ?? []).length, limited: Object.keys(p.config.limit ?? {}).length })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePreset(p)}
                    aria-label={t('common.delete')}
                    className="px-1.5 py-1 text-on-surface-variant hover:bg-error/10 hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={presetName}
              maxLength={40}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={t('solo.preset_namePlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!presetName.trim() || saving}
              onClick={() => void saveCurrent()}
              className="rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              {t('solo.preset_save')}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {blocks.map((b) => {
          const on = !off.has(b.type);
          return (
            <li key={b.type}>
              <div
                className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors ${on ? 'border-primary/60 bg-primary/5' : 'border-outline-variant/50 bg-surface-container-lowest opacity-70'}`}
              >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={on} onChange={() => toggle(b.type)} className="h-5 w-5 shrink-0 accent-primary" />
                <span className="material-symbols-outlined shrink-0 text-[22px] text-primary">{kindOf(b.type).icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-label-md text-label-md font-bold text-on-surface">{t(`soloEdit.stepType_${b.type}`)}</span>
                  <span className="block truncate font-caption text-caption text-on-surface-variant">
                    {t(`soloEdit.stepHelp_${b.type}`)}
                    {b.sample ? ` · ${t('solo.asm_example', { text: b.sample })}` : ''}
                  </span>
                </span>
              </label>
              <label className="flex shrink-0 items-center gap-1 font-caption text-caption text-on-surface-variant">
                <input
                  type="number"
                  min={1}
                  max={b.perLesson}
                  disabled={!on || b.perLesson <= 1}
                  value={limit[b.type] ?? b.perLesson}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(b.perLesson, Math.round(Number(e.target.value) || 1)));
                    setLimit((cur) => ({ ...cur, [b.type]: v }));
                  }}
                  aria-label={t('solo.asm_countLabel')}
                  className="w-14 rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-center text-sm tabular-nums text-on-surface disabled:opacity-50"
                />
                <span className="tabular-nums">/ {b.perLesson}{lessons.length > 1 ? t('solo.asm_perLesson') : ''}</span>
              </label>
              </div>
            </li>
          );
        })}
      </ul>

      {warnNoMeet && <p className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">{t('solo.asm_warnNoMeet')}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/40 pt-3">
        <button
          type="button"
          disabled={busy || kept === 0}
          onClick={make}
          className="rounded-full bg-primary px-6 py-2.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
        >
          {busy ? t('common.loading') : allOn ? t('solo.asm_makeAll') : t('solo.asm_makeSelected')}
        </button>
        <span className="font-caption text-caption text-on-surface-variant">
          {t('solo.asm_summary', { steps: kept, minutes })}
          {lessons.length > 1 ? ` · ${t('solo.asm_lessons', { count: lessons.length })}` : ''}
        </span>
        {!allOn && (
          <button type="button" onClick={() => { setOff(new Set()); setLimit({}); }} className="ml-auto font-caption text-caption text-primary hover:underline">
            {t('solo.asm_reset')}
          </button>
        )}
      </div>
      {kept === 0 && <p className="font-caption text-caption text-error">{t('solo.asm_none')}</p>}
    </div>
  );
}
