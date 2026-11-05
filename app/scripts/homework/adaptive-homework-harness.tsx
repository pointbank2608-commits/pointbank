import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Route,Routes} from 'react-router-dom';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import AdaptiveHomeworkComposer from '../../src/components/homework/teacher/AdaptiveHomeworkComposer';
import AdaptiveHomeworkResults from '../../src/components/homework/teacher/AdaptiveHomeworkResults';
import AdaptiveHomeworkResearch from '../../src/components/admin/AdaptiveHomeworkResearch';
import StudentPortalPage from '../../src/pages/StudentPortalPage';
import StudentSoloPage from '../../src/pages/StudentSoloPage';

void i18n.changeLanguage('ko');
const academyId='10000000-0000-4000-8000-000000000001',classId='30000000-0000-4000-8000-000000000001';
if(location.pathname.startsWith('/s'))localStorage.setItem('classbank.studentToken','50000000-0000-4000-8000-000000000001');
function Teacher(){
 const [show,setShow]=useState(true),[revision,setRevision]=useState(0);
 return <main className="mx-auto max-w-4xl space-y-5 p-4">{show?<AdaptiveHomeworkComposer academyId={academyId} classId={classId} onClose={()=>setShow(false)} onCreated={()=>{setShow(false);setRevision(r=>r+1);}}/>:<p role="status">숙제를 배정했어요.</p>}<AdaptiveHomeworkResults classId={classId} revision={revision}/></main>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes><Route path="/s" element={<StudentPortalPage/>}/><Route path="/s/homework/:assignmentId" element={<StudentSoloPage homework/>}/><Route path="/research" element={<main className="mx-auto max-w-4xl p-4"><AdaptiveHomeworkResearch/></main>}/><Route path="*" element={<Teacher/>}/></Routes></BrowserRouter>);
