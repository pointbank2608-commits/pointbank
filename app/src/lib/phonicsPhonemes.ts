import { PHONICS_RULES } from '../data/phonicsCurriculum';
import audio from '../data/phonics/phoneme-audio.json';

/**
 * 파닉스 음가(글자 소리) 음원. 규칙 하나(`ruleId`, 76개)마다 파일 하나: `/phonics-sounds/<ruleId>.mp3`.
 * 파일이 있는 규칙만 `phoneme-audio.json`(`available`)에 올라가고, 없는 규칙은 소리 듣기 버튼이 나오지 않는다.
 * 목록 정리·누락 확인·매니페스트 갱신은 `node scripts/phonics/sync-phonemes.mjs`.
 * 합성 TTS 는 글자 이름("에스")을 읽을 뿐 음가(/s/)를 못 내므로 음가는 녹음·검수한 파일만 쓴다.
 */
export interface PhonemeRule { id: string; name: string; sound: string; step: number; stageId: string; examples: string[]; }
export const PHONEME_RULES: PhonemeRule[] = PHONICS_RULES.map((r: { id: string; name: string; sound: string; step: number; stageId: string; groups: { patterns: string[] }[] }) => ({
  id: r.id, name: r.name, sound: r.sound, step: r.step, stageId: r.stageId,
  examples: [...new Set(r.groups.flatMap((g) => g.patterns))].slice(0, 3).map((p) => p.replace(/[{}]/g, '')),
}));
const available = new Set<string>(audio.available);
export const phonemeUrl = (ruleId: string) => `/phonics-sounds/${ruleId}.mp3`;
export const hasPhoneme = (ruleId?: string | null) => Boolean(ruleId && available.has(ruleId));

let current: HTMLAudioElement | null = null;
export function stopPhoneme() { try { current?.pause(); } catch { /* 이미 멈춤 */ } current = null; }
/** 음가를 한 번 들려 준다. 진행 중인 낱말 읽기·재생은 먼저 멈춘다. 파일이 없거나 재생이 막히면 조용히 false. */
export async function playPhoneme(ruleId: string): Promise<boolean> {
  if (!hasPhoneme(ruleId)) return false;
  stopPhoneme();
  try { window.speechSynthesis?.cancel(); } catch { /* 음성 없음 */ }
  const el = new Audio(phonemeUrl(ruleId));
  current = el;
  try { await el.play(); return true; } catch { current = null; return false; }
}
