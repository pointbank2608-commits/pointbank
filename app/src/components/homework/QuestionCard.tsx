import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import type { HwQuestion } from '../../lib/homework/types';
import { TextAnswer } from '../../pages/LiveJoinPage';

const CHOICE_COLORS = ['#e5484d', '#2f6fdb', '#d99a00', '#2e9e5b', '#8e4ec6', '#12a594'];

/**
 * 숙제 문제 한 개(학생 화면·선생님 미리보기 공용) — 보기 고르기 · 철자 입력 · 낱말/글자 순서(탭으로 놓기).
 * 답을 정하면 onAnswer(응답 글)를 부른다. 채점은 하지 않는다(서버 또는 미리보기가 한다).
 */
export default function QuestionCard({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (response: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const listen = q.style === 'listen';

  useEffect(() => {
    if (listen && q.speak) speak(q.speak);
  }, [q.id, listen, q.speak]);

  const guide = t(`studentHw.guide_${q.style ?? (q.qtype === 'text' ? 'spell' : q.qtype === 'order' ? 'letters' : 'any')}`);
  const speakBtn = (big: boolean) =>
    q.speak ? (
      <button
        type="button"
        onClick={() => speak(q.speak!)}
        aria-label={t('studentHw.listenAgain')}
        className={`flex items-center justify-center gap-2 rounded-full bg-warm-yellow font-bold text-deep-navy shadow-lg active:scale-95 ${big ? 'h-24 w-24' : 'min-h-11 px-4 text-base'}`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: big ? 52 : 22 }}>
          volume_up
        </span>
        {!big && t('studentHw.listen')}
      </button>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-3 px-5 py-4 text-center">
        <div className="text-base text-white/75">{guide}</div>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="h-36 w-36 rounded-2xl bg-white object-contain p-2 sm:h-44 sm:w-44" />}
        {listen ? (
          speakBtn(true)
        ) : (
          <>
            {q.prompt && (
              <div className={`font-bold leading-snug ${q.prompt.length > 50 ? 'text-xl' : q.prompt.length > 20 ? 'text-2xl' : 'text-3xl'}`}>{q.prompt}</div>
            )}
            {q.sub && <div className="text-base text-white/70">({q.sub})</div>}
            {q.style !== 'meaning' && q.speak && q.qtype === 'text' && speakBtn(false)}
            {q.style === 'meaning' && speakBtn(false)}
          </>
        )}
      </div>

      {q.qtype === 'choice' && <ChoiceList q={q} onAnswer={onAnswer} disabled={disabled} />}
      {q.qtype === 'text' && <TextInput key={q.id} onAnswer={onAnswer} disabled={disabled} />}
      {q.qtype === 'order' && <OrderBuilder key={q.id} q={q} onAnswer={onAnswer} disabled={disabled} />}
    </div>
  );
}

function ChoiceList({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const choices = q.choices ?? [];
  const ox = choices.length === 2 && choices[0] === 'O' && choices[1] === 'X';
  if (ox) {
    return (
      <div className="grid flex-1 grid-cols-2 gap-3 p-4">
        {choices.map((c, i) => (
          <button key={c} type="button" disabled={disabled} onClick={() => onAnswer(String(i))} className="min-h-28 rounded-3xl text-7xl font-bold text-white shadow-lg disabled:opacity-60" style={{ background: i === 0 ? '#2f6fdb' : '#e5484d' }}>
            {c}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="grid content-start gap-3 p-4">
      {choices.map((c, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onAnswer(String(i))}
          className="flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60"
          style={{ background: CHOICE_COLORS[i % CHOICE_COLORS.length] }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-base">{i + 1}</span>
          {c}
        </button>
      ))}
    </div>
  );
}

function TextInput({ onAnswer, disabled }: { onAnswer: (r: string) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  return <TextAnswer text={text} setText={setText} disabled={disabled} onSubmit={() => text.trim() && !disabled && onAnswer(text.trim())} />;
}

/** 조각을 눌러 차례로 놓고, 놓은 조각을 누르면 되돌린다(끌기 없이도 풀 수 있게) */
function OrderBuilder({ q, onAnswer, disabled }: { q: HwQuestion; onAnswer: (r: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const tokens = q.tokens ?? [];
  const [placed, setPlaced] = useState<number[]>([]);
  const letters = q.joiner === '';
  const done = placed.length === tokens.length && tokens.length > 0;
  const tile = `min-h-12 rounded-xl px-3 font-bold shadow-[0_3px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none ${letters ? 'min-w-12 text-2xl' : 'text-lg'}`;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/30 p-3" aria-live="polite">
        {placed.length === 0 && <span className="text-base text-white/50">{t('studentHw.orderHint')}</span>}
        {placed.map((ti, k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => setPlaced((p) => p.filter((_, j) => j !== k))} className={`${tile} bg-warm-yellow text-deep-navy`}>
            {tokens[ti]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tokens.map((tok, i) =>
          placed.includes(i) ? (
            <span key={i} className={`${tile} invisible`}>
              {tok}
            </span>
          ) : (
            <button key={i} type="button" disabled={disabled} onClick={() => setPlaced((p) => [...p, i])} className={`${tile} bg-white text-deep-navy`}>
              {tok}
            </button>
          ),
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" disabled={disabled || placed.length === 0} onClick={() => setPlaced([])} className="min-h-12 flex-1 rounded-full bg-white/15 text-base font-bold text-white disabled:opacity-40">
          {t('studentHw.clearOrder')}
        </button>
        <button
          type="button"
          disabled={disabled || !done}
          onClick={() => onAnswer(JSON.stringify(placed.map((i) => tokens[i])))}
          className="min-h-12 flex-[2] rounded-full bg-warm-yellow text-lg font-bold text-deep-navy disabled:opacity-40"
        >
          {t('studentHw.check')}
        </button>
      </div>
    </div>
  );
}
