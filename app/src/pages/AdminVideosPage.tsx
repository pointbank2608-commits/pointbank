import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseShadowText, toShadowSource } from '../lib/shadowLines';
import {
  adminDeleteVideoClip,
  adminListVideoClips,
  adminSaveVideoClip,
  adminSetClipHidden,
  clipLength,
  clipThumb,
  formatClipTime,
  isBlockedChannel,
  type VideoClip,
} from '../lib/videoClips';
import { extractYoutubeId } from '../lib/youtube';

type Form = {
  id?: string;
  series: string;
  title: string;
  summary: string;
  url: string;
  channel: string;
  start: string;
  end: string;
  level: number;
  tags: string;
  words: string;
  script: string;
  sort_order: number;
};

const EMPTY: Form = { series: '', title: '', summary: '', url: '', channel: '', start: '0', end: '', level: 2, tags: '', words: '', script: '', sort_order: 0 };

/** "1:05" · "65" · "1:05.5" → 초 */
const toSec = (v: string) => {
  const m = v.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : NaN;
};

/**
 * 관리자 — 영상 쉐도잉 라이브러리(2026-10-03). 장면 추가·고치기, 저작권자 요청이 오면 "내리기"(즉시 선생님 화면과
 * 이미 넣은 수업에서 막힘), 다시 올리기, 지우기. 디즈니 계열 채널은 저장을 막는다.
 * 많이 넣을 때는 `app/scripts/shadow/make-clip-library.mjs`가 만든 SQL 을 SQL Editor 에서 실행한다.
 */
export default function AdminVideosPage() {
  const { t } = useTranslation();
  const [clips, setClips] = useState<VideoClip[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'live' | 'hidden'>('all');

  const load = async () => {
    try {
      setClips(await adminListVideoClips());
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(/video_clips|relation/i.test(msg) ? t('adminVideos.needSetup') : msg);
      setClips([]);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!form) return;
    const youtubeId = extractYoutubeId(form.url) ?? (/^[\w-]{11}$/.test(form.url.trim()) ? form.url.trim() : null);
    const start = toSec(form.start || '0');
    const end = toSec(form.end);
    const script = toShadowSource(form.script);
    if (!form.series.trim() || !form.title.trim() || !youtubeId || Number.isNaN(start) || Number.isNaN(end) || end <= start || parseShadowText(script).length === 0) {
      setError(t('adminVideos.invalid'));
      return;
    }
    if (isBlockedChannel(form.channel) || isBlockedChannel(form.series)) {
      setError(t('adminVideos.blocked'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminSaveVideoClip({
        id: form.id,
        series: form.series.trim(),
        title: form.title.trim(),
        summary: form.summary.trim(),
        youtube_id: youtubeId,
        channel: form.channel.trim(),
        start_sec: start,
        end_sec: end,
        level: form.level,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        words: form.words.split(',').map((s) => s.trim()).filter(Boolean),
        script,
        sort_order: form.sort_order,
      });
      setForm(null);
      await load();
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(c: VideoClip) {
    let reason: string | undefined;
    if (!c.hidden) {
      const r = window.prompt(t('adminVideos.hideReason'), t('adminVideos.hideReasonDefault'));
      if (r === null) return;
      reason = r;
    }
    await adminSetClipHidden(c.id, !c.hidden, reason).catch((e) => setError(String(e?.message ?? e)));
    await load();
  }

  async function remove(c: VideoClip) {
    if (!window.confirm(t('adminVideos.deleteConfirm', { title: c.title }))) return;
    await adminDeleteVideoClip(c.id).catch((e) => setError(String(e?.message ?? e)));
    await load();
  }

  function edit(c: VideoClip) {
    setForm({
      id: c.id,
      series: c.series,
      title: c.title,
      summary: c.summary,
      url: `https://www.youtube.com/watch?v=${c.youtube_id}`,
      channel: c.channel,
      start: formatClipTime(Number(c.start_sec)),
      end: formatClipTime(Number(c.end_sec)),
      level: c.level,
      tags: c.tags.join(', '),
      words: c.words.join(', '),
      script: c.script,
      sort_order: c.sort_order,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary';
  const list = (clips ?? []).filter((c) => filter === 'all' || (filter === 'hidden' ? c.hidden : !c.hidden));
  const hiddenCount = (clips ?? []).filter((c) => c.hidden).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-md text-headline-md text-deep-navy">{t('adminVideos.title')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('adminVideos.intro')}</p>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('adminVideos.add')}
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{error}</div>}

      {form && (
        <div className="space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={input} value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} placeholder={t('adminVideos.series')} />
            <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('adminVideos.clipTitle')} />
            <input className={input} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={t('adminVideos.url')} />
            <input className={input} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} placeholder={t('adminVideos.channel')} />
            <div className="flex gap-2">
              <input className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} placeholder={t('adminVideos.start')} />
              <input className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} placeholder={t('adminVideos.end')} />
              <select className={input} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((l) => (
                  <option key={l} value={l}>
                    Lv.{l}
                  </option>
                ))}
              </select>
            </div>
            <input className={input} value={form.words} onChange={(e) => setForm({ ...form, words: e.target.value })} placeholder={t('adminVideos.words')} />
            <input className={`${input} sm:col-span-2`} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder={t('adminVideos.summary')} />
          </div>
          <textarea className={`${input} min-h-[220px] font-mono`} value={form.script} onChange={(e) => setForm({ ...form, script: e.target.value })} placeholder={t('curriculum.shadow.sourcePlaceholder')} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container disabled:opacity-40">
              {t('common.save')}
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-full border border-outline-variant px-5 py-2 font-label-md text-label-md text-on-surface-variant">
              {t('common.cancel')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.shadow.lineCount', { count: parseShadowText(form.script).length })}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['all', 'live', 'hidden'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 font-label-md text-label-md ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
          >
            {t(`adminVideos.filter_${f}`, { count: f === 'hidden' ? hiddenCount : f === 'live' ? (clips?.length ?? 0) - hiddenCount : clips?.length ?? 0 })}
          </button>
        ))}
      </div>

      {clips === null ? (
        <div className="text-on-surface-variant">{t('common.loading')}</div>
      ) : (
        <div className="divide-y divide-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm">
          {list.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-3 p-3 ${c.hidden ? 'opacity-60' : ''}`}>
              <img src={clipThumb(c.youtube_id)} alt="" className="h-14 w-24 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="font-caption text-caption text-on-surface-variant">
                  {c.series} · Lv.{c.level} · {formatClipTime(Number(c.start_sec))}–{formatClipTime(Number(c.end_sec))} ({formatClipTime(clipLength(c))}) · {c.channel}
                </div>
                <div className="truncate font-label-lg text-label-lg text-on-surface">{c.title}</div>
                {c.hidden && <div className="font-caption text-caption text-error">{t('adminVideos.hiddenAt', { reason: c.hidden_reason ?? '-', at: c.hidden_at?.slice(0, 10) ?? '' })}</div>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => edit(c)} className="rounded-full border border-outline-variant px-3 py-1 text-sm text-on-surface-variant hover:bg-surface-container-low">
                  {t('adminVideos.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleHidden(c)}
                  className={`rounded-full px-3 py-1 text-sm ${c.hidden ? 'border border-primary text-primary' : 'bg-error text-on-error'}`}
                >
                  {t(c.hidden ? 'adminVideos.unhide' : 'adminVideos.hide')}
                </button>
                <button type="button" onClick={() => void remove(c)} aria-label={t('adminVideos.delete')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="p-6 text-center text-on-surface-variant">{t('adminVideos.none')}</div>}
        </div>
      )}
    </div>
  );
}
