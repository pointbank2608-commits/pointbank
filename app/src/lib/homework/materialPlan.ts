import type { FullCardItem } from '../types';
import { newBlock, type BlockType } from './blocks';
import { meaningQ, shuffleWith, SKILL } from './build';
import type { HwItemDraft, HwQuestion, HwShadowLine } from './types';

export const labels = {
  learn: '단어 익히기', choice: '뜻 고르기', say: '뜻 보고 영어로 말하기', spell: '가리고 쓰기 · 스펠링',
  listen: '문장 보고 듣기', repeat: '듣고 따라 말하기', hide: '읽고 가리고 말하기', order: '문장 순서 맞추기', write: '문장 쓰기',
  sceneWords: '장면 속 단어 익히기', watch: '장면 보고 듣기', echo: '대사 듣고 따라 말하기', shadow: '섀도잉', dub: '역할 더빙하기',
};
export type Activity = keyof typeof labels;
export type Material = {
  id: string; name: string; kind: 'word' | 'sentence' | 'scene' | 'frequent'; cards: FullCardItem[];
  scene?: { videoUrl: string; start: number; end: number; lines: HwShadowLine[] };
};
export type Settings = {
  activities: Activity[]; spelling?: 'first' | 'one' | 'all'; mask?: 1 | 3 | 'all'; writing?: 'blank' | 'full'; role?: string;
};
export const activitiesByKind: Record<Material['kind'], Activity[]> = {
  word: ['learn','choice','say','spell'], sentence: ['listen','repeat','hide','order','write'],
  scene: ['sceneWords','watch','echo','shadow','dub'], frequent: [],
};
const materialVersion = 'homework-material-v1';

export function spellingExercise(word: string, mode: Settings['spelling'] = 'first') {
  const letters = Array.from(word);
  const indices = letters.flatMap((letter,i) => /[a-z]/i.test(letter) ? [i] : []);
  const index = indices[mode === 'one' ? Math.floor(indices.length / 2) : 0];
  const hidden = new Set(mode === 'all' ? indices : [index]);
  return { prompt: letters.map((c,i) => hidden.has(i) ? '□' : c).join(''), answer: indices.length ? (mode === 'all' ? word : letters[index]) : '' };
}

