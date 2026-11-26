let voices: SpeechSynthesisVoice[] = [];

export const canvasVoiceTones = {
  adultMale: { pitch: 0.92, rate: 0.85, female: false },
  adultFemale: { pitch: 1.08, rate: 0.85, female: true },
  childMale: { pitch: 1.22, rate: 0.94, female: false },
  childFemale: { pitch: 1.38, rate: 0.94, female: true },
  seniorMale: { pitch: 0.82, rate: 0.75, female: false },
  seniorFemale: { pitch: 1.01, rate: 0.75, female: true },
} as const;
export type CanvasVoiceTone = keyof typeof canvasVoiceTones;

/** A teacher's text box may include a Korean gloss alongside its English example. */
export function canvasEnglishText(text: string): string {
  if (!/\p{Script=Latin}/u.test(text)) return '';
  return text.replace(/[^\p{Script=Latin}\d\s'’".,!?;:$%&+\-/]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
  };
}

/** 안드로이드 크롬은 읽는 도중 발화 객체가 정리되면 끝 신호·소리가 사라져서, 읽는 동안 붙잡아 둔다 */
const alive = new Set<SpeechSynthesisUtterance>();

/** 목소리 목록은 처음엔 비어 있다가 늦게 채워지므로 읽을 때마다 다시 본다. 영어(미국) 목소리를 먼저 쓴다 */
function englishVoice(): SpeechSynthesisVoice | undefined {
  if (!voices.length) voices = window.speechSynthesis.getVoices();
  const isEn = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase().startsWith('en');
  return voices.find((v) => v.lang.replace('_', '-').toLowerCase() === 'en-us' && isEn(v)) ?? voices.find(isEn);
}

function makeUtter(text: string): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.85;
  const voice = englishVoice();
  if (voice) utter.voice = voice;
  alive.add(utter);
  const release = () => alive.delete(utter);
  utter.addEventListener('end', release);
  utter.addEventListener('error', release);
  return utter;
}

/**
 * 앞에서 읽던 것을 멈추고 새로 읽는다. 안드로이드 크롬은 cancel 바로 뒤의 speak 를 삼키는 일이 있어
 * 읽는 중일 때만 cancel 하고 아주 잠깐 뒤에 시작한다. 일시정지 상태도 풀어 준다.
 */
function start(utters: SpeechSynthesisUtterance[], signal?: AbortSignal) {
  const synth = window.speechSynthesis;
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  const run = () => {
    if (signal?.aborted) return;
    if (synth.paused) synth.resume();
    for (const u of utters) synth.speak(u);
  };
  if (busy) window.setTimeout(run, 60);
  else run();
}

/**
 * 영어 단어/문장을 브라우저 내장 음성으로 읽어준다(Web Speech API, 별도 서버·API 비용 없음).
 * 유치~초등 저학년 대상이라 기본보다 살짝 느리게(rate 0.85) 읽는다.
 */
export function speak(text: string, rate = 0.85) {
  if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utter = makeUtter(text);
  utter.rate = rate;
  start([utter]);
}

/** Voice names are platform-specific. Pitch and rate also work with a single installed voice. */
export function speakCanvasText(text: string, tone?: CanvasVoiceTone) {
  if (!tone || !Object.hasOwn(canvasVoiceTones, tone)) return speak(text);
  if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const preset = canvasVoiceTones[tone];
  const utter = makeUtter(text);
  const name = preset.female ? /\b(female|zira|samantha|jenny|aria|sonia|victoria)\b/i
    : /\b(male|david|mark|guy|george|daniel|alex)\b/i;
  const voice = voices.find(v => /^en(?:[-_]|$)/i.test(v.lang) && name.test(v.name));
  if (voice) { utter.voice = voice; utter.lang = voice.lang; }
  utter.pitch = preset.pitch;
  utter.rate = preset.rate;
  start([utter]);
}

/** For assessed listening, errors and timeouts cannot stand in for playback. */
export function speakVerified(text: string, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted || !text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve(false);
  return new Promise(resolve => {
    try {
      const utterance = makeUtter(text);
      const aborted = () => finish(false);
      const finish = (played: boolean) => {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', aborted);
        resolve(played);
      };
      const timer = window.setTimeout(() => finish(false), signal ? Math.max(8000, text.length * 150) : 8000);
      signal?.addEventListener('abort', aborted, {once:true});
      utterance.addEventListener('end', () => finish(true), { once: true });
      utterance.addEventListener('error', () => finish(false), { once: true });
      start([utterance], signal);
    } catch { resolve(false); }
  });
}

/**
 * speak 와 같지만 다 읽으면 끝나는 Promise 를 돌려준다(시험의 듣기 문제가 읽는 동안 시계를 멈추려고).
 * 음성이 없거나 끝 신호가 오지 않아도 글자 수로 어림한 시간 뒤에는 끝난다.
 */
export function speakAsync(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, 1500 + text.length * 120);
    const utter = makeUtter(text);
    utter.addEventListener('end', finish);
    utter.addEventListener('error', finish);
    start([utter]);
  });
}

/** 여러 문장을 차례대로 읽는다(문법 예문 "모두 읽기"). 앞에서 읽던 건 멈추고 새로 시작한다. */
export function speakSequence(texts: string[]) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utters = texts.filter((t) => t.trim()).map(makeUtter);
  if (utters.length) start(utters);
}
