import { useRef, useState } from 'react';
import { usePhonicsSound } from '../lib/phonicsGameSound';
import { hasPhoneme, playPhoneme } from '../lib/phonicsPhonemes';

export default function LearningAudioButton({ text, ruleId, en, onPlayback, compact = false }: {
  text: string; ruleId?: string; en: boolean; onPlayback?: () => void; compact?: boolean;
}) {
  const { player } = usePhonicsSound();
  const [failedFor, setFailedFor] = useState('');
  const request = useRef(0);
  const key = ruleId || text;
  const label = ruleId ? (en ? 'Hear the sound' : '소리 듣기') : (en ? 'Hear word / sentence' : '단어·문장 듣기');
  if (ruleId && !hasPhoneme(ruleId)) return null;
  function play() {
    const current = ++request.current;
    const failed = () => { if (current === request.current) setFailedFor(key); };
    player.stop();
    player.cancelSpeech();
    setFailedFor('');
    if (ruleId) {
      void playPhoneme(ruleId).then(ok => { if (!ok) failed(); else if (current === request.current) onPlayback?.(); });
      return;
    }
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') { failed(); return; }
    const end = player.speechStart(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = .85;
    const voice = window.speechSynthesis.getVoices().find(candidate => candidate.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { if (current === request.current) onPlayback?.(); };
    utterance.onend = end;
    utterance.onerror = event => {
      end();
      if (!['canceled', 'interrupted'].includes(event.error)) failed();
    };
    try { window.speechSynthesis.speak(utterance); } catch { end(); failed(); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button className={`pg-button ${ruleId ? 'pg-phoneme' : ''}`} type="button" data-learning-audio aria-label={label} title={label} onClick={play}>
      <span className="material-symbols-outlined" aria-hidden="true">{ruleId ? 'graphic_eq' : 'volume_up'}</span>
      {!compact && <>{label}{ruleId && <b lang="en">{text}</b>}</>}
    </button>
    {failedFor === key && <small role="status">{ruleId
      ? en ? 'Could not play the sound.' : '소리를 재생할 수 없어요.'
      : en ? 'Speech is unavailable. Ask your teacher to read it.' : '이 기기에서 음성을 재생할 수 없어요. 선생님이 읽어 주세요.'}</small>}
  </span>;
}
