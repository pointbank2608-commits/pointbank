import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * 영상 쉐도잉 라이브러리(2026-10-03, `supabase/039_video_clips.sql`).
 * 클래스뱅크가 미리 만들어 둔 유튜브 장면(2~4분 구간 + AI 대사표). 선생님은 쉐도잉 슬라이드에서 고르고,
 * 고른 장면은 슬라이드에 대사·주소가 복사되며 `clipId`로 원래 장면을 기억한다 — 저작권자 요청으로
 * 장면을 내리면(hidden) 이미 넣은 슬라이드도 `useClipTakenDown`이 막는다.
 */
/**
 * 장면 하나의 수업 묶음(클래스5 무비 수업 8단계를 참고) — AI 가 대사표를 보고 만든다(`scripts/shadow/make-clip-library.mjs`).
 * time 은 영상 전체 기준 초.
 */
export interface ClipPack {
  /** 내용 질문(Q&A) */
  questions?: { q: string; a: string; qKo?: string; aKo?: string; time?: number }[];
  /** 핵심 단어 — 영화 속 예문과 그 문장이 나오는 시간(단어 소개의 "장면 보기") */
  words?: { word: string; meaning: string; pos?: string; example: string; exampleKo?: string; time: number }[];
  /** 문법 포인트 — 영화 문장 하나를 틀로 바꿔 말하기 */
  grammar?: {
    grammarId?: string | null;
    sentence: string;
    sentenceKo?: string;
    time?: number;
    /** 한 줄 설명(한국어) */
    point: string;
    drills: { cue: string; answer: string; answerKo?: string }[];
  };
  /** 리스닝 빙고에 쓸 낱말(대사에 나온 것) */
  bingo?: string[];
}

export interface VideoClip {
  id: string;
  series: string;
  title: string;
  summary: string;
  youtube_id: string;
  channel: string;
  start_sec: number;
  end_sec: number;
  level: number;
  tags: string[];
  script: string;
  words: string[];
  pack: ClipPack;
  sort_order: number;
  hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  created_at: string;
}

/** 관리자 저장용 — pack 을 빼면 있던 수업 묶음은 그대로 둔다(새 장면은 빈 묶음) */
export type VideoClipInput = Omit<VideoClip, 'id' | 'hidden' | 'hidden_reason' | 'hidden_at' | 'created_at' | 'pack'> & { pack?: ClipPack };

let listPromise: Promise<VideoClip[]> | null = null;

/** 선생님용 목록(내려간 장면은 RLS 가 빼 준다). 한 번 받아 두고 같이 쓴다. */
export function fetchVideoClips(force = false): Promise<VideoClip[]> {
  if (force) listPromise = null;
  listPromise ??= (async () => {
    const { data, error } = await supabase.from('video_clips').select('*').order('series').order('sort_order').order('start_sec');
    if (error) throw error;
    return (data ?? []) as VideoClip[];
  })().catch((e) => {
    listPromise = null;
    throw e;
  });
  return listPromise;
}

export function useVideoClips() {
  const [clips, setClips] = useState<VideoClip[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchVideoClips()
      .then((c) => alive && setClips(c))
      .catch(() => {
        if (!alive) return;
        setClips([]);
        setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { clips, error };
}

const takenDown = new Map<string, Promise<boolean>>();

/** 이 장면이 내려갔는지(없어졌거나 hidden). 확인하기 전·확인 실패 시에는 false(막지 않음). */
export function useClipTakenDown(clipId: string | null | undefined): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    if (!clipId) {
      setDown(false);
      return;
    }
    let alive = true;
    let p = takenDown.get(clipId);
    if (!p) {
      p = (async () => {
        const { data, error } = await supabase.from('video_clips').select('id').eq('id', clipId).maybeSingle();
        if (error) {
          takenDown.delete(clipId);
          return false;
        }
        return !data;
      })();
      takenDown.set(clipId, p);
    }
    void p.then((v) => alive && setDown(v));
    return () => {
      alive = false;
    };
  }, [clipId]);
  return down;
}

export const clipLength = (c: Pick<VideoClip, 'start_sec' | 'end_sec'>) => Math.max(0, Number(c.end_sec) - Number(c.start_sec));

export function formatClipTime(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const clipThumb = (youtubeId: string) => `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;

// ---------- 관리자 ----------

export async function adminListVideoClips(): Promise<VideoClip[]> {
  const { data, error } = await supabase.from('video_clips').select('*').order('series').order('sort_order').order('start_sec');
  if (error) throw error;
  return (data ?? []) as VideoClip[];
}

export async function adminSaveVideoClip(clip: VideoClipInput & { id?: string }): Promise<void> {
  const { id, ...rest } = clip;
  const { error } = id ? await supabase.from('video_clips').update(rest).eq('id', id) : await supabase.from('video_clips').insert(rest);
  if (error) throw error;
  listPromise = null;
}

/** 내리기(저작권자 요청 등) / 다시 올리기 */
export async function adminSetClipHidden(id: string, hidden: boolean, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('video_clips')
    .update({ hidden, hidden_reason: hidden ? (reason?.trim() || null) : null, hidden_at: hidden ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
  listPromise = null;
  takenDown.delete(id);
}

export async function adminDeleteVideoClip(id: string): Promise<void> {
  const { error } = await supabase.from('video_clips').delete().eq('id', id);
  if (error) throw error;
  listPromise = null;
  takenDown.delete(id);
}

/**
 * 넣지 않는 채널(디즈니 계열). 채널 이름에 이 낱말이 있으면 관리자 화면이 막는다.
 * 블루이는 BBC Studios 채널이라 막지 않지만, 디즈니+가 해외 방영권을 갖고 있어 조심해서 넣는다.
 */
export const BLOCKED_CHANNEL_WORDS = ['disney', 'pixar', 'marvel', 'star wars', 'lucasfilm', 'national geographic', 'nat geo', '20th century', 'searchlight', 'hulu', 'espn'];

export const isBlockedChannel = (channel: string) => {
  const c = channel.toLowerCase();
  return BLOCKED_CHANNEL_WORDS.some((w) => c.includes(w));
};
