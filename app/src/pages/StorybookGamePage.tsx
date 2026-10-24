import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useGameWorkspace } from '../context/GameWorkspaceContext';
import { useGameTemplates } from '../lib/useGameTemplates';
import { createGameTemplate, renameGameTemplate } from '../lib/api';
import { storySample, storyErrors, STORY_NAMES, type StorybookConfig, type StoryGame as StoryType } from '../lib/storybook';
import type { GameTemplate } from '../lib/types';
import GameThemeFrame from '../components/GameThemeFrame';
import AddActivityToLesson from '../components/AddActivityToLesson';
import StoryGame from '../components/storybook/StoryGame';
import StoryEditor from '../components/storybook/StoryEditor';

export default function StorybookGamePage({ type }: { type: StoryType }) {
  const g=useGameTemplates({gameType:type,defaultItems:()=>[],defaultConfig:()=>({storybook:storySample(type)}),listKind:'all'});
  const workspace=useGameWorkspace();
  const {notify}=useToast();
  const {profile}=useAuth();
  const [fallback,setFallback]=useState(()=>({storybook:storySample(type)}));
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState(false);
  const [name,setName]=useState('');
  const [addLesson,setAddLesson]=useState(false);
  const selected=g.selected;
  const config=selected?.config.storybook || fallback.storybook;
  async function apply(value: StorybookConfig) {
    if (storyErrors(type,value).length || busy) return;
    setBusy(true);
    try {
      const next={...selected?.config,storybook:structuredClone(value)};
      // Teacher-authored rules now own the content; stale source adapters must not override it.
      delete next.classroomSource;
      if(!await g.persistConfig(next,name.trim()||STORY_NAMES[type]))setFallback({storybook:structuredClone(value)});
      setPending(false);setRevision(n=>n+1);notify('게임 설정을 적용했어요.');
    } catch(e){notify(e instanceof Error?e.message:String(e),'error');throw e;}
    finally{setBusy(false);}
  }
  async function save(copy: boolean) {
    if(!g.academy || !profile || busy || storyErrors(type,config).length)return;
    setBusy(true);
    try {
      const title=name.trim() || `${STORY_NAMES[type]} · ${new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}`;
      if(!copy && selected){await renameGameTemplate(selected.id,title);g.setTemplates(old=>old.map(t=>t.id===selected.id?{...t,name:title}:t));}
      else {
        // The existing API enforces authentication and academy RLS.
        const saved=await createGameTemplate({academyId:g.academy.id,classId:g.classId,teacherId:profile.id,gameType:type,name:title,items:[],config:{...selected?.config,storybook:structuredClone(config)}});
        g.setTemplates(old=>[...old,saved]);g.setSelectedId(saved.id);
      }
      setName('');notify('게임을 저장했어요.');
    } catch(e){notify(e instanceof Error?e.message:String(e),'error');}finally{setBusy(false);}
  }
  const activity:GameTemplate=selected || {id:'storybook-preview',game_type:type,academy_id:g.academy?.id || '',class_id:g.classId,created_by:null,created_at:'',updated_at:'',items:[],name:STORY_NAMES[type],config:{storybook:config}};
  return <div className="space-y-4">
    {!g.loading && <GameThemeFrame gameType={type} onRestart={()=>setRevision(n=>n+1)}><StoryGame key={`${type}:${selected?.id}:${revision}:${JSON.stringify(config)}`} type={type} config={config} onRestart={()=>setRevision(n=>n+1)}/></GameThemeFrame>}
    {g.isStaff && !g.presenting && !workspace?.playing && <>
      <section className="sb-editor"><h2>{STORY_NAMES[type]} · 게임 준비</h2><p>콘텐츠를 적용하고 미리 본 다음 저장하세요. 제목을 비우면 자동으로 이름이 붙어요.</p><div className="sb-edit-row"><label>저장된 게임<select value={g.selectedId || ''} onChange={e=>{setPending(false);g.setSelectedId(e.target.value || null);}}><option value="">샘플 미리보기</option>{g.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>게임 제목 (선택)<input value={name} placeholder={selected?.name || STORY_NAMES[type]} onChange={e=>setName(e.target.value)}/></label></div><div className="sb-edit-row"><button className="sb-save" disabled={busy || pending || !!storyErrors(type,config).length} onClick={()=>void save(true)}>새 게임으로 저장</button>{selected && <button disabled={busy} onClick={()=>void save(false)}>제목 변경</button>}<button disabled={busy || pending || !!storyErrors(type,config).length} onClick={()=>setAddLesson(true)}>수업에 삽입</button></div></section>
      <StoryEditor key={`${selected?.id}:${revision}:${JSON.stringify(config)}`} type={type} value={config} lists={g.wordLists} loading={g.wordListsLoading} busy={busy} onApply={apply} onDirty={setPending}/>
    </>}
    {addLesson && <AddActivityToLesson activity={activity} onClose={()=>setAddLesson(false)}/>}
  </div>;
}

export function FeedMonsterPage(){return <StorybookGamePage type="feedmonster"/>;}
export function SentenceBridgePage(){return <StorybookGamePage type="sentencebridge"/>;}
export function SentenceTowerPage(){return <StorybookGamePage type="sentencetower"/>;}
