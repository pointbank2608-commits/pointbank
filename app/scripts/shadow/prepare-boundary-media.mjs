// Read-only original media for local boundary QA. Nothing is uploaded to our service.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
const [catalogFile,out,downloader,runtime,...ids]=process.argv.slice(2);
if(!runtime)throw Error('catalogue, output folder, official yt-dlp and supported Node runtime required');
const sources=JSON.parse(await readFile(catalogFile,'utf8')).filter(s=>!ids.length||ids.includes(s.youtubeId));
const root=resolve(out);await mkdir(root,{recursive:true});
let cursor=0;const failed=[];
function run(program,args,stdout=false){return new Promise((accept,reject)=>{
 const p=spawn(program,args,{windowsHide:true});let log='';
 p.stdout.on('data',b=>{log+=b;if(stdout)process.stdout.write(b);});p.stderr.on('data',b=>{log+=b;});
 p.on('error',reject);p.on('close',code=>code===0?accept(log):reject(Error(log.slice(-1000))));
});}
await Promise.all(Array.from({length:2},async()=>{while(cursor<sources.length){
 const source=sources[cursor++],file=join(root,source.youtubeId+'.mkv');
 try{
  try{await access(file);}catch{
   console.log(source.youtubeId,'fetching public original');
   await run(downloader,['--ignore-config','--no-playlist','--no-progress','--js-runtimes','node:'+runtime,
    '-f','134+249/18/b[height<=360]','--merge-output-format','mkv','-o',join(root,'%(id)s.%(ext)s'),`https://www.youtube.com/watch?v=${source.youtubeId}`]);
   try{await access(file);}catch{
    let alternative;
    for(const extension of ['mp4','webm'])try{const candidate=join(root,source.youtubeId+'.'+extension);await access(candidate);alternative=candidate;break;}catch{}
    if(!alternative)throw Error('No completed original media file');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-i',alternative,'-c','copy','-y',file]);
   }
  }
  const probe=JSON.parse(await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,r_frame_rate,start_time','-of','json',file]));
  if(!probe.streams.some(s=>s.codec_type==='audio')||!probe.streams.some(s=>s.codec_type==='video'))throw Error('Both original audio and video required');
  if(Math.abs(Number(probe.format.duration)-source.duration)>2)throw Error('Original duration differs from catalogue');
  await writeFile(join(root,source.youtubeId+'.probe.json'),JSON.stringify(probe,null,2));
  console.log(source.youtubeId,'original ready',probe.format.duration);
 }catch(error){failed.push(source.youtubeId);console.error(source.youtubeId,error.message);}
}}));
if(failed.length)throw Error('Originals unavailable: '+failed.join(', '));
