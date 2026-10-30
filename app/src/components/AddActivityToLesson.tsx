import {useToast} from '../context/ToastContext';
import { activityName } from '../lib/activityNames';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AccessibleDialog from './AccessibleDialog';
import { useAuth } from '../context/AuthContext';
import { appendActivityToLesson, createCurriculumLesson, createGameTemplate, fetchAllCurriculumLessons, fetchCurriculumLessonById } from '../lib/api';
import type { CurriculumLesson, GameTemplate, GameType, FullCardItem } from '../lib/types';
import { prepareClassroomGame } from '../lib/gameWorkspace';
import {announceLessonChange} from '../lib/lessonChanges';

export default function AddActivityToLesson({ activity, source, onClose }: {
  activity?: GameTemplate; source?: { cards: FullCardItem[]; kind: 'word' | 'sentence'; name: string }; onClose: () => void;
}) {
  const { t } = useTranslation();const {notify}=useToast();const adding=useRef(false);
  const { academy, profile } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<CurriculumLesson[] | null>(null);
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added,setAdded]=useState<{lesson:CurriculumLesson;slideId:string}|null>(null);
  useEffect(() => {
    let active = true;
    if (academy) fetchAllCurriculumLessons(academy.id).then(rows => { if (active) setLessons(rows); }).catch(() => { if (active) setError(t('quick.failed')); });
    return () => { active = false; };
  }, [academy, t]);
  async function add() {
    if (!academy || !profile || busy || adding.current || !target) return;
    adding.current=true;
    setBusy(true); setError('');
    try {
      const lesson = target === 'new' ? null : await fetchCurriculumLessonById(target);
      if (target!=='new'&&!lesson)throw new Error('missing_lesson');
      if (lesson && lesson.academy_id !== academy.id) throw new Error('wrong_academy');
      const gameType: GameType = activity?.game_type || (source?.kind === 'sentence' ? 'unscramble' : 'wheel');
      const content = activity || (source && prepareClassroomGame(gameType, source.cards, source.kind));
      if (!content) throw new Error('invalid_content');
      // Snapshot: later edits to an activity must not silently change a saved lesson.
      const template = await createGameTemplate({ academyId: academy.id, classId: lesson?.class_id || null,
        teacherId: profile.id, gameType, name: activity?.name || source!.name, items: structuredClone(content.items), config: structuredClone({ ...content.config, editingTemplateId:undefined, lessonSnapshot:true, ...(source ? { classroomSource: { id: 'temporary', name: source.name, kind: source.kind, version: '', cards: source.cards } } : {}) }) });
      const slide = { id: crypto.randomUUID(), kind: 'game' as const, gameType, templateId: template.id };
      const saved = lesson || await createCurriculumLesson({ academyId: academy.id, classId: null, teacherId: profile.id,
        name: activityName(name,t('flow.defaultLesson'),lessons?.map(row=>row.name)), wordListId: null, videoUrl: null, level: null, playlist: [slide] });
      if (lesson) await appendActivityToLesson(lesson, slide);
      announceLessonChange(academy.id,saved.id);
      notify(t('launchUx.lessonAdded',{name:saved.name}));
      setAdded({lesson:saved,slideId:slide.id});
    } catch { setError(t('quick.addFailed')); } finally { adding.current=false;setBusy(false); }
  }
  return <AccessibleDialog label={t('quick.addLesson')} onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">{t('quick.addLesson')}</h2>
      {added ? <div className="space-y-4" role="status"><p className="rounded-xl bg-green-50 p-4 font-bold text-green-800">{t('launchUx.lessonAdded',{name:added.lesson.name})}</p><div className="flex flex-wrap gap-3"><button className="min-h-12 rounded-xl bg-primary px-5 font-bold text-white" onClick={()=>{navigate('/curriculum',{state:{focusClassId:added.lesson.class_id,reopenLessonId:added.lesson.id,reopenSlideId:added.slideId,addedActivity:true}});onClose();}}>{t('prelaunchUx.viewLesson')}</button><button className="min-h-12 rounded-xl border px-4" onClick={onClose}>{t('common.close')}</button></div></div> : <>
      <p>{t('quick.lessonHint')}</p>
      <label className="block">{t('quick.chooseLesson')}<select aria-label={t('quick.chooseLesson')} className="mt-2 min-h-12 w-full rounded-xl border p-3" value={target} disabled={busy || !lessons} onChange={e => setTarget(e.target.value)}>
        <option value="">{t(lessons ? 'quick.chooseLesson' : 'common.loading')}</option>
        <option value="new">{t('quick.newLesson')}</option>
        {lessons?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      {target === 'new' && <label className="block">{t('quick.lessonName')}<input placeholder={activityName('',t('flow.defaultLesson'),lessons?.map(row=>row.name))} className="mt-2 min-h-12 w-full rounded-xl border p-3" value={name} onChange={e => setName(e.target.value)} /></label>}
      {error && <p role="alert" className="text-error">{error}</p>}
      <div className="flex gap-3"><button className="min-h-12 rounded-xl border px-4" disabled={busy} onClick={onClose}>{t('common.close')}</button>
        <button className="min-h-12 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50" disabled={busy || !lessons || !target} onClick={() => void add()}>{t(busy ? 'common.loading' : 'quick.addLesson')}</button></div></>}
    </div>
  </AccessibleDialog>;
}
