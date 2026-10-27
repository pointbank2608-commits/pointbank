import {useState} from 'react';
import MoreMenu from '../../src/components/MoreMenu';
import AdventureEditor from '../../src/components/adventure/AdventureEditor';
import {sampleAdventure} from '../../src/lib/adventureGames';
export default function PrelaunchExtras(){
 const [result,setResult]=useState(''),[open,setOpen]=useState(true);
 return <div className="space-y-6 p-5"><div style={{height:90,overflow:'hidden',border:'1px solid'}} data-clipped-card><MoreMenu triggerLabel="검증 메뉴" items={['공유','다른 반 복사','이전 버전','삭제'].map(label=>({key:label,label,onSelect:()=>setResult(label)}))}/></div><p data-menu-result>{result}</p>{open&&<AdventureEditor type="grammardetective" value={sampleAdventure('grammardetective')} lists={[]} loading={false} busy={false} onDirty={()=>{}} onApply={async c=>{setResult(JSON.stringify(c));setOpen(false);}}/>}<pre data-grammar-result>{result}</pre></div>;
}
