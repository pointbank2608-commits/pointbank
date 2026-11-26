import { buildCurriculumWords } from '../curriculumWords';
import { animationEpisodeLibrary, type EpisodeChapter } from '../animationEpisodes';
import { wordListToCards } from '../gameFromWords';
import type { FullCardItem, WordBankEntry, WordList } from '../types';
import type { VideoClip } from '../videoClips';
import type { Material } from './materialPlan';

export interface CatalogueMaterial extends Material {
  episode?: { id:string; name:string; start:number };
  chapter?: Pick<EpisodeChapter, 'title' | 'start' | 'end' | 'intent'>;
  school?: { id:string; name:string };
  band?: { id:string; name:string };
}

export function savedMaterials(lists: WordList[]): Material[] {
  return lists.map(list => ({
    id: list.id, name: list.name, kind: list.kind === 'sentence' ? 'sentence' : 'word',
    cards: wordListToCards(list).filter(card => card.word.trim()),
  }));
}

export function sceneMaterials(clips: VideoClip[]): CatalogueMaterial[] {
  return animationEpisodeLibrary(clips).episodes.flatMap(({ episode, chapters, words, source, lines }) =>
    chapters.map((chapter, index) => ({
      id: `${episode.id}/chapter/${index}`, kind: 'scene' as const, name: `${episode.title} · ${chapter.title}`,
      episode: { id: episode.id, name: episode.title, start: episode.start },
      chapter: { title: chapter.title, start: chapter.start, end: chapter.end, intent: chapter.intent },
      cards: words.filter(word => word.chapterIds.includes(index)),
      scene: {
        videoUrl: `https://www.youtube.com/watch?v=${source.youtubeId}`, start: chapter.start, end: chapter.end,
        lines: lines.filter(line => line.start >= chapter.start && line.end <= chapter.end && line.end > line.start && line.en.trim())
          .map(line => ({ s: line.start, e: line.end, en: line.en, ko: line.ko, speaker: line.speaker })),
      },
    })),
  );
}

export function bankCard(entry: WordBankEntry): FullCardItem {
  return { id: entry.id, word: entry.word, meaning: entry.meaning, imageUrl: entry.image_url,
    partOfSpeech: entry.part_of_speech, category: entry.category, example: entry.example_sentence };
}

export function frequentMaterials(bank: WordBankEntry[]): CatalogueMaterial[] {
  return buildCurriculumWords(bank).filter(school => school.id !== 'high').flatMap(school =>
    school.bands.filter(band => band.id !== 'moe800').flatMap(band =>
      band.units.map(unit => ({
        id: `curriculum:${school.id}:${band.id}:${unit.id}`, kind: 'frequent' as const,
        name: [school.ko, band.label, unit.label].join(' → '),
        school: { id: school.id,name: school.ko }, band: { id: band.id, name: band.label },
        cards: unit.sets.flatMap(set => set.entries.map(bankCard)),
      })),
    ),
  );
}
