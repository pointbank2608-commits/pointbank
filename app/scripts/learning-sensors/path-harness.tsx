import {createRoot} from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import LearningPathStudio from '../../src/components/solo/LearningPathStudio';
import LearningPathPlayer from '../../src/components/solo/LearningPathPlayer';
void i18n.changeLanguage('ko');
const mode=new URLSearchParams(location.search).get('mode');
const ac='10000000-0000-4000-8000-000000000001',cl='30000000-0000-4000-8000-000000000001';
createRoot(document.getElementById('root')!).render(mode==='student'?<LearningPathPlayer token="synthetic" assignment="70000000-0000-4000-8000-000000000001" title="샘플 단어 수업" onExit={()=>{document.body.dataset.exited='yes';}}/>:<div className="mx-auto max-w-6xl p-4"><LearningPathStudio academyId={ac} classId={cl}/></div>);
