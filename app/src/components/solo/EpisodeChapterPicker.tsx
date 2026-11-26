import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { sourceTime } from '../../lib/animationSources';
import type { EpisodeChapter } from '../../lib/animationEpisodes';

type Props = {
  chapters: Pick<EpisodeChapter, 'title' | 'start' | 'end' | 'intent'>[];
  episodeStart: number;
  selected: number[];
  onToggle: (index: number) => void;
  legend: string;
  notice?: string;
  playback?: { active: number; ready: boolean; play: (index: number) => void };
};

export default function EpisodeChapterPicker({ chapters, episodeStart, selected, onToggle, legend, notice, playback }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return <fieldset className="grid max-h-[480px] min-w-0 gap-2 md:grid-cols-3 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-4">
    <legend className="px-1 font-bold">{legend}</legend>
    {notice && <p className="text-sm text-on-surface-variant">{notice}</p>}
    {chapters.map((chapter, index) => {
      const checked = selected.includes(index);
      const highlighted = playback ? playback.active === index : checked;
      const content = <>
        <span className="block text-xs text-on-surface-variant">{sourceTime(chapter.start - episodeStart)}–{sourceTime(chapter.end - episodeStart)}</span>
        <span className="font-bold">{chapter.title}</span>
        {chapter.intent && <small className="mt-1 block text-on-surface-variant">{chapter.intent}</small>}
      </>;
      const inputId = id + '-' + index;
      return <div key={chapter.start} className={'flex items-center gap-3 rounded-xl border p-3 ' + (highlighted ? 'border-primary bg-sky-50' : 'border-outline-variant')}>
        <input id={inputId} aria-label={playback ? t('animationSolo.selectChapter', { title: chapter.title }) : chapter.title} type="checkbox" checked={checked} onChange={() => onToggle(index)}/>
        {playback
          ? <button type="button" disabled={!playback.ready} onClick={() => playback.play(index)} className="min-h-11 min-w-0 flex-1 text-left disabled:opacity-60">{content}</button>
          : <label htmlFor={inputId} className="min-h-11 min-w-0 flex-1 cursor-pointer text-left">{content}</label>}
      </div>;
    })}
  </fieldset>;
}
