import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AnimationSoloLibrary from '../../src/components/solo/AnimationSoloLibrary';
import { ToastProvider } from '../../src/context/ToastContext';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';

void i18n.changeLanguage('ko').then(() => {
  createRoot(document.getElementById('root')!).render(<MemoryRouter><ToastProvider>
    <main className="mx-auto max-w-7xl space-y-3 p-4">
      <p className="text-sm text-slate-600">라이브러리 영상으로 만든 로컬 미리보기예요. 저장 버튼은 테스트 반에 저장해요.</p>
      <AnimationSoloLibrary academyId="preview" classId="preview-class" teacherId="preview-teacher" />
    </main>
  </ToastProvider></MemoryRouter>);
});
