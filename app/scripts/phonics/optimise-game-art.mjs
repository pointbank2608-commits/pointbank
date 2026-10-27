// Format-only optimisation of built-in Imagegen outputs. No artwork is repainted.
import {createRequire} from 'node:module';
import {mkdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const sharp=require(process.env.PHONICS_SHARP_MODULE||'sharp');
const source=resolve(process.argv[2]||'../output/phonics-artwork-v2/originals'),destination=resolve('public/skins/phonics-v2');
await mkdir(destination,{recursive:true});
for(const id of ['train','workshop','garden','diner','coast','island','props','monster-states']){
 const input=resolve(source,id+'.png');
 const metadata=await sharp(input).metadata();
 const atlas=id==='props'||id==='monster-states';
 if(atlas&&!metadata.hasAlpha)throw Error('The sprite atlas must preserve transparency');
 await sharp(input).webp(atlas?{lossless:true}:{quality:86,effort:6}).toFile(resolve(destination,id+'.webp'));
 console.log(id,metadata.width,metadata.height,(await stat(resolve(destination,id+'.webp'))).size);
}
