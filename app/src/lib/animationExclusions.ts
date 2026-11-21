import sources from '../data/animationExcludedSources.json';

/** Originals explicitly removed by the teacher after confirmed playback failures. */
export const excludedAnimationSources=new Set(sources.map(source=>source.youtubeId));
