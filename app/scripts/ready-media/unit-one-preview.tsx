import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import { availableLessonSlides, courseUnits, courseWord } from '../../src/data/phonicsLessons';
import PhonicsLessonPage from '../../src/pages/PhonicsLessonPage';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';

const units = courseUnits().filter(unit => unit.status === 'confirmed');

function Preview() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const unit = units.find(unit => unit.id === params.get('unit'));
  if (!unit) return <Navigate to={`${pathname}?unit=course-2-1&lesson=1&slide=course-2-1%3A6`} replace />;
  const currentSlide = params.get('slide');
  const slides = availableLessonSlides(unit);
  const demos = [
    { label: '소리 합치기', slide: slides.find(slide => slide.kind === 'builder') },
    { label: '듣고 고르기', slide: slides.find(slide => slide.kind === 'choose' && slide.phase === 0) },
    { label: '단어 분류', slide: slides.find(slide => slide.kind === 'sort' && slide.phase === 0) },
    { label: '혼자 읽기', slide: slides.find(slide => slide.kind === 'readAlone') ?? slides.find(slide => slide.kind === 'memory' && slide.phase === 0 &&
      (unit.id !== 'course-2-1' || courseWord(unit, slide.entryIds[0]).word === 'bag')) },
  ];
  return <main className="mx-auto max-w-7xl p-3 sm:p-5">
    <header className="mb-3 flex flex-wrap items-center gap-3">
      <h1 className="mr-2 font-bold text-[#17385c]">파닉스 Ready Class</h1>
      <label className="flex max-w-full items-center gap-2 text-sm font-bold text-[#17385c]">유닛
        <select className="w-64 min-w-0 rounded-lg border border-[#b8ccdf] bg-white px-2 py-2 md:w-80" value={unit.id}
          onChange={event => navigate(`${pathname}?${new URLSearchParams({ unit: event.target.value, lesson: '1' })}`)}>
          {[1, 2, 3, 4, 5].map(level => <optgroup key={level} label={`${level}단계`}>
            {units.filter(unit => unit.step === level).map(unit => <option key={unit.id} value={unit.id}>{level}단계 Unit {unit.number} · {unit.groups.map(group => group.label).join(' / ')}</option>)}
          </optgroup>)}
        </select>
      </label>
      <nav aria-label="활동 미리보기" className="flex flex-wrap gap-2">
        {demos.map(({ label, slide }) => slide && <Link key={slide.id} aria-current={currentSlide === slide.id ? 'page' : undefined}
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
