import type {StemFrame,StemLesson} from '../lib/stemTypes';

const base='/stem/paper-bridges';
const dynamic=`${base}/dynamic`;
const vocabulary=[
 ['bridge','다리','This is a bridge.','folded'],
 ['paper','종이','We use one sheet of paper.','paper'],
 ['fold','접다','Fold the paper.','fold'],
 ['coin','동전','Add one coin.','coin'],
 ['strong','튼튼한','Can we make it strong?','folded'],
 ['bend','휘다','The paper can bend.','flat'],
 ['predict','예측하다','I predict ten coins.','predict'],
 ['observe','관찰하다','Observe the bridge.','observe'],
].map(([word,meaning,example,picture],i)=>({id:`paper-bridge-word-${i+1}`,word,meaning,example,imageUrl:`${picture==='flat'||picture==='folded'?dynamic:base}/${picture}.webp`,category:'STEM / Structures'}));
const text=(id:number,block:StemFrame['block'],layout:StemFrame['layout'],title:string,lines:string[],image?:string):StemFrame=>({id:`paper-bridge-slide-${id}`,block,layout,mode:'text',title,lines,...(image?{imageUrl:`${base}/${image}.webp`}:{})});
const frames:StemFrame[]=[
 text(1,'introduction','cover','Paper Bridges',['Can paper hold coins?','Let’s build, test, and try again!'],'hero'),
 text(2,'introduction','picture-question','Look and Think!',['Look at the paper.','What happens when we add coins?','Will it bend?'],'flat'),
 {...text(3,'vocabulary','vocabulary-cards','Science Words 1',[]),mode:'vocabulary',vocabularyIds:vocabulary.slice(0,4).map(w=>w.id)},
 {...text(4,'vocabulary','vocabulary-cards','Science Words 2',[]),mode:'vocabulary',vocabularyIds:vocabulary.slice(4).map(w=>w.id)},
 text(5,'vocabulary','speaking','Let’s Speak!',['I predict ___ coins.','Add one coin at a time.','Look! It bends.','Let’s try again!']),
 text(6,'prediction','prediction','Let’s Predict!',['How many coins can flat paper hold?','I predict ___ coins.','Tell your partner.'],'materials'),
 text(7,'experiment','picture-question','Get Ready!',['Paper · Books · Coins · Ruler','Use the same paper and coin size.','Keep the gap the same.'],'materials'),
 {...text(8,'experiment','experiment-steps','How to Test',['Put paper across the books.','Add coins at the center, one at a time.','Stop if it touches the table or coins fall.','Count only the coins held before that.']),illustrations:[{imageUrl:`${base}/flat.webp`,caption:'Use the same gap.'},{imageUrl:`${base}/folded.webp`,caption:'Keep the coins at the center.'}]},
 text(9,'experiment','results','Test 1: Flat Paper',['Try the flat paper first.','It held ___ coins.','Zero is a result, too!'],'flat'),
 {...text(10,'concept','science-concept','Watch and Notice',[]),mode:'video',videoUrl:'https://www.youtube.com/watch?v=CqYGVW2Eu6Y'},
 {...text(11,'concept','science-concept','Same Paper. New Shape.',['Folds change the shape.','The new shape can be harder to bend.','Let’s test it!']),illustrations:[{imageUrl:`${base}/flat.webp`,caption:'Flat paper'},{imageUrl:`${base}/folded.webp`,caption:'Folded paper'}]},
 text(12,'experiment','experiment-steps','Test 2: Folded Paper',['I predict ___ coins.','Fold a fresh sheet back and forth.','Put the long folds across the gap.','Test it the same way.'],'fold'),
 text(13,'experiment','results','What Happened?',['Flat paper held ___ coins.','Folded paper held ___ coins.','Which held more? Or were they the same?'],'folded'),
 {...text(14,'review','game-instructions','What’s Missing?',[]),mode:'missing'},
 text(15,'review','game-instructions','Build. Test. Try Again!',['Change only the paper’s shape.','Use a fresh sheet of the same paper.','Keep the gap and coin size the same.','Test again. Did it hold more?'],'hero'),
 {...text(16,'report','report-instructions','My Science Report',[]),mode:'report'},
 text(17,'wrapup','wrap-up','We Are Engineers!',['What did we change? The shape!','How did we find out? We tested it!','Tell us what your bridge held.','Great job, engineers!'],'hero'),
];

