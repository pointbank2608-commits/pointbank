// Only provider chapter markers or separately identified single-episode uploads enter the catalogue.
import {readFile,writeFile,access} from 'node:fs/promises';
const [sourceFile,output]=process.argv.slice(2);
const sources=JSON.parse(await readFile(sourceFile,'utf8'));
const singles=new Set(['yCzDip2ma9o','t081EqotCm8','1Fe1ooiTnfI','GuQUr_5dksM','edlhlPDExIQ','JR4sK_IFLvw','B35BQs-jEf4','8JvsROfXgyE','uI01DX8x5yU','RGOWhnd5IRc','hrzkgVBF3FM','j_sYPQCqpmA','vKVEiOjF-9k','G4c-gJlIFaM','5isK-DgYUMI','6P84M_sXCHM','DhZP2111nNY','xhnetlok_RY','7F_OD9-S9GE','0opocDWriTs']);
const catalogue=[];
for(const source of sources){
  const markers=source.chapters.filter((chapter,index,all)=>!index||chapter.start-all[index-1].start>.05);
  const episodeMarkers=markers.filter(chapter=>/Season\s+\d+\s+Ep\./i.test(chapter.title));
  const episodes=singles.has(source.youtubeId)?[{title:source.title,start:0,end:source.duration,thumbnail:`https://i.ytimg.com/vi/${source.youtubeId}/hqdefault.jpg`,titleOrigin:'source-title',chapters:markers.map((chapter,index)=>({...chapter,end:markers[index+1]?.start??source.duration}))}]
    :episodeMarkers.map((chapter,index)=>({...chapter,end:episodeMarkers[index+1]?.start??source.duration,titleOrigin:'provider-chapter',chapters:[]}));
  for(const episode of episodes){
    const asset=`${source.youtubeId}-${Math.round(episode.start*1000)}.jpg`;
    try{await access(`app/public/animation-episodes/${asset}`);episode.thumbnail=`/animation-episodes/${asset}`;}catch{/* provider thumbnail */}
  }
  catalogue.push({youtubeId:source.youtubeId,title:source.title,duration:source.duration,checkedAt:source.checkedAt,
    status:episodes.length?'available':'needs-episode-review',episodes:episodes.map(episode=>({...episode,id:`${source.youtubeId}:episode:${Math.round(episode.start*1000)}`}))});
}
await writeFile(output,JSON.stringify(catalogue,null,2)+'\n');
console.log(JSON.stringify({sources:catalogue.length,episodes:catalogue.flatMap(source=>source.episodes).length,pending:catalogue.filter(source=>!source.episodes.length).length}));