function gradedQuestion(card: FullCardItem, activity: Activity, settings: Settings, pool: FullCardItem[]): HwQuestion | null {
  const {word,meaning} = card;
  const needsMeaning = activity !== 'write' || settings.writing === 'full';
  if (!word.trim() || (needsMeaning && !meaning.trim()) || word.includes('/')) return null;
  if (activity === 'choice') {
    // Exclude alternative senses of the same headword from the distractors.
    const other = pool.filter(c => c.word.trim().toLowerCase() !== word.trim().toLowerCase());
    const q = meaningQ(card, other, Math.random);
    return q?.choices?.length === 4 ? {...q, contentId:card.id, gen:materialVersion} : null;
  }
  const base = {id:crypto.randomUUID(), word, card:{word,meaning}, contentId:card.id, gen:materialVersion};
  const tokens = word.trim().split(/\s+/);
  if (activity === 'order') {
    if (tokens.length < 2 || new Set(tokens).size < 2) return null;
    const shuffled = shuffleWith(tokens, Math.random);
    if (shuffled.join(' ') === tokens.join(' ')) shuffled.push(shuffled.shift()!);
    return {...base, skill:SKILL.sentence, qtype:'order', style:'sentence', prompt:meaning, tokens:shuffled, correct:tokens, joiner:' '};
  }
  if (activity === 'spell') {
    const exercise = spellingExercise(word,settings.spelling);
    return exercise.answer ? {...base,skill:SKILL.spelling,qtype:'text',style:'hint',prompt:exercise.prompt,sub:meaning,correct:exercise.answer,missingLetter:settings.spelling !== 'all'} : null;
  }
  const writing = {...base,skill:'writing.sentence',qtype:'text',style:'content'} as const;
  if (settings.writing === 'full') return {...writing,prompt:meaning,correct:word};
  const match = /[a-zA-Z]+(?:['’-][a-zA-Z]+)*(?=[^a-zA-Z]*$)/.exec(word);
  if (!match) return null;
  const prompt = word.slice(0,match.index)+'____'+word.slice(match.index+match[0].length);
  return {...writing,prompt,sub:meaning,correct:match[0]};
}

export function buildMaterialPlan(material: Material, settings: Settings, pool: FullCardItem[]) {
  const items: HwItemDraft[] = [], issues: string[] = [];
  const scene = material.scene;
  if (material.kind === 'scene' && (!scene || !scene.videoUrl || scene.end <= scene.start)) {
    return {items,issues:[material.name+'의 영상 구간을 확인해 주세요.']};
  }
  for (const activity of activitiesByKind[material.kind].filter(a => settings.activities.includes(a))) {
    const startCount = items.length;
    const issueCount = issues.length;
    const groupKey = JSON.stringify([material.kind,material.id,activity,activity === 'dub' ? settings.role : activity === 'spell' ? settings.spelling : activity === 'hide' ? settings.mask : activity === 'write' ? settings.writing : null]);
    const make = (type:BlockType) => {
      const item = newBlock(type);
      item.title = labels[activity];
      Object.assign(item.config.block!, {method:'material:'+activity,groupKey,materialName:material.name,guidedPractice:true});
      return item;
    };
    if (['choice','spell','order','write'].includes(activity)) {
      const questions = material.cards.map(c=>gradedQuestion(c,activity,settings,pool));
      const invalid = material.cards.filter((_,index)=>!questions[index]);
      if (invalid.length && material.kind==='sentence') {
        const needsMeaning = activity==='order' || settings.writing==='full';
        const untranslated = invalid.filter(c=>needsMeaning && !c.meaning.trim());
        if (untranslated.length) issues.push('한글 뜻 입력이 필요한 문장 · '+untranslated.map(c=>c.word).join(' / '));
        const unusable = invalid.filter(c=>!untranslated.includes(c));
        if (unusable.length) issues.push(labels[activity]+'에 쓸 영어 문장을 확인해 주세요 · '+unusable.map(c=>c.word).join(' / '));
      } else if (invalid.length) issues.push(material.name+' · '+labels[activity]+'에 필요한 뜻, 보기 또는 영어 문장을 확인해 주세요.');
      const valid = questions.filter((q):q is HwQuestion=>!!q);
      for (let p=0;p<valid.length;p+=100) {
        const item = make('recall');
        item.content.questions = valid.slice(p,p+100);
        items.push(item);
      }
    } else if (scene && ['watch','shadow','dub','echo'].includes(activity)) {
      const lines = scene.lines.filter(line=>line.en.trim() && line.s>=scene.start && line.e<=scene.end && line.e>line.s);
      if (activity === 'dub' && (!settings.role || !lines.some(line=>line.speaker===settings.role))) {
        issues.push(material.name+'에서 대사가 있는 역할을 지정해 주세요.');
        continue;
      }
      if (activity === 'echo') {
        for (const line of lines) {
          const item = make('speak');
          Object.assign(item.config.block!,{videoUrl:scene.videoUrl,start:line.s,end:line.e,text:line.en,translation:line.ko||'',stages:['model']});
          item.content.lines=[line]; items.push(item);
        }
      } else if (activity==='watch'||lines.length) {
        const item=make(activity==='watch'?'video':'speak');
        Object.assign(item.config.block!,{videoUrl:scene.videoUrl,start:scene.start,end:scene.end,text:material.name,role:activity==='dub'?settings.role:undefined,stages:['model']});
        item.content.lines=lines; items.push(item);
      }
    } else {
      for (const card of material.cards) {
        if (!card.word.trim() || (material.kind!=='sentence' && !card.meaning.trim())) {
          issues.push(material.name+' · '+(card.word||labels[activity])+'의 영어와 한글 뜻이 필요해요.');
          continue;
        }
        const item=make(activity==='listen'?'study':'speak');
        const words=card.word.trim().split(/\s+/);
        const n=settings.mask==='all'?words.length:Math.min(words.length,settings.mask??1);
        Object.assign(item.config.block!,{text:card.word,translation:card.meaning,materialEntryId:card.id,stages:activity==='hide'?['model','hidden']:['model'],
          hiddenWords:activity==='hide'?Array.from({length:n},(_,i)=>words.length-n+i):[]});
        items.push(item);
      }
    }
    if (items.length===startCount && issues.length===issueCount) issues.push(material.name+' · '+labels[activity]+'에 사용할 자료가 없어요.');
  }
  return {items,issues:[...new Set(issues)]};
}
