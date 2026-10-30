import type { TFunction } from 'i18next';
import type { RunnerStep } from '../context/LessonRunnerContext';
import type { VideoClip } from './videoClips';
import { extractYoutubeId } from './youtube';

/** Display-only: catalogue titles describe the source, not the activity. */
export function lessonActivityLabel(step: RunnerStep, clips: VideoClip[], t: TFunction): string {
  const keys: Record<string,string> = {shadow:'mediaV2.generalVideo',video:'mediaV2.generalVideo',qna:'mediaV2.questions',wordshow:'mediaV2.words',drill:'mediaV2.drill',reading:'curriculum.reading.defaultTitle'};
  const key=keys[step.kind];
  if(!key)return step.label;
  const title=step.activityTitle?.trim() || (['shadow','qna','drill','reading'].includes(step.kind)?step.label.trim():undefined);
  const inherited=!!title&&clips.some(clip=>clip.title.trim()===title&&(clip.id===step.sourceClipId||clip.youtube_id===extractYoutubeId(step.sourceVideoUrl||'')||!step.sourceClipId&&!step.sourceVideoUrl));
  const defaults=['curriculum.shadow.defaultTitle','curriculum.reading.defaultTitle','qna.title','drill.title'].map(k=>t(k));
  return title&&!inherited&&!defaults.includes(title)?title:t(key);
}
