import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchScanAccess } from './api';

/** Teacher-facing model calls share the existing per-academy admin switch.
 * The Edge Function checks it again before contacting a model. */
export function useAcademyAi() {
  const { academy, profile } = useAuth();
  const id = academy?.id;
  const scope = id && profile?.id ? id + '/' + profile.id : '';
  const [allowed, setAllowed] = useState('');
  useEffect(() => {
    let sequence = 0;
    async function check() {
      const current = ++sequence;
      const enabled = id && scope && await fetchScanAccess(id).catch(() => false);
      if (current === sequence) setAllowed(enabled ? scope : '');
    }
    void check();
    window.addEventListener('focus', check);
    return () => { sequence++; window.removeEventListener('focus', check); };
  }, [id, scope]);
  return !!scope && allowed === scope;
}
