import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {join} from 'node:path';
const [sourcesFile,out,...ids]=process.argv.slice(2);
const sources=JSON.parse(await readFile(sourcesFile,'utf8')).filter(source=>!ids.length||ids.includes(source.youtubeId));
await mkdir(out,{recursive:true});const jobs=[];
for(const source of sources){
  const spec=source.storyboard?.split('|');if(!spec)continue;
  const levels=spec.slice(1).map((value,level)=>{const [w,h,count,cols,rows,interval,name,signature]=value.split('#');return {level,w:+w,h:+h,count:+count,cols:+cols,rows:+rows,interval:+interval,name,signature};});
  const level=levels.filter(level=>level.interval>0&&level.w>=160).at(-1);if(!level)continue;
  for(let sheet=0;sheet<Math.ceil(level.count/(level.cols*level.rows));sheet++){
    const path=join(out,`${source.youtubeId}-${sheet}.jpg`);
    const url=spec[0].replaceAll('$L',String(level.level)).replaceAll('$N',level.name).replaceAll('$M',String(sheet))+`&sigh=${level.signature}`;
    jobs.push({path,url});
  }
  const frames=Array.from({length:level.count},(_,index)=>({time:index*level.interval/1000,file:join(out,`${source.youtubeId}-${Math.floor(index/(level.cols*level.rows))}.jpg`),x:(index%level.cols)*level.w,y:Math.floor((index%(level.cols*level.rows))/level.cols)*level.h,width:level.w,height:level.h}));
  await writeFile(join(out,`${source.youtubeId}.frames.json`),JSON.stringify({youtubeId:source.youtubeId,duration:source.duration,frames}));
}
let index=0,finished=0;
await Promise.all(Array.from({length:6},async()=>{while(index<jobs.length){const job=jobs[index++];try{await access(job.path);}catch{const response=await fetch(job.url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`${job.path}: ${response.status}`);await writeFile(job.path,new Uint8Array(await response.arrayBuffer()));}if(++finished%50===0)console.log('sheets',finished,'/',jobs.length);}}));
console.log('sheets ready',jobs.length);
