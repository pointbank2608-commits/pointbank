// Native original frames only. No generated art or remote thumbnail substitutions.
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {spawn} from 'node:child_process';

const [catalogFile,mediaDirectory,publicDirectory='app/public']=process.argv.slice(2);
const catalog=JSON.parse(await readFile(catalogFile,'utf8'));
const imageRoot=resolve(publicDirectory,'animation-episodes');
await mkdir(imageRoot,{recursive:true});
const jobs=catalog.flatMap(source=>source.episodes.map(episode=>({source,episode})));
let cursor=0;
const run=args=>new Promise((ok,no)=>{
 const child=spawn('ffmpeg',args,{windowsHide:true});let log='';
 child.stderr.on('data',buffer=>{log+=buffer;});child.on('error',no);
 child.on('close',code=>code===0?ok():no(Error(log.slice(-1000))));
});
await Promise.all(Array.from({length:3},async()=>{
 while(cursor<jobs.length){
  const {source,episode}=jobs[cursor++];
  if(!episode.thumbnail?.startsWith('/animation-episodes/'))throw Error('Unexpected thumbnail path');
  const output=resolve(publicDirectory,'.'+episode.thumbnail);
  if(!output.startsWith(imageRoot+sep))throw Error('Thumbnail escapes its asset directory');
  const time=episode.start+Math.min(15,(episode.end-episode.start)/4);
  await run(['-hide_banner','-loglevel','error','-ss',String(time),'-i',join(resolve(mediaDirectory),source.youtubeId+'.mkv'),'-frames:v','1','-vf','scale=480:-2','-q:v','3','-y',output]);
 }
}));
console.log(JSON.stringify({originalFrames:jobs.length}));
