import { useEffect, useRef, useState } from 'react';
import type { Student } from '../../lib/types';
import { parsePathCards, type PathCard } from '../../lib/learningPaths';
import { approveVocab, dismissVocabDraft, type VocabDraft } from '../../lib/vocabLearning';
import { cueLabel, cueModes, nextCueClass, type CueMode, type CueSchedule, type EssentialCue } from '../../lib/vocabCues';
import { EssentialCuePicker, VocabPlanTiming } from './VocabClassSchedule';
import HomeworkDeadlinePicker from '../homework/teacher/HomeworkDeadlinePicker';
import '../../styles/homework-composer.css';

const field = 'w-full rounded-xl border border-outline-variant bg-white px-3 py-3';
const primary = 'min-h-11 rounded-full bg-primary px-4 font-bold text-on-primary disabled:opacity-40';
const secondary = 'min-h-11 rounded-full border border-outline-variant px-4 disabled:opacity-40';

function formatCards(draft: VocabDraft) {
  return draft.cards.map(card => [card.word, card.meaning, card.example].filter(Boolean).join(' | ')).join('\n');
}
const cardKey = (card: Pick<PathCard, 'word' | 'meaning'>) => JSON.stringify([card.word, card.meaning]);
const sentenceKey = (sentence: string) => sentence.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function VocabDraftEditor({ draft, classId, students, sourceCards, en, schedule, onClose, onApproved }: {
  draft: VocabDraft;
  classId: string;
  students: Student[];
  sourceCards: PathCard[];
  en: boolean;
  schedule: CueSchedule | null;
  onClose: () => void;
  onApproved: (kind: VocabDraft['kind']) => void;
}) {
  const l = (ko: string, english: string) => en ? english : ko;
  const homework = draft.kind === 'homework';
  const [title, setTitle] = useState(draft.title);
  const [text, setText] = useState(() => formatCards(draft));
  const [selected, setSelected] = useState(draft.students);
  const [practice, setPractice] = useState<'games' | 'letters' | 'recall'>(draft.games ? 'games' : 'recall');
  const [modes, setModes] = useState<CueMode[]>(draft.cue?.modes ?? []);
  const [essential, setEssential] = useState<EssentialCue[]>(draft.cue?.essential ?? []);
  const [opens, setOpens] = useState(() => draft.cue && !draft.cue.essential?.length ? schedule?.next_review_on ?? '' : '');
  const [nextClass, setNextClass] = useState('');
  const [sentences, setSentences] = useState(() => Object.fromEntries(
    (draft.cue?.contexts ?? []).map(item => [cardKey(item), item.sentence])
  ));
  const [due, setDue] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editor = useRef<HTMLElement>(null);
  const pending = useRef<Parameters<typeof approveVocab>[0] | null>(null);
  useEffect(() => { editor.current?.focus(); }, []);
  useEffect(() => { setConfirmed(false); }, [schedule?.revision]);
  const roster = students.filter(student => selected.includes(student.id)).map(student => student.id);
  const limit = homework ? 8 : 12;
  const cards = (() => {
    if (text === formatCards(draft)) return draft.cards;
    try {
      return parsePathCards(text).map(card => ({
        ...card,
        imageUrl: draft.cards.find(original => original.word === card.word && original.meaning === card.meaning)?.imageUrl,
      }));
    } catch { return []; }
  })();
  const sourceKeys = new Set(sourceCards.map(cardKey));
  const hasSharedGoal = cards.some(card => sourceKeys.has(cardKey(card)));
  const contexts = cards.map(card => ({ word: card.word, meaning: card.meaning, sentence: (sentences[cardKey(card)] ?? '').trim() }));
  const sourceExamples = new Set(sourceCards.map(card => sentenceKey(card.example ?? '')));
  const contextKeys = contexts.map(item => sentenceKey(item.sentence));
  const validContexts = new Set(contextKeys).size === contexts.length && contexts.every((item, index) =>
    sourceKeys.has(cardKey(item)) && item.sentence.length >= 8 && item.sentence.length <= 250 && contextKeys[index].length >= 5 &&
    !/[가-힣]/.test(item.sentence) && new RegExp(`\\b${item.word}\\b`, 'i').test(item.sentence) && !sourceExamples.has(contextKeys[index])
  );
  const cueHomework = !!draft.cue && homework;
  const contextualLesson = !!draft.cue?.contextual && !homework;
  const goals = essential.filter(goal => modes.includes(goal.mode) && cards.some(card => cardKey(card) === cardKey(goal)));
  const nextClassOn = schedule && !homework ? nextClass || nextCueClass(schedule, opens) : null;
  const timingValid = !schedule || ((!opens || opens >= schedule.today) &&
    (!nextClassOn || nextClassOn > (opens || schedule.today)) && (!due || !opens || due.slice(0, 10) >= opens));
  const validContextualLesson = modes.includes('read') && cards.every(card =>
    !!card.example && card.example.length >= 8 && new RegExp(`\\b${card.word}\\b`, 'i').test(card.example));
  const valid = !!title.trim() && roster.length > 0 && cards.length > 0 && cards.length <= limit &&
    (cueHomework ? validContexts : !homework || hasSharedGoal) && (!draft.cue || homework || modes.length > 0) &&
    (!contextualLesson || validContextualLesson) && timingValid && (!draft.cue || !!schedule);

  async function submit() {
    if (busy || (!pending.current && (!confirmed || !valid))) return;
    if (!pending.current) {
      if (due && new Date(due).getTime() <= Date.now()) { setError('due'); return; }
      pending.current = {
        request: draft.id, draft: draft.id, classId, students: roster, title: title.trim(),
        cards, practice: practice === 'recall' ? 'recall' : 'letters', games: practice === 'games', due: due || null,
        cues: draft.cue ? {
          modes, contexts: cueHomework ? contexts : undefined, contextual: contextualLesson,
          timetable: schedule ? { revision: schedule.revision, next_class_on: nextClassOn, opens_on: opens || null,
            essential: homework ? [] : goals } : undefined,
        } : undefined,
      };
    }
    setBusy(true);
    setError('');
    try {
      await approveVocab(pending.current);
      pending.current = null;
      onApproved(draft.kind);
    } catch (cause) {
      const rejected = cause instanceof Error && /^(bad_|feature_closed|draft_not_available|schedule_changed|learning_path_protection_changed|homework_protection_changed|request_changed|path_not_ready)/.test(cause.message);
      if (rejected) {
        pending.current = null;
        setConfirmed(false);
      }
      setError(rejected ? cause.message.includes('bad_context_reused') ? 'reused' : cause.message === 'schedule_changed' ? 'schedule' : 'rejected' : 'uncertain');
    } finally { setBusy(false); }
  }

  async function skip() {
    if (busy || pending.current) return;
    setBusy(true);
    try {
      await dismissVocabDraft(draft.id);
      onClose();
    } catch { setError('dismiss'); }
    finally { setBusy(false); }
  }

  return <section ref={editor} tabIndex={-1} aria-label={l('어휘 추천 초안 편집','Edit suggested vocabulary plan')} className="space-y-4 rounded-2xl border border-primary/30 bg-white p-4">
    <h4 className="text-lg font-bold">{homework ? l('후속 숙제 초안','Follow-up homework draft') : l('보충 개별수업 초안','Individual lesson draft')}</h4>
    <p>{cueHomework ? l('기준 수업의 단어를 새 문장에 넣어 문장 속 뜻을 확인해요. 문장을 검토하고 필요하면 바꿔 주세요.','Check the meaning of each word in a new sentence. Review or replace the sentences before assigning.') :
      contextualLesson ? l('새 문장 숙제에서 어려웠던 단어예요. 다음 수업에서는 문장을 읽고 문맥으로 뜻을 고르는 연습을 해요.','The new-sentence homework was difficult. The next lesson practises selecting the meaning from a sentence.') :
      draft.reason === 'practice' ? l('최근 혼자 푼 답에서 다시 연습할 단어를 골랐어요.','Selected words that need more practice based on recent independent answers.') :
      homework ? l('수업에서 맞힌 단어를 숙제에서도 혼자 떠올릴 수 있는지 확인해요.','Check whether students can also recall the words independently in homework.') :
      l('아직 답을 확인하지 못한 단서를 다시 확인해요.','Recheck cues where a usable response is missing.')}</p>
    <fieldset disabled={busy || !!pending.current} className="space-y-4">
      <label className="block space-y-1"><span>{l('이름','Title')}</span><input className={field} value={title} maxLength={100} onChange={event => { setTitle(event.target.value); setConfirmed(false); }}/></label>
      <label className="block space-y-1"><span>{l(`단어 | 뜻 | 예문(선택) · 최대 ${limit}개`, `Word | meaning | example (optional) · up to ${limit}`)}</span>
        <textarea className={field} value={text} rows={4} onChange={event => { setText(event.target.value); setConfirmed(false); }}/>
      </label>
      {(!cards.length || cards.length > limit) && <p className="text-error">{l('영어 단어와 뜻을 한 줄에 하나씩 입력하고 분량과 중복을 확인해 주세요.','Enter one word and meaning per line, within the word limit and without duplicates.')}</p>}
      {contextualLesson && <p className={validContextualLesson ? 'text-sm' : 'text-sm text-error'}>{l('각 줄의 세 번째 칸에 해당 단어가 들어간 영어 예문을 넣어 주세요. 읽기 단서는 문장 속 뜻으로 확인합니다.','In the third field of each line, enter an English example containing the word. Reading will be checked in context.')}</p>}
      {homework && !cueHomework && <p className={cards.length > 0 && !hasSharedGoal ? 'text-error' : 'text-sm'}>{l('기준 수업과 단어·뜻이 같은 항목만 연결해요. 그런 항목을 하나 이상 남겨 주세요.','Keep at least one matching word and meaning. Only matching items are linked to the source lesson.')}</p>}
      {cueHomework && <fieldset className="space-y-2">
        <legend className="font-bold">{l('새 문장 확인 문제','New sentence checks')}</legend>
        <p className={cards.length > 0 && !validContexts ? 'text-error text-sm' : 'text-sm'}>{l('기준 수업에 있는 단어·뜻마다, 해당 영어 단어가 들어간 서로 다른 새 문장을 넣어 주세요. 사전에서 같은 뜻의 예문을 찾으면 먼저 채워드려요.','Use a different new sentence containing each word and meaning from the source lesson. Matching dictionary examples are prefilled when available.')}</p>
        {contexts.map(item => <label className="block space-y-1" key={cardKey(item)}><span>{item.word} · {item.meaning}</span>
          <input className={field} value={item.sentence} maxLength={250} onChange={event => {
            setSentences(previous => ({ ...previous, [cardKey(item)]: event.target.value }));
            setConfirmed(false);
          }} placeholder={l('새 영어 문장 입력','Enter a new English sentence')}/>
        </label>)}
      </fieldset>}
      {!!draft.cue && !homework && <fieldset className="space-y-2">
        <legend className="font-bold">{l('집중할 단서','Cues to focus on')}</legend>
        {cueModes.map(mode => <label key={mode} className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={modes.includes(mode)} disabled={contextualLesson && mode === 'read'} onChange={event => {
            setModes(event.target.checked ? [...modes, mode] : modes.filter(value => value !== mode));
            setConfirmed(false);
          }}/>{cueLabel(mode, en)}
        </label>)}
      </fieldset>}
      {draft.cue && schedule && <>
        {!homework && <EssentialCuePicker cards={cards} modes={modes} selected={goals} en={en} onChange={value=>{setEssential(value);setConfirmed(false);}}/>}
        <VocabPlanTiming schedule={schedule} en={en} opens={opens} onOpens={value=>{setOpens(value);setNextClass('');setConfirmed(false);}}
          nextClass={nextClass} onNextClass={value=>{setNextClass(value);setConfirmed(false);}} homework={homework} hasEssential={goals.length>0}/>
        {!timingValid && <p className="text-sm text-error">{l('시작일, 숙제 기한, 다음 수업일의 순서를 확인해 주세요.','Check the order of the opening date, homework deadline and next class date.')}</p>}
      </>}
      {!cueHomework && <label className="block space-y-1"><span>{l('연습 방식','Practice mode')}</span><select className={field} value={practice} onChange={event => { setPractice(event.target.value as typeof practice); setConfirmed(false); }}>
        <option value="games">{l('뜻 풍선 + 철자 기차','Vocabulary balloons + spelling train')}</option>
        {!draft.cue && <option value="letters">{l('글자 조합','Arrange letters')}</option>}
        <option value="recall">{draft.cue ? l('기본 연습','Standard practice') : l('직접 쓰기','Type from meaning')}</option>
      </select></label>}
      {homework && <HomeworkDeadlinePicker value={due} onChange={value => { setDue(value); setConfirmed(false); }} en={en}/>}
      <fieldset><legend className="mb-1 font-bold">{l('배정할 학생','Students to assign')}</legend>
        <div className="flex flex-wrap gap-2">{students.map(student => <label key={student.id} className="flex min-h-11 items-center gap-2 rounded-full border px-3">
          <input type="checkbox" checked={selected.includes(student.id)} onChange={event => {
            setSelected(event.target.checked ? [...selected, student.id] : selected.filter(id => id !== student.id));
            setConfirmed(false);
          }}/>{student.name}
        </label>)}</div>
      </fieldset>
      <p className="text-sm">{cueHomework ? l('각 문장의 첫 답을 기준 수업에 연결합니다.','Each first answer is linked to the source lesson.') :
        draft.cue ? schedule?.revision ? l('어려운 단서만 연습하고, 저장한 반 요일에 따라 복습을 열어요.','Practise difficult cues and open reviews on the saved class days.') :
          l('어려운 단서만 연습하고, 독립 확인 결과에 따라 1일·3일·7일 복습을 조정합니다.','Practise only difficult cues and adapt day 1, 3, and 7 reviews to independent answers.') :
        l('첫 답 확인 → 필요한 단어 설명·연습 → 혼자 확인 → 1일·7일 뒤 복습 확인', 'First answer → explanation and practice as needed → independent check → reviews after 1 and 7 days')}</p>
      <label className="flex items-start gap-2 rounded-xl bg-surface-container-low p-3">
        <input type="checkbox" checked={confirmed} disabled={!valid} onChange={event => setConfirmed(event.target.checked)}/>
        {cueHomework ? l(`${roster.length}명에게 보낼 ${cards.length}개 새 문장을 검토했습니다.`, `I reviewed ${cards.length} new sentences for ${roster.length} students.`) :
          l(`${roster.length}명, ${cards.length}단어와 이후 복습 확인까지 검토했습니다.`, `I reviewed ${roster.length} students, ${cards.length} words and their later checks.`)}
      </label>
    </fieldset>
    {error && <p role="alert" className="text-error">{
      error === 'uncertain' ? l('배정 결과를 확인하지 못했어요. 같은 내용으로 다시 확인해 주세요.','Assignment status is uncertain. Retry with the same settings.') :
      error === 'due' ? l('마감일을 현재보다 나중으로 선택해 주세요.','Choose a future deadline.') :
      error === 'reused' ? l('기준 수업이나 선택한 학생의 이전 연결 숙제에 쓰인 문장이 있어요. 다른 문장으로 바꿔 주세요.','A sentence was used in the source lesson or a selected student’s linked homework. Replace it with a new one.') :
      error === 'schedule' ? l('반 요일 설정이 바뀌었어요. 최신 설정을 다시 읽은 뒤 초안을 검토해 주세요.','Class days changed. Reload the latest settings and review the draft again.') :
      error === 'dismiss' ? l('건너뛰기를 저장하지 못했어요. 다시 시도해 주세요.','Could not save this decision. Try again.') :
      l('배정할 수 없어요. 반과 학생, 기능 설정을 확인한 뒤 다시 승인해 주세요.','Could not assign. Check the class, students and feature settings before approving again.')
    }</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={primary} disabled={busy || (!pending.current && (!valid || !confirmed))} onClick={() => void submit()}>
        {pending.current ? l('같은 배정 다시 확인','Retry this assignment') : homework ? l('승인하고 숙제 배정','Approve and assign homework') : l('승인하고 수업 배정','Approve and assign lesson')}
      </button>
      <button type="button" className={secondary} disabled={busy || !!pending.current} onClick={() => void skip()}>{l('이 추천 건너뛰기','Skip this recommendation')}</button>
    </div>
  </section>;
}
