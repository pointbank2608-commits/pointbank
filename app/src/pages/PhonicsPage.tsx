import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPhonicsBank } from '../lib/api';
import { speak } from '../lib/speech';
import type { PhonicsBankEntry } from '../lib/types';

const STEPS = [1, 2, 3, 4, 5];

/** "r{ai}n" -> [{text:'r'},{text:'ai',marked:true},{text:'n'}]. 소리 규칙 글자를 {} 로 감싸둔
 * pattern_marked 를 파싱해서, AI 이미지에 텍스트를 굽는 대신 앱이 직접 색깔 있는 글자로 그린다. */
function parsePattern(pattern: string): { text: string; marked?: boolean }[] {
  const parts: { text: string; marked?: boolean }[] = [];
  const re = /\{([^}]*)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(pattern))) {
    if (match.index > lastIndex) parts.push({ text: pattern.slice(lastIndex, match.index) });
    parts.push({ text: match[1], marked: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < pattern.length) parts.push({ text: pattern.slice(lastIndex) });
  return parts;
}

function PatternWord({ pattern, size = 'card' }: { pattern: string; size?: 'card' | 'lightbox' }) {
  const textSizeClass = size === 'lightbox' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-[26px]';
  return (
    <span className={`font-title-md font-bold text-deep-navy ${textSizeClass}`}>
      {parsePattern(pattern).map((part, i) =>
        part.marked ? (
          // 소리 규칙 글자는 진한 남색 글자 + 밝은 노란 배경으로 대비를 크게 줘서(파란 글자에
          // 파란 배경이라 잘 안 보인다는 피드백으로 수정) 눈에 확 띄게 한다.
          <span key={i} className="rounded bg-warm-yellow px-0.5 font-extrabold text-deep-navy">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function PhonicsImage({ entry, onOpen }: { entry: PhonicsBankEntry; onOpen: (entry: PhonicsBankEntry) => void }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (!entry.image_url || broken) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg bg-surface-container-low text-3xl">
        🔤
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="block w-full cursor-zoom-in"
      aria-label={t('phonics.viewFullImage', { word: entry.word })}
    >
      <img
        src={entry.image_url}
        alt=""
        className="h-32 w-full rounded-lg object-cover transition-transform hover:scale-[1.03]"
        onError={() => setBroken(true)}
      />
    </button>
  );
}

function PhonicsLightbox({ entry, onClose }: { entry: PhonicsBankEntry; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg sm:max-w-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={entry.image_url ?? undefined} alt="" className="max-h-[70vh] w-full object-contain bg-surface-container-low" />
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-1.5">
            <PatternWord pattern={entry.pattern_marked} size="lightbox" />
            <button
              type="button"
              onClick={() => speak(entry.word)}
              aria-label={t('phonics.playWord', { word: entry.word })}
              title={t('phonics.playWord', { word: entry.word })}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            >
              <span className="material-symbols-outlined text-[26px]">volume_up</span>
            </button>
          </div>
          {entry.meaning && <p className="font-body-md mt-1 text-xl text-on-surface sm:text-2xl">{entry.meaning}</p>}
          <button
            type="button"
            onClick={onClose}
            className="mt-5 rounded-full bg-primary px-6 py-2.5 font-label-md text-lg text-on-primary transition-colors hover:bg-primary-container"
          >
            {t('dictionary.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhonicsPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PhonicsBankEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);
  const [rule, setRule] = useState<string>('all');
  const [lightbox, setLightbox] = useState<PhonicsBankEntry | null>(null);

  useEffect(() => {
    fetchPhonicsBank()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const stepEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => e.step === step);
  }, [entries, step]);

  const usedRules = useMemo(() => {
    const seen: string[] = [];
    for (const e of stepEntries) if (!seen.includes(e.rule)) seen.push(e.rule);
    return seen;
  }, [stepEntries]);

  const filtered = useMemo(() => {
    if (rule === 'all') return stepEntries;
    return stepEntries.filter((e) => e.rule === rule);
  }, [stepEntries, rule]);

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('phonics.title')}
      </h2>

      <div>
        <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('phonics.stepLabel')}</div>
        <div className="flex flex-wrap gap-2">
          {STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStep(s);
                setRule('all');
              }}
              className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                step === s
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {t('phonics.stepName', { step: s })}
            </button>
          ))}
        </div>
      </div>

      {usedRules.length > 0 && (
        <div>
          <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('phonics.ruleLabel')}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRule('all')}
              className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                rule === 'all'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {t('phonics.allRule')}
            </button>
            {usedRules.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRule(r)}
                className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                  rule === r
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="font-body-md text-body-md text-error">{error}</div>}

      {!entries && !error && (
        <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</div>
      )}

      {entries && (
        <>
          <div className="font-caption text-caption text-on-surface-variant tabular-nums">
            {t('phonics.resultCount', { count: filtered.length })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-surface-container-lowest py-16 text-center shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="mb-3 text-5xl">🔍</div>
              <div className="font-body-md text-body-md text-on-surface-variant">{t('phonics.noResults')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)]"
                >
                  <PhonicsImage entry={entry} onOpen={setLightbox} />
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <PatternWord pattern={entry.pattern_marked} />
                    <button
                      type="button"
                      onClick={() => speak(entry.word)}
                      aria-label={t('phonics.playWord', { word: entry.word })}
                      title={t('phonics.playWord', { word: entry.word })}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[20px]">volume_up</span>
                    </button>
                  </div>
                  {entry.meaning && (
                    <p className="font-body-md mt-0.5 text-lg text-on-surface sm:text-xl">{entry.meaning}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {lightbox && <PhonicsLightbox entry={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
