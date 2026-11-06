import { useEffect, useState } from 'react';
import { grammarList, grammarNotReady, type GrammarAssignment } from './grammarServer';

export function useGrammarPortalAssignments(token: string | null) {
  const [result, setResult] = useState<{ token: string; rows: GrammarAssignment[]; error?: boolean }>();
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!token) return;
    let active = true;
    grammarList(token).then(rows => { if (active) setResult({ token, rows }); })
      .catch(error => { if (active) setResult({ token, rows: [], error: !grammarNotReady(error) }); });
    return () => { active = false; };
  }, [token, reload]);
  const current = result?.token === token ? result : undefined;
  return { rows: current?.rows ?? [], error: current?.error, retry: () => setReload(n => n + 1) };
}
