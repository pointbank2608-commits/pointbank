import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import StoryGame from '../../src/components/storybook/StoryGame';
import { storySample, type StoryGame as StoryType } from '../../src/lib/storybook';
const query=new URLSearchParams(location.search);
const type=(query.get('game') || 'feedmonster') as StoryType;
export function Harness(){
  const [key,setKey]=useState(0);
  const [config]=useState(()=>{
    const c=storySample(type);c.sound=query.has('sound');
    if(query.has('timed'))c.seconds=30;
    if(query.has('long')){
      if(type==='sentencetower'){c.start='My wonderful friends play.';c.steps=[{id:'long',phrase:'football together in the beautiful garden every afternoon after school',sentence:'My wonderful friends play football together in the beautiful garden every afternoon after school.',position:25,wrong:['a book']}];}
      else c.questions[0].prompt='My wonderful friends and I would like to find the correct answer to this very long English sentence ___ together after school.';
    }
    return c;
  });
  return <StoryGame key={key} type={type} config={config} onRestart={()=>setKey(n=>n+1)}/>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
