// Supabase Edge Function (Deno) — 유튜브 영상 자막에서 단어장을 자동 추출한다.
//
// **아직 배포되지 않은 상태다.** 이 파일은 코드만 준비해둔 것이고, 실제로 동작하려면
// 아래 절차가 필요하다(전부 로그인/설정이 필요해서 자동으로는 못 함):
//   1. `npx supabase login` (브라우저로 Supabase 계정 로그인)
//   2. `npx supabase link --project-ref <프로젝트 ref>` (이 저장소를 실제 Supabase 프로젝트에 연결)
//   3. `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (Anthropic 콘솔에서 발급한 키)
//   4. `npx supabase functions deploy extract-lesson-from-video`
// 배포 전까지는 클라이언트(`api.ts`의 `generateWordListFromVideo`)가 호출해도 404로 실패하고,
// CurriculumPage의 "AI로 단어 추출" 버튼은 그 실패를 잡아서 안내 토스트만 띄운다 — 앱이
// 깨지지는 않는다.
//
// 자막(스크립트) 자체는 유튜브 공식 Data API 키 없이도, 영상에 자막이 있으면 비공식
// timedtext 엔드포인트로 가져올 수 있다(키 발급이 필요한 건 이 함수가 쓰는 LLM 쪽 키뿐).
// 다만 이 엔드포인트는 유튜브가 언제든 바꿀 수 있는 비공식 경로라 실패할 수 있음 — 실패하면
// 그 사실을 그대로 에러로 돌려준다(추측으로 가짜 데이터를 만들지 않는다).

interface ExtractRequest {
  videoId: string;
}

interface ExtractedWord {
  word: string;
  meaning: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchTranscript(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`);
  if (!res.ok) throw new Error(`transcript fetch failed: ${res.status}`);
  const xml = await res.text();
  if (!xml.trim()) throw new Error('이 영상에는 자동 추출 가능한 영어 자막이 없어요.');
  // <text ...>내용</text> 조각만 뽑아 이어붙인다. HTML 엔티티(&#39; 등)는 대략만 풀어준다.
  const lines = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) =>
    m[1]
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&'),
  );
  return lines.join(' ');
}

async function extractWords(transcript: string, apiKey: string): Promise<ExtractedWord[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content:
            '다음은 초등학생용 영어 영상 대본이야. 유치~초등 저학년이 배우기 좋은 핵심 단어를 최대 15개 뽑아서 ' +
            '[{"word":"영단어","meaning":"한국어 뜻"}] 형식의 JSON 배열로만 답해줘. 다른 설명은 하지 마.\n\n' +
            transcript.slice(0, 4000),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM 호출 실패: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('LLM 응답에서 단어 목록을 찾지 못했어요.');
  return JSON.parse(match[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const { videoId } = (await req.json()) as ExtractRequest;
    if (!videoId) throw new Error('videoId가 필요해요.');
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 시크릿이 설정되지 않았어요.');

    const transcript = await fetchTranscript(videoId);
    const words = await extractWords(transcript, apiKey);

    return new Response(JSON.stringify({ items: words }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
