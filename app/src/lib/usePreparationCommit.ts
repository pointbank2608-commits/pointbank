import {useEffect,useRef} from 'react';
import {useGameWorkspace} from '../context/GameWorkspaceContext';

/** The outer Done/Save buttons read the latest native editor values, never a stale preview. */
export function usePreparationCommit(commit:()=>Promise<boolean>){
 const workspace=useGameWorkspace(),latest=useRef(commit);latest.current=commit;
 const register=workspace?.registerPreparation;
 useEffect(()=>register?.(()=>latest.current()),[register]);
 return workspace;
}
