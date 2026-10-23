import { useEffect, useState } from 'react';

/** Decode the exact currently selected media URLs before allowing finished printing. */
export function useWorkbookImageChecks(paths: string[]) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    setChecked({});
    for (const src of paths) {
      const image = new Image();
      image.src = src;
      image.decode().then(() => { if (active) setChecked(prev => ({ ...prev, [src]: true })); })
        .catch(() => { if (active) setChecked(prev => ({ ...prev, [src]: false })); });
    }
    return () => { active = false; };
  }, [paths]);
  return checked;
}
