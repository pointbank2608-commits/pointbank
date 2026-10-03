// Supabase Edge Function (Deno) — 유튜브 영상을 Gemini 가 보고 쉐도잉 대사표를 만든다(2026-10-03).
//
// 결과 형식(앱의 app/src/lib/shadowLines.ts): 한 줄에 "[m:ss.s-m:ss.s] 배역: 영어 | 한국어 해석"
// 자막 파일을 내려받지 않고(유튜브가 막는다) Gemini 가 영상 주소를 직접 본다 — 공개 영상만 된다.
//
// **아직 배포 전이다.** 동작하려면(로그인·키가 필요해서 자동으로는 못 함):
//   1. Google AI Studio(aistudio.google.com)에서 API 키 발급 — 선불 충전(₩8,000~)이 있어야 호출된다
//   2. `npx supabase login` → `npx supabase link --project-ref <프로젝트 ref>`
//   3. `npx supabase secrets set GEMINI_API_KEY=<키>`
//   4. `npx supabase functions deploy shadow-script`
// 배포 전에는 앱의 "AI로 대사표 만들기" 버튼이 실패를 잡아 "스크립트 표시를 붙여넣어 주세요" 안내만 띄운다.
// 같은 일을 로컬에서 하는 스크립트: app/scripts/shadow/make-shadow-script.mjs(Vertex, gcloud 로그인).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT =
  'You are making a shadowing script for Korean elementary school students learning English. ' +
  'Watch the video and transcribe every spoken English sentence in order, one sentence per line, in exactly this format:\n' +
  '[m:ss.s-m:ss.s] Speaker: English sentence | 자연스러운 한국어 해석\n' +
  'Rules: times must be precise to 0.1 second (start when the sentence begins, end when it finishes); split long narration into short sentences; ' +
  'Speaker is the character name (use Narrator for the storyteller); the Korean translation is short and natural for children; ' +
  'output only the lines, no headings or explanations. Stop after 10 minutes of video.';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY 가 등록되지 않았어요.' }, 500);
    const { videoId, transcript } = (await req.json()) as { videoId?: string; transcript?: string };
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return json({ error: '영상 주소가 올바르지 않아요.' }, 400);
    // 선생님이 붙여넣은 자막(시간 있음)이 있으면 같이 보낸다 — AI 가 영상을 보며 문장을 나누고 배역·해석을 붙이되 시간은 자막을 따른다.
    const hint = transcript?.trim()
      ? `

The teacher pasted this auto-generated transcript (times are reliable, but sentences run together and speakers are missing). ` +
        `Use its times; split it into separate sentences, estimating each sentence's start and end inside its chunk:
${transcript.slice(0, 30000)}`
      : '';

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}`, mimeType: 'video/*' }, videoMetadata: { startOffset: '0s', endOffset: '600s' } },
              { text: PROMPT + hint },
            ],
          },
        ],
        generationConfig: { temperature: 0, mediaResolution: 'MEDIA_RESOLUTION_LOW' },
      }),
    });
    if (!res.ok) return json({ error: `Gemini 호출 실패: ${res.status}` }, 502);
    const data = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    const script = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\[\d{1,2}:\d{2}/.test(l))
      .join('\n');
    if (!script) return json({ error: '대사를 찾지 못했어요.' }, 422);
    return json({ script });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
