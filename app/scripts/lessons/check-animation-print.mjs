import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const server=await createServer({root,configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false}});
try {
  const {animationPrintActivities}=await server.ssrLoadModule('/src/lib/animationPrint.ts');
  const options={letters:1,bank:true,chunks:true,pictureClues:true};
  const words=[
    ['know','알다','동사'],['washing','빨래','명사'],['wind','바람','명사'],
    ['back','다시, 되돌아','부사'],['long','긴, 먼','형용사'],['small','작은','형용사'],
    ['best','가장 좋은','형용사'],['poor','불쌍한','형용사'],['wrong','잘못된','형용사'],
  ].map(([word,meaning,pos])=>({word,meaning,pos,example:'Example.',time:0}));
  const picture=(word,meaning,pos,id=word)=>({id,word,meaning,part_of_speech:pos,image_url:'/word-bank-images/'+id+'.webp'});
  // Dictionary spellings/meanings observed in the reported scene. The noun comes first on purpose.
  const bank=[picture('back','등','명사','back-2'),picture('back','뒤로, 되돌아','부사'),
    picture('long','긴','형용사'),picture('wrong','틀린','형용사'),picture('poor','가난한','형용사'),
    picture('know','알다','동사'),picture('small','작은','형용사'),picture('wind','바람','명사')];
  const clip={id:'f27bf371-9c13-4975-9869-6d8c233b1980',script:'',pack:{words}};
  const activities=(clip,bank)=>animationPrintActivities(clip,bank,options)[0].types;
  const items=(clip,bank,type='pictureMatch')=>activities(clip,bank).find(row=>row.id===type).items;
  const result=items(clip,bank);
  assert.equal(result.length,9);
  assert.equal(result.filter(row=>row.image).length,8);
  for(const word of words){
    const row=result.find(row=>row.label===word.word);
    assert.equal(row.meaning,word.meaning,'Keep the video meaning for '+word.word);
    assert.equal(row.answer,word.word);
  }
  for(const word of ['back','long','wrong','poor'])assert.equal(result.find(row=>row.label===word).image,'/word-bank-images/'+word+'.webp');
  assert.equal(result.find(row=>row.label==='best').image,undefined);
  assert.equal(result.find(row=>row.label==='washing').image,'/word-bank-images/laundry.webp');
  assert.equal(items(clip,[]).length,9,'An empty dictionary must not remove matching questions');

  const custom={id:'picture-fallback-test',script:'',pack:{words:[{word:' ＢＡＣＫ ',meaning:'영상의 뜻',pos:'부사',example:'Example.',time:0}]}};
  assert.equal(items(custom,bank)[0].image,'/word-bank-images/back.webp','Normalize English spelling and prefer the same part of speech');
  assert.equal(items(custom,[bank[0]])[0].image,'/word-bank-images/back-2.webp','A different part of speech must still allow the same English word');
  assert.equal(items(custom,[])[0].meaning,'영상의 뜻');
  const sameMeaning=[picture('back','영상의 뜻','명사','exact-meaning'),...bank];
  assert.equal(items(custom,sameMeaning)[0].image,'/word-bank-images/exact-meaning.webp','Exact meaning takes priority over a part-of-speech fallback');
  sameMeaning.push(picture('back','영상의 뜻','부사','exact-both'));
  assert.equal(items(custom,sameMeaning)[0].image,'/word-bank-images/exact-both.webp');
  custom.pack.scene={wordPictures:{'back|영상의 뜻':'/reviewed.webp'}};
  assert.equal(items(custom,bank)[0].image,'/reviewed.webp');
  custom.pack.words[0].imageUrl='/video.webp';
  assert.equal(items(custom,bank)[0].image,'/video.webp');
  for(const type of ['wordTrace','crossword'])assert.equal(items(clip,bank,type).find(row=>row.label==='wrong').image,'/word-bank-images/wrong.webp');
  assert.deepEqual(items(clip,bank,'wordScramble').find(row=>row.label==='wrong').pictures,['/word-bank-images/wrong.webp']);
  console.log('PASS same-word lookup, meaning/POS priority, overrides, missing images and shared picture clues');

  if(process.env.ANIMATION_PRINT_FIXTURE){
    const clips=JSON.parse(readFileSync(process.env.ANIMATION_PRINT_FIXTURE,'utf8').replace(/^\uFEFF/,''));
    const dictionary=process.env.ANIMATION_WORD_BANK_FIXTURE?JSON.parse(readFileSync(process.env.ANIMATION_WORD_BANK_FIXTURE,'utf8').replace(/^\uFEFF/,'')):bank;
    let count=0,pictures=0;
    for(const video of clips.filter(video=>!video.pack?.phonicsSong)){
      const source=video.pack.words??[],rows=items(video,dictionary);
      assert.deepEqual(rows.map(row=>[row.label,row.meaning,row.answer]),source.map(word=>[word.word,word.meaning,word.word]),video.title);
      assert.equal(items(video,[]).length,source.length,video.title+' without dictionary');
      count+=rows.length;
      pictures+=rows.filter(row=>row.image).length;
    }
    console.log(`PASS all ${clips.filter(video=>!video.pack?.phonicsSong).length} animation worksheets: ${count} words, ${pictures} picture clues, ${count-pictures} meaning-only clues`);
  }
} finally {await server.close();}
