import type {StemBlock,StemFrame,StemLesson,StemLayout} from '../lib/stemTypes';
import {PAPER_BRIDGES} from './stemPaperBridges';
const base='/stem/surface-tension';
const vocabulary=[
 ['water','물','This is water.'],['drop','물방울','Add one drop.'],['coin','동전','Put a coin on the tray.'],['spill','넘치다, 쏟다','The water spilled.'],
 ['surface tension','표면장력','This is surface tension.'],['stick together','서로 달라붙다','Water sticks together.'],['predict','예측하다','I predict 20 drops.'],['observe','관찰하다',"Let’s observe the water."],
].map(([word,meaning,example],i)=>({id:`surface-word-${i+1}`,word,meaning,example,imageUrl:`${base}/word-${i+1}.png`,category:'STEM / Water'}));
const titles=['SCIENCE LAB · Surface Tension','Look and Think!','Water Sticks Together!','What Is Surface Tension?','Science Words 1','Science Words 2',"Let’s Speak!","Let’s Predict!",'How to Experiment',"Let’s Experiment!",'What Happened?',"What’s Missing?","Today’s Challenge!",'Game Rules',"Don’t Spill the Water!",'My Science Report','We Are Scientists!'];
const blocks:StemBlock[]=['introduction','introduction','concept','concept','vocabulary','vocabulary','vocabulary','prediction','experiment','experiment','experiment','review','review','review','review','report','wrapup'];
const layouts:StemLayout[]=['cover','picture-question','science-concept','science-concept','vocabulary-cards','vocabulary-cards','speaking','prediction','experiment-steps','experiment-steps','results','game-instructions','picture-question','game-instructions','game-instructions','report-instructions','wrap-up'];
const lines=[
 ['Why Does Water Stick Together?'],['Look at the water drops!','Are they round or square?','Why are they round?'],
 ['Water has tiny molecules.','They pull each other.','Water sticks together!'],['Water molecules pull each other.','The surface tries to stay small.','This is surface tension!'],
 ['water','drop','coin','spill'],['surface tension','stick together','predict','observe'],['Water sticks together.','This is surface tension.',"Let’s predict!","Let’s observe!"],
 ['How many drops can we add?','I predict ______ drops.','5 / 10 / 20 / 30'],
 ['Put a coin on the tray.','Add one drop at a time.','Count the drops.','Observe the water.'],['One drop at a time!','Count the drops!','Be careful!',"Don’t spill!"],
 ['I predicted ______ drops.','I counted ______ drops before the water spilled.'],['Close your eyes!','Open your eyes!',"What’s missing?"],
 ['Can we add more water?','Yes or No?',"Let’s find out!"],['Take turns.','Add one drop at a time.',"Don’t touch the cup.","If the water spills, you’re out!"],
 ['Your turn!','One drop!','Be careful!','Look at the water!','It spilled!'],['Complete your science report.'],
 ['What did we learn today?','Surface tension!','What does water do?','Water sticks together!','Great job, scientists!'],
];
const frames:StemFrame[]=titles.map((title,i)=>({id:`surface-slide-${String(i+1).padStart(2,'0')}`,block:blocks[i],layout:layouts[i],title,lines:lines[i],mode:'image',imageUrl:`${base}/slide-${String(i+1).padStart(2,'0')}.png`,originalImageUrl:`${base}/slide-${String(i+1).padStart(2,'0')}.png`}));
// Use editable content for the explicitly revised result/report and real review activity.
frames[4]={...frames[4],mode:'vocabulary',vocabularyIds:vocabulary.slice(0,4).map(w=>w.id)};
frames[5]={...frames[5],mode:'vocabulary',vocabularyIds:vocabulary.slice(4).map(w=>w.id)};
frames[10]={...frames[10],mode:'text',illustrations:[{imageUrl:`${base}/before.png`,caption:'The water made a dome!'},{imageUrl:`${base}/after.png`,caption:'Then, it spilled!'}]};
frames[11]={...frames[11],mode:'missing'};
frames[15]={...frames[15],mode:'report'};
export const SURFACE_TENSION:StemLesson={meta:{schema:1,sourceId:'surface-tension-v1',title:'Surface Tension',description:'Why Does Water Stick Together?',grade:'Elementary Grade 3',level:'Elementary English',duration:50,language:'en',category:'Science / Water / Properties of Matter',
 objectives:['Explain surface tension using simple English.','Use eight science vocabulary words.','Make a prediction before an experiment.','Observe water drops on a coin.','Explain what happened using short English sentences.','Complete a simple science report.'],
 materials:['Water','A clean, dry coin','A dropper','A tray','A cup','Paper towels'],safety:['Do not put coins or droppers in your mouth.','Use a tray and wipe up spills.','Keep water away from electrical equipment.','Count only the drops that stayed on the coin before the spill.'],
 vocabulary,ownerId:null,visibility:'provided',published:true,
 report:{mascotUrl:`${base}/mascot.png`,title:'Surface Tension',question:'How many drops can we add before the water spills?',prediction:'I predict ______ drops.',result:'I counted ______ drops before the water spilled.',
 steps:[0,1,2,3].map((i)=>({id:`step-${i+1}`,text:lines[8][i],imageUrl:`${base}/step-${i+1}.png`})),
 questions:[{id:'q1',prompt:'Water molecules ________ each other.',options:['pull','push away'],answer:'pull'},{id:'q2',prompt:'The water surface tries to stay ________.',options:['small','big'],answer:'small'},{id:'q3',prompt:'This is called ________.',options:['surface tension','gravity'],answer:'surface tension'},{id:'q4',prompt:'Surface tension helps water form a ________ shape.',options:['round','square'],answer:'round'}],
 wordBank:['water','stick together','surface tension','dome','round'],sentences:['Water __________________________.','This is called __________________________.'],showWordBank:true}},frames};
export const READY_STEM=[SURFACE_TENSION];
export const REVIEW_STEM=import.meta.env.DEV?[PAPER_BRIDGES]:[];
