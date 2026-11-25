import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../../AccessibleDialog';
import { fetchStudentsOfClass } from '../../../lib/api';
import type { Student } from '../../../lib/types';
import { assignDraft, loadPublication, revisePublication, type PublishedHomework } from '../../../lib/homework/blockApi';
import { newBlock, newDraft, validateItems, type HomeworkDraft } from '../../../lib/homework/blocks';
import { guidedDeadline } from '../../../lib/homework/deadline';
import { addDays, kstToday } from '../../wordMemoryProject/model';
import { QuestionEditor } from './HomeworkBlockEditor';

type Mode = 'edit' | 'reissue';
const field = 'mt-1 block min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2';
const button = 'min-h-11 rounded-xl border border-outline-variant px-4 font-bold';

export default function PublishedHomeworkDialog({ id, initialMode, onClose, onSaved }: {
  id: string; initialMode: Mode; onClose: () => void; onSaved: (newId?: string) => void;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = (ko: string, english: string) => en ? english : ko;
  const [original, setOriginal] = useState<PublishedHomework>();
  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [items, setItems] = useState<HomeworkDraft['items']>([]);
  const [selected, select] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const receipt = useRef<{ key: string; request: string; draft: HomeworkDraft } | null>(null);
  const copying = mode === 'reissue';
  const heading = copying ? l('숙제 재발행', 'Reissue homework') : l('발행한 숙제 수정', 'Edit published homework');
  const canEditContent = copying || !original?.started;
  const item = items[selected];
  const originalDay = original?.due ? kstToday(new Date(original.due)) : '';

  useEffect(() => {
    let active = true;
    setOriginal(undefined);
    setError('');
    (async () => {
      const data = await loadPublication(id);
      const roster = await fetchStudentsOfClass(data.classId);
      if (!active) return;
      const dueDay = data.due ? kstToday(new Date(data.due)) : '';
      setOriginal(data); setTitle(data.title); setItems(data.items); select(0);
      setMode(initialMode);
      setDay(initialMode === 'reissue' && data.due && Date.parse(data.due) <= Date.now() ? addDays(kstToday(), 1) : dueDay);
      setStudents(roster); setTargets(roster.filter(s => data.students.includes(s.id)).map(s => s.id));
    })().catch(() => { if (active) setError(en ? 'Could not load this assignment.' : '발행한 숙제를 불러오지 못했어요.'); });
    return () => { active = false; };
  }, [id, initialMode, reload, en]);

  function switchToCopy() {
    setMode('reissue'); setError('');
    if (day && day <= kstToday()) setDay(addDays(kstToday(), 1));
  }
  function updateItem(next: typeof item) {
    setItems(current => current.map((row, index) => index === selected ? next : row));
  }
  async function save() {
    if (!original || lock.current) return;
    const name = title.trim();
    if (!name) { setError(l('숙제 이름을 입력해 주세요.', 'Enter a homework title.')); return; }
    const due = original.due && day === originalDay && (!copying || Date.parse(original.due) > Date.now()) ? original.due : guidedDeadline(day);
    if (copying && (!targets.length || (due && Date.parse(due) <= Date.now()))) {
      setError(l('학생을 선택하고 마감일을 오늘 이후로 정하거나 비워 주세요.', 'Select students and choose today or a later due date, or clear it.'));
      return;
    }
    if (copying || original.items !== items) {
      const issues = validateItems(items);
      if (issues.length) { setError(issues[0]); return; }
      if (original.shortRepeat && !items.some(i => i.config.block?.type === 'recall' && i.content.questions.length)) {
        setError(l('반복 조건을 적용할 채점 문제를 한 개 이상 남겨 주세요.', 'Keep a graded recall question for the repeat condition.')); return;
      }
    }
    lock.current = true; setBusy(true); setError('');
    try {
      if (copying) {
        const recipients = [...targets].sort();
        const key = JSON.stringify([name, items, recipients, due]);
        if (receipt.current?.key !== key) receipt.current = { key, request: crypto.randomUUID(), draft: {
          ...newDraft(), title: name, items, shortRepeat: original.shortRepeat ?? undefined,
        }};
        const result = await assignDraft(original.classId, receipt.current.draft, recipients, due || '', receipt.current.request);
        onSaved(result.id);
      } else {
        await revisePublication(id, original.version, name, due || null, items);
        onSaved();
      }
    } catch (cause) {
      const msg = String((cause as {message?: string})?.message);
      setError(msg.includes('publication_started') ? l('편집 중 학생이 시작했어요. 변경한 내용으로 재발행할 수 있어요.', 'A student has started. Reissue your edited copy.')
        : msg.includes('publication_changed') ? l('다른 창에서 숙제가 변경됐어요. 최신 내용을 다시 불러와 주세요.', 'This homework has changed. Reload the latest version.')
        : l('저장하지 못했어요. 연결과 입력 내용을 확인한 뒤 다시 시도해 주세요.', 'Could not save. Check your connection and entries, then retry.'));
    } finally { lock.current = false; setBusy(false); }
  }

  return <AccessibleDialog label={heading} onClose={() => { if (!lock.current) onClose(); }}>
    <div className="space-y-4 p-5">
      <header className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{heading}</h2>
        <button type="button" className={button} disabled={busy} onClick={onClose}>{l('닫기','Close')}</button></header>
      {!original && !error && <p role="status">{l('숙제를 불러오는 중…','Loading homework…')}</p>}
      {original && <fieldset disabled={busy} className="min-w-0 space-y-4">
        <p>{copying ? l('원본과 학습 기록을 보관하고, 선택한 학생에게 새 숙제 번호로 배정해요.', 'Keep the original and its results. Selected students receive a new assignment code.')
          : original.started ? l('학생이 시작한 숙제는 이름과 마감일을 수정할 수 있어요. 문제를 바꾸려면 재발행해 주세요.', 'Students have started. You can edit the title and deadline, or reissue to change the activities.')
          : l('기존 숙제 번호와 대상 학생을 유지하면서 내용을 수정해요.', 'Save changes to the existing assignment for the same students.')}</p>
        <label className="block">{l('숙제 이름','Title')}<input className={field} value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label className="block">{l('마감일 (선택)','Due date (optional)')}<input type="date" className={field} min={copying ? kstToday() : undefined} value={day} onChange={e=>setDay(e.target.value)} /></label>
        {original.closed && !copying && <p>{l('닫힌 숙제예요. 학생에게 다시 내려면 재발행해 주세요.', 'This assignment is closed. Reissue it to assign it again.')}</p>}
        {copying && <fieldset><legend className="font-bold">{l('대상 학생','Recipients')}</legend>
          <div className="flex flex-wrap gap-2">{students.map(s=><label className="flex min-h-11 items-center gap-2 px-2" key={s.id}>
            <input type="checkbox" checked={targets.includes(s.id)} onChange={e=>setTargets(e.target.checked ? [...targets,s.id] : targets.filter(x=>x!==s.id))}/>{s.name}</label>)}</div>
        </fieldset>}
        {canEditContent && <section className="space-y-3 rounded-xl border border-outline-variant p-3">
          <label className="block font-bold">{l('편집할 활동','Activity to edit')}<select className={field} value={selected} onChange={e=>select(Number(e.target.value))}>
            {items.map((it,i)=><option key={i} value={i}>{i+1}. {it.title || it.kind}</option>)}</select></label>
          {item && <div key={selected} className="space-y-3">
            <label className="block">{l('활동 이름','Activity name')}<input className={field} value={item.title} onChange={e=>updateItem({...item,title:e.target.value})}/></label>
            {item.config.block && item.config.block.type !== 'recall' && <label className="block">{l('학습 내용','Activity text')}
              <textarea rows={4} className={field} value={item.config.block.text} onChange={e=>updateItem({...item,config:{...item.config,block:{...item.config.block!,text:e.target.value}}})}/></label>}
            {item.content.lines?.map((line,i)=><label className="block" key={i}>{l('대사','Line')} {i+1}
              <input className={field} value={line.en} onChange={e=>updateItem({...item,content:{...item.content,lines:item.content.lines!.map((ln,j)=>j===i?{...ln,en:e.target.value}:ln)}})}/></label>)}
            {(item.content.questions.length>0 || item.config.block?.type==='recall') && <QuestionEditor items={item.content.questions} en={en}
              maxQuestions={Math.max(100,item.content.questions.length)} onChange={questions=>updateItem({...item,content:{...item.content,questions}})}/>}
            <button type="button" className={button} disabled={items.length<=1} onClick={()=>{setItems(items.filter((_,i)=>i!==selected));select(Math.max(0,selected-1));}}>{l('이 활동 빼기','Remove activity')}</button>
          </div>}
          <button type="button" className={button} onClick={()=>{setItems([...items,newBlock('recall')]);select(items.length);}}>{l('문제 활동 추가','Add a question activity')}</button>
        </section>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button+' bg-primary text-white'} onClick={()=>void save()}>{copying?l('새 숙제로 재발행','Reissue as new homework'):l('수정 저장','Save changes')}</button>
          {!copying && <button type="button" className={button} onClick={switchToCopy}>{l('새 숙제로 재발행하기','Reissue as a new assignment')}</button>}
        </div>
      </fieldset>}
      {error && <div role="alert" className="space-y-2"><p>{error}</p><button type="button" className={button} disabled={busy} onClick={()=>setReload(n=>n+1)}>{l('최신 내용 다시 불러오기','Reload latest version')}</button></div>}
    </div>
  </AccessibleDialog>;
}
