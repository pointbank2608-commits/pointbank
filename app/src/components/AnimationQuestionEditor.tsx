import { effectiveSlides } from '../lib/lessonSlides';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCurriculumLesson, fetchAllCurriculumLessons, updateCurriculumLesson } from '../lib/api';
import { announceLessonChange } from '../lib/lessonChanges';
import { animationPracticeLines } from '../lib/animationSession';
import { learningRange } from '../lib/animationScene';
import { findVideoQuestionLesson } from '../lib/videoQuestionLessons';
import { formatQuestionTime, parseQuestionTime, questionError, questionKinds, questionNumber, questionTimeInClip, questionTimeInVideo, sentenceWords, sortedQuestions, type VideoQuestion } from '../lib/videoQuestions';
import type { CurriculumLesson, VideoSlide } from '../lib/types';
import type { VideoClip } from '../lib/videoClips';
import AccessibleDialog from './AccessibleDialog';
import PlainTeachingVideo, { type TeachingVideoControl } from './PlainTeachingVideo';
import TimedVideoLesson from './TimedVideoLesson';
import '../styles/video-questions.css';

export default function AnimationQuestionEditor({ clip, onClose, initialSlide, onSave }: { clip: VideoClip; onClose: () => void; initialSlide?:VideoSlide; onSave?:(slide:VideoSlide)=>Promise<void> }) {
  const { academy, profile } = useAuth();
  const player = useRef<TeachingVideoControl | null>(null);
  const range = learningRange(clip);
  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const [slide, setSlide] = useState<VideoSlide>(() => initialSlide ?? ({ id: crypto.randomUUID(), kind: 'video', clipId: clip.id, title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, startSec: range?.start ?? 0, endSec: range?.end, timedQuestions: [], questionLesson: true, questionVersion: 1 }));
  const [videoReady,setVideoReady]=useState(false);
  const [loading, setLoading] = useState(!initialSlide), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [draft, setDraft] = useState<VideoQuestion | null>(null);
  const [at, setAt] = useState('');
  const [draftError, setDraftError] = useState('');
  const [preview, setPreview] = useState<VideoQuestion | null>(null), [run, setRun] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    if(initialSlide)return;
    let live = true;
    if (!academy || !profile) return;
    void fetchAllCurriculumLessons(academy.id).then(rows => {
      if (!live) return;
      const found = findVideoQuestionLesson(rows, clip.id, profile.id);
      if (found) { setLesson(found.lesson); setSlide(found.slide); }
      setLoading(false);
    }).catch(() => { if (live) setError('편집본을 불러오지 못했어요. 닫았다가 다시 열어 주세요.'); });
    return () => { live = false; };
  }, [academy, profile, clip.id, initialSlide]);
  const open = (q: VideoQuestion) => { player.current?.pause(); setDraft(q); setAt(formatQuestionTime(questionTimeInClip(q.at, slide.startSec))); setDraftError(''); };
  const value = (): VideoQuestion | null => draft ? { ...draft, at: questionTimeInVideo(parseQuestionTime(at), slide.startSec), replayStart: undefined } : null;
  const validate = () => {
    const q = value();
    if (!q) return null;
    const message = timeError || questionError(q, slide.startSec, slide.endSec);
    setDraftError(message); return message ? null : q;
  };
  const save = async () => {
    const q = validate();
    if (!q || !academy || !profile || saving.current) return;
    saving.current = true; setBusy(true);
    const next: VideoSlide = { ...slide, timedQuestions: sortedQuestions([...(slide.timedQuestions ?? []).filter(item => item.id !== q.id), q]) };
    try {
      if(onSave){await onSave(next);setSlide(next);setDraft(null);setDraftError('');return;}
      let savedId = lesson?.id;
      if (lesson) {
        const playlist = effectiveSlides(lesson).map(s => s.id === slide.id ? next : s);
        await updateCurriculumLesson(lesson.id, { playlist }); setLesson({ ...lesson, playlist });
      } else {
        const created = await createCurriculumLesson({ academyId: academy.id, classId: null, name: `${clip.title} · 영상 질문`, wordListId: null, videoUrl: null, level: null, playlist: [next], teacherId: profile.id });
        setLesson(created); savedId = created.id;
      }
      setSlide(next); setDraft(null); setDraftError(''); if (savedId) announceLessonChange(academy.id, savedId);
    } catch { setDraftError('질문을 저장하지 못했어요. 입력한 내용은 유지돼요. 다시 저장해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const source = slide.animationSession?.source ?? clip.script;
  const lines = animationPracticeLines(source,slide.startSec,slide.endSec);
  const questions = sortedQuestions(slide.timedQuestions ?? []);
  const relativeTime = parseQuestionTime(at);
  const timeError = draft && (!Number.isFinite(relativeTime) || relativeTime < 0 || relativeTime > (slide.endSec ?? Infinity) - (slide.startSec ?? 0)) ? `질문 시점은 학습 구간의 0:00부터 ${slide.endSec === undefined ? '영상 끝' : formatQuestionTime(slide.endSec - (slide.startSec ?? 0))} 사이로 입력해 주세요.` : '';
  const changeTime = (text: string) => { setAt(text); setDraftError(''); };
  const seekDraft = (time: number) => { if (draft && !busy) { player.current?.pause(); changeTime(formatQuestionTime(questionTimeInClip(time, slide.startSec))); } };
  const openSaved = (id: string) => { const q = questions.find(q => q.id === id); if (q && !busy) { open(q); player.current?.seek(q.at); } };
  const adjustTime = (delta: number) => {
    const relative = Math.max(0, (parseQuestionTime(at) || 0) + delta);
    changeTime(formatQuestionTime(relative));
    if (relative <= (slide.endSec ?? Infinity) - (slide.startSec ?? 0)) { player.current?.pause(); player.current?.seek(questionTimeInVideo(relative, slide.startSec)); }
  };
  const timeInput = <label>질문 시점<div className="vq-time"><input aria-label="질문 시점" aria-invalid={!!timeError} aria-describedby={timeError ? 'vq-time-error' : undefined} placeholder="00:27.00" value={at} onChange={e => changeTime(e.target.value)}/><button type="button" aria-label="질문 시점 −1초" onClick={() => adjustTime(-1)}>−1초</button><button type="button" aria-label="질문 시점 +1초" onClick={() => adjustTime(1)}>+1초</button></div></label>;
  return <AccessibleDialog label="영상 중간 질문 편집" onClose={() => { if (!busy) onClose(); }}><div className="vq-editor">
    <header><h2>{clip.title} · 영상 중간 질문 편집</h2><button disabled={busy} onClick={onClose}>닫기</button></header>
    {loading && <p role="status">편집본을 불러오고 있어요.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="vq-grid"><div>
      {!loading && <div className="vq-player"><PlainTeachingVideo key={`${slide.startSec}:${slide.endSec}`} videoUrl={slide.videoUrl} start={slide.startSec} end={slide.endSec} title={clip.title} source={source} simple settingsLabel="수업 설정" onReady={()=>setVideoReady(true)} controlRef={player} onSeek={seekDraft} questionMarkers={questions} onQuestionMarker={openSaved}/></div>}
      <button disabled={loading || busy || !videoReady} className="vq-primary" onClick={() => { const time = player.current?.getTime() ?? slide.startSec ?? 0; player.current?.pause(); open({ id: crypto.randomUUID(), kind: 'spoken', at: Math.round(time * 100) / 100, prompt: '' }); }}>여기에 질문 넣기</button>
      <nav aria-label="저장된 질문 타임라인" className="vq-timeline">{questions.map((q, i) => <button key={q.id} disabled={busy} onClick={() => openSaved(q.id)}>{questionNumber(i)} {formatQuestionTime(questionTimeInClip(q.at, slide.startSec))} · {questionKinds[q.kind].split(' · ')[0]}</button>)}</nav>
      <div className="vq-actions"><button disabled={!slide.timedQuestions?.length || busy || !!draft} onClick={() => { player.current?.pause(); setRun(true); }}>저장한 질문으로 수업 재생</button>{lesson && <Link to="/curriculum">내 수업에서 편집본 열기</Link>}</div>
      <p role="status">{onSave ? '현재 수업 편집본의 질문을 편집하고 있어요.' : lesson ? '이 영상의 질문은 내 수업의 편집본에 저장돼요.' : '첫 질문을 저장하면 내 수업에 영상 편집본이 만들어져요.'}</p>
    </div><div>
      {!draft ? <p>영상을 보며 원하는 순간에 ‘여기에 질문 넣기’를 누르세요. 저장된 질문을 눌러 다시 고칠 수 있어요.</p> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
        <fieldset disabled={busy} className="space-y-3">
          {timeInput}
          {timeError && <p id="vq-time-error" className="vq-error" role="alert">{timeError}</p>}
          <label>질문 유형<select aria-label="질문 유형" value={draft.kind} onChange={e => { const base = { id: draft.id, at: draft.at }; const kind = e.target.value as VideoQuestion['kind']; if((kind==='cloze'||kind==='scramble')&&(draft.kind==='cloze'||draft.kind==='scramble')){setDraft(kind==='cloze'?{...base,kind,sentence:draft.sentence,hiddenWordIndices:[]}:{...base,kind,sentence:draft.sentence});return;} setDraft(kind === 'spoken' ? { ...base, kind, prompt: '' } : kind === 'choice' ? { ...base, kind, prompt: '', choices: ['', ''], answerIndex: 0 } : kind === 'cloze' ? { ...base, kind, sentence: '', hiddenWordIndices: [] } : { ...base, kind, sentence: '' }); }}>{Object.entries(questionKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
          {(draft.kind === 'spoken' || draft.kind === 'choice') && <label>질문<textarea value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })}/></label>}
          {draft.kind === 'spoken' && <label>예시 답 (선택)<textarea value={draft.modelAnswer ?? ''} onChange={e => setDraft({ ...draft, modelAnswer: e.target.value })}/></label>}
          {draft.kind === 'choice' && <fieldset><legend>보기와 정답 하나</legend>{draft.choices.map((choice, i) => <div className="vq-time" key={i}><input type="radio" name="correct-choice" aria-label={`보기 ${i + 1} 정답`} checked={draft.answerIndex === i} onChange={() => setDraft({ ...draft, answerIndex: i })}/><input aria-label={`보기 ${i + 1}`} value={choice} onChange={e => setDraft({ ...draft, choices: draft.choices.map((c, index) => index === i ? e.target.value : c) })}/></div>)}<button type="button" onClick={() => setDraft({ ...draft, choices: [...draft.choices, ''] })}>보기 추가</button></fieldset>}
          {(draft.kind === 'cloze' || draft.kind === 'scramble') && <>
            <button type="button" onClick={()=>{const time=player.current?.getTime()??0;const line=lines.find(l=>l.start<=time+.05&&l.end>time);if(!line){setDraftError('현재 장면의 대사를 확인할 수 없어요. 직접 입력해 주세요.');return;}setDraft(draft.kind==='cloze'?{...draft,sentence:line.en.replace(/\*\*/g,''),hiddenWordIndices:[]}:{...draft,sentence:line.en.replace(/\*\*/g,'')});changeTime(formatQuestionTime(questionTimeInClip(line.end,slide.startSec)));}}>이 장면 대사 가져오기</button>
            <label>완성 문장<textarea value={draft.sentence} onChange={e => setDraft(draft.kind === 'cloze' ? { ...draft, sentence: e.target.value, hiddenWordIndices: [] } : { ...draft, sentence: e.target.value })}/></label>
            {draft.kind === 'cloze' && <div><p>화면에서 가릴 단어를 누르세요.</p><div className="vq-choices">{sentenceWords(draft.sentence).map((word, i) => <button type="button" key={i} aria-pressed={draft.hiddenWordIndices.includes(i)} onClick={() => setDraft({ ...draft, hiddenWordIndices: draft.hiddenWordIndices.includes(i) ? draft.hiddenWordIndices.filter(index => index !== i) : [...draft.hiddenWordIndices, i] })}>{draft.hiddenWordIndices.includes(i) ? '____' : word}</button>)}</div></div>}
          </>}
          {draftError && !timeError && <p className="vq-error" role="alert">{draftError}</p>}
          <div className="vq-actions"><button type="button" onClick={() => { const q = validate(); if (q) { player.current?.pause(); setPreview(q); } }}>이 문항 미리보기</button><button className="vq-primary" type="submit">{busy ? '저장 중…' : '질문 저장'}</button><button type="button" onClick={() => { setDraft(null); setDraftError(''); }}>편집 취소</button></div>
        </fieldset>
      </form>}
    </div></div>
    {(preview || run) && <AccessibleDialog label={preview ? '이 문항 미리보기' : '영상 질문 수업'} onClose={() => { setPreview(null); setRun(false); }}><div className="vq-editor"><button onClick={() => { setPreview(null); setRun(false); }}>편집으로 돌아가기</button><TimedVideoLesson slide={slide} source={source} previewQuestion={preview ?? undefined}/></div></AccessibleDialog>}
  </div></AccessibleDialog>;
}
