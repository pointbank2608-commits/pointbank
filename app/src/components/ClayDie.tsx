import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DICE_FACES, DICE_ROLL_MS, nextDiceRotation } from '../lib/diceMotion';
import { drawRoundedDie } from '../lib/roundedDie';
import './clay-dice.css';

export default function ClayDie({ tint, value, rolling, spin, tossKey, label }: {
  tint: 'blue' | 'red'; value: number; rolling: boolean; spin: 'a' | 'b'; tossKey: number; label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const spinDriver = useRef<HTMLDivElement>(null);
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
  useLayoutEffect(() => {
    const context = canvas.current?.getContext('2d');
    const driver = spinDriver.current;
    if (!context || !driver) return;
    let frame = 0;
    let lastTransform = '';
    const draw = () => {
      const transform = getComputedStyle(driver).transform;
      if (transform !== lastTransform) {
        drawRoundedDie(context, new DOMMatrixReadOnly(transform), tint);
        lastTransform = transform;
      }
      if (rolling) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [motion, rolling, tint]);

  const style = {
    '--td-from-rx': `${motion.from.rx}deg`, '--td-from-ry': `${motion.from.ry}deg`,
    '--td-rx': `${motion.to.rx}deg`, '--td-ry': `${motion.to.ry}deg`,
    '--td-duration': `${DICE_ROLL_MS}ms`,
    '--td-drift': spin === 'a' ? '-7px' : '7px',
    '--td-tilt': spin === 'a' ? '14deg' : '-14deg',
  } as CSSProperties;
  return <div role="img" aria-label={label} data-value={rolling ? undefined : value}
    data-skin-object="die" className={`clay-die td-die-scene ${rolling ? 'is-rolling' : ''}`} style={style}>
    <div className="td-die-shadow" />
    <div className="td-toss" aria-hidden="true">
      <div ref={spinDriver} className="td-cube" />
      <canvas ref={canvas} className="td-rounded-body" width={384} height={384} />
    </div>
  </div>;
}
