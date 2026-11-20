import { effectiveSlides } from '../lib/lessonSlides';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCurriculumLesson, fetchAllCurriculumLessons, updateCurriculumLesson } from '../lib/api';
import { announceLessonChange } from '../lib/lessonChanges';
import { parseShadowText } from '../lib/shadowLines';
import { formatQuestionTime, parseQuestionTime, questionError, questionKinds, sentenceWords, sortedQuestions, type VideoQuestion } from '../lib/videoQuestions';
import type { CurriculumLesson, VideoSlide } from '../lib/types';
import type { VideoClip } from '../lib/videoClips';
import AccessibleDialog from './AccessibleDialog';
import PlainTeachingVideo, { type TeachingVideoControl } from './PlainTeachingVideo';
import TimedVideoLesson from './TimedVideoLesson';
import '../styles/video-questions.css';

export default function AnimationQuestionEditor({ clip, onClose }: { clip: VideoClip; onClose: () => void }) {
  const { academy, profile } = useAuth();
  const player = useRef<TeachingVideoControl | null>(null);
  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const [slide, setSlide] = useState<VideoSlide>(() => ({ id: crypto.randomUUID(), kind: 'video', clipId: clip.id, title: clip.title, videoUrl: `https://www.youtube.com/watch?v=${clip.youtube_id}`, startSec: Number(clip.start_sec) || 0, endSec: Number(clip.end_sec) || undefined, timedQuestions: [], questionLesson: true, questionVersion: 1 }));
  const [videoReady,setVideoReady]=useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [draft, setDraft] = useState<VideoQuestion | null>(null);
  const [at, setAt] = useState(''), [replay, setReplay] = useState('');
  const [preview, setPreview] = useState<VideoQuestion | null>(null), [run, setRun] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let live = true;
    if (!academy || !profile) return;
    void fetchAllCurriculumLessons(academy.id).then(rows => {
      if (!live) return;
      const found = rows.filter(row => row.created_by === profile.id && effectiveSlides(row).some(s => s.kind === 'video' && s.clipId === clip.id && s.questionLesson)).sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0];
      if (found) { setLesson(found); setSlide(effectiveSlides(found).find((s): s is VideoSlide => s.kind === 'video' && s.clipId === clip.id && !!s.questionLesson)!); }
      setLoading(false);
    }).catch(() => { if (live) setError('편집본을 불러오지 못했어요. 닫았다가 다시 열어 주세요.'); });
    return () => { live = false; };
  }, [academy, profile, clip.id]);
  const open = (q: VideoQuestion) => { player.current?.pause(); setDraft(q); setAt(formatQuestionTime(q.at)); setReplay(q.replayStart === undefined ? '' : formatQuestionTime(q.replayStart)); setError(''); };
  const value = (): VideoQuestion | null => draft ? { ...draft, at: parseQuestionTime(at), replayStart: replay.trim() ? parseQuestionTime(replay) : undefined } : null;
  const validate = () => {
    const q = value();
    if (!q) return null;
    const message = questionError(q, slide.startSec, slide.endSec);
    setError(message); return message ? null : q;
  };
  const save = async () => {
    const q = validate();
    if (!q || !academy || !profile || saving.current) return;
    saving.current = true; setBusy(true);
    const next: VideoSlide = { ...slide, timedQuestions: sortedQuestions([...(slide.timedQuestions ?? []).filter(item => item.id !== q.id), q]) };
    try {
      let savedId = lesson?.id;
      if (lesson) {
        const playlist = effectiveSlides(lesson).map(s => s.id === slide.id ? next : s);
        await updateCurriculumLesson(lesson.id, { playlist }); setLesson({ ...lesson, playlist });
      } else {
        const created = await createCurriculumLesson({ academyId: academy.id, classId: null, name: `${clip.title} · 영상 질문`, wordListId: null, videoUrl: null, level: null, playlist: [next], teacherId: profile.id });
        setLesson(created); savedId = created.id;
      }
      setSlide(next); setDraft(null); setError(''); if (savedId) announceLessonChange(academy.id, savedId);
    } catch { setError('질문을 저장하지 못했어요. 입력한 내용은 유지돼요. 다시 저장해 주세요.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const lines = parseShadowText(clip.script);
  const timeInput = (label: string, text: string, change: (value: string) => void) => <label>{label}<div className="vq-time"><input aria-label={label} placeholder="00:42.00" value={text} onChange={e => change(e.target.value)}/><button type="button" aria-label={`${label} −1초`} onClick={() => change(formatQuestionTime(Math.max(slide.startSec ?? 0, (parseQuestionTime(text) || 0) - 1)))}>−1초</button><button type="button" aria-label={`${label} +1초`} onClick={() => change(formatQuestionTime((parseQuestionTime(text) || 0) + 1))}>+1초</button></div></label>;
  return <AccessibleDialog label="영상 중간 질문 편집" onClose={() => { if (!busy) onClose(); }}><div className="vq-editor">
    <header><h2>{clip.title} · 영상 중간 질문 편집</h2><button disabled={busy} onClick={onClose}>닫기</button></header>
    {loading && <p role="status">편집본을 불러오고 있어요.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="vq-grid"><div>
      <div className="vq-player"><PlainTeachingVideo videoUrl={slide.videoUrl} start={slide.startSec} end={slide.endSec} title={clip.title} source={clip.script} simple onReady={()=>setVideoReady(true)} controlRef={player}/></div>
      <button disabled={loading || busy || !videoReady} className="vq-primary" onClick={() => { const time = player.current?.getTime() ?? slide.startSec ?? 0; player.current?.pause(); open({ id: crypto.randomUUID(), kind: 'spoken', at: Math.round(time * 100) / 100, prompt: '' }); }}>여기에 질문 넣기</button>
      <nav aria-label="저장된 질문 타임라인" className="vq-timeline">{sortedQuestions(slide.timedQuestions ?? []).map((q, i) => <button key={q.id} disabled={busy} onClick={() => { open(q); player.current?.seek(q.at); }}>{formatQuestionTime(q.at)} · {i + 1}. {questionKinds[q.kind].split(' · ')[0]}{q.replayStart !== undefined ? ` (다시 보기 ${formatQuestionTime(q.replayStart)})` : ''}</button>)}</nav>
      <div className="vq-actions"><button disabled={!slide.timedQuestions?.length || busy || !!draft} onClick={() => { player.current?.pause(); setRun(true); }}>저장한 질문으로 수업 재생</button>{lesson && <Link to="/curriculum">내 수업에서 편집본 열기</Link>}</div>
      <p role="status">{lesson ? '이 영상의 질문은 내 수업의 편집본에 저장돼요.' : '첫 질문을 저장하면 내 수업에 영상 편집본이 만들어져요.'}</p>
    </div><div>
      {!draft ? <p>영상을 보며 원하는 순간에 ‘여기에 질문 넣기’를 누르세요. 저장된 질문을 눌러 다시 고칠 수 있어요.</p> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
        <fieldset disabled={busy} className="space-y-3">
          {timeInput('질문 시점', at, setAt)}
          <label>질문 유형<select aria-label="질문 유형" value={draft.kind} onChange={e => { const base = { id: draft.id, at: draft.at, replayStart: draft.replayStart }; const kind = e.target.value as VideoQuestion['kind']; setDraft(kind === 'spoken' ? { ...base, kind, prompt: '' } : kind === 'choice' ? { ...base, kind, prompt: '', choices: ['', ''], answerIndex: 0 } : kind === 'cloze' ? { ...base, kind, sentence: '', hiddenWordIndices: [] } : { ...base, kind, sentence: '' }); }}>{Object.entries(questionKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
          {(draft.kind === 'spoken' || draft.kind === 'choice') && <label>질문<textarea value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })}/></label>}
          {draft.kind === 'spoken' && <label>예시 답 (선택)<textarea value={draft.modelAnswer ?? ''} onChange={e => setDraft({ ...draft, modelAnswer: e.target.value })}/></label>}
          {draft.kind === 'choice' && <fieldset><legend>보기와 정답 하나</legend>{draft.choices.map((choice, i) => <div className="vq-time" key={i}><input type="radio" name="correct-choice" aria-label={`보기 ${i + 1} 정답`} checked={draft.answerIndex === i} onChange={() => setDraft({ ...draft, answerIndex: i })}/><input aria-label={`보기 ${i + 1}`} value={choice} onChange={e => setDraft({ ...draft, choices: draft.choices.map((c, index) => index === i ? e.target.value : c) })}/></div>)}<button type="button" onClick={() => setDraft({ ...draft, choices: [...draft.choices, ''] })}>보기 추가</button></fieldset>}
          {(draft.kind === 'cloze' || draft.kind === 'scramble') && <>
            {lines.length > 0 && <label>대본에서 가져오기<select aria-label="대본에서 가져오기" value="" onChange={e => { const line = lines[Number(e.target.value)]; if (line) setDraft(draft.kind === 'cloze' ? { ...draft, sentence: line.en.replace(/\*\*/g, ''), hiddenWordIndices: [] } : { ...draft, sentence: line.en.replace(/\*\*/g, '') }); }}><option value="">대사 한 줄 선택</option>{lines.map((line, i) => <option key={i} value={i}>{formatQuestionTime(line.start)} {line.en.replace(/\*\*/g, '')}</option>)}</select></label>}
            <label>완성 문장<textarea value={draft.sentence} onChange={e => setDraft(draft.kind === 'cloze' ? { ...draft, sentence: e.target.value, hiddenWordIndices: [] } : { ...draft, sentence: e.target.value })}/></label>
            {draft.kind === 'cloze' && <div><p>화면에서 가릴 단어를 누르세요.</p><div className="vq-choices">{sentenceWords(draft.sentence).map((word, i) => <button type="button" key={i} aria-pressed={draft.hiddenWordIndices.includes(i)} onClick={() => setDraft({ ...draft, hiddenWordIndices: draft.hiddenWordIndices.includes(i) ? draft.hiddenWordIndices.filter(index => index !== i) : [...draft.hiddenWordIndices, i] })}>{draft.hiddenWordIndices.includes(i) ? '____' : word}</button>)}</div></div>}
          </>}
          {timeInput('다시 볼 시작점 (선택)', replay, setReplay)}
          <small>질문 시점보다 앞선 시간을 입력하세요. 비워 두면 장면 다시 보기를 사용하지 않아요.</small>
          <div className="vq-actions"><button type="button" onClick={() => { const q = validate(); if (q) { player.current?.pause(); setPreview(q); } }}>이 문항 미리보기</button><button className="vq-primary" type="submit">{busy ? '저장 중…' : '질문 저장'}</button><button type="button" onClick={() => { setDraft(null); setError(''); }}>편집 취소</button></div>
        </fieldset>
      </form>}
    </div></div>
    {(preview || run) && <AccessibleDialog label={preview ? '이 문항 미리보기' : '영상 질문 수업'} onClose={() => { setPreview(null); setRun(false); }}><div className="vq-editor"><button onClick={() => { setPreview(null); setRun(false); }}>편집으로 돌아가기</button><TimedVideoLesson slide={slide} source={clip.script} previewQuestion={preview ?? undefined}/></div></AccessibleDialog>}
  </div></AccessibleDialog>;
}
