import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import SoloPreview from '../../src/components/solo/SoloPreview';
import SoloPlayer, { type SoloPlayerApi } from '../../src/components/solo/SoloPlayer';
import SoloCatalogModal from '../../src/components/solo/SoloCatalogModal';
import { ToastProvider } from '../../src/context/ToastContext';
import { MemoryRouter } from 'react-router-dom';
import { buildLibrarySoloVideoTemplate, ICE_SKATING_CLIP_ID, videoDraftSteps, videoSelectedSteps } from '../../src/lib/soloVideoTemplate';
import { gradeSoloLocal, soloCorrectText, toPublicStep } from '../../src/lib/soloLessons';
import { gradeTestLocal } from '../../src/lib/soloTest';
import { buildCaillouCourseDraft } from '../../src/lib/caillouVideoCourse';
import { DEFAULT_CAILLOU_GAMES, videoReviewChoices, videoReviewSteps } from '../../src/lib/videoReviewGames';

const query = new URLSearchParams(location.search);
const lesson = buildLibrarySoloVideoTemplate({
    id: ICE_SKATING_CLIP_ID, youtube_id: 'O37zFRCQhEQ', title: 'Caillou Goes Ice Skating',
    start_sec: 12.8, end_sec: 223.6, hidden: false,
});
if (!lesson) throw new Error('Library video has no usable evidence');
const startAt = Number(query.get('step')) || 0;
const draft = query.has('short') ? lesson : buildCaillouCourseDraft(10, 0, lesson) ?? lesson;
const selectedGames = query.has('soloGames')
  ? { ...DEFAULT_CAILLOU_GAMES, gameshowquiz: true, tugofwar: true, wordhoops: true, catchsentence: true }
  : DEFAULT_CAILLOU_GAMES;
const games = draft.finalReview
  ? videoReviewSteps(videoReviewChoices(videoSelectedSteps(draft)), selectedGames, i18n.getFixedT('ko'))
  : [];
const steps = videoDraftSteps(draft, draft.defaultExcluded, games);
const studentApi: SoloPlayerApi = {
  answer: async (index, value) => {
    document.body.dataset.lastAnswer = String(index);
    return gradeSoloLocal(steps[index], value) ?? false;
  },
  advance: async (index, unsure) => {
    document.body.dataset.lastAdvance = String(index);
    return { answer: unsure ? soloCorrectText(steps[index]) : null };
  },
  reveal: async index => soloCorrectText(steps[index]),
  submitTest: async (_index, answers) => gradeTestLocal([], answers),
};
void i18n.changeLanguage('ko').then(() => {
  createRoot(document.getElementById('root')!).render(
    query.has('teacher')
      ? <MemoryRouter><ToastProvider><SoloCatalogModal academyId="preview" onClose={() => {}}
          initialVideoDraft={query.has('library') ? { draft: lesson, source: `verified-video-${ICE_SKATING_CLIP_ID}-v7`, caillouCourse: !query.has('short') } : undefined}
          onBatch={async lessons => { document.body.dataset.savedSteps = JSON.stringify(lessons[0]?.steps); }}
          onScratch={async () => {}} /></ToastProvider></MemoryRouter>
      : query.has('student')
        ? <SoloPlayer steps={steps.map(toPublicStep)} api={studentApi} startAt={startAt} onExit={() => window.location.assign(location.pathname)} />
        : <SoloPreview steps={steps} startAt={startAt} onClose={() => window.location.assign(location.pathname)} />,
  );
});
