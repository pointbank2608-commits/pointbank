import {useCallback,useEffect,useRef,useState} from 'react';
export const VIDEO_CHROME_EVENT='classbank:video-chrome';
/** Overlays retain their geometry when hidden. Focus, hover and open popups lock visibility. */
export function useVideoChrome(playing:boolean,popup:boolean,expanded=false){
 const [full,setFull]=useState(!!document.fullscreenElement),[visible,setVisible]=useState(true),[always,setAlways]=useState(false);
 const last=useRef(Date.now()),hover=useRef(false),focus=useRef(false);
 const show=useCallback(()=>{last.current=Date.now();setVisible(true);},[]);
 useEffect(()=>{const nav=(e:Event)=>{hover.current=(e as CustomEvent<boolean>).detail;show();};window.addEventListener('classbank:video-nav-focus',nav);return()=>window.removeEventListener('classbank:video-nav-focus',nav);},[show]);
 useEffect(()=>{const change=()=>{setFull(!!document.fullscreenElement||document.documentElement.dataset.lessonExpanded==='true');show();};document.addEventListener('fullscreenchange',change);window.addEventListener('classbank:lesson-expanded',change);return()=>{document.removeEventListener('fullscreenchange',change);window.removeEventListener('classbank:lesson-expanded',change);};},[show]);
 useEffect(()=>{show();const timer=window.setInterval(()=>{if((full||expanded)&&playing&&!popup&&!always&&!hover.current&&!focus.current&&Date.now()-last.current>=3000)setVisible(false);},250);return()=>clearInterval(timer);},[full,expanded,playing,popup,always,show]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent(VIDEO_CHROME_EVENT,{detail:visible}));return()=>{window.dispatchEvent(new CustomEvent(VIDEO_CHROME_EVENT,{detail:true}));};},[visible]);
 return {visible,always,setAlways,show,pointer:()=>{focus.current=false;show();},lock:{onMouseEnter:()=>{hover.current=true;show();},onMouseLeave:()=>{hover.current=false;show();},onFocusCapture:(e:React.FocusEvent)=>{focus.current=(e.target as HTMLElement).matches(':focus-visible');show();},onBlurCapture:(e:React.FocusEvent)=>{if(!e.currentTarget.contains(e.relatedTarget)){focus.current=false;show();}}}};
}
