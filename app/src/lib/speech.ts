let voices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
  };
}

/**
 * 영어 단어/문장을 브라우저 내장 음성으로 읽어준다(Web Speech API, 별도 서버·API 비용 없음).
 * 유치~초등 저학년 대상이라 기본보다 살짝 느리게(rate 0.85) 읽는다.
 */
export function speak(text: string) {
  if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.85;
  const voice = voices.find((v) => v.lang.startsWith('en'));
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}
