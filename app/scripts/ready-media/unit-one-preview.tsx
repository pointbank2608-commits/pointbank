import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import { availableLessonSlides, courseUnits, courseWord } from '../../src/data/phonicsLessons';
import PhonicsLessonPage from '../../src/pages/PhonicsLessonPage';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';

const unit = courseUnits().find(unit => unit.id === 'course-2-1')!;
const slides = availableLessonSlides(unit);
const demos = [
  { label: '소리 합치기', slide: slides.find(slide => slide.kind === 'builder')! },
  { label: '듣고 고르기', slide: slides.find(slide => slide.kind === 'choose' && slide.phase === 0)! },
  { label: '단어 분류', slide: slides.find(slide => slide.kind === 'sort' && slide.phase === 0)! },
  { label: '혼자 읽기', slide: slides.find(slide => slide.kind === 'memory' && slide.phase === 0 && courseWord(unit, slide.entryIds[0]).word === 'bag')! },
];

function Preview() {
  const { pathname, search } = useLocation();
  const currentSlide = new URLSearchParams(search).get('slide');
  return <main className="mx-auto max-w-7xl p-3 sm:p-5">
    <header className="mb-3 flex flex-wrap items-center gap-3">
      <h1 className="mr-2 font-bold text-[#17385c]">파닉스 Ready Class · 2단계 Unit 1</h1>
      <nav aria-label="활동 미리보기" className="flex flex-wrap gap-2">
        {demos.map(({ label, slide }) => <Link key={slide.id} aria-current={currentSlide === slide.id ? 'page' : undefined}
          className="rounded-lg border border-[#b8ccdf] bg-white px-3 py-2 text-sm font-bold text-[#17385c] aria-[current=page]:bg-[#e2efff]"
          to={`${pathname}?${new URLSearchParams({ unit: unit.id, lesson: String(slide.lesson), slide: slide.id })}`}>{label}</Link>)}
      </nav>
    </header>
    <PhonicsLessonPage />
  </main>;
}

void i18n.changeLanguage('ko').then(() => {
  createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Preview /></AuthProvider></BrowserRouter>);
});
