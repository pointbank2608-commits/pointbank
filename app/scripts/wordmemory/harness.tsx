// 단어암기숙제 브라우저 검증 전용 — 운영 진입점에 포함하지 않는다. 서버 호출(wm_*)만 실제 SQL(PGlite)로 가고, 로그인·반·학생 목록은 합성이다.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import WordMemoryAssignModal from '../../src/components/wordMemory/WordMemoryAssignModal';
import WordMemoryResults from '../../src/components/wordMemory/WordMemoryResults';
import WordMemoryPortalLinks from '../../src/components/wordMemory/WordMemoryPortalLinks';
import WordMemoryStudentPage from '../../src/pages/WordMemoryStudentPage';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';

const params = new URLSearchParams(location.search);
void i18n.changeLanguage(params.get('lang') === 'en' ? 'en' : 'ko');
if (params.get('scale')) document.documentElement.style.fontSize = `${Number(params.get('scale'))}%`;

const CARDS = JSON.parse(sessionStorage.getItem('wm-cards') || '[]');

function Teacher() {
  const [q] = useSearchParams();
  const [open, setOpen] = useState(true);
  const kind = q.get('kind') === 'elementary800' ? 'elementary800' : 'wordlist';
  return (
    <div className="p-4">
      <button type="button" onClick={() => setOpen(true)} data-open-modal>
        열기
      </button>
      {open && <WordMemoryAssignModal source={{ type: kind, id: 'list-1', name: kind === 'elementary800' ? '명사 Level 1' : '내 단어장' }} cards={CARDS} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Results() {
  return (
    <div className="p-4">
      <WordMemoryResults classId="cccccccc-0000-4000-8000-000000000001" />
    </div>
  );
}

function Portal() {
  return (
    <div className="bg-[#16213e] p-4 text-white">
      <WordMemoryPortalLinks token="11111111-1111-4111-8111-111111111111" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/wm/:access" element={<WordMemoryStudentPage />} />
      <Route path="/scripts/wordmemory/harness.html" element={<Teacher />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/results" element={<Results />} />
      <Route path="/portal" element={<Portal />} />
    </Routes>
  </BrowserRouter>,
);
