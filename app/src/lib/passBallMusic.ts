import type { MusicSelection } from './types';

/** 공 돌리기 기본 배경음악(public/sounds). 음악을 따로 고르지 않은 게임(옛 템플릿 포함)에 쓴다. */
export const PASS_BALL_MUSIC: MusicSelection = { kind: 'upload', path: '', name: 'Pass the Ball', url: '/sounds/pass-the-ball-bgm.mp3' };

/** music이 비어 있으면(undefined) 기본 음악, 선생님이 "없음"을 골라 null로 저장했으면 소리 없음 */
export function passBallMusic(value: MusicSelection | null | undefined): MusicSelection | null {
  return value === undefined ? PASS_BALL_MUSIC : value;
}
