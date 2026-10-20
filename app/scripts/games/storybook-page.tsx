import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LessonRunnerProvider } from '../../src/context/LessonRunnerContext';
import { GameEmbedContext } from '../../src/context/GameEmbedContext';
import GameWorkspace from '../../src/components/GameWorkspace';
import StorybookGamePage from '../../src/pages/StorybookGamePage';
import GamesPage from '../../src/pages/GamesPage';
import { type StoryGame } from '../../src/lib/storybook';
import i18n from '../../src/i18n';
import '../../src/tailwind.css';
void i18n.changeLanguage('ko');
const q=new URLSearchParams(location.search);
const type=(q.get('game') || 'feedmonster') as StoryGame;
export function Fixture(){
  if(q.get('mode')==='games')return <GamesPage/>;
  if(q.get('mode')==='embed')return <GameEmbedContext.Provider value={{classId:'class-test',templateId:q.get('template') || undefined,onSelect:id=>{document.documentElement.dataset.template=id || '';}}}><StorybookGamePage type={type}/></GameEmbedContext.Provider>;
  if(q.get('mode')==='student')return <StorybookGamePage type={type}/>;
  return <GameWorkspace><StorybookGamePage type={type}/></GameWorkspace>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><LessonRunnerProvider><Fixture/></LessonRunnerProvider></BrowserRouter>);
