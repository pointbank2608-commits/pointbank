import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { uploadLessonSlideImage } from '../../lib/api';
import { lettersOf, wordsOfSentence } from '../../lib/soloEdit';
import type { RoleplayLine, SoloClip, SoloStep } from '../../lib/soloLessons';
import type { WordBankEntry } from '../../lib/types';
import { extractYoutubeId } from '../../lib/youtube';
import { SPEAKING_ITEMS, STRUCTURE_ITEMS } from '../../lib/rainbow';
import { loadWordBank } from '../../lib/wordBankCache';

const input = 'w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary';
const label = 'mb-1 block font-caption text-caption text-on-surface-variant';

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={label}>{title}</span>
      {children}
      {hint && <p className="mt-1 font-caption text-caption text-on-surface-variant">{hint}</p>}
    </div>
  );
}

/* ---------------- 그림 고르기(사전에서 찾기 / 올리기 / 지우기) ---------------- */

function ImageField({ academyId, url, onChange }: { academyId: string; url: string | null; onChange: (u: string | null) => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [bank, setBank] = useState<WordBankEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function openPicker() {
    setOpen((o) => !o);
    if (!bank) setBank(await loadWordBank().catch(() => []));
  }
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!bank || k.length < 2) return [];
    return bank.filter((e) => e.image_url && (e.word.toLowerCase().includes(k) || e.meaning.includes(k))).slice(0, 18);
  }, [bank, q]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? <img src={url} alt="" className="h-20 w-20 rounded-lg border border-outline-variant/50 bg-white object-contain" /> : <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-outline-variant text-on-surface-variant"><span className="material-symbols-outlined">image</span></div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void openPicker()} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10">
            {t('soloEdit.pickFromDictionary')}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
            {t('soloEdit.uploadImage')}
          </button>
          {url && (
            <button type="button" onClick={() => onChange(null)} className="rounded-full px-3 py-1 font-label-md text-label-md text-error hover:bg-error/10">
              {t('soloEdit.removeImage')}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const up = await uploadLessonSlideImage(academyId, f);
              onChange(up.url);
            } catch (err) {
              notify(err instanceof Error ? err.message : String(err), 'error');
            }
          }}
        />
      </div>
      {open && (
        <div className="space-y-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('soloEdit.searchPlaceholder')} className={input} autoFocus />
          <div className="grid grid-cols-6 gap-1.5">
            {hits.map((h) => (
              <button
                key={h.id}
                type="button"
                title={`${h.word} · ${h.meaning}`}
                onClick={() => {
                  onChange(h.image_url);
                  setOpen(false);
                }}
                className="overflow-hidden rounded-lg border border-outline-variant/50 bg-white hover:border-primary"
              >
                <img src={h.image_url ?? ''} alt={h.word} className="aspect-square w-full object-contain" />
                <div className="truncate px-1 pb-1 text-center font-caption text-caption">{h.word}</div>
              </button>
            ))}
          </div>
          {q.trim().length >= 2 && bank && hits.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('soloEdit.noImageHits')}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- 보기 목록(정답 고르기) ---------------- */

function OptionsField({
  options,
  answer,
  onChange,
  min = 2,
  max = 6,
}: {
  options: string[];
  answer: number;
  onChange: (options: string[], answer: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" checked={answer === i} onChange={() => onChange(options, i)} aria-label={t('soloEdit.markAnswer')} className="h-4 w-4 shrink-0 accent-primary" />
          <input value={o} onChange={(e) => onChange(options.map((x, j) => (j === i ? e.target.value : x)), answer)} className={input} placeholder={t('soloEdit.optionN', { n: i + 1 })} />
          <button
            type="button"
            disabled={options.length <= min}
            onClick={() => onChange(options.filter((_, j) => j !== i), answer === i ? 0 : answer > i ? answer - 1 : answer)}
            aria-label={t('common.delete')}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-error disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
      {options.length < max && (
        <button type="button" onClick={() => onChange([...options, ''], answer)} className="font-label-md text-label-md text-primary hover:underline">
          + {t('soloEdit.addOption')}
        </button>
      )}
      <p className="font-caption text-caption text-on-surface-variant">{t('soloEdit.answerHint')}</p>
    </div>
  );
}

function ClipField({ clip, onChange }: { clip: SoloClip; onChange: (c: SoloClip) => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(clip.videoId ? `https://www.youtube.com/watch?v=${clip.videoId}` : '');
  return (
    <div className="space-y-2">
      <Field title={t('soloEdit.youtubeUrl')}>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            const id = extractYoutubeId(e.target.value);
            if (id) onChange({ ...clip, videoId: id });
          }}
          className={input}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field title={t('soloEdit.clipStart')}>
          <input type="number" min={0} step={0.1} value={clip.start} onChange={(e) => onChange({ ...clip, start: Number(e.target.value) })} className={input} />
        </Field>
        <Field title={t('soloEdit.clipEnd')}>
          <input type="number" min={0} step={0.1} value={clip.end} onChange={(e) => onChange({ ...clip, end: Number(e.target.value) })} className={input} />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- 단계 종류별 편집 칸 ---------------- */

export default function SoloStepForm({ step, academyId, onChange }: { step: SoloStep; academyId: string; onChange: (s: SoloStep) => void }) {
  const { t } = useTranslation();
  const set = (patch: Partial<SoloStep>) => onChange({ ...step, ...patch } as SoloStep);
  const text = (title: string, value: string, key: string, opts?: { area?: boolean; hint?: string; placeholder?: string }) => (
    <Field title={title} hint={opts?.hint}>
      {opts?.area ? (
        <textarea value={value} rows={3} onChange={(e) => set({ [key]: e.target.value } as Partial<SoloStep>)} className={input} placeholder={opts?.placeholder} />
      ) : (
        <input value={value} onChange={(e) => set({ [key]: e.target.value } as Partial<SoloStep>)} className={input} placeholder={opts?.placeholder} />
      )}
    </Field>
  );
  const image = (url: string | null | undefined, key = 'imageUrl') => (
    <Field title={t('soloEdit.image')}>
      <ImageField academyId={academyId} url={url ?? null} onChange={(u) => set({ [key]: u } as Partial<SoloStep>)} />
    </Field>
  );

  switch (step.t) {
    case 'intro':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.title'), step.title, 'title')}
          {text(t('soloEdit.introText'), step.text, 'text', { area: true, hint: t('soloEdit.introTextHint') })}
          {image(step.imageUrl)}
        </div>
      );
    case 'meet':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.word'), step.word, 'word')}
          {text(t('soloEdit.meaning'), step.meaning, 'meaning')}
          <Field title={t('soloEdit.example')}>
            <input value={step.example ?? ''} onChange={(e) => set({ example: e.target.value || null })} className={input} />
          </Field>
          {image(step.imageUrl)}
        </div>
      );
    case 'pickWord':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.meaningPrompt'), step.meaning, 'meaning', { hint: t('soloEdit.pickWordHint') })}
          {image(step.imageUrl)}
          <Field title={t('soloEdit.options')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} />
          </Field>
        </div>
      );
    case 'pickMeaning':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.word'), step.word, 'word', { hint: t('soloEdit.readAloudHint') })}
          {image(step.imageUrl)}
          <Field title={t('soloEdit.options')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} />
          </Field>
        </div>
      );
    case 'listenPick':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.wordHeard'), step.word, 'word', { hint: t('soloEdit.listenPickHint') })}
          <Field title={t('soloEdit.options')}>
            <div className="space-y-2">
              {step.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-outline-variant/50 p-2">
                  <input type="radio" checked={step.answer === i} onChange={() => set({ answer: i })} aria-label={t('soloEdit.markAnswer')} className="h-4 w-4 accent-primary" />
                  <input value={o} onChange={(e) => set({ options: step.options.map((x, j) => (j === i ? e.target.value : x)) })} className={input} placeholder={t('soloEdit.optionN', { n: i + 1 })} />
                  <ImageField academyId={academyId} url={step.images[i] ?? null} onChange={(u) => set({ images: step.images.map((x, j) => (j === i ? u : x)) })} />
                </div>
              ))}
            </div>
          </Field>
        </div>
      );
    case 'spell':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.word'), step.word, 'word', { hint: t('soloEdit.spellHint') })}
          {text(t('soloEdit.meaning'), step.meaning, 'meaning')}
          {image(step.imageUrl)}
          <button type="button" onClick={() => set({ letters: lettersOf(step.word) })} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10">
            {t('soloEdit.reshuffle')}: {step.letters.join(' ')}
          </button>
        </div>
      );
    case 'typeWord':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.word'), step.word, 'word', { hint: t('soloEdit.typeHint') })}
          {text(t('soloEdit.meaning'), step.meaning, 'meaning')}
          {image(step.imageUrl)}
        </div>
      );
    case 'dictation':
      return <div className="space-y-4">{text(t('soloEdit.word'), step.word, 'word', { hint: t('soloEdit.dictationHint') })}</div>;
    case 'fillBlank':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.sentenceBlank'), step.sentence, 'sentence', { area: true, hint: t('soloEdit.blankHint') })}
          {text(t('soloEdit.meaningHint'), step.meaning, 'meaning')}
          <Field title={t('soloEdit.options')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} />
          </Field>
        </div>
      );
    case 'rule':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.title'), step.title, 'title')}
          {text(t('soloEdit.pattern'), step.pattern, 'pattern', { hint: t('soloEdit.patternHint') })}
          {text(t('soloEdit.explain'), step.explain, 'explain', { area: true })}
          <Field title={t('soloEdit.ruleLines')} hint={t('soloEdit.ruleLinesHint')}>
            <textarea value={step.lines.join('\n')} rows={5} onChange={(e) => set({ lines: e.target.value.split('\n') })} className={input} />
          </Field>
          {text(t('soloEdit.tip'), step.tip, 'tip')}
        </div>
      );
    case 'example':
    case 'fadeRead':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.sentence'), step.sentence, 'sentence', { area: true, hint: step.t === 'fadeRead' ? t('soloEdit.fadeHint') : undefined })}
          {text(t('soloEdit.ko'), step.ko, 'ko')}
          {step.t === 'fadeRead' && image(step.imageUrl)}
        </div>
      );
    case 'translatePick':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.sentence'), step.sentence, 'sentence', { area: true })}
          <Field title={t('soloEdit.optionsKo')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} />
          </Field>
        </div>
      );
    case 'pickCorrect':
      return (
        <div className="space-y-4">
          <Field title={t('soloEdit.optionsCorrect')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} max={4} />
          </Field>
          {text(t('soloEdit.why'), step.why, 'why')}
        </div>
      );
    case 'unscramble':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.sentence'), step.sentence, 'sentence', { area: true, hint: t('soloEdit.unscrambleHint') })}
          <button type="button" onClick={() => set({ words: wordsOfSentence(step.sentence) })} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10">
            {t('soloEdit.reshuffle')}: {step.words.join(' · ')}
          </button>
          {step.clip && <ClipField clip={step.clip} onChange={(clip) => set({ clip })} />}
        </div>
      );
    case 'sayPick':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.situation'), step.situation, 'situation', { hint: t('soloEdit.situationHint') })}
          {image(step.imageUrl)}
          <Field title={t('soloEdit.optionsEn')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} />
          </Field>
        </div>
      );
    case 'watch':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.title'), step.title, 'title')}
          <Field title={t('soloEdit.watchMode')}>
            <select value={step.mode} onChange={(e) => set({ mode: e.target.value as 'listen' | 'sing' })} className={input}>
              <option value="listen">{t('soloEdit.watchListen')}</option>
              <option value="sing">{t('soloEdit.watchSing')}</option>
            </select>
          </Field>
          <ClipField clip={step.clip} onChange={(clip) => set({ clip })} />
        </div>
      );
    case 'lyricBlank':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.sentenceBlank'), step.sentence, 'sentence', { area: true, hint: t('soloEdit.blankHint') })}
          {text(t('soloEdit.ko'), step.ko, 'ko')}
          <Field title={t('soloEdit.options')}>
            <OptionsField options={step.options} answer={step.answer} onChange={(options, answer) => set({ options, answer })} />
          </Field>
          <ClipField clip={step.clip} onChange={(clip) => set({ clip })} />
        </div>
      );
    case 'lineSing':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.sentence'), step.en, 'en', { area: true })}
          {text(t('soloEdit.ko'), step.ko, 'ko')}
          <ClipField clip={step.clip} onChange={(clip) => set({ clip })} />
        </div>
      );
    case 'rainbowSpeak':
    case 'rainbowStructure': {
      const pool = step.t === 'rainbowSpeak' ? SPEAKING_ITEMS.map((i) => ({ id: i.id, text: i.englishAnswer })) : STRUCTURE_ITEMS.map((i) => ({ id: i.id, text: i.sentence }));
      return (
        <div className="space-y-4">
          <Field title={t('soloEdit.rainbowSentence')} hint={t('soloEdit.rainbowHint')}>
            <select
              value={step.itemId}
              onChange={(e) => set({ itemId: e.target.value })}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            >
              {pool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.text}
                </option>
              ))}
            </select>
          </Field>
        </div>
      );
    }
    case 'roleplay':
      return (
        <div className="space-y-4">
          {text(t('soloEdit.title'), step.title, 'title')}
          {image(step.imageUrl)}
          <Field title={t('soloEdit.dialogue')} hint={t('soloEdit.dialogueHint')}>
            <div className="space-y-2">
              {step.lines.map((l, i) => {
                const setLine = (patch: Partial<RoleplayLine>) => set({ lines: step.lines.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="space-y-1.5 rounded-lg border border-outline-variant/50 p-2">
                    <div className="flex items-center gap-2">
                      <select value={l.who} onChange={(e) => setLine({ who: e.target.value as 'me' | 'other' })} className={`${input} !w-28`}>
                        <option value="other">{t('soloEdit.whoOther')}</option>
                        <option value="me">{t('soloEdit.whoMe')}</option>
                      </select>
                      <input value={l.speaker} onChange={(e) => setLine({ speaker: e.target.value })} className={input} placeholder={t('soloEdit.speaker')} />
                      <button type="button" disabled={i === 0} onClick={() => set({ lines: swap(step.lines, i, i - 1) })} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30" aria-label={t('soloEdit.moveUp')}>
                        <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                      </button>
                      <button type="button" disabled={i === step.lines.length - 1} onClick={() => set({ lines: swap(step.lines, i, i + 1) })} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30" aria-label={t('soloEdit.moveDown')}>
                        <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => set({ lines: step.lines.filter((_, j) => j !== i) })} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-error" aria-label={t('common.delete')}>
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                    <input value={l.en} onChange={(e) => setLine({ en: e.target.value })} className={input} placeholder="English" />
                    <input value={l.ko} onChange={(e) => setLine({ ko: e.target.value })} className={input} placeholder={t('soloEdit.ko')} />
                  </div>
                );
              })}
              <button type="button" onClick={() => set({ lines: [...step.lines, { who: step.lines[step.lines.length - 1]?.who === 'me' ? 'other' : 'me', speaker: step.lines[step.lines.length - 1]?.who === 'me' ? 'Clerk' : 'Me', en: '', ko: '' }] })} className="font-label-md text-label-md text-primary hover:underline">
                + {t('soloEdit.addLine')}
              </button>
            </div>
          </Field>
        </div>
      );
  }
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const x = [...arr];
  [x[a], x[b]] = [x[b], x[a]];
  return x;
}
