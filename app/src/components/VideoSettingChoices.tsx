import type {ReactNode} from 'react';
/** Existing setting values, exposed as touch-friendly, immediately applied toggles. */
export default function VideoSettingChoices<T extends string|number>({label,values,value,onChange,format}:{label:string;values:readonly T[];value:T;onChange:(v:T)=>void;format:(v:T)=>ReactNode}){
 return <fieldset className="tv-choice-row"><legend>{label}</legend><div>{values.map(v=><button type="button" key={v} aria-pressed={value===v} onClick={()=>onChange(v)}>{format(v)}</button>)}</div></fieldset>;
}
