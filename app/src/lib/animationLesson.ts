import { lessonBoard, lessonTitleSlide } from './lessonCanvas';
import { newTextElement } from '../components/CanvasSlideEditor';
import { animationLessonTiming, sceneLesson, sceneTeaching, type AnimationLessonPlan } from './animationScene';
import { clipThumb, type VideoClip } from './videoClips';
import type { CanvasSlide, FullCardItem, LessonSlide } from './types';

const uid = () => crypto.randomUUID();
const reveal = { effect:'fade',trigger:'click',duration:.2,delay:0 } as const;

function board(title:string, lines:string[], answer?:string) {
  const slide=lessonBoard(title,lines,5,'whiteboard');
  if(answer) slide.elements.push(newTextElement({x:8,y:82,w:84,h:14,text:answer,fitText:true,color:'#163b63',fill:'#fff0bc',font:'round',fontSize:5,motion:reveal}));
  return slide;
}

export function buildAnimationLesson(clip:VideoClip, cards:FullCardItem[], plan:AnimationLessonPlan):LessonSlide[] {
  const scene=sceneLesson(clip);
  if(scene.missing.length || !scene.range || !scene.expression) return [];
  const {expression,examples,questions,range}=scene;
  const extended=plan.minutes===40;
  const timing=animationLessonTiming(plan.minutes);
  const clipUrl='https://www.youtube.com/watch?v='+clip.youtube_id;
  const opener=questions.at(-1)!;
  const data=sceneTeaching(clip);
  const final=examples.at(-1)!;
  const models=examples.slice(0,-1);
  const cover=lessonTitleSlide(clip.title,clip.series+' · '+plan.minutes+' min','pastel');
  const predict=board('Look and predict',[opener.q,'Tell your partner what you think.'], 'Look for the answer as you watch.');
  predict.elements.splice(1,0,{id:uid(),type:'image',url:data.image??clipThumb(clip.youtube_id),fit:'contain',x:3,y:33,w:29,h:37});
  for (const item of predict.elements.slice(2,4)) {item.x=34;item.w=62;}
  const vocab=cards.slice(0,extended?8:6);
  const questionItems=questions.map((item,index)=>{
    const alternatives=data.choices?.[item.q]??[];
    const choices=[...alternatives];
    choices.splice(index%(choices.length+1),0,item.a);
    return {...item,choices:alternatives.length?choices:undefined};
  });
  const teacherNotes=(slide:LessonSlide,index:number,question:string,expected:string,hint:string,next:string):LessonSlide=>({
    ...slide,animationGuide:{clipId:clip.id,minutes:timing[index],question,expected,hint,next},
  });
  const step=(index:number,slide:LessonSlide,question:string,expected:string,hint:string,next:string)=>
    teacherNotes(slide,index,question,expected,hint,next);
  const pair = (example:typeof models[number],index:number):CanvasSlide=>board(index?'Try a new situation':'Talk with a partner',[
    example.situation,'Partner A: Say one sentence. Partner B: Give a short reply.','Switch roles after both of you speak.',
  ], 'A: '+example.answer+'   B: '+(example.answer.endsWith('?')?'Sure!':'Thank you.'));
  const round=(example:typeof models[number],title:string)=>board(title,[example.situation,'Say the target expression before you pass the turn.','Hint: '+expression.text],example.answer);
  const game=[
    step(6,board('Pass the turn',['Think for five seconds. Say a sentence for the situation.','If you get stuck, use the pattern. Then pass the turn.','Try the example together first.']), 'How do we play?', 'Take one turn and pass.','Model a turn before the first round.','Let’s try one together.'),
    ...models.slice(0,extended?4:3).map((item,index)=>round(item,index===0?'Example round':'Round '+index)),
  ];
  const exit=step(7,board('One last sentence',[final.situation,'Say or write one sentence on your own.'],final.answer),
    final.situation,final.answer,'Check that the target pattern fits the situation.','Read one answer and say what worked.');
  const slides:LessonSlide[]=[
    cover,
    step(0,predict,opener.q,opener.a,'Ask pupils to predict before giving the answer.','Let’s look for it in the video.'),
    step(1,{id:uid(),kind:'wordshow',boardTheme:'whiteboard',words:vocab,videoUrl:clipUrl},'What does this word mean?',vocab.map(word=>word.word+' · '+word.meaning).join(' / '),'Point, act out the meaning, or reveal the Korean meaning.','Listen for these words in the scene.'),
    step(2,board('Watch for the answer',[opener.q,'Share your answer after the video.']),opener.q,opener.a,'Let pupils listen before answering.','Now watch the scene.'),
    {id:uid(),kind:'video',title:clip.title,clipId:clip.id,videoUrl:clipUrl,startSec:range.start,endSec:range.end},
    step(3,{id:uid(),kind:'qna',title:'Story review',questions:questionItems,videoUrl:clipUrl,boardTheme:'whiteboard'},opener.q,opener.a,'Let students answer first. Replay the evidence if needed.','Now try the expression in a new situation.'),
    step(4,board('Look and say',[models[0].situation,expression.original?'From the scene: '+expression.original:'Learning expression: '+expression.text,expression.explanation],models[0].answer),
      models[0].situation,models[0].answer,expression.text,'Say it together, then change the situation.'),
    ...(extended?[board('Change the situation',[models[1].situation,'Use the same pattern.'],models[1].answer)]:[]),
    step(5,pair(models[1],0),models[1].situation,models[1].answer,expression.text,'Switch partners or roles.'),
    ...(extended?[pair(models[2]??models[0],1)]:[]),
  ];
  slides.push(...(plan.gameLast?[exit,...game]:[...game,exit]));
  return slides;
}
