import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import SoloPreview from '../../src/components/solo/SoloPreview';
import SoloCatalogModal from '../../src/components/solo/SoloCatalogModal';
import { ToastProvider } from '../../src/context/ToastContext';
import { MemoryRouter } from 'react-router-dom';
import { buildLibrarySoloVideoTemplate, ICE_SKATING_CLIP_ID, videoDraftSteps } from '../../src/lib/soloVideoTemplate';

const query = new URLSearchParams(location.search);
const lesson = buildLibrarySoloVideoTemplate({
    id: ICE_SKATING_CLIP_ID, youtube_id: 'O37zFRCQhEQ', title: 'Caillou Goes Ice Skating',
    start_sec: 12.8, end_sec: 223.6, hidden: false,
});
if (!lesson) throw new Error('Library video has no usable evidence');
const startAt = Number(query.get('step')) || 0;
const steps = videoDraftSteps(lesson);
void i18n.changeLanguage('ko').then(() => {
  createRoot(document.getElementById('root')!).render(
    query.has('teacher')
      ? <MemoryRouter><ToastProvider><SoloCatalogModal academyId="preview" onClose={() => {}}
          initialVideoDraft={query.has('library') ? { draft: lesson, source: `verified-video-${ICE_SKATING_CLIP_ID}-v7`, caillouCourse: !query.has('short') } : undefined}
          onBatch={async lessons => { document.body.dataset.savedSteps = JSON.stringify(lessons[0]?.steps); }}
          onScratch={async () => {}} /></ToastProvider></MemoryRouter>
      : <SoloPreview steps={steps} startAt={startAt} onClose={() => window.location.assign(location.pathname)} />,
  );
});
