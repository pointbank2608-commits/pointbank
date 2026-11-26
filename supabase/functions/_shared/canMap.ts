import type { SceneLine } from './grammarWorkshop.ts';

export function canMap(request:SceneLine) {
  const mapScenes:SceneLine[]=[request,
    {label:'수영 선생님 → 지우',setting:'첫 수업이에요. 선생님이 지우에게 어느 반이 맞을지 알아봐요.',chunks:['Can','you','swim?'],glosses:["할 줄 아니","너는","수영하다"],meaning:'너 수영할 줄 아니?',image:'/word-bank-images/swimming.webp',response:'Yes, I can. (네, 할 줄 알아요.)',rationale:'선생님은 누가 옆에서 잡아 주지 않아도 지우가 수영할 수 있는지 궁금해요. 매주 수영장에 다니는지는 이 대답만으로 알 수 없어요.'},
    {label:'지우 → 수영 선생님',setting:'지우는 수영할 줄 알아요. 쉬는 시간이 끝나 가자 물가에서 기다려요.',chunks:['Can','I','swim now?'],glosses:["해도 될까","내가","지금 수영하다"],meaning:'지금 수영해도 돼요?',image:'/word-bank-images/pool.webp',response:'Yes, you can. (응, 이제 들어가도 돼.)',rationale:'물에 들어갈 사람은 I, 곧 지우예요. 수영할 실력이 있어도 지금 들어가도 되는지는 선생님에게 따로 물어야 해요.'},
    {label:'수영 선생님 → 지우',setting:'쉬는 시간이 끝났어요. 선생님이 기다리던 지우에게 말해요.',chunks:['You','can','swim now.'],glosses:["너는","해도 돼","지금 수영하다"],meaning:'이제 수영해도 돼.',image:'/word-bank-images/pool.webp',response:'지우가 물에 들어가요.',rationale:'조금 전 Can I …? 하고 물은 지우에게 주는 대답이에요. 지우가 자신을 가리킬 때는 I, 선생님이 지우를 부를 때는 you예요.'},
    {label:'민서 → 지우',setting:'지우가 무거운 가방을 들고 있어요. 민서가 먼저 손을 내밀어요.',chunks:['Can','I','carry your bag?'],glosses:["해 줄까","내가","네 가방을 들다"],meaning:'네 가방 들어 줄까?',image:'/word-bank-images/carry.webp',response:'Yes, please. (응, 부탁해.) 지우가 가방을 건네요.',rationale:'가방을 들겠다는 사람은 I, 곧 민서예요. 민서가 하면 지우가 편해져서 도움을 제안하는 말이 돼요.'},
    {label:'안전요원 → 수영반',setting:'안전요원이 물기가 남은 바닥을 가리켜요.',chunks:['Wet floors','can','be slippery.'],glosses:["젖은 바닥은","그럴 수 있어","미끄럽다"],meaning:'젖은 바닥은 미끄러울 수 있어.',image:'/word-bank-images/slip.webp',response:'학생들이 발밑을 살피며 걸어요.',rationale:'반드시 미끄러진다는 말일까요? 물이 있으면 그런 일이 생길 수 있으니 조심하라는 뜻이에요.'}
  ];
  return {
    map:['부탁: 해 줄래?', '능력: 할 줄 아니?', '허락 구하기: 해도 돼요?', '허락해 주기: 해도 돼.', '도움 제안: 내가 해 줄까?', '일반적 가능성: 그럴 수 있어.'],
    mapScenes,
  };
}
