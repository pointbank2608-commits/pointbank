import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../../AccessibleDialog';
import { fetchStudentsOfClass } from '../../../lib/api';
import type { Student } from '../../../lib/types';
import { reissuePublication, loadPublication, revisePublication, type PublishedHomework } from '../../../lib/homework/blockApi';
import { newDraft, type HomeworkDraft } from '../../../lib/homework/blocks';
import { publicationGroups, publicationIssues, type PublicationRow } from '../../../lib/homework/publishedActivityGroups';
import { activityCardCount, activityCountLabel } from '../../../lib/homework/activityGroups';
import { estimateMinutes } from '../../../lib/homework/build';
import { guidedDeadline } from '../../../lib/homework/deadline';
import { addDays, kstToday } from '../../wordMemoryProject/model';
import { QuestionEditor } from './HomeworkBlockEditor';
import PublishedActivityPicker from './PublishedActivityPicker';

type Mode = 'edit' | 'reissue';
type Activity = HomeworkDraft['items'][number];
const field = 'mt-1 block min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2';
const button = 'min-h-11 rounded-xl border border-outline-variant px-4 font-bold';

export default function PublishedHomeworkDialog({ id, initialMode, onClose, onSaved }: {
  id: string; initialMode: Mode; onClose: () => void; onSaved: (newId?: string, code?: string) => void;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = (ko: string, english: string) => en ? english : ko;
  const [original, setOriginal] = useState<PublishedHomework>();
  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [rows, setRows] = useState<PublicationRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const recipientsRef = useRef<HTMLLegendElement>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const receipt = useRef<{ key: string; request: string; draft: HomeworkDraft } | null>(null);
  const copying = mode === 'reissue';
  const heading = copying ? l('숙제 재발행', 'Reissue homework') : l('발행한 숙제 수정', 'Edit published homework');
  const originalDay = original?.due ? kstToday(new Date(original.due)) : '';
  const items = rows.map(row => row.item);
  const groups = publicationGroups(rows);
  const rounds = original?.shortRepeat?.minimum ?? 1;
  const duration = (minutes: number) => l(`약 ${minutes}분`, `about ${minutes} min`);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (copying && original && initialMode === 'edit') recipientsRef.current?.focus();
  }, [copying, initialMode, original]);

  useEffect(() => {
    let active = true;
    setOriginal(undefined);
    setError('');
    setNeedsReload(false);
    (async () => {
      const data = await loadPublication(id);
      const roster = await fetchStudentsOfClass(data.classId);
      if (!active) return;
      const dueDay = data.due ? kstToday(new Date(data.due)) : '';
      setOriginal(data); setTitle(data.title);
      setRows(data.items.map((item, index) => ({ key: data.itemIds[index], item })));
      setExpanded(null); setAdding(false);
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
  function updateItem(key: string, next: Activity) {
    setRows(current => current.map(row => row.key === key ? { ...row, item: next } : row));
  }
  function moveActivity(from: number, to: number) {
    if (from === to || to < 0 || to >= groups.length) return;
    const next = [...groups];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRows(next.flatMap(group => group.rows));
  }
  async function save() {
    if (!original || lock.current) return;
    const name = title.trim();
    setNeedsReload(false);
    if (!name) { setError(l('숙제 이름을 입력해 주세요.', 'Enter a homework title.')); return; }
    const due = original.due && day === originalDay && (!copying || Date.parse(original.due) > Date.now()) ? original.due : guidedDeadline(day);
    if (copying && (!targets.length || (due && Date.parse(due) <= Date.now()))) {
      setError(l('학생을 선택하고 마감일을 오늘 이후로 정하거나 비워 주세요.', 'Select students and choose today or a later due date, or clear it.'));
      return;
    }
    if (copying || items.length !== original.items.length || items.some((item, i) => item !== original.items[i])) {
      const issues = publicationIssues(groups);
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
        const result = await reissuePublication(id, receipt.current.draft, recipients, due || '', receipt.current.request);
        onSaved(result.id, result.code);
      } else {
        await revisePublication(id, original.version, name, due || null, items, rows.map(row => original.itemIds.includes(row.key) ? row.key : null));
        onSaved();
      }
    } catch (cause) {
      const msg = String((cause as {message?: string})?.message);
      setNeedsReload(msg.includes('publication_changed'));
      setError(msg.includes('publication_changed') ? l('다른 창에서 숙제가 변경됐어요. 최신 내용을 다시 불러와 주세요.', 'This homework has changed. Reload the latest version.')
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
          : original.started ? l('활동을 추가하거나 빼고 저장하면 진행 중인 학생은 다음에 열 때 새 구성을 봐요. 이미 제출한 학생의 결과는 보관돼요.', 'Students still working will see the revised activities when they reopen the homework. Submitted results are preserved.')
          : l('기존 숙제 번호와 대상 학생을 유지하면서 내용을 수정해요.', 'Save changes to the existing assignment for the same students.')}</p>
        <label className="block">{l('숙제 이름','Title')}<input className={field} value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label className="block">{l('마감일 (선택)','Due date (optional)')}<input type="date" className={field} min={copying ? kstToday() : undefined} value={day} onChange={e=>setDay(e.target.value)} /></label>
        {original.closed && !copying && <p>{l('닫힌 숙제예요. 학생에게 다시 내려면 재발행해 주세요.', 'This assignment is closed. Reissue it to assign it again.')}</p>}
        {copying && <fieldset><legend tabIndex={-1} ref={recipientsRef} className="font-bold">{l('대상 학생','Recipients')}</legend>
          <div className="flex flex-wrap gap-2">{students.map(s=><label className="flex min-h-11 items-center gap-2 px-2" key={s.id}>
            <input type="checkbox" checked={targets.includes(s.id)} onChange={e=>setTargets(e.target.checked ? [...targets,s.id] : targets.filter(x=>x!==s.id))}/>{s.name}</label>)}</div>
        </fieldset>}
        <section className="space-y-3" aria-label={l('선택된 활동','Selected activities')}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-bold">{l('선택된 활동','Selected activities')} ({groups.length})</h3>
            <p className="font-bold text-deep-navy">{l('전체 예상 시간','Estimated total')} · {duration(estimateMinutes(items, rounds))}</p>
          </div>
          {rounds > 1 && <p className="text-sm text-on-surface-variant">
            {l(`필수 ${rounds}회 기준 · 1회 ${duration(estimateMinutes(items))}`, `${rounds} required rounds · ${duration(estimateMinutes(items))} per round`)}
          </p>}
          {original.shortRepeat?.threshold != null && <p className="text-sm text-on-surface-variant">
            {l(`정답률이 ${original.shortRepeat.threshold}% 이하면 추가 반복 시간이 필요해요.`, `Allow extra time for more rounds if accuracy is ${original.shortRepeat.threshold}% or lower.`)}
          </p>}
          <ol className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
          {groups.map(({key, rows: members}, index) => {
            const item = members[0].item;
            const groupItems = members.map(row => ({...row.item,id:row.key}));
            const groupCount = groupItems.reduce((n,entry) => n + activityCardCount(entry), 0);
            const memberKeys = new Set(members.map(row => row.key));
            return <li key={key} className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><strong className="break-words">{index+1}. {item.title || item.kind}</strong>
                <div className="flex flex-wrap gap-x-2 text-sm text-on-surface-variant">
                  {(item.config.block?.materialName || item.config.materialList?.name) && <span>{item.config.block?.materialName || item.config.materialList?.name}</span>}
                  {key.startsWith('group:') ? <span>{activityCountLabel(groupItems[0], groupCount, en)}</span> :
                    item.content.questions.length > 0 && <span>{l(`문제 ${item.content.questions.length}개`, `${item.content.questions.length} questions`)}</span>}
                  <span>{duration(estimateMinutes(groupItems))}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {groups.length > 1 && <label className="flex flex-col text-xs font-bold text-on-surface-variant">
                  {l('순서','Order')}
                  <select className="min-h-11 rounded-xl border border-outline-variant bg-white px-2 text-sm"
                    aria-label={l(`${index+1}. ${item.title || item.kind} 순서`, `Position of ${index+1}. ${item.title || item.kind}`)}
                    value={index} onChange={e=>moveActivity(index,Number(e.target.value))}>
                    {groups.map((_, i) => <option key={i} value={i}>{l(`${i+1}번째`, String(i+1))}</option>)}
                  </select>
                </label>}
                <button type="button" className={button+' shrink-0'} aria-expanded={expanded === key} aria-label={`${index+1}. ${item.title || item.kind} ${expanded === key ? l('접기','Collapse') : l('펼치기','Expand')}`}
                  onClick={()=>setExpanded(expanded === key ? null : key)}>{expanded === key ? l('접기','Collapse') : l('펼치기','Expand')}</button>
              </div>
            </div>
            <button type="button" className="min-h-11 px-2 text-sm font-bold text-error disabled:opacity-40"
              disabled={groups.length <= 1} aria-label={l(`${index+1}. ${item.title || item.kind} 빼기`, `Remove ${index+1}. ${item.title || item.kind}`)}
              onClick={()=>{setRows(rows.filter(row=>!memberKeys.has(row.key)));if(expanded===key)setExpanded(null);}}>{l('활동 빼기','Remove activity')}</button>
          {expanded === key && <fieldset className="mt-3 min-w-0 space-y-3 border-t border-outline-variant pt-3">
            <label className="block">{l('활동 이름','Activity name')}<input className={field} value={item.title} onChange={e=>{
              const title = e.target.value;
              setRows(current=>current.map(row=>memberKeys.has(row.key) ? {...row,item:{...row.item,title}} : row));
            }}/></label>
            {members.map((row, cardIndex) => <div key={row.key} className="space-y-2">
              {members.length > 1 && <strong>{l(`카드 ${cardIndex+1}`, `Card ${cardIndex+1}`)}</strong>}
              <ActivityFields item={row.item} en={en} onChange={next=>updateItem(row.key,next)}/>
            </div>)}
          </fieldset>}
          </li>;})}
          </ol>
          <button type="button" className={button+' w-full text-primary'} disabled={groups.length>=60} onClick={()=>setAdding(true)}>{l('+ 활동 추가','+ Add activity')}</button>
          {adding && <PublishedActivityPicker classId={original.classId} en={en} onClose={()=>setAdding(false)}
            onAdd={next=>{const row = {key: crypto.randomUUID(), item: next}; setRows(current=>[...current,row]);setExpanded(null);setAdding(false);setError('');}}/>}
        </section>
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-outline-variant bg-white py-2">
          <button type="button" className={button+' bg-primary text-white'} onClick={()=>void save()}>{busy ? l('저장 중…','Saving…') : copying?l(`학생 ${targets.length}명에게 재발행`,`Reissue to ${targets.length} students`):l('수정 저장','Save changes')}</button>
          {!copying && <button type="button" className={button} onClick={switchToCopy}>{l('재발행 설정 열기','Open reissue settings')}</button>}
        </div>
      </fieldset>}
      {error && <div role="alert" tabIndex={-1} ref={errorRef} className="space-y-2"><p>{error}</p>{(!original || needsReload) && <button type="button" className={button} disabled={busy} onClick={()=>setReload(n=>n+1)}>{l('최신 내용 다시 불러오기','Reload latest version')}</button>}</div>}
    </div>
  </AccessibleDialog>;
}

function ActivityFields({ item, en, onChange }: { item: Activity; en: boolean; onChange: (item: Activity) => void }) {
  const block = item.config.block;
  const lines = item.content.lines ?? [];
  function editLine(index: number, text: string) {
    const config = block?.method === 'material:echo' ? {...item.config,block:{...block,text}} : item.config;
    onChange({...item,config,content:{...item.content,lines:lines.map((line,i)=>i===index ? {...line,en:text} : line)}});
  }
  return <>
    {block && block.type !== 'recall' && block.method !== 'material:echo' && <label className="block">
      {en ? 'Activity text' : '학습 내용'}
      <textarea rows={4} className={field} value={block.text}
        onChange={e=>onChange({...item,config:{...item.config,block:{...block,text:e.target.value}}})}/>
    </label>}
    {lines.map((line,index)=><label className="block" key={index}>{en ? 'Line' : '대사'} {index+1}
      <input className={field} value={line.en} onChange={e=>editLine(index,e.target.value)}/>
    </label>)}
    {(item.content.questions.length > 0 || block?.type === 'recall') && <QuestionEditor
      items={item.content.questions} en={en} maxQuestions={Math.max(100,item.content.questions.length)}
      onChange={questions=>onChange({...item,content:{...item.content,questions}})}/>}
  </>;
}
