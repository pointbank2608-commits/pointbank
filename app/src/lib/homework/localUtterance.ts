/** Optional on-device recognition. The microphone recording remains usable when
 * a browser has no local English recognizer or its language pack is missing. */
type LocalRecognizer = {
  lang: string;
  processLocally: boolean;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => LocalRecognizer;
  webkitSpeechRecognition?: new () => LocalRecognizer;
};
export type UtteranceCheck = 'matched' | 'different' | 'unrecognized' | 'unavailable';
function words(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function compareUtterance(expected: string, heard: string): UtteranceCheck {
  const text = words(heard);
  if (!text) return 'unrecognized';
  return text === words(expected) ? 'matched' : 'different';
}
export function listenLocally(expected: string, onCheck: (value: UtteranceCheck) => void) {
  const browser = window as SpeechWindow;
  const Engine = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!Engine || !expected.trim()) return null;
  let speech: LocalRecognizer | undefined;
  try {
    speech = new Engine();
    if (!('processLocally' in speech)) return null;
    speech.processLocally = true;
    speech.lang = 'en-US';
    speech.continuous = true;
    speech.interimResults = false;
    let receivedResult = false;
    speech.onresult = ({ results }) => {
      const text = Array.from(results, line => line[0]?.transcript ?? '').join(' ');
      receivedResult = Boolean(text.trim());
      onCheck(compareUtterance(expected, text));
    };
    speech.onerror = ({ error }) => {
      if (!receivedResult && error !== 'aborted') onCheck(error === 'no-speech' ? 'unrecognized' : 'unavailable');
    };
    speech.start();
    const active = speech;
    return {
      stop() { try { active.stop(); } catch { /* Already stopped after a speech error. */ } },
      abort() { try { active.abort(); } catch { /* The recorder has an independent lifecycle. */ } },
    };
  } catch {
    try { speech?.abort(); } catch { /* Optional recognizer did not start. */ }
    return null;
  }
}
