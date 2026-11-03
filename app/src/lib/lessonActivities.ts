import { BLOCKS } from './blocks/registry';
import type { BlockDef } from './blocks/types';

export type ActivityCategory = 'recent'|'learn'|'games'|'media'|'print'|'free';
const LEARN_ORDER=['learn.wordShow','learn.study','learn.shadow','learn.reading.cloze','learn.qna','learn.reading.lines','learn.grammar','learn.drill','learn.rainbow.speak','learn.rainbow.structure','learn.stem','learn.attendance'];
export const GROUP_ACTIVITIES=BLOCKS.filter(b=>b.uses.includes('group')&&b.status==='ready').sort((a,b)=>a.category==='learn'&&b.category==='learn'?LEARN_ORDER.indexOf(a.id)-LEARN_ORDER.indexOf(b.id):0);
export const activityCategory=(b:BlockDef):ActivityCategory=>b.category==='game'||b.category==='practice'?'games':b.category==='helper'?'free':b.category as ActivityCategory;

export function readRecentActivities(key:string):string[]{try{const v=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,12):[];}catch{return [];}}
export function rememberActivity(key:string,id:string){try{localStorage.setItem(key,JSON.stringify([id,...readRecentActivities(key).filter(x=>x!==id)].slice(0,12)));}catch{/* private storage */}}
