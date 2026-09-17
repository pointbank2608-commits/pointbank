import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DICE_FACES, nextDiceRotation } from '../lib/diceMotion';
import './clay-dice.css';

const pips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const faces = [[1, 'front'], [6, 'back'], [3, 'right'], [4, 'left'], [2, 'top'], [5, 'bottom']] as const;

export default function ClayDie({ tint, value, rolling, spin, tossKey, label }: {
  tint: 'teal' | 'coral'; value: number; rolling: boolean; spin: 'a' | 'b'; tossKey: number; label: string;
}) {
  const previous = useRef(DICE_FACES[value]);
  const lastRoll = useRef(0);
  const [motion, setMotion] = useState({ from: previous.current, to: previous.current });
  useLayoutEffect(() => {
    if (rolling && lastRoll.current !== tossKey) {
      const from = previous.current;
      const to = nextDiceRotation(from, value, spin === 'a' ? 1 : -1);
      previous.current = to;
      lastRoll.current = tossKey;
      setMotion({ from, to });
    } else if (!rolling && tossKey === 0) {
      const face = DICE_FACES[value];
      previous.current = face;
      lastRoll.current = 0;
      setMotion({ from: face, to: face });
    }
  }, [rolling, value, spin, tossKey]);
  const style = {
    '--td-from-rx': `${motion.from.rx}deg`, '--td-from-ry': `${motion.from.ry}deg`,
    '--td-rx': `${motion.to.rx}deg`, '--td-ry': `${motion.to.ry}deg`,
    '--td-drift': spin === 'a' ? '-10px' : '10px',
  } as CSSProperties;
  return <div role="img" aria-label={label} data-value={rolling ? undefined : value}
    data-skin-object="die" className={`clay-die td-die-scene ${rolling ? 'is-rolling' : ''}`} style={style}>
    <div className="td-die-shadow" />
    <div className="td-toss"><div className="td-camera"><div className="td-cube">
      {faces.map(([n, pos]) => <div key={n} className={`td-face td-face-${pos} td-face-${tint}`}>
        <div className="td-pips" aria-hidden="true">{Array.from({ length: 9 }, (_, i) =>
          <span key={i} className={pips[n].includes(i) ? 'td-pip' : undefined} />)}</div>
      </div>)}
    </div></div></div>
  </div>;
}
