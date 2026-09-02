import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPhonicsBank } from '../lib/api';
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

function PatternWord({ pattern }: { pattern: string }) {
  return (
    <span className="font-title-md text-title-md text-deep-navy">
      {parsePattern(pattern).map((part, i) =>
        part.marked ? (
          <span key={i} className="rounded bg-primary-container px-0.5 text-primary">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function PhonicsImage({ entry }: { entry: PhonicsBankEntry }) {
  const [broken, setBroken] = useState(false);
  if (!entry.image_url || broken) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg bg-surface-container-low text-3xl">
        🔤
      </div>
    );
  }
  return (
    <img
      src={entry.image_url}
      alt=""
      className="h-32 w-full rounded-lg object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export default function PhonicsPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PhonicsBankEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);
  const [rule, setRule] = useState<string>('all');

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
                  <PhonicsImage entry={entry} />
                  <div className="mt-3">
                    <PatternWord pattern={entry.pattern_marked} />
                  </div>
                  {entry.meaning && <p className="font-body-md text-body-md text-on-surface">{entry.meaning}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