// Keep all lesson content and IDs; only change the composition and artwork.
for(const frame of frames){
 if(frame.imageUrl===`${base}/flat.webp`)frame.imageUrl=`${dynamic}/flat.webp`;
 if(frame.imageUrl===`${base}/folded.webp`||frame.imageUrl===`${base}/hero.webp`)frame.imageUrl=`${dynamic}/folded.webp`;
 frame.illustrations=frame.illustrations?.map(image=>({...image,imageUrl:image.imageUrl.replace(`${base}/flat.webp`,`${dynamic}/flat.webp`).replace(`${base}/folded.webp`,`${dynamic}/folded.webp`)}));
}
frames[0]={...frames[0],backgroundUrl:`${dynamic}/hero.webp`,imageUrl:`${dynamic}/hero.webp`};

/** Review-only sample. No production catalogue registration before content approval. */
export const PAPER_BRIDGES:StemLesson={meta:{schema:1,sourceId:'paper-bridges-review-v1',title:'Paper Bridges',description:'Can Paper Hold Coins?',grade:'Elementary Grade 3',level:'Elementary English',duration:50,language:'en',category:'Engineering / Structures / Fair Tests',presentation:'science-lab',mascotUrl:`${dynamic}/robot.webp`,reviewSample:true,
 objectives:['Use eight words while predicting and testing.','Compare flat and folded paper bridges.','Keep the paper, gap, and coins the same.','Improve a design and test it again.','Explain results using short English sentences.'],
 materials:['Three identical A4 sheets per pair: flat, folded, and redesign','Two stable, equally tall book stacks per pair','Identical coins (same denomination)','A ruler','A clear table and a tray for coins'],
 safety:['Keep coins out of mouths; collect them after class.','Use low, stable book stacks and keep hands clear of falling coins.','Stop when the paper touches the table or a coin falls.','Count only coins held before failure; do not count the coin that causes it.','If all available coins are held, record “at least ___”; do not claim a maximum.','Teacher: pretest a 15–20 cm gap with your paper; choose one gap and keep it fixed.','Teacher: keep folds running across the gap, not across the bridge’s width.','Illustrations show the idea, not measured results or a fold template.'],
 vocabulary,ownerId:null,visibility:'provided',published:false,
 report:{title:'Paper Bridges',question:'Which paper bridge can hold more coins?',prediction:'I predict: flat ____ coins; folded ____ coins.',result:'Flat: ____ coins. Folded: ____ coins. New design: ____ coins.',
 steps:[{id:'bridge-step-1',text:'Set up the books and paper.',imageUrl:`${base}/materials.webp`},{id:'bridge-step-2',text:'Test flat paper. Count.',imageUrl:`${base}/flat.webp`},{id:'bridge-step-3',text:'Fold a fresh sheet.',imageUrl:`${base}/fold.webp`},{id:'bridge-step-4',text:'Test folded paper. Compare.',imageUrl:`${base}/folded.webp`}],
 questions:[{id:'bq1',prompt:'Folding changes the paper’s ______.',options:['shape','color'],answer:'shape'},{id:'bq2',prompt:'For a fair test, keep the gap ______.',options:['the same','different'],answer:'the same'},{id:'bq3',prompt:'We add coins ______.',options:['one at a time','all at once'],answer:'one at a time'},{id:'bq4',prompt:'We find out by ______ our bridge.',options:['testing','guessing'],answer:'testing'}],
 wordBank:['paper','fold','shape','coins','stronger','test'],sentences:['My strongest bridge held ______ coins.','I changed __________________________.'],showWordBank:true}},frames};
