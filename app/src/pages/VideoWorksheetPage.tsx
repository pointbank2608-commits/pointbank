import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVideoClips, type VideoClip } from '../lib/videoClips';
import { parseShadowText } from '../lib/shadowLines';
import '../styles/ready-class-workbook.css';
import '../styles/video-worksheet.css';

const groups = [
  { id: 'words', label: '단어', title: 'Vocabulary', instruction: 'Write the meaning.' },
  { id: 'questions', label: '내용 질문', title: 'Comprehension', instruction: 'Answer in a full sentence.' },
  { id: 'shadow', label: '영상 따라하기', title: 'Watch and repeat', instruction: 'Watch, listen, and repeat.' },
] as const;
type Group = typeof groups[number]['id'];
type Task = { question: string; answer?: string };
type PrintRow = Task & { group: Group; number: number };

function paginate(rows: PrintRow[], teacher = false) {
  const pages: PrintRow[][] = [];
  let used = 0;
  let current: PrintRow[] = [];
  for (const row of rows) {
    const textLength = row.question.length + (teacher ? row.answer?.length ?? 0 : 0);
    const cost = (teacher ? 13 : row.group === 'questions' ? 27 : 12) + 5 * Math.floor(textLength / 66);
    const limit = pages.length ? 246 : 217;
    const heading = current.at(-1)?.group === row.group ? 0 : 18;
    if (current.length && used + cost + heading > limit) {
      pages.push(current);
      current = [];
      used = 0;
    }
    used += cost + (current.at(-1)?.group === row.group ? 0 : 18);
    current.push(row);
  }
  if (current.length) pages.push(current);
  return pages;
}

function Worksheet({ clip }: { clip: VideoClip }) {
  const {t, i18n} = useTranslation();
  const en = i18n.resolvedLanguage?.startsWith('en');
  const tasks: Record<Group, Task[]> = {
    words: (clip.pack.words ?? []).map(word => ({question:word.word,answer:word.meaning})),
    questions: (clip.pack.questions ?? []).map(q => ({question:q.q,answer:q.a})),
    shadow: parseShadowText(clip.script).map(line => ({question:line.en.replace(/\*\*/g, '')})),
  };
  const [included,setIncluded] = useState<Record<Group,boolean>>({words:true,questions:true,shadow:true});
  const [selected,setSelected] = useState<Record<Group,Set<number>>>(() => ({
    words:new Set(tasks.words.keys()), questions:new Set(tasks.questions.keys()), shadow:new Set(tasks.shadow.keys()),
  }));
  const [teacher,setTeacher] = useState(false);
  const [fonts,setFonts] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => { if (live) setFonts(true); });
    return () => { live = false; };
  }, []);
  const rows = groups.flatMap(({id}) => included[id]
    ? tasks[id].filter((_,index) => selected[id].has(index)).map((task,index) => ({...task,group:id,number:index+1}))
    : []);
  const pages = [
    ...paginate(rows).map(content => ({content,teacher:false})),
    ...(teacher ? paginate(rows.filter(row => row.group !== 'shadow'),true).map(content => ({content,teacher:true})) : []),
  ];
  if (!groups.some(({id}) => tasks[id].length)) return <p role="alert">{t('readyMedia.noWorksheet')}</p>;
  return <section className="rc-workbook animation-worksheet">
    <div className="rc-controls no-print">
      <Link to="/videos">{t('readyMedia.back')}</Link>
      <h1 className="flex-1 text-xl font-bold">{clip.title}</h1>
      <button type="button" data-print disabled={!fonts || !pages.length} onClick={() => window.print()}>{en?'Print':'인쇄하기'}</button>
    </div>
    <div className="animation-worksheet-layout">
      <aside className="no-print">
        <h2>{en?'Choose activities to print':'인쇄할 활동 선택'}</h2>
        {groups.map(group => {
          const {id} = group;
          const label = en ? group.title : group.label;
          return <section key={id}>
            <label className="animation-group-toggle"><input type="checkbox" checked={included[id] && tasks[id].length > 0} disabled={!tasks[id].length}
              onChange={event => setIncluded({...included,[id]:event.target.checked})} /> {label}</label>
            <details>
              <summary>{selected[id].size} / {tasks[id].length} {en?'selected':'선택'}</summary>
              <div className="animation-select-actions">
                <button type="button" onClick={() => { setSelected({...selected,[id]:new Set(tasks[id].keys())}); setIncluded({...included,[id]:true}); }}>{en?'Select all':'전체 선택'}</button>
                <button type="button" onClick={() => setSelected({...selected,[id]:new Set()})}>{en?'Clear':'선택 해제'}</button>
              </div>
              {tasks[id].map((task,index) => <label className="animation-item-toggle" key={index}><input type="checkbox" checked={selected[id].has(index)}
                onChange={event => {
                  const next = new Set(selected[id]);
                  if (event.target.checked) next.add(index); else next.delete(index);
                  setSelected({...selected,[id]:next});
                  if (event.target.checked && !included[id]) setIncluded({...included,[id]:true});
                }} /> <span lang="en">{task.question}</span></label>)}
            </details>
          </section>;
        })}
        <label className="animation-group-toggle"><input type="checkbox" checked={teacher} onChange={event => setTeacher(event.target.checked)} /> {t('readyMedia.teacher')}</label>
      </aside>
      <div className="min-w-0">
        <h2 className="no-print mb-2 font-bold">{en?'A4 print preview':'A4 인쇄 미리보기'} · {pages.length}{en?' pages':'쪽'}</h2>
        <div className="rc-preview">{pages.map((page,index) => <article className="rc-sheet animation-sheet" key={index}>
          {(index === 0 || (page.teacher && !pages[index-1]?.teacher)) && <>
            <h1>{clip.title}</h1>
            {page.teacher ? <h2>{t('readyMedia.teacher')}</h2> : <div className="rc-name">Name <span /> Date <span /></div>}
          </>}
          {groups.map(group => {
            const content = page.content.filter(row => row.group === group.id);
            if (!content.length) return null;
            return <section key={group.id} lang="en">
              <h2>{group.title}</h2>
              {!page.teacher && <p className="animation-instruction">{group.instruction}</p>}
              {content.map(row => <div className={'animation-print-row animation-print-'+group.id} key={row.number}>
                <p>{row.number}. {row.question}</p>
                {page.teacher ? <p className="animation-answer">{row.answer}</p> : group.id === 'words' ? <span className="animation-write-line" /> : group.id === 'questions' ? <><span className="animation-write-line" /><span className="animation-write-line" /></> : null}
              </div>)}
            </section>;
          })}
          <footer><strong>ClassBank</strong><span>{index+1} / {pages.length}</span></footer>
        </article>)}</div>
      </div>
    </div>
  </section>;
}

export default function VideoWorksheetPage() {
  const {t} = useTranslation();
  const [params] = useSearchParams();
  const {clips,error} = useVideoClips();
  const clip = clips?.find(item => item.id === params.get('clip') && !item.pack?.phonicsSong);
  if (error) return <p role="alert">{t('readyMedia.noWorksheet')}</p>;
  if (!clips) return <p>{t('common.loading')}</p>;
  return clip ? <Worksheet key={clip.id} clip={clip} /> : <p role="alert">{t('readyMedia.noWorksheet')}</p>;
}
