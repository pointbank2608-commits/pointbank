import { curriculumEntries, wordBySpelling } from '../data/phonicsCurriculum';
import { worksheetActivity } from './worksheetActivityCatalog';
import { newTask, rebuildWordTasks, type StudioTask, type StudioWord, type WorksheetDocument } from './worksheetStudio';

// This is pronunciation metadata for examples, not a second curriculum or asset list.
const soundData:Record<string,[string,string,string,number]>={
 cat:['c|a|t','k|æ|t','cat',1],cap:['c|a|p','k|æ|p','cap',1],cup:['c|u|p','k|ʌ|p','cup',1],cot:['c|o|t','k|ɒ|t','cot',1],dot:['d|o|t','d|ɒ|t','dot',1],dog:['d|o|g','d|ɒ|g','dog',1],fog:['f|o|g','f|ɒ|g','fog',1],log:['l|o|g','l|ɒ|g','log',1],
 fish:['f|i|sh','f|ɪ|ʃ','fish',1],dish:['d|i|sh','d|ɪ|ʃ','dish',1],ship:['sh|i|p','ʃ|ɪ|p','ship',1],shop:['sh|o|p','ʃ|ɒ|p','shop',1],pig:['p|i|g','p|ɪ|g','pig',1],big:['b|i|g','b|ɪ|g','big',1],hen:['h|e|n','h|e|n','hen',1],pen:['p|e|n','p|e|n','pen',1],
 fox:['f|o|x:x','f|ɒ|k|s','fox',1],cow:['c|ow','k|aʊ','cow',1],bee:['b|ee','b|iː','bee',1],tea:['t|ea','t|iː','tea',1],hat:['h|a|t','h|æ|t','hat',1],bag:['b|a|g','b|æ|g','bag',1],
 cake:['c|a_e|k','k|eɪ|k','cake',1],rain:['r|ai|n','r|eɪ|n','rain',1],apple:['a|pp|le','æ|p|əl','ap|ple',1],banana:['b|a|n|a|n|a','b|ə|n|æ|n|ə','ba|na|na',2],rabbit:['r|a|bb|i|t','r|æ|b|ɪ|t','rab|bit',1],
};
const originals:Record<string,{example:string;partner?:string;parts?:string;meaning?:string;category?:string}>={
 cat:{example:'The cat sits on a mat.',partner:'cap',category:'Pets'},dog:{example:'The dog runs in the park.',partner:'log',category:'Pets'},fish:{example:'The fish swims in the pond.',partner:'dish',category:'Water'},pig:{example:'The pig is in the mud.',partner:'big',category:'Farm'},hen:{example:'The hen has an egg.',partner:'pen',category:'Farm'},fox:{example:'The fox runs past a tree.',partner:'box',category:'Wild'},cow:{example:'The cow eats grass.',partner:'how',category:'Farm'},bee:{example:'The bee is on a flower.',partner:'tea',category:'Wild'},
 unhappy:{example:'He is unhappy today.',parts:'un|happy',meaning:'행복하지 않은'},teacher:{example:'Our teacher reads a book.',parts:'teach|er',meaning:'선생님'},playful:{example:'The playful dog runs.',parts:'play|ful',meaning:'장난기 많은'},replay:{example:'We replay the song.',parts:'re|play',meaning:'다시 재생하다'},
};
const base=['cat','dog','fish','pig','hen','fox','cow','bee'];
export function addKnownWorksheetSounds(word:StudioWord):StudioWord {
 const sound=soundData[word.word.trim().toLowerCase()];
 return sound?{...word,sounds:word.sounds||sound[0],phonemes:word.phonemes||sound[1],syllables:word.syllables||sound[2],stress:word.stress||sound[3]}:word;
}
export function exampleWords(activityId:string):StudioWord[] {
 const labels=activityId==='wordChain'?['cat','cot','dot','dog','fog','log']
  :activityId==='rhyme'?['cat','hat','dog','log','fish','dish']
  :activityId==='soundSort'?['cat','hat','bag','fish','ship','dish']
  :activityId==='soundBoxes'?['ship','fish','cat','cake','rain','fox']
  :activityId==='minimalPairs'?['cat','ship','pig','hen']
  :activityId==='syllables'?['apple','banana','rabbit','teacher']
  :activityId==='morphology'?['unhappy','teacher','playful','replay']
  :activityId==='wordSort'?['cat','dog','fish','pig','hen','cow']
  :activityId==='listenMap'?['park','shop','school','bank','farm','pond','bus','home','tree']:base;
 const curriculum=curriculumEntries();
 return labels.map((label,i)=>{
  const shared=wordBySpelling(label),entry=curriculum.find(e=>e.word===label&&e.step>=2)||curriculum.find(e=>e.word===label),meta=originals[label];
  const sd=soundData[label]||['','','',1],partner=meta?.partner||({ship:'shop',hen:'pen',pig:'big'}[label as 'ship']||'');
  const pd=soundData[partner];
  return {id:`example:${label}:${i}`,word:label,meaning:shared?.meaning||meta?.meaning||label,imageUrl:shared?.imageUrl||null,lineartUrl:shared?.lineartUrl||null,sharedImage:true,sharedLineart:true,
   example:meta?.example||`I can see a ${label}.`,category:activityId==='wordSort'?(i<3?'Pets':'Farm'):['soundSort','rhyme','targetLetters'].includes(activityId)?entry?.rule:meta?.category||'Other',patternMarked:entry?.pattern_marked,
   sounds:sd[0] as string,phonemes:sd[1] as string,soundGroup:entry?.rule||'',syllables:sd[2] as string,stress:sd[3] as number,partner,
   partnerSounds:pd?.[0]||'',partnerPhonemes:pd?.[1]||'',parts:meta?.parts||''};
 });
}
const story='Mina has a red bag. She puts a cup in the bag. She walks to the park with Ben. At the park, they find a little dog. The dog is hot. Mina puts water in the cup. The dog drinks the water. Then Mina and Ben take the dog home.';
const row=(prompt:string,answer='',detail='',order?:number):StudioTask=>({...newTask(prompt,answer,detail),order});
const storyQuestions=()=>[row('Who has a red bag?','Mina','The first sentence names Mina.'),row('Where do Mina and Ben find the dog?','At the park.','Look at the fourth sentence.'),row('What does the dog drink?','Water.','Mina puts water in the cup.')];

