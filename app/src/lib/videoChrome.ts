import {useCallback,useEffect,useRef,useState} from 'react';
export const VIDEO_CHROME_EVENT='classbank:video-chrome';
/** Overlays retain their geometry when hidden. Focus, hover and open popups lock visibility. */
export function useVideoChrome(playing:boolean,popup:boolean,expanded=false){
 const [full,setFull]=useState(!!document.fullscreenElement),[visible,setVisible]=useState(true),[always,setAlways]=useState(()=>{try{return sessionStorage.getItem('classbank.video.always-show')==='1';}catch{return false;}});
 const last=useRef(Date.now()),hover=useRef(false),focus=useRef(false),navLocked=useRef(false),manuallyHidden=useRef(false);
 const show=useCallback(()=>{manuallyHidden.current=false;last.current=Date.now();setVisible(true);},[]);
 useEffect(()=>{try{sessionStorage.setItem('classbank.video.always-show',always?'1':'0');}catch{/* Session preference is optional. */}},[always]);
 useEffect(()=>{document.addEventListener('keydown',show,true);const move=()=>{if(full||expanded)show();};document.addEventListener('pointermove',move);return()=>{document.removeEventListener('keydown',show,true);document.removeEventListener('pointermove',move);};},[show,full,expanded]);
 useEffect(()=>{const nav=(e:Event)=>{navLocked.current=(e as CustomEvent<boolean>).detail;show();};window.addEventListener('classbank:video-nav-focus',nav);return()=>window.removeEventListener('classbank:video-nav-focus',nav);},[show]);
 useEffect(()=>{const change=()=>{setFull(!!document.fullscreenElement||document.documentElement.dataset.lessonExpanded==='true');show();};document.addEventListener('fullscreenchange',change);window.addEventListener('classbank:lesson-expanded',change);return()=>{document.removeEventListener('fullscreenchange',change);window.removeEventListener('classbank:lesson-expanded',change);};},[show]);
 useEffect(()=>{show();const timer=window.setInterval(()=>{if((full||expanded)&&playing&&!popup&&!always&&!hover.current&&!focus.current&&!navLocked.current&&Date.now()-last.current>=3000)setVisible(false);},250);return()=>clearInterval(timer);},[full,expanded,playing,popup,always,show]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent(VIDEO_CHROME_EVENT,{detail:visible}));return()=>{window.dispatchEvent(new CustomEvent(VIDEO_CHROME_EVENT,{detail:true}));};},[visible]);
 return {visible,hide:()=>{manuallyHidden.current=true;last.current=Date.now();setVisible(false);},always,setAlways,show,pointer:()=>{focus.current=false;show();},lock:{onPointerEnter:(e:React.PointerEvent)=>{if(e.pointerType!=='touch')hover.current=true;show();},onPointerLeave:()=>{hover.current=false;if(!manuallyHidden.current)show();},onFocusCapture:(e:React.FocusEvent)=>{focus.current=(e.target as HTMLElement).matches(':focus-visible');show();},onBlurCapture:(e:React.FocusEvent)=>{if(!e.currentTarget.contains(e.relatedTarget)){focus.current=false;if(!manuallyHidden.current)show();}}}};
}
