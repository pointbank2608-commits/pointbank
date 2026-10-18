import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import SoloGameStep from '../../src/components/solo/SoloGameStep';
import type { SoloPlayerApi } from '../../src/components/solo/SoloPlayer';
import RecommendReview from '../../src/components/homework/teacher/RecommendReview';
import { openGameCheck, answerGameCheck } from '../../src/lib/gameLearning';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import HomeworkPage from '../../src/pages/HomeworkPage';
void i18n.changeLanguage('ko');
const handoff=new URLSearchParams(location.search).has('handoff');
if(handoff)history.replaceState({usr:{fromClassId:'c',personalGame:{name:'게임에서 가져온 단어',cards:[['apple','사과'],['banana','바나나'],['cat','고양이'],['dog','강아지']].map(([word,meaning])=>({id:word,word,meaning,imageUrl:null}))}},key:'synthetic-handoff'},'',location.href);
const api: SoloPlayerApi = {
  answer: async () => true,
  advance: async () => ({ answer: null }),
  reveal: async () => null,
  submitTest: async () => ({ score: 0, total: 0, items: [], by_area: {} }),
  gameTemplate: async () => ({
    game_type: 'matchup',
    name: 'Synthetic game',
    items: [],
    config: {
      pairs: [
        { id: 'a', left: 'apple', right: '사과' },
        { id: 'b', left: 'banana', right: '바나나' },
      ],
    },
  }),
  gameCheckOpen: () => openGameCheck('synthetic', 'assignment', 0),
  gameCheckAnswer: (_, q, v, r) =>
    answerGameCheck('synthetic', 'assignment', 0, q, v, r),
};
export default function Fixture() {
  const [done, setDone] = useState(false);
  const rec = new URLSearchParams(location.search).has('recommend');
  if (done) return <h1>합성 검증 완료</h1>;
  if(handoff)return <HomeworkPage/>;
  return rec ? (
    <div className="p-4">
      <RecommendReview
        academyId="a"
        classId="c"
        students={[
          { id: 'alice', name: 'Alice' },
          { id: 'bob', name: 'Bob' },
        ]}
        initialGamesOnly
        onClose={() => setDone(true)}
        onSent={() => setDone(true)}
      />
    </div>
  ) : (
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 bg-[#16213e] p-5 text-white">
      <SoloGameStep
        api={api}
        stepIndex={0}
        step={{
          t: 'game',
          gameType: 'matchup',
          templateId: 'game',
          title: '합성 게임',
        }}
        load={api.gameTemplate}
        busy={false}
        onDone={() => setDone(true)}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Fixture />
  </BrowserRouter>,
);
