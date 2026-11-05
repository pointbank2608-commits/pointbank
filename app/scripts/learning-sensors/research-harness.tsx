import {createRoot} from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import AdminLearningPage from '../../src/pages/AdminLearningPage';
void i18n.changeLanguage(new URLSearchParams(location.search).get('lang')==='en'?'en':'ko');
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-[1280px] p-4 md:p-8"><p className="mb-3 text-xs font-bold text-on-surface-variant">합성 데이터 검증 화면 · 운영 데이터 아님</p><AdminLearningPage/></main>);
