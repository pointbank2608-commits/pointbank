import {createRoot} from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import StudentPortalPage from '../../src/pages/StudentPortalPage';
import LearningRunCoverage from '../../src/components/admin/LearningRunCoverage';
void i18n.changeLanguage('ko');
const mode=new URLSearchParams(location.search).get('mode');
if(mode==='portal')localStorage.setItem('classbank.studentToken','synthetic-token');
createRoot(document.getElementById('root')!).render(mode==='portal'?<StudentPortalPage/>:<div className="mx-auto max-w-4xl p-4"><LearningRunCoverage/></div>);