/** Short, original examples. Teachers can replace every field without altering source lists. */
export function exampleWorksheet(id:string):WorksheetDocument {
 const activity=worksheetActivity(id);if(!activity)throw Error('unknown_activity');
 let doc:WorksheetDocument={schema:'classbank-worksheet-v1',activityId:id,title:activity.en,instruction:activity.instruction,words:activity.mode==='words'?exampleWords(id):[],tasks:[],passage:'',topic:'Our class',left:'A',right:'B',columns:'I|We|They\nlike|see|have\napples|cats|books',route:'right,right,down,down,left',seed:1};
 if(activity.mode==='words'){
  doc=rebuildWordTasks(doc);
  if(id==='meaningPairs')doc.words=doc.words.map(w=>({...w,partner:w.meaning}));
  if(id==='collocations')doc.words=doc.words.slice(0,4).map((w,i)=>({...w,word:['make','take','have','play'][i],partner:['a cake','a photo','breakfast','soccer'][i],imageUrl:null,lineartUrl:null}));
  if(id==='syllables')doc.words=doc.words.map(w=>w.word==='teacher'?{...w,syllables:'teach|er',stress:1}:w);
  if(id==='findSomeone')doc.tasks=doc.words.map(w=>newTask(`Do you like ${w.word==='fish'?'fish':w.word==='fox'?'foxes':w.word+'s'}?`,'','Ask why, or ask for one more detail.',w.id));
  if(id==='pictureWrite')doc.tasks=doc.words.map(w=>newTask('Write a sentence about this picture.',w.example||'','Other fitting sentences are welcome.',w.id));
  if(id==='exitTicket')doc.tasks=[row('Write one word you learned today.','','Check the selected word list.'),row('Use that word in your own sentence.','','Check meaning and word order.'),row('What would you like to practise next?','','Use this response to plan the next lesson.')];
  return doc;
 }
 switch(id){
 case 'grammarChoice': doc.tasks=[{...row('She ___ a book every day.','reads','She takes the third-person singular form.'),options:['read','reads','reading']},{...row('They ___ in the park now.','are playing','Now signals an action in progress.'),options:['plays','are playing','is play']},{...row('I have ___ apple.','an','Apple begins with a vowel sound.'),options:['a','an','some']}];break;
 case 'transform':doc.tasks=[row('Make a question: You like apples.','Do you like apples?','Use do + subject + base verb.'),row('Use yesterday: I play soccer.','I played soccer yesterday.','Other natural placements of yesterday are acceptable.'),row('Make it negative: She is tired.','She is not tired.','She is not / She isn’t are acceptable.')];break;
 case 'errorCorrection':doc.tasks=[row('She go to school every day.','She goes to school every day.','Third-person singular present.'),row('There is two cats.','There are two cats.','Two cats is plural.'),row('I am like apples.','I like apples.','Like is the main verb here.')];break;
 case 'combine':doc.tasks=[row('I am tired. I will finish my work. (but)','I am tired, but I will finish my work.','Accept equivalent punctuation.'),row('It is raining. We stay inside. (because)','We stay inside because it is raining.','Because it is raining, we stay inside is also acceptable.')];break;
 case 'substitution':doc.tasks=[row('Write a sentence with one choice from each column.','We like apples.','Other grammatical combinations are acceptable.')];break;
 case 'punctuation':doc.tasks=[row('my name is mina','My name is Mina.','Capitalise the start and the name.'),row('where is your bag','Where is your bag?','Capitalise the first word and add a question mark.')];break;
 case 'cloze':doc.passage='Ben has a dog. The dog (1) ___ small. Every day, Ben (2) ___ with his dog.';doc.tasks=[{...row('(1)','is','The subject is singular.'),options:['is','are']},{...row('(2)','plays','Ben is third-person singular.'),options:['play','plays']}];break;
 case 'decodable':doc.passage='A cat sat on a mat. A dog ran to the cat. The cat hid in a big bag. The dog sat by the bag.';doc.topic='Short vowels; review the irregular words a, the, to and by before reading.';doc.tasks=[row('Where did the cat sit?','On a mat.'),row('Where did the cat hide?','In a big bag.')];break;
 case 'readingQuestions':doc.passage=story;doc.tasks=storyQuestions();break;
 case 'sequence':doc.tasks=[row('Mina puts a cup in her bag.','1','',1),row('Mina and Ben find a dog at the park.','2','',2),row('Mina gives the dog water.','3','',3),row('They take the dog home.','4','',4)];break;
 case 'storyMap':doc.passage=story;doc.tasks=[row('Characters','Mina, Ben and a dog'),row('Setting','The park'),row('Problem','The dog is hot.'),row('Solution','Mina gives it water, then they take it home.')];break;
 case 'mainIdea':doc.passage='Bees help many plants. When a bee visits flowers, it carries pollen from one flower to another. This helps plants make seeds. Many fruits begin with flowers visited by bees.';doc.tasks=[row('Main idea','Bees help plants.'),row('Detail 1','Bees carry pollen.'),row('Detail 2','Pollen helps plants make seeds.'),row('Detail 3','Many fruits begin with flowers visited by bees.')];break;
 case 'compare':doc.left='Cats';doc.right='Dogs';doc.tasks=[row('Only cats','Many cats climb well.'),row('Both','Both are animals and can be pets.'),row('Only dogs','Dogs need regular walks.'),row('Comparison sentence','Cats and dogs can both be pets.')];break;
 case 'inference':doc.passage='Leo looks out of the window. He puts on his boots and takes an umbrella. At the door, he picks up a towel for his wet dog.';doc.tasks=[row('What might the weather be like? Give two clues.','It is probably rainy.','Boots, an umbrella and a wet dog support the inference.'),row('Why might Leo take a towel?','To dry the dog.','The dog is wet. Accept plausible answers with evidence.')];break;
 case 'listenDraw':doc.tasks=[row('Scene 1','Draw two apples under a table.','There is a table. Draw two apples under it.'),row('Scene 2','Draw a small circle above a big square.','Draw a big square. Draw a small circle above it.')];break;
 case 'listenTable':doc.left='Club';doc.right='Start time';doc.tasks=[row('Art club','3:10','The art club starts at three ten.'),row('Music club','3:30','The music club starts at three thirty.'),row('Sports club','4:00','The sports club starts at four o’clock.')];break;
 case 'dictogloss':doc.passage='On Friday, our class makes fruit salad. Mina brings apples. Ben brings bananas. We wash the fruit and cut it into small pieces. Then we share the salad.';doc.tasks=[row('Who? What? When?','The class makes fruit salad on Friday.','Read once for meaning, again for notes, then ask pairs to reconstruct.')];break;
 case 'mediaGaps':doc.passage='Original ClassBank practice chant:\nWe (1) ___ to the park.\nWe (2) ___ by the tree.\nWe look at the flowers.\nWhat can we (3) ___?';doc.tasks=[row('(1)','walk','Read: We walk to the park.'),row('(2)','sit','Read: We sit by the tree.'),row('(3)','see','Read: What can we see?')];break;
 case 'informationGap':doc.left='Activity';doc.right='Time';doc.tasks=[row('Art','9:00'),row('Music','10:00'),row('Lunch','12:00'),row('Sports','2:00')];break;
 case 'roleplay':doc.topic='At the class picnic';doc.tasks=[row('A · Picnic organiser','Arrange one drink and one food item for each person.','There are six people. You have six apples and six cups. Ask B to bring something to drink.',1),row('B · Classmate','Agree what to bring and ask how many people are coming.','You can bring water or milk. You do not know how many people are coming.',2)];break;
 case 'ranking':doc.topic='Choose three things for a class picnic. Explain your choices.';doc.tasks=[row('Water','','Think about what everyone needs.'),row('Fruit','','Think about sharing.'),row('A ball','','Think about a group activity.'),row('A book','','Think about quiet activities.')];break;
 case 'jigsaw':doc.topic='Plan a school fair.';doc.tasks=[row('A · Food','The food stall opens at 10:00. Juice costs two coins.','Find out what time the music and games start.',1),row('B · Music','The music starts at 11:00. The show is in the hall.','Find out what juice costs.',2),row('C · Games','The games start at 10:30. Each game costs one coin.','Find out where the music show is.',3)];break;
 case 'expansion':doc.tasks=[row('The dog runs.','The small dog runs in the park after school.','Add where and when.'),row('We read.','We read a funny book in the classroom.','Add what and where.')];break;
 case 'paragraph':doc.topic='My favourite place';doc.tasks=[row('Topic sentence','My favourite place is the park.'),row('Detail 1','I can play with my friends there.'),row('Detail 2','There are trees and flowers.'),row('Closing sentence','The park is a happy place for me.')];break;
 case 'comic':doc.topic='Two friends find a lost bag.';doc.tasks=[row('Scene 1: Mina sees a bag on a bench.','Look! There is a bag.'),row('Scene 2: Ben checks for a name.','Whose bag is it?'),row('Scene 3: A child comes back to the bench.','That is my bag. Thank you!')];break;
 case 'recount':doc.topic='A day I remember';doc.tasks=[row('Who, where and when?','Last Sunday, I went to the park with my family.'),row('First','First, we walked by the pond.'),row('Next','Next, we played a game.'),row('Last','Last, we went home and had dinner.')];break;
 case 'opinion':doc.topic='Should our class read outside sometimes?';doc.tasks=[row('My opinion','I think we should read outside sometimes.'),row('Reason','We can enjoy fresh air.'),row('Example','We can read under a tree on a warm day.'),row('Conclusion','Reading outside can make our reading time different and enjoyable.')];break;
 case 'editing':doc.passage='yesterday i go to the park with ben we play a game';doc.tasks=[row('Does each sentence start with a capital?','Yesterday I went to the park with Ben. We played a game.'),row('Are names capitalised?','I and Ben'),row('Do verbs match the time?','Went and played match yesterday.'),row('Are there full stops?','Two full stops.')];break;
 case 'functionalReading':doc.left='Picnic menu';doc.right='Coins';doc.tasks=[row('Apple','2','',0),row('Sandwich','4','',0),row('Water','1','',0),row('How much is one apple?','2 coins','',1),row('How much are a sandwich and water together?','5 coins','',1)];break;
 case 'functionalWriting':doc.topic='Write an email inviting a friend to a class picnic. Say when, where and what to bring. Use fictional details.';doc.tasks=[row('To / Subject','To: friend@example.test / Subject: Class picnic'),row('Greeting','Hi Ben,'),row('Message','Please come to our picnic at the park on Friday at three. Bring a cup.'),row('Closing','See you! Mina')];break;
 case 'poster':doc.topic='Help keep our classroom tidy.';doc.tasks=[row('Who will read it?','Our classmates'),row('Title','Our tidy classroom'),row('Key facts','Put books on the shelf. Put paper in the recycling box.'),row('Clear message','Let’s keep our classroom tidy together!')];break;
 case 'mediaLiteracy':doc.passage='Source A — fictional school notice: Our class planted six trees on Friday. Twenty students helped.\n\nSource B — fictional student comment: Planting trees was the best activity of the year. I think every class should do it.';doc.tasks=[row('Write one fact from Source A.','The class planted six trees on Friday.'),row('Write one opinion from Source B.','Planting trees was the best activity of the year.'),row('How are the sources different?','A reports an event. B gives a personal judgement.')];break;
 case 'kwl':doc.topic='How plants grow';doc.tasks=[row('What I know','','Discuss before reading.'),row('What I want to know','','Record questions before reading.'),row('What I learned','','Complete after reading; accept accurate new learning.')];break;
 case 'rubric':doc.topic='My short talk about an animal';doc.tasks=[row('I named my animal clearly.','','Listen for the animal name.'),row('I gave two facts.','','Check that the facts fit the animal.'),row('I spoke so my partner could hear.','','Consider the learner’s needs.'),row('I answered a question.','','Recognise a relevant response.')];break;
 default:throw Error('missing_original_example:'+id);
 }
 return doc;
}
