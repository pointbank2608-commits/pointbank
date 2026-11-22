// Read the existing public dictionary for vocabulary meaning/image validation.
import {readFile,writeFile} from 'node:fs/promises';
const [environmentFile,out]=process.argv.slice(2);
const environment=await readFile(environmentFile,'utf8');
const get=name=>environment.match(new RegExp(`^${name}=(.*)$`,'m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const base=get('VITE_SUPABASE_URL'),key=get('VITE_SUPABASE_ANON_KEY');
if(!base||!key)throw new Error('Project environment missing');
const entries=[];
for(let offset=0;;offset+=1000){
  const response=await fetch(`${base}/rest/v1/word_bank?select=word,meaning,image_url,part_of_speech&order=sort_order,sense_number,id&offset=${offset}&limit=1000`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw new Error(`Public dictionary read failed ${response.status}`);
  const page=await response.json();entries.push(...page);if(page.length<1000)break;
}
await writeFile(out,JSON.stringify(entries));console.log('Public dictionary entries',entries.length);
