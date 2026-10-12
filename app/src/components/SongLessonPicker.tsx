import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { grammarPoint, plainText } from '../lib/grammar';
import { lyricsSearchUrl, songVideoUrl, type SongLesson } from '../lib/songLessons';

/**
 * 팝송 수업 컬렉션(songLessons.ts) 고르기 — 곡 카드 → 곡 상세(소개·핵심 단어·문법·활동·주의점) → "이 노래로 수업 만들기".
 * 가사는 담지 않는다: 공식 영상과 정식 가사 제공처(검색 링크)로 안내하고, 선생님이 가사를 붙여 넣으면
 * 그 수업 안에서만 읽기·빈칸 듣기 슬라이드가 더해진다.
 */
export default function SongLessonPicker({
  songs,
  busy,
  onBuild,
}: {
  songs: SongLesson[];
  busy: boolean;
  onBuild: (song: SongLesson, lyrics: string) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<SongLesson | null>(null);
  const [lyrics, setLyrics] = useState('');

  if (picked) {
    const video = songVideoUrl(picked);
    const chip = 'rounded-full bg-surface-container px-2.5 py-0.5 font-caption text-caption text-on-surface-variant';
    return (
      <div className="space-y-3 rounded-xl border border-primary/30 bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">music_note</span>
          <div className="min-w-0 flex-1">
            <div className="font-title-md text-title-md font-bold text-deep-navy">{picked.title}</div>
            <div className="font-caption text-caption text-on-surface-variant">
              {picked.artist} · {picked.levelNote}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setLyrics('');
            }}
            className="font-label-md text-label-md text-on-surface-variant hover:text-primary"
          >
            {t('songs.back')}
          </button>
        </div>

        <p className="font-body-md text-body-md text-on-surface">{picked.intro}</p>

        {(picked.tags.caution || !picked.tags.elementary || picked.videoNote) && (
          <div className="space-y-1 rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">
            {picked.tags.caution && (
              <p className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                {picked.tags.caution}
              </p>
            )}
            {picked.videoNote && (
              <p className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px]">smart_display</span>
                {picked.videoNote}
              </p>
            )}
            {!picked.tags.elementary && (
              <p className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px]">school</span>
                {t('songs.upperOnly')}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {picked.points.map((p) => (
            <span key={p} className="rounded-full bg-primary/10 px-2.5 py-0.5 font-caption text-caption text-primary">
              {p}
            </span>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 font-label-md text-label-md font-bold text-deep-navy">{t('songs.words')}</div>
            <ul className="space-y-1">
              {picked.words.map((w) => (
                <li key={w.word} className="font-body-md text-body-md text-on-surface">
                  <span className="font-bold">{w.word}</span> <span className="text-on-surface-variant">· {w.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 font-label-md text-label-md font-bold text-deep-navy">{t('songs.grammar')}</div>
              <div className="flex flex-wrap gap-1.5">
                {picked.grammarIds.map((id) => {
                  const g = grammarPoint(id);
                  return g ? (
                    <span key={id} className={chip}>
                      {plainText(g.name)}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <div>
              <div className="mb-1 font-label-md text-label-md font-bold text-deep-navy">{t('songs.activity')}</div>
              <p className="font-body-md text-body-md text-on-surface">{picked.activity.title}</p>
              <p className="font-caption text-caption text-on-surface-variant">{picked.activity.frame}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {video ? (
            <a
              href={video}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">smart_display</span>
              {t('songs.openVideo')}
            </a>
          ) : (
            <span className="font-caption text-caption text-on-surface-variant">{t('songs.noVideo')}</span>
          )}
          <a
            href={lyricsSearchUrl(picked)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-[18px]">lyrics</span>
            {t('songs.openLyrics')}
          </a>
        </div>

        <details className="rounded-lg bg-surface-container-low px-3 py-2">
          <summary className="cursor-pointer font-label-md text-label-md text-primary">{t('songs.pasteTitle')}</summary>
          <p className="mt-2 font-caption text-caption text-on-surface-variant">{t('songs.pasteHint')}</p>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={6}
            placeholder={t('songs.pastePlaceholder')}
            aria-label={t('songs.pasteTitle')}
            className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary"
          />
        </details>

        <p className="font-caption text-caption text-on-surface-variant">{t('songs.draftNote')}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onBuild(picked, lyrics)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          {busy ? t('songs.building') : t('songs.build')}
        </button>
      </div>
    );
  }

  if (songs.length === 0) return <p className="font-caption text-caption text-on-surface-variant">{t('songs.none')}</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {songs.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={busy}
          onClick={() => setPicked(s)}
          className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">music_note</span>
            <span className="min-w-0 flex-1 truncate font-label-md text-label-md font-bold text-on-surface">{s.title}</span>
            {s.tags.caution && <span className="material-symbols-outlined text-[16px] text-warm-yellow" title={s.tags.caution}>warning</span>}
          </div>
          <div className="font-caption text-caption text-on-surface-variant">
            {s.artist} · {s.levelNote}
          </div>
          <div className="flex flex-wrap gap-1">
            {s.themes.map((th) => (
              <span key={th} className="rounded-full bg-primary/10 px-2 py-0.5 font-caption text-[11px] text-primary">
                {th}
              </span>
            ))}
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-[11px] text-on-surface-variant">{t('songs.draft')}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
