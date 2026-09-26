import { useEffect, useMemo, useRef, useState } from 'react';
import { useSyncedSubState } from '../lib/presentSync';
import { useTranslation } from 'react-i18next';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import { usePhonicsFilled } from '../lib/phonicsFill';
import { speak } from '../lib/speech';
import { useWordBankEnriched } from '../lib/wordBankCache';
import type { FullCardItem } from '../lib/types';
import { CanvasStageBox } from './CanvasSlideView';
import PhonicsMarkedWord from './PhonicsMarkedWord';

/**
 * "단어 소개" 슬라이드(2026-09-27) — 사전 카드를 칠판에 크게. 단어 하나씩, 한 단계씩 연다:
 * 그림 → 단어(읽어 주기) → 뜻·품사 → 예문. 클리커(PageDown)·Space·→ 로 다음 단계, 단어가 끝나면 다음 단어,
 * 마지막 단어의 마지막 단계에서는 흘려보내 다음 슬라이드로(문법 슬라이드와 같은 방식). 단어장에 없는 예문·품사는
 * 사전에서, 파닉스 단어의 규칙 글자 강조는 파닉스 자료에서 채운다.
 */
type Step = 'image' | 'word' | 'meaning' | 'example';

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WordShowBoard({
  words,
  themeId,
  interactive,
  shuffle = false,
  autoSpeak = true,
}: {
  words: FullCardItem[];
  themeId?: string | null;
  /** false: 편집 화면 미리보기 — 첫 단어를 다 연 상태로 보여 준다 */
  interactive: boolean;
  shuffle?: boolean;
  autoSpeak?: boolean;
}) {
  const { t } = useTranslation();
  const th = boardTheme(themeId ?? 'green') ?? boardTheme('green')!;
  const font = BOARD_FONTS[th.font];
  const enriched = useWordBankEnriched(usePhonicsFilled(words));
  // 섞는 건 처음 한 번만(사전 정보가 늦게 와도 순서가 바뀌지 않게 id 순서만 기억)
  const [order, setOrder] = useState<string[]>(() => {
    const ids = words.map((w) => w.id);
    return shuffle && interactive ? shuffled(ids) : ids;
  });
  const wordKey = words.map((w) => w.id).join('|');
  useEffect(() => {
    const ids = words.map((w) => w.id);
    setOrder((prev) => (prev.length === ids.length && prev.every((id) => ids.includes(id)) ? prev : shuffle && interactive ? shuffled(ids) : ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordKey]);
  const list = useMemo(() => {
    const byId = new Map(enriched.map((w) => [w.id, w]));
    return order.map((id) => byId.get(id)).filter((w): w is FullCardItem => !!w);
  }, [enriched, order]);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  // 학생 따라보기: 순서·지금 단어·단계를 학생 화면에 그대로(학생 화면은 자동 읽기도 안 한다)
  const follower = useSyncedSubState({ order, idx, step }, (s) => {
    if (Array.isArray(s.order)) setOrder(s.order as string[]);
    setIdx(Number(s.idx) || 0);
    setStep(Number(s.step) || 0);
  });
  const card = list[Math.min(idx, list.length - 1)];
  const steps: Step[] = card
    ? ([card.imageUrl ? 'image' : null, 'word', card.meaning ? 'meaning' : null, card.example ? 'example' : null].filter(Boolean) as Step[])
    : [];
  const shownStep = interactive ? step : steps.length - 1;
  const has = (s: Step) => steps.indexOf(s) >= 0 && steps.indexOf(s) <= shownStep;

  const stateRef = useRef({ idx, step, total: list.length, last: steps.length - 1 });
  stateRef.current = { idx, step, total: list.length, last: steps.length - 1 };

  // 단어가 나오는 단계에서 한 번 읽어 준다
  const spokenRef = useRef<string>('');
  useEffect(() => {
    if (!interactive || follower || !autoSpeak || !card) return;
    const key = `${card.id}:word`;
    if (steps[step] === 'word' && spokenRef.current !== key) {
      spokenRef.current = key;
      speak(card.word);
    }
  });

  function forward(): boolean {
    const s = stateRef.current;
    if (s.step < s.last) {
      setStep(s.step + 1);
      return true;
    }
    if (s.idx < s.total - 1) {
      setIdx(s.idx + 1);
      setStep(0);
      return true;
    }
    return false;
  }
  function back(): boolean {
    const s = stateRef.current;
    if (s.step > 0) {
      setStep(s.step - 1);
      return true;
    }
    if (s.idx > 0) {
      setIdx(s.idx - 1);
      setStep(99); // 이전 단어는 다 연 상태로(아래에서 마지막 단계로 맞춘다)
      return true;
    }
    return false;
  }
  useEffect(() => {
    if (step > steps.length - 1 && steps.length > 0) setStep(steps.length - 1);
  }, [step, steps.length]);

  // → · Space · PageDown(클리커): 다음 단계. 다 열었으면 흘려보내 다음 슬라이드로. ← · PageUp 은 반대.
  useEffect(() => {
    if (!interactive || follower) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const isFwd = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const isBack = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if ((isFwd && forward()) || (isBack && back())) {
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === ' ') {
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, follower]);

  if (!card) {
    return <div className="flex h-full items-center justify-center text-on-surface-variant">{t('curriculum.wordShow.noWords')}</div>;
  }
  const withImage = !!card.imageUrl && has('image');
  const speakBtn = (text: string, size: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
      style={{ width: size, height: size, background: th.chip, color: th.text }}
      aria-label={t('dictionary.playWord', { word: text })}
    >
      <span className="material-symbols-outlined" style={{ fontSize: `calc(${size} * 0.6)` }}>
        volume_up
      </span>
    </button>
  );

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0" style={boardSlideStyle(th)} />
        <div className="absolute inset-0 flex flex-col" style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}>
          <div className="flex items-center gap-[1.5cqh]" style={{ fontSize: '2.6cqh', color: th.muted }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
              menu_book
            </span>
            <span className="flex-1">{t('curriculum.wordShow.title')}</span>
            <span className="tabular-nums">
              {Math.min(idx, list.length - 1) + 1} / {list.length}
            </span>
          </div>
          <div className={`flex min-h-0 flex-1 items-center gap-[5cqh] ${withImage ? '' : 'justify-center text-center'}`}>
            {card.imageUrl && (
              <div
                className="flex h-[62cqh] w-[62cqh] shrink-0 items-center justify-center overflow-hidden rounded-[3cqh] transition-all duration-500"
                style={{ background: '#ffffff', opacity: has('image') ? 1 : 0, transform: has('image') ? 'scale(1)' : 'scale(0.9)' }}
              >
                <img src={card.imageUrl} alt="" className="h-full w-full object-contain p-[2cqh]" />
              </div>
            )}
            <div className={`flex min-w-0 flex-1 flex-col gap-[3cqh] ${withImage ? '' : 'items-center'}`}>
              <div className="flex items-center gap-[2cqh] transition-opacity duration-300" style={{ opacity: has('word') ? 1 : 0 }}>
                <span className="font-bold leading-none" style={{ fontSize: card.word.length > 12 ? '9cqh' : '13cqh' }}>
                  {card.patternMarked ? <PhonicsMarkedWord pattern={card.patternMarked} /> : card.word}
                </span>
                {has('word') && speakBtn(card.word, '8cqh')}
              </div>
              <div className="flex flex-wrap items-baseline gap-[1.5cqh] transition-opacity duration-300" style={{ opacity: has('meaning') ? 1 : 0 }}>
                {card.partOfSpeech && (
                  <span className="rounded-full px-[1.6cqh] py-[0.4cqh]" style={{ fontSize: '3cqh', background: th.chip, color: th.muted }}>
                    {card.partOfSpeech}
                  </span>
                )}
                <span style={{ fontSize: '7cqh', color: th.accent }}>{card.meaning}</span>
              </div>
              {card.example && (
                <div className="flex items-start gap-[1.5cqh] transition-opacity duration-300" style={{ opacity: has('example') ? 1 : 0 }}>
                  <span style={{ fontSize: '4.6cqh', lineHeight: 1.35 }}>{card.example}</span>
                  {has('example') && speakBtn(card.example, '6cqh')}
                </div>
              )}
            </div>
          </div>
          {interactive && (
            <div className="flex items-center justify-center gap-[1cqh]">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className="rounded-full transition-all"
                  style={{ width: i === step ? '4cqh' : '1.6cqh', height: '1.6cqh', background: i <= step ? th.accent : th.line }}
                />
              ))}
            </div>
          )}
        </div>
      </CanvasStageBox>
    </div>
  );
}
