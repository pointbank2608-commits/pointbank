import { useEffect, useState } from 'react';
import { fetchWordLists } from './api';
import type { WordList } from './types';

/** Use the same scope as My collections: selected class plus academy-wide words. */
export function useClassWordLists(academyId: string, classId: string) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{key:string; lists:WordList[]; loading:boolean; error:boolean}>({key:'',lists:[],loading:true,error:false});
  const key = `${academyId}:${classId}`;
  useEffect(() => {
    let active=true;
    setState({key,lists:[],loading:true,error:false});
    void fetchWordLists(academyId,classId).then(lists => {
      if(active)setState({key,lists,loading:false,error:false});
    }).catch(() => {
      if(active)setState({key,lists:[],loading:false,error:true});
    });
    return () => { active=false; };
  },[academyId,classId,key,retry]);
  return {...(state.key===key?state:{lists:[],loading:true,error:false}), reload:()=>setRetry(n=>n+1)};
}
