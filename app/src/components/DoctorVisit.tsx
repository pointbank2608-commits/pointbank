import { gameClock } from '../lib/gameClock';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import { MATCH_SETS, PATIENTS, PROBLEM_ORDER, clinicLines, patientById, type Patient, type PatientId } from '../lib/doctorVisit';

/**
 * 병원 롤플레이(2026-10-15) — PPT "ESL Let's Go to the Doctor Lesson (Kids A1)"를 한 게임으로 옮겼다.
 * ① 낱말(8개: 그림을 눌러 낱말·예문) ② 짝 맞추기(PPT 11·12번, 4개씩 2세트) ③ What's the problem?(PPT 13~19번)
 * ④ 진료실(우리가 보탠 의사–환자 대화: 환자를 고르고 한 줄씩 말하기, Switch!). 점수는 없다.
 */

interface Props {
  showKo: boolean;
}

type Step = 'words' | 'match' | 'problem' | 'clinic';
const STEPS: Step[] = ['words', 'match', 'problem', 'clinic'];
const STEP_ICON: Record<Step, string> = { words: '🩺', match: '🔗', problem: '❓', clinic: '🏥' };
const IMG = (n: string) => `/skins/doctor/${n}.webp`;

const STYLE = `
@keyframes dr-pop { 0%{transform:scale(.5);opacity:0} 60%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes dr-rise { 0%{transform:translateY(10%);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes dr-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6%)} 75%{transform:translateX(6%)} }
@keyframes dr-glow { 0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.95)} 50%{box-shadow:0 0 0 .7cqw rgba(250,204,21,0)} }
.dr-btn { transition: transform .15s, filter .15s; }
.dr-btn:hover:not(:disabled) { transform: translateY(-3%) scale(1.03); filter: brightness(1.04); }
.dr-btn:active:not(:disabled) { transform: scale(.97); }
.dr-btn:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .dr-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function DoctorVisit({ showKo: showKoProp }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('words');
  const [showKo, setShowKo] = useState(showKoProp);

  /* ① 낱말 */
  const [openWord, setOpenWord] = useState<Set<PatientId>>(new Set());
  function reveal(p: Patient) {
    setOpenWord((s) => new Set(s).add(p.id));
    playSfx(GAME_SFX.doctor.reveal);
    speak(`${p.word}. ${p.sentence}`);
  }

  /* ② 짝 맞추기 */
  const [setIdx, setSetIdx] = useState(0);
  const [pickedWord, setPickedWord] = useState<PatientId | null>(null);
  const [done, setDone] = useState<Set<PatientId>>(new Set());
  const [wrong, setWrong] = useState<PatientId | null>(null);
  const [order, setOrder] = useState<PatientId[]>(() => shuffle(MATCH_SETS[0]));
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const l = timers.current;
    return () => l.forEach((id) => gameClock.clearTimeout(id));
  }, []);
  function loadSet(i: number) {
    setSetIdx(i);
    setDone(new Set());
    setPickedWord(null);
    setOrder(shuffle(MATCH_SETS[i]));
  }
  function pickPicture(id: PatientId) {
    if (done.has(id) || !pickedWord) return;
    if (id === pickedWord) {
      setDone((d) => new Set(d).add(id));
      setPickedWord(null);
      playSfx(GAME_SFX.doctor.correct);
      speak(patientById(id).word);
    } else {
      setWrong(id);
      playSfx(GAME_SFX.doctor.wrong);
      timers.current.push(gameClock.setTimeout(() => setWrong(null), 500));
    }
  }
  const setDoneAll = done.size >= MATCH_SETS[setIdx].length;

  /* ③ What's the problem? */
  const [pIdx, setPIdx] = useState(0);
  const [pShown, setPShown] = useState(false);
  function revealProblem() {
    setPShown(true);
    playSfx(GAME_SFX.doctor.reveal);
    speak(patientById(PROBLEM_ORDER[pIdx]).problem);
  }
  function nextProblem() {
    setPIdx((i) => Math.min(PROBLEM_ORDER.length - 1, i + 1));
    setPShown(false);
  }

  /* ④ 진료실 */
  const [patientId, setPatientId] = useState<PatientId>('headache');
  const [shown, setShown] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const patient = patientById(patientId);
  const lines = clinicLines(patient);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);
  function nextLine() {
    if (shown >= lines.length) return;
    setShown(shown + 1);
    playSfx(GAME_SFX.doctor.line);
    speak(lines[shown].text);
  }
  function choosePatient(id: PatientId) {
    setPatientId(id);
    setShown(0);
    playSfx(GAME_SFX.doctor.reveal);
  }
  function randomPatient() {
    const others = PATIENTS.filter((p) => p.id !== patientId);
    choosePatient(others[Math.floor(Math.random() * others.length)].id);
  }
  function switchRoles() {
    setSwapped((v) => !v);
    playSfx(COMMON_SFX.yourTurn);
  }
  const clinicDone = shown >= lines.length;

  /* ---- 선생님 폰 리모컨 ---- */
  const stepIdx = STEPS.indexOf(step);
  const nextStep = stepIdx < STEPS.length - 1 ? [{ id: 'step', label: t('gameDoctor.nextStep'), tone: 'neutral' as const, run: () => setStep(STEPS[stepIdx + 1]) }] : [];
  useRemoteActions(
    step === 'words'
      ? [{ id: 'reveal', label: t('gameDoctor.revealNext'), tone: 'primary' as const, run: () => { const p = PATIENTS.find((x) => !openWord.has(x.id)); if (p) reveal(p); } }, ...nextStep]
      : step === 'match'
        ? [{ id: 'again', label: t('gameDoctor.again'), tone: 'neutral' as const, run: () => loadSet(setIdx) }, { id: 'nextset', label: t('gameDoctor.nextSet'), tone: 'primary' as const, run: () => loadSet((setIdx + 1) % MATCH_SETS.length) }, ...nextStep]
        : step === 'problem'
          ? [{ id: 'answer', label: t('gameDoctor.showAnswer'), tone: 'primary' as const, run: revealProblem }, { id: 'next', label: t('gameDoctor.nextPicture'), tone: 'neutral' as const, run: nextProblem }, ...nextStep]
          : [
              { id: 'line', label: t('gameDoctor.nextLine'), tone: 'primary' as const, run: nextLine },
              { id: 'random', label: t('gameDoctor.randomPatient'), tone: 'neutral' as const, run: randomPatient },
              { id: 'switch', label: 'Switch!', tone: 'good' as const, run: switchRoles },
            ],
  );

  const pill = { fontSize: 'clamp(11px, 1.9cqw, 26px)' };
  const bf = { fontSize: 'clamp(11px, 1.7cqw, 22px)' };
  const btn = 'dr-btn rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg';
  const scene = step === 'clinic' ? 'scene-clinic' : 'scene-waiting';
  const problemPatient = patientById(PROBLEM_ORDER[pIdx]);
  const doctorSide = swapped ? 1 : 0;

  return (
    <div className="space-y-3">
      <style>{STYLE}</style>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
              step === s ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span aria-hidden="true">{STEP_ICON[s]}</span>
            {i + 1}. {t(`gameDoctor.step_${s}`)}
          </button>
        ))}
      </div>

      <div className="relative w-full overflow-hidden rounded-[24px] shadow-lg" style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#bae6fd url(${IMG(scene)}) center / cover no-repeat` }}>
        <div className="absolute left-0 right-0 top-[2.2%] z-20 text-center">
          <span className="inline-block max-w-[92%] rounded-full bg-white/92 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={pill}>
            {step === 'problem' ? 'What’s the problem?' : t(`gameDoctor.hint_${step}`)}
          </span>
        </div>

        {/* ① 낱말 */}
        {step === 'words' && (
          <>
            <div className="absolute inset-x-[3%] z-10 grid grid-cols-4 gap-[1.4cqw]" style={{ top: '11.5%', bottom: '11%' }}>
              {PATIENTS.map((p, i) => {
                const open = openWord.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => reveal(p)}
                    className="dr-btn dr-anim flex flex-col items-center overflow-hidden rounded-[1.4cqw] border-[0.35cqw] border-white bg-white/90 p-[0.6cqw] shadow-lg"
                    style={{ animation: open ? undefined : `dr-rise .4s ${i * 0.05}s both` }}
                  >
                    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                      <img src={IMG(p.art)} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                    </div>
                    <div className="flex w-full flex-col items-center justify-center" style={{ minHeight: '7cqw' }}>
                      {open ? (
                        <>
                          <div className="dr-anim font-black leading-tight text-deep-navy" style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)', animation: 'dr-pop .35s both' }}>
                            {p.word}
                            {showKo && <span className="ml-[0.6cqw] text-indigo-600" style={{ fontSize: '0.62em' }}>{p.ko}</span>}
                          </div>
                          <div className="text-center leading-tight text-slate-600" style={{ fontSize: 'clamp(8px, 1.15cqw, 16px)' }}>
                            {p.sentence}
                          </div>
                        </>
                      ) : (
                        <div className="font-black text-slate-400" style={{ fontSize: 'clamp(14px, 2.6cqw, 34px)' }}>?</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameDoctor.koToggle')}
              </button>
              <button type="button" onClick={() => setStep('match')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                {t('gameDoctor.toMatch')} ▶
              </button>
            </div>
          </>
        )}

        {/* ② 짝 맞추기 */}
        {step === 'match' && (
          <>
            <div className="absolute z-10 flex flex-col justify-evenly gap-[0.8cqw]" style={{ left: '5%', width: '30%', top: '12%', bottom: '12%' }}>
              {MATCH_SETS[setIdx].map((id) => {
                const p = patientById(id);
                const ok = done.has(id);
                const sel = pickedWord === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={ok}
                    onClick={() => {
                      setPickedWord(id);
                      speak(p.word);
                    }}
                    className="dr-btn rounded-[1.2cqw] border-[0.3cqw] px-[1cqw] py-[1.2cqw] font-black shadow-lg"
                    style={{
                      background: ok ? '#bbf7d0' : sel ? '#fde68a' : '#ffffffee',
                      borderColor: ok ? '#16a34a' : sel ? '#f59e0b' : '#fff',
                      fontSize: 'clamp(12px, 2.2cqw, 30px)',
                      color: '#0f172a',
                    }}
                  >
                    {ok ? '✓ ' : ''}
                    {p.word}
                  </button>
                );
              })}
            </div>
            <div className="absolute z-10 grid grid-cols-4 gap-[1.2cqw]" style={{ left: '38%', right: '3%', top: '12%', bottom: '12%' }}>
              {order.map((id) => {
                const p = patientById(id);
                const ok = done.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={ok}
                    onClick={() => pickPicture(id)}
                    className="dr-btn dr-anim flex items-center justify-center rounded-[1.2cqw] border-[0.3cqw] p-[0.5cqw] shadow-lg"
                    style={{ background: ok ? '#bbf7d0' : '#ffffffee', borderColor: ok ? '#16a34a' : '#fff', animation: wrong === id ? 'dr-shake .4s' : undefined, opacity: ok ? 0.85 : 1 }}
                  >
                    <img src={IMG(p.art)} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  </button>
                );
              })}
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={() => loadSet(setIdx)} className={btn} style={{ ...bf, background: '#64748b' }}>
                {t('gameDoctor.again')}
              </button>
              {MATCH_SETS.map((_, i) => (
                <button key={i} type="button" onClick={() => loadSet(i)} className={btn} style={{ ...bf, background: setIdx === i ? '#6366f1' : '#94a3b8' }}>
                  {t('gameDoctor.setN', { n: i + 1 })}
                </button>
              ))}
              {setDoneAll && (
                <button type="button" onClick={() => (setIdx < MATCH_SETS.length - 1 ? loadSet(setIdx + 1) : setStep('problem'))} className={`${btn} dr-anim`} style={{ ...bf, background: '#16a34a', animation: 'dr-glow 1.4s ease-in-out infinite' }}>
                  {setIdx < MATCH_SETS.length - 1 ? t('gameDoctor.nextSet') : t('gameDoctor.toProblem')} ▶
                </button>
              )}
            </div>
          </>
        )}

        {/* ③ What's the problem? */}
        {step === 'problem' && (
          <>
            <div className="absolute z-10 flex flex-col items-center justify-end" style={{ left: '28%', right: '28%', top: '11%', bottom: '17%' }}>
              <img src={IMG(problemPatient.art)} alt="" className="dr-anim min-h-0 flex-1 object-contain drop-shadow-xl" style={{ animation: 'dr-pop .35s both' }} key={problemPatient.id} draggable={false} />
              <div className="mt-[1cqw] flex min-h-[7cqw] w-full items-center justify-center rounded-[1.6cqw] bg-white/92 px-[2cqw] py-[0.8cqw] shadow-xl">
                {pShown ? (
                  <div className="dr-anim text-center font-black text-deep-navy" style={{ fontSize: 'clamp(14px, 3cqw, 40px)', animation: 'dr-pop .35s both' }}>
                    {problemPatient.problem}
                    {showKo && <div className="font-bold text-indigo-600" style={{ fontSize: '0.5em' }}>{problemPatient.ko}</div>}
                  </div>
                ) : (
                  <button type="button" onClick={revealProblem} className="dr-btn rounded-full bg-indigo-500 px-[2cqw] py-[0.6cqw] font-bold text-white" style={{ fontSize: 'clamp(11px, 1.8cqw, 24px)' }}>
                    {t('gameDoctor.showAnswer')}
                  </button>
                )}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex items-center justify-center gap-[0.8cqw]">
              <span className="rounded-full bg-white/90 px-[1.2cqw] py-[0.3cqw] font-bold text-slate-700" style={{ fontSize: 'clamp(10px, 1.4cqw, 19px)' }}>
                {pIdx + 1} / {PROBLEM_ORDER.length}
              </span>
              <button type="button" onClick={() => { setPIdx((i) => Math.max(0, i - 1)); setPShown(false); }} disabled={pIdx === 0} className={`${btn} disabled:opacity-40`} style={{ ...bf, background: '#64748b' }}>
                ◀
              </button>
              {pIdx < PROBLEM_ORDER.length - 1 ? (
                <button type="button" onClick={nextProblem} className={btn} style={{ ...bf, background: '#6366f1' }}>
                  {t('gameDoctor.nextPicture')} ▶
                </button>
              ) : (
                <button type="button" onClick={() => setStep('clinic')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                  {t('gameDoctor.toClinic')} ▶
                </button>
              )}
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameDoctor.koToggle')}
              </button>
            </div>
          </>
        )}

        {/* ④ 진료실 */}
        {step === 'clinic' && (
          <>
            {/* 환자 고르기 */}
            <div className="absolute z-20 flex justify-center gap-[0.6cqw]" style={{ left: '3%', right: '3%', top: '10%' }}>
              {PATIENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePatient(p.id)}
                  className="dr-btn rounded-[1cqw] border-[0.25cqw] bg-white/92 px-[0.6cqw] pt-[0.3cqw]"
                  style={{ borderColor: patientId === p.id ? '#f59e0b' : '#fff', width: '9cqw' }}
                >
                  <img src={IMG(p.art)} alt="" className="mx-auto object-contain" style={{ height: '6.4cqw' }} draggable={false} />
                  <div className="truncate text-center font-bold text-slate-800" style={{ fontSize: 'clamp(8px, 1.1cqw, 15px)' }}>{p.word}</div>
                </button>
              ))}
            </div>

            {/* 의사·환자 */}
            {([0, 1] as const).map((side) => {
              const isDoctor = side === doctorSide;
              return (
                <div key={side} className="absolute z-10 flex flex-col items-center" style={{ [side === 0 ? 'left' : 'right']: '2%', width: '15%', top: '27%', bottom: '12%' }}>
                  <img src={IMG(isDoctor ? 'doctor-f' : patient.art)} alt="" className="min-h-0 flex-1 object-contain drop-shadow-lg" draggable={false} />
                  <span className="mt-[0.4cqw] rounded-full px-[1cqw] py-[0.2cqw] text-center font-black text-white shadow" style={{ background: isDoctor ? '#0284c7' : '#ea580c', fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                    {isDoctor ? 'Doctor' : 'Patient'} · {side === 0 ? 'A' : 'B'}
                  </span>
                </div>
              );
            })}

            {/* 대화 */}
            <div ref={chatRef} className="absolute z-10 flex flex-col gap-[0.7cqw] overflow-y-auto rounded-[1.6cqw] bg-white/84 p-[1.2cqw] shadow-xl" style={{ left: '19%', right: '19%', top: '27%', bottom: '12%' }}>
              {lines.slice(0, shown).map((l, i) => {
                const doc = l.who === 'doctor';
                return (
                  <div key={i} className={`dr-anim flex ${doc ? 'justify-start' : 'justify-end'}`} style={{ animation: 'dr-rise .3s both' }}>
                    <button
                      type="button"
                      onClick={() => speak(l.text)}
                      className="max-w-[88%] rounded-[1.1cqw] border-[0.2cqw] px-[1cqw] py-[0.4cqw] text-left font-bold text-slate-800"
                      style={{ background: doc ? '#e0f2fe' : '#fff7ed', borderColor: doc ? '#38bdf8' : '#fb923c', fontSize: 'clamp(10px, 1.6cqw, 22px)' }}
                    >
                      <span className="block font-black" style={{ fontSize: '0.6em', color: doc ? '#0369a1' : '#c2410c' }}>
                        {doc ? 'Doctor' : 'Patient'}
                      </span>
                      {l.text}
                      {showKo && <span className="block font-normal text-slate-500" style={{ fontSize: '0.66em' }}>{l.ko}</span>}
                    </button>
                  </div>
                );
              })}
              {shown === 0 && (
                <div className="m-auto text-center font-bold text-slate-500" style={{ fontSize: 'clamp(10px, 1.6cqw, 22px)' }}>
                  {t('gameDoctor.clinicHint')}
                </div>
              )}
              {clinicDone && (
                <div className="dr-anim m-auto flex items-center gap-[1cqw]" style={{ animation: 'dr-pop .4s both' }}>
                  <img src={IMG('medicine')} alt="" style={{ height: '7cqw' }} className="object-contain" draggable={false} />
                  <img src={IMG('firstaid')} alt="" style={{ height: '7cqw' }} className="object-contain" draggable={false} />
                </div>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={nextLine} disabled={clinicDone} className={`${btn} disabled:opacity-40`} style={{ ...bf, background: '#0284c7' }}>
                {shown === 0 ? t('gameDoctor.start') : t('gameDoctor.nextLine')} ▶
              </button>
              <button type="button" onClick={randomPatient} className={btn} style={{ ...bf, background: '#6366f1' }}>
                🎲 {t('gameDoctor.randomPatient')}
              </button>
              <button type="button" onClick={switchRoles} className={btn} style={{ ...bf, background: '#16a34a' }}>
                Switch! 🔄
              </button>
              <button type="button" onClick={() => setShown(0)} className={btn} style={{ ...bf, background: '#64748b' }}>
                {t('gameDoctor.again')}
              </button>
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameDoctor.koToggle')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
