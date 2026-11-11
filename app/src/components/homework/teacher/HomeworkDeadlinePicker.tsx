import { useState } from 'react';
import AccessibleDialog from '../../AccessibleDialog';
import { formatHomeworkDeadline, guidedDeadline } from '../../../lib/homework/deadline';

function todayInKorea() {
  const fields = new Intl.DateTimeFormat('en', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts();
  return ['year','month','day'].map(type => fields.find(field => field.type === type)?.value).join('-');
}

export default function HomeworkDeadlinePicker({ value, onChange, en }: { value:string; onChange:(value:string)=>void; en:boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [month, setMonth] = useState('');
  const today = todayInKorea();
  const open = () => {
    const day = value.slice(0,10) || today;
    setMonth(day.slice(0,7));
    setDraft(day);
  };
  const first = new Date(month ? month+'-01T00:00:00Z' : today+'T00:00:00Z');
  const shift = (by:number) => {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth()+by,1);
    setMonth(next.toISOString().slice(0,7));
  };
  const days = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const label = en?'Deadline · optional':'마감일 · 선택';
  return <div className="hw-compose-label">
    <span>{label}</span>
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-label={label} onClick={open}>
        <span className="material-symbols-outlined mr-2 align-middle" aria-hidden>calendar_month</span>
        {value ? formatHomeworkDeadline(value,en?'en':'ko') : en?'Choose a date':'날짜 선택'}
      </button>
      {value && <button type="button" onClick={()=>onChange('')}>{en?'Clear':'지우기'}</button>}
    </div>
    <span className="hw-muted">{en?'New dates close at the end of that day in Korea.':'새로 고른 날짜는 한국 시간 기준 그날 끝까지 제출할 수 있어요.'}</span>
    {draft !== null && <AccessibleDialog label={label} onClose={()=>setDraft(null)}>
      <div className="hw-composer w-[min(23rem,calc(100vw-2rem))] !p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label={en?'Previous month':'이전 달'} onClick={()=>shift(-1)}>‹</button>
          <strong aria-live="polite">{first.toLocaleDateString(en?'en':'ko',{year:'numeric',month:'long',timeZone:'UTC'})}</strong>
          <button type="button" aria-label={en?'Next month':'다음 달'} onClick={()=>shift(1)}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {(en?['Su','Mo','Tu','We','Th','Fr','Sa']:['일','월','화','수','목','금','토']).map(day=><span key={day}>{day}</span>)}
          {Array.from({length:first.getUTCDay()},(_,i)=><span key={'gap'+i}/>)}
          {Array.from({length:days},(_,i)=>{
            const day=month+'-'+String(i+1).padStart(2,'0');
            return <button key={day} type="button" aria-label={day} aria-pressed={draft===day} aria-current={day===today?'date':undefined}
              disabled={day<today&&day!==value.slice(0,10)} onClick={()=>setDraft(day)}
              className={day===today?'hw-today !p-1':draft===day?'hw-selected-day !p-1':'!p-1'}>{i+1}</button>;
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={()=>setDraft(null)}>{en?'Cancel':'취소'}</button>
          <button type="button" className="hw-primary" onClick={()=>{if(draft!==value.slice(0,10))onChange(guidedDeadline(draft));setDraft(null);}}>{en?'Done':'완료'}</button>
        </div>
      </div>
    </AccessibleDialog>}
  </div>;
}
