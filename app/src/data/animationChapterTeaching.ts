import type {AnimationExpression} from '../lib/types';
import type {ShadowLine} from '../lib/shadowLines';

/** Source: YouTube English auto captions exported 2026-11-22.
 * Bounds below are existing caption cue starts, not guessed speech durations.
 * Catalogue episode/chapter boundaries remain unchanged. */
export const chapterTeaching:Record<string,{definitions?:Record<string,string>;lines:ShadowLine[];chapters:{questions:{q:string;a:string;choices:string[]}[];expression?:AnimationExpression}[]}>={
 'DhKIqYVB_Ws:episode:0':{
  // Teaching definitions, authored separately from the caption quotations.
  definitions:{copy:'to make another document or picture that is the same as the original',glasses:'two lenses in a frame that you wear over your eyes to help you see'},
  lines:[
   [8,12,'Are you excited to come to work with me today, Caillou?','오늘 아빠와 함께 출근해서 신나니?','Dad'],
   [19,31,'Wow. What a great tie.','와, 정말 멋진 넥타이구나.','Dad'],
   [31,34,'What are all those numbers, Daddy?','저 숫자들은 뭐예요, 아빠?','Caillou'],
   [34,40,'Well, Caillou, if you press a number, the elevator takes you to that floor.','숫자를 누르면 엘리베이터가 그 층으로 데려다준단다.','Dad'],
   [40,45,"Why don't you give it a try? We're going to level four.",'한번 해 보렴. 우리는 4층으로 간단다.','Dad'],
   [69,77,'Good morning, Caillou. This is Valerie. She runs the whole office.','안녕, 카이유. 이분은 사무실을 관리하는 밸러리란다.','Dad'],
   [81,95,'Very nice to meet you, Miss Valerie.','만나서 정말 반가워요, 밸러리 선생님.','Caillou'],
   [103,106,'What do you do, Daddy?','아빠는 무슨 일을 하세요?','Caillou'],
   [106,114,'Well, Daddy does lots of things, Caillou. Right now, Valerie needs us to make some copies for a presentation.','아빠는 여러 일을 한단다. 지금은 발표에 쓸 복사본을 만들어야 해.','Dad'],
   [121,128,"Caillou, we need to make some copies so that everyone can read it. It's kind of like a show and tell.",'모두가 읽을 수 있도록 복사본이 필요해. 보여 주고 이야기하는 활동과 비슷해.','Dad'],
   [140,142,'How does it work, Daddy?','이건 어떻게 작동해요, 아빠?','Caillou'],
   [142,152,'Well, you take whatever it is that you want to copy and put it up here.','복사하고 싶은 것을 가져와서 여기에 올려놓는 거야.','Dad'],
   [152,165,'Then you press the number for how many copies you want to make.','그런 다음 만들고 싶은 복사본 수를 눌러.','Dad'],
   [165,168,'And they pop right out into that tray.','그러면 저 받침대로 나온단다.','Dad'],
   [169,175,'So it can copy anything.','그러면 뭐든 복사할 수 있네요.','Caillou'],
   [208,211,'Oh, Valerie needs me.','밸러리가 아빠를 찾는구나.','Dad'],
   [211,228,"I'll be right back. Why don't you finish putting those copies together?",'곧 돌아올게. 복사한 것들을 정리해 주겠니?','Dad'],
   [263,271,"Oh, excuse me, sir. Have you seen my son? He's about your height with a yellow shirt.",'실례합니다. 제 아들을 보셨나요? 당신 정도 키에 노란 셔츠를 입었는데요.','Dad'],
   [271,277,"It's me, Daddy. Now I'm a business person just like you.",'저예요, 아빠. 저도 아빠처럼 회사원이 됐어요.','Caillou'],
   [277,285,"Oh, Caillou, you don't need glasses or a mustache for that.",'카이유, 그러려고 안경이나 콧수염이 필요한 건 아니란다.','Dad'],
   [300,314,"So, we've had a special helper around the office today. Caillou has been helping Boris prepare for today's meeting, and he really has been lending a hand.",'오늘 사무실에 특별한 도우미가 있었어요. 카이유가 보리스의 회의 준비를 도왔답니다.','Valerie'],
   [320,329,'That was so cool, Daddy. When I grow up, I want to work in an office just like you.','정말 멋졌어요, 아빠. 저도 커서 아빠처럼 사무실에서 일하고 싶어요.','Caillou'],
  ].map(([start,end,en,ko,speaker])=>({start:Number(start),end:Number(end),en:String(en),ko:String(ko),speaker:String(speaker)})),
  chapters:[
   {questions:[{q:'Who goes to work with Daddy?',a:'Caillou goes to work with Daddy.',choices:['Rosie goes to work with Daddy.','Grandma goes to work with Daddy.']},{q:'Which floor do they go to?',a:'They go to level four.',choices:['They go to level two.','They go to level five.']}],expression:{text:"Why don't you …?",original:"Why don't you give it a try?",explanation:'상대에게 해 보라고 제안해요.',examples:[{situation:'문을 열어 보라고 제안하기',answer:"Why don't you open the door?"},{situation:'그림을 그려 보라고 제안하기',answer:"Why don't you draw a picture?"}]}},
   {questions:[{q:'What machine does Daddy show Caillou?',a:'He shows Caillou a copier.',choices:['He shows Caillou an elevator.','He shows Caillou a telephone.']},{q:'Where do the copies come out?',a:'They come out into the tray.',choices:['They come out into a bag.','They come out under a chair.']}],expression:{text:'It can copy …',original:'So it can copy anything.',explanation:'복사할 수 있는 것을 바꿔 말해요.',examples:[{situation:'그림을 복사할 수 있다고 말하기',answer:'It can copy a picture.'},{situation:'편지를 복사할 수 있다고 말하기',answer:'It can copy a letter.'}]}},
   {questions:[{q:'Who helps Boris prepare for the meeting?',a:'Caillou helps Boris prepare for the meeting.',choices:['Rosie helps Boris.','Grandma helps Boris.']},{q:'Where does Caillou want to work when he grows up?',a:'He wants to work in an office.',choices:['He wants to work on a farm.','He wants to work in a shop.']}],expression:{text:'I want to work in …',original:'I want to work in an office just like you.',explanation:'일하고 싶은 장소를 바꿔 말해요.',examples:[{situation:'학교에서 일하고 싶다고 말하기',answer:'I want to work in a school.'},{situation:'병원에서 일하고 싶다고 말하기',answer:'I want to work in a hospital.'}]}}
  ]
 }
};
