import { useTranslation } from 'react-i18next';
import { ADVENTURE_TYPES, MAX_ADVENTURE_QUESTIONS } from '../lib/adventureGames';
import { DETECTIVE_RULES, defaultDetectiveRules, previewDetectiveDraft, builtInDetectiveQuestions, detectiveCaseFromVariant } from '../lib/detectiveSuggestion';
import type { GameTemplateConfig, GameType } from '../lib/types';
import { SENTENCE_PATTERNS } from '../lib/sentencePatterns';
import CatchSentenceSettings, { CATCH_DEFAULT_SECONDS, type CatchLevel } from './CatchSentenceSettings';
import { normalizeContestRounds } from '../lib/liveQuiz';
import AdventureMapEditor from './adventure/AdventureMapEditor';
import GameImagePicker from './GameImagePicker';
import { useGameWorkspace } from '../context/GameWorkspaceContext';

const field='mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2';
/** Options from the dedicated editors, with content selection owned by the toolbar. */
export default function GameNativeOptions({type,value,onChange}:{type:GameType;value:GameTemplateConfig;onChange:(config:GameTemplateConfig)=>void}) {
  const {i18n,t}=useTranslation(),en=i18n.language.startsWith('en'),text=(ko:string,en:string)=>i18n.language.startsWith('en')?en:ko;
  const workspace=useGameWorkspace();
  const a=value.adventure,s=value.storybook;
  const patch=(p:Partial<GameTemplateConfig>)=>onChange({...value,...p});
  if(type==='quizshow') {
    const rounds=normalizeContestRounds(value.liveContestRounds);
    return <fieldset className="space-y-3 rounded-xl bg-surface-container-low p-3"><legend className="font-bold">{text('라운드 설정','Round settings')}</legend>{rounds.map((round,i)=><div key={round.type} className="space-y-2 rounded-xl bg-white p-3">
      <label className="flex min-h-10 items-center gap-2 font-bold"><input type="checkbox" checked={round.on} onChange={e=>patch({liveContestRounds:rounds.map((r,j)=>j===i?{...r,on:e.target.checked}:r)})}/>{t(`liveQuiz.roundName_${round.type}`)}</label>
      <label className="block text-sm">{text('문제 수 (−1은 전체)','Questions (−1 = all)')}<input className={field} type="number" min={-1} value={round.count} onChange={e=>patch({liveContestRounds:rounds.map((r,j)=>j===i?{...r,count:e.target.valueAsNumber}:r)})}/></label>
      <label className="block text-sm">{text('제한 시간(초)','Time limit (sec)')}<input className={field} type="number" min={5} max={120} value={round.seconds??20} onChange={e=>patch({liveContestRounds:rounds.map((r,j)=>j===i?{...r,seconds:e.target.valueAsNumber}:r)})}/></label>
      <label className="block text-sm">{text('점수','Points')}<input className={field} type="number" min={0} value={round.points??1000} onChange={e=>patch({liveContestRounds:rounds.map((r,j)=>j===i?{...r,points:e.target.valueAsNumber}:r)})}/></label>
      <div className="flex gap-2">{[-1,1].map(delta=><button key={delta} type="button" className="min-h-11 rounded-xl border px-3 font-bold disabled:opacity-40" disabled={i+delta<0||i+delta>=rounds.length} onClick={()=>{const next=[...rounds];[next[i],next[i+delta]]=[next[i+delta],next[i]];patch({liveContestRounds:next});}}>{delta===-1?text('위로','Up'):text('아래로','Down')}</button>)}</div>
    </div>)}</fieldset>;
  }
  if(type==='catchsentence') return <CatchSentenceSettings level={(value.catchLevel??1) as CatchLevel} seconds={value.catchSeconds??CATCH_DEFAULT_SECONDS[(value.catchLevel??1) as CatchLevel]} onChange={next=>patch({catchLevel:next.level??value.catchLevel,catchSeconds:next.seconds??value.catchSeconds})}/>;
  if(type==='watermelon') return <label className="block font-bold">{text('문장 틀','Sentence pattern')}<select className={field} value={value.watermelonPatternId??'svo'} onChange={e=>patch({watermelonPatternId:e.target.value})}>{SENTENCE_PATTERNS.filter(p=>p.playable).map(p=><option key={p.id} value={p.id}>{p.slots.join(' + ')}</option>)}</select></label>;
  if(type==='labeleddiagram') return <section className="space-y-2"><p className="font-bold">{text('문제 그림','Diagram image')}</p><GameImagePicker academyId={workspace?.info?.academyId??''} value={value.diagramImageUrl??null} onChange={url=>patch({diagramImageUrl:url??undefined})}/></section>;
  if(type==='winlosequiz') return <div className="space-y-2"><p className="font-bold">{text('걸 수 있는 점수','Bet options')}</p>{(value.winLoseBetOptions??[10,20,50]).map((amount,i)=><label key={i} className="block text-sm">{i+1}<input className={field} type="number" min={0} value={amount} onChange={e=>patch({winLoseBetOptions:(value.winLoseBetOptions??[10,20,50]).map((v,j)=>i===j?e.target.valueAsNumber:v)})}/></label>)}</div>;
  if(type==='saveorgive') return <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
    <label className="block font-bold">{text('참여 방식','Participation')}<select className={field} value={value.saveOrGiveMode??'team'} onChange={e=>patch({saveOrGiveMode:e.target.value as 'team'|'individual'})}><option value="team">{text('팀전','Teams')}</option><option value="individual">{text('개인전','Individuals')}</option></select></label>
    <label className="block font-bold">{text('팀 수','Teams')}<input className={field} type="number" min={2} max={8} value={value.saveOrGiveTeamCount??2} onChange={e=>patch({saveOrGiveTeamCount:e.target.valueAsNumber})}/></label>
    <label className="block font-bold">{text('개인 참가자 · 한 줄에 한 명','Individual players · one per line')}<textarea className={field} value={(value.saveOrGiveParticipants??[]).map(p=>p.label).join('\n')} onChange={e=>patch({saveOrGiveParticipants:e.target.value.split('\n').map((label,i)=>({id:value.saveOrGiveParticipants?.[i]?.id??crypto.randomUUID(),label}))})}/></label>
    <label className="block font-bold">{text('반전 결과 · 점수 또는 swap을 한 줄에 하나','Rewards · one score or swap per line')}<textarea className={field} value={(value.rewardPool??[{kind:'points',value:100},{kind:'points',value:-50},{kind:'swap'},{kind:'points',value:0}]).map(r=>r.kind==='swap'?'swap':String(r.value??0)).join('\n')} onChange={e=>patch({rewardPool:e.target.value.split('\n').map(row=>row.trim()==='swap'?{kind:'swap'}:{kind:'points',value:Number(row)})})}/></label>
  </div>;
  if((ADVENTURE_TYPES as readonly string[]).includes(type)&&a) {
    const set=(p:Partial<typeof a>)=>patch({adventure:{...a,...p}});
    const source=a.detectiveSource;
    const rules=source?.rules??defaultDetectiveRules;
    const applicable=source&&source.kind!=='default'?previewDetectiveDraft(source.text,defaultDetectiveRules,source.kind).applicableRules:undefined;
    return <div className="space-y-3 rounded-xl bg-surface-container-low p-3" data-native-game-options>
      {type==='treasurehunt'&&<AdventureMapEditor value={a.places} onChange={places=>set({places})}/>}
      {type==='grammardetective'?<>
        <fieldset><legend className="font-bold">{text('적용할 문법','Grammar topics')}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{DETECTIVE_RULES.map(rule=><label key={rule.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" disabled={applicable?!applicable.has(rule.id):false} checked={rules.includes(rule.id)} onChange={e=>{
          const next=e.target.checked?[...rules,rule.id]:rules.filter(id=>id!==rule.id);
          const questions=source&&source.kind!=='default'?previewDetectiveDraft(source.text,next,source.kind).ready:builtInDetectiveQuestions(next);
          set({detectiveSource:{...(source??{kind:'default'}),rules:next},cases:questions.map(({variant,context})=>detectiveCaseFromVariant(variant,undefined,context||undefined))});
        }}/>{en?rule.en:rule.ko}</label>)}</div></fieldset>
        <label className="block font-bold">{text('한 게임당 문제 수','Questions per game')}<input className={field} type="number" min={1} step={1} placeholder={text('전체 문제','All questions')} value={a.detectiveQuestionLimit??''} onChange={e=>set({detectiveQuestionLimit:e.target.value===''?undefined:e.target.valueAsNumber})}/></label>
        <label className="block font-bold">{text('답하는 방식','Answer mode')}<select className={field} value={a.detectiveMode} onChange={e=>set({detectiveMode:e.target.value as typeof a.detectiveMode})}><option value="choice">{text('보기 고르기','Choose an answer')}</option><option value="type">{text('직접 입력','Type an answer')}</option></select></label>
        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={a.caseSensitive} onChange={e=>set({caseSensitive:e.target.checked})}/>{text('대소문자 구분','Case sensitive')}</label>
        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={a.punctuationSensitive} onChange={e=>set({punctuationSensitive:e.target.checked})}/>{text('문장부호 구분','Punctuation sensitive')}</label>
      </>:!['balloonpop','wordfishing','wordclaw'].includes(type)&&<label className="block font-bold">{text('최대 문제 개수','Maximum questions')}<input className={field} type="number" min={1} max={MAX_ADVENTURE_QUESTIONS} value={a.count} onChange={e=>set({count:e.target.valueAsNumber})}/></label>}
      {['balloonpop','wordfishing'].includes(type)&&<>
        <label className="block font-bold">{text('보기 개수','Choices')}<select className={field} value={a.choices} onChange={e=>set({choices:Number(e.target.value) as typeof a.choices})}>{[3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
        <label className="block font-bold">{text('움직임 속도','Speed')}<select className={field} value={a.speed} onChange={e=>set({speed:e.target.value as typeof a.speed})}><option value="slow">{text('천천히','Slow')}</option><option value="normal">{text('보통','Normal')}</option><option value="fast">{text('빠르게','Fast')}</option></select></label>
        {type==='wordfishing'&&<label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={a.listening} onChange={e=>set({listening:e.target.checked})}/>{text('영어 듣기 모드 (음성이 없으면 뜻 표시)','Listen to English (show meaning if unavailable)')}</label>}
      </>}
      {type==='wordclaw'&&<label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={a.simpleClaw} onChange={e=>set({simpleClaw:e.target.checked})}/>{text('쉬운 모드: 단어를 바로 눌러 뽑기','Easy mode: tap a word to draw')}</label>}
      <label className="block font-bold">{text('제한 시간','Time limit')}<select className={field} value={a.seconds} onChange={e=>set({seconds:Number(e.target.value)})}>{[0,20,30,45,60,90].map(n=><option key={n} value={n}>{n?`${n}${text('초','s')}`:text('시간 제한 없음','No time limit')}</option>)}</select></label>
      <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={a.shuffle} onChange={e=>set({shuffle:e.target.checked})}/>{text('문제 순서 섞기','Shuffle questions')}</label>
    </div>;
  }
  if(s) return <div className="space-y-3 rounded-xl bg-surface-container-low p-3" data-native-game-options>
    {type==='feedmonster'&&<label className="block font-bold">{text('학습 모드','Learning mode')}<select className={field} value={s.mode} onChange={e=>patch({storybook:{...s,mode:e.target.value as typeof s.mode}})}><option value="vocabulary">Vocabulary Match · {text('한국어 뜻 → 영어 단어','Meaning → English word')}</option><option value="sentence">Sentence Match · {text('요청 문장 → 단어','Request sentence → word')}</option></select></label>}
    <label className="block font-bold">{text('문제 개수','Questions')}<input className={field} type="number" min={type==='sentencebridge'?5:1} max={type==='sentencebridge'?10:50} disabled={type==='sentencetower'} value={s.count} onChange={e=>patch({storybook:{...s,count:e.target.valueAsNumber}})}/></label>
    <label className="block font-bold">{text('문제별 제한 시간','Time per question')}<select className={field} value={s.seconds} onChange={e=>patch({storybook:{...s,seconds:Number(e.target.value)}})}>{[0,30,60,90].map(n=><option key={n} value={n}>{n?`${n}${text('초','s')}`:text('시간 제한 없음','No time limit')}</option>)}</select></label>
    {(['shuffle','hints'] as const).map(key=><label key={key} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={s[key]} disabled={key==='shuffle'&&type==='sentencetower'} onChange={e=>patch({storybook:{...s,[key]:e.target.checked}})}/>{key==='shuffle'?text('문제 순서 섞기','Shuffle questions'):text('힌트 표시','Show hints')}</label>)}
    {type==='sentencetower'&&<label className="block font-bold">{text('시작 문장','Starting sentence')}<input className={field} value={s.start} onChange={e=>patch({storybook:{...s,start:e.target.value}})}/></label>}
  </div>;
  return null;
}
