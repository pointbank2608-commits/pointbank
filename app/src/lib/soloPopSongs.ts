import { grammarPoint } from './grammar';
import { soloGrammarStages, buildSoloWordSteps, options, shuffle, type SoloStep } from './soloLessons';
import { songWordCards, type SongLesson } from './songLessons';

/**
 * 팝송 컬렉션(`SONG_LESSONS`)을 개별수업으로 만든다 — 단체수업의 곡 수업과 같은 곡·같은 내용이고 가사는 담지 않는다.
 * 순서: 소개 → 듣기 전 말해 보기 → 노래 듣기 → 핵심 단어 → 내용 확인 → 문법 → 문장 순서 → 내 이야기.
 * 가사 줄별 빈칸·따라 부르기는 가사(선생님이 붙여 넣는 글)가 있어야 하므로 "노래·영상 → 가사 붙여넣기" 쪽에서 한다.
 */
export function buildSoloPopSongLesson(song: SongLesson): { name: string; steps: SoloStep[]; minutes: number } {
  const steps: SoloStep[] = [{ t: 'intro', title: `♪ ${song.title}`, text: song.intro }];

  for (const w of song.warmup) steps.push({ t: 'example', sentence: w.en, ko: w.ko });

  if (song.videoId) steps.push({ t: 'watch', title: song.title, clip: { videoId: song.videoId, start: 0, end: 240 }, mode: 'listen' });

  // 핵심 단어(만나기 → 고르기 → 듣고 고르기 → 철자). 첫 intro 는 우리 소개로 대신한다.
  const cards = songWordCards(song);
  if (cards.length >= 4) steps.push(...buildSoloWordSteps(song.title, cards).slice(1));
  else for (const c of cards) steps.push({ t: 'meet', word: c.word, meaning: c.meaning, imageUrl: null, example: c.example ?? null, pos: c.partOfSpeech ?? null });

  // 내용 확인: 질문을 읽고 알맞은 답 고르기(다른 질문의 답이 보기)
  const answers = song.comprehension.map((c) => c.a);
  for (const c of song.comprehension) {
    const o = options(c.a, answers);
    if (o.list.length >= 3) steps.push({ t: 'sayPick', situation: c.q, options: o.list, answer: o.answer });
  }

  // 곡의 문법 항목도 쓰임 지도부터 독립 과제까지 한 블록으로 넣는다.
  for (const gid of song.grammarIds.slice(0, 2)) {
    const point = grammarPoint(gid);
    if (point) steps.push(...soloGrammarStages(point).steps);
  }

  // 문장 순서 맞추기(우리가 쓴 3~8낱말 문장)
  for (const s of shuffle(song.sentences).slice(0, 4)) {
    const words = s.trim().split(/\s+/);
    if (words.length < 3 || words.length > 10) continue;
    let sc = shuffle(words);
    for (let i = 0; i < 5 && sc.join(' ') === words.join(' '); i++) sc = shuffle(words);
    steps.push({ t: 'unscramble', sentence: words.join(' '), words: sc });
  }

  // 내 이야기 말하기
  steps.push({ t: 'intro', title: song.activity.title, text: `${song.activity.frame}\n\n${song.activity.prompt}` });

  return { name: `♪ ${song.title}`, steps, minutes: Math.max(10, Math.round(steps.length * 0.7)) };
}
