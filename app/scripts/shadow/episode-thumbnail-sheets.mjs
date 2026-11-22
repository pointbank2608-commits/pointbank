// Extracts only episode representative frames from public YouTube storyboard sheets.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const [catalogFile,sourcesFile,out]=process.argv.slice(2);
const catalog=JSON.parse(await readFile(catalogFile,'utf8'));
const sources=JSON.parse(await readFile(sourcesFile,'utf8'));
await mkdir(out,{recursive:true});const plan=[];
for(const source of catalog.filter(source=>source.episodes.length>1)){
  const spec=sources.find(item=>item.youtubeId===source.youtubeId)?.storyboard?.split('|');
  if(!spec)continue;
  const levels=spec.slice(1).map((level,index)=>{const [width,height,count,columns,rows,interval,name,signature]=level.split('#');return {level:index,width:+width,height:+height,count:+count,columns:+columns,rows:+rows,interval:+interval,name,signature};});
  const level=levels.filter(level=>level.interval>0).at(-1);
  if(!level)continue;
  const downloaded=new Set();
  for(const episode of source.episodes){
    const frame=Math.min(level.count-1,Math.floor((episode.start+Math.min(15,(episode.end-episode.start)/4))*1000/level.interval));
    const sheet=Math.floor(frame/(level.columns*level.rows));
    const url=spec[0].replaceAll('$L',String(level.level)).replaceAll('$N',level.name).replaceAll('$M',String(sheet))+`&sigh=${level.signature}`;
    const file=join(out,`${source.youtubeId}-${sheet}.jpg`);
    if(!downloaded.has(file)){const response=await fetch(url);if(!response.ok)throw new Error(`Storyboard unavailable: ${response.status}`);await writeFile(file,new Uint8Array(await response.arrayBuffer()));downloaded.add(file);}
    plan.push({episodeId:episode.id,file,name:`${source.youtubeId}-${Math.round(episode.start*1000)}.jpg`,x:(frame%level.columns)*level.width,y:Math.floor((frame%(level.columns*level.rows))/level.columns)*level.height,width:level.width,height:level.height});
  }
}
await writeFile(join(out,'plan.json'),JSON.stringify(plan,null,2));console.log('Representative frames',plan.length);
