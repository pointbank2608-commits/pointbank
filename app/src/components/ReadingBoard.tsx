import { useEffect, useRef, useState } from 'react';
import { useSyncedSubState } from '../lib/presentSync';
import { useTranslation } from 'react-i18next';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import { parseMarked, plainText } from '../lib/grammar';
import { clozeSegments, parseReadingText } from '../lib/readingLines';
import { speak } from '../lib/speech';
import { extractYoutubeId } from '../lib/youtube';
import { CanvasStageBox } from './CanvasSlideView';

/**
 * "노래·지문 한 줄씩" 칠판 — 커리큘럼 reading 슬라이드.
 *  - lines(한 줄씩 보기): 한 줄을 크게, 해석 켜고 끄기, 그 줄 읽어주기·영상 그 부분 듣기.
 *    →·Space·PageDown(클리커)으로 다음 줄, 마지막 줄 뒤에는 다음 슬라이드로(GrammarBoard 와 같은 패턴,
 *    document capture 로 받아 처리한 키만 전파를 막는다).
 *  - cloze(빈칸 듣기): 전체 가사에서 ** ** 낱말을 빈칸으로. 빈칸을 누르면 하나씩, "정답 보기"로 전부.
 */
export default function ReadingBoard({
  source,
  title,
  videoUrl,
  mode,
  themeId,
  interactive = true,
}: {
  source: string;
  title?: string;
  videoUrl?: string | null;
  mode: 'lines' | 'cloze';
  themeId?: string | null;
  interactive?: boolean;
}) {
  const { t } = useTranslation();
  const th = boardTheme(themeId ?? 'green') ?? boardTheme('green')!;
  const lines = parseReadingText(source);
  const [idx, setIdx] = useState(0);
  const [showKo, setShowKo] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [playAt, setPlayAt] = useState<number | null>(null);
  const videoId = videoUrl ? extractYoutubeId(videoUrl) : null;
  const idxRef = useRef(idx);
  idxRef.current = idx;
  // 학생 따라보기: 지금 줄·해석·빈칸 연 것을 학생 화면에 그대로
  const follower = useSyncedSubState({ idx, showKo, revealed: [...revealed], revealAll }, (s) => {
    setIdx(Number(s.idx) || 0);
    setShowKo(!!s.showKo);
    setRevealed(new Set(Array.isArray(s.revealed) ? (s.revealed as string[]) : []));
    setRevealAll(!!s.revealAll);
  });

  useEffect(() => {
    setIdx(0);
    setRevealed(new Set());
    setRevealAll(false);
    setPlayAt(null);
  }, [source, mode]);

  useEffect(() => {
    if (!interactive || follower || mode !== 'lines') return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const forward = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
      if (forward && idxRef.current < lines.length - 1) {
        e.preventDefault();
        e.stopPropagation();
        setIdx((i) => i + 1);
      } else if (back && idxRef.current > 0) {
        e.preventDefault();
        e.stopPropagation();
        setIdx((i) => i - 1);
      } else if (e.key === ' ') e.preventDefault();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [interactive, mode, lines.length, follower]);

  const font = BOARD_FONTS[th.font];
  const line = lines[Math.min(idx, Math.max(0, lines.length - 1))];

  function Marked({ text }: { text: string }) {
    return (
      <>
        {parseMarked(text).map((seg, i) => (
          <span key={i} style={seg.strong ? { color: th.accent, fontWeight: 700 } : undefined}>
            {seg.text}
          </span>
        ))}
      </>
    );
  }

  // 빈칸 듣기: 줄 수에 맞춰 글자 크기(한 줄 높이 ≈ 글자 × 1.5)
  const clozeSize = Math.min(4.2, 60 / Math.max(1, lines.length * 1.5 + (showKo ? lines.length * 0.9 : 0)));

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0" style={boardSlideStyle(th)} />
        <div className="absolute inset-0 flex flex-col" style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}>
          <div className="flex items-center gap-[1.5cqh]" style={{ fontSize: '2.8cqh', color: th.muted }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
              {mode === 'cloze' ? 'hearing' : 'lyrics'}
            </span>
            <span className="truncate">{title || t('curriculum.reading.defaultTitle')}</span>
            {mode === 'lines' && lines.length > 0 && (
              <span className="ml-auto rounded-full px-[1.4cqh]" style={{ background: th.chip }}>
                {idx + 1} / {lines.length}
              </span>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-1 items-center justify-center" style={{ fontSize: '3.4cqh', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
              {t('curriculum.reading.empty')}
            </div>
          ) : mode === 'lines' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-[3cqh] text-center">
              <div className="font-bold leading-snug" style={{ fontSize: plainText(line.en).length > 40 ? '6cqh' : '7.5cqh' }}>
                <Marked text={line.en} />
              </div>
              {showKo && line.ko && (
                <div style={{ fontSize: '4cqh', color: th.muted, fontFamily: BOARD_FONTS.sans }}>{line.ko}</div>
              )}
            </div>
          ) : (
            <ol className="mt-[2cqh] flex min-h-0 flex-1 flex-col justify-center gap-[1cqh] overflow-y-auto pb-[6cqh]" style={{ fontSize: `${clozeSize}cqh` }}>
              {lines.map((l, li) => (
                <li key={li}>
                  {clozeSegments(l.en).map((seg, si) => {
                    const key = `${li}:${si}`;
                    if (!seg.blank) return <span key={key}>{seg.text}</span>;
                    const open = revealAll || revealed.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => interactive && setRevealed((prev) => new Set(prev).add(key))}
                        className="mx-[0.3em] inline-block min-w-[5em] text-center align-baseline"
                        style={{ borderBottom: `0.4cqh solid ${th.accent}`, color: open ? th.accent : 'transparent', fontWeight: 700 }}
                      >
                        {open ? seg.text : seg.text.replace(/./g, '_')}
                      </button>
                    );
                  })}
                  {showKo && l.ko && (
                    <span className="ml-[1em]" style={{ fontSize: '0.6em', color: th.muted, fontFamily: BOARD_FONTS.sans }}>
                      {l.ko}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {interactive && playAt !== null && videoId && (
          <iframe
            key={playAt}
            title="video"
            className="absolute bottom-[9cqh] left-[3cqh] aspect-video w-[34%] rounded-lg shadow-lg"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${playAt}`}
            allow="autoplay; encrypted-media"
          />
        )}

        {interactive && lines.length > 0 && (
          <div className="absolute bottom-[2.5cqh] right-[3cqh] flex flex-wrap items-center justify-end gap-[1cqh]" style={{ fontSize: '2.4cqh' }}>
            {mode === 'lines' && (
              <>
                <Btn icon="chevron_left" label={t('curriculum.reading.prev')} disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} />
                <Btn icon="chevron_right" label={t('curriculum.reading.next')} disabled={idx >= lines.length - 1} onClick={() => setIdx((i) => Math.min(lines.length - 1, i + 1))} />
                <Btn icon="volume_up" label={t('grammar.readAll')} onClick={() => speak(plainText(line.en))} />
                {videoId && line.start !== null && (
                  <Btn icon="play_circle" label={t('curriculum.reading.playLine')} onClick={() => setPlayAt(line.start)} />
                )}
              </>
            )}
            {mode === 'cloze' && (
              <>
                {videoId && <Btn icon="play_circle" label={t('curriculum.reading.playSong')} onClick={() => setPlayAt(lines[0]?.start ?? 0)} />}
                <Btn icon="visibility" label={revealAll ? t('curriculum.reading.hideAnswers') : t('curriculum.reading.showAnswers')} onClick={() => { setRevealAll((v) => !v); setRevealed(new Set()); }} />
              </>
            )}
            {playAt !== null && <Btn icon="stop_circle" label={t('curriculum.reading.stopVideo')} onClick={() => setPlayAt(null)} />}
            {lines.some((l) => l.ko) && (
              <Btn icon="translate" label={showKo ? t('grammar.hideKo') : t('grammar.showKo')} onClick={() => setShowKo((v) => !v)} />
            )}
          </div>
        )}
      </CanvasStageBox>
    </div>
  );
}

function Btn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-[0.6cqh] rounded-full bg-white/90 px-[1.8cqh] py-[0.9cqh] font-bold text-[#1f2937] shadow-md hover:bg-white disabled:opacity-40"
      style={{ fontFamily: BOARD_FONTS.sans }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
