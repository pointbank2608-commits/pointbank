// 영상 라이브러리 대사표 시간 맞추기 — 유튜브 페이지(아무 영상 watch 페이지)의 개발자 도구 콘솔에 붙여 넣어 쓴다(2026-10-04).
// 왜 브라우저에서? 유튜브는 자동 자막(낱말마다 ms 단위 시간)을 바깥에서 내려받지 못하게 막지만(PO token),
// 페이지 안 플레이어는 받아 온다. 그 응답을 가로채 AI 대사표의 문장마다 첫·마지막 낱말을 찾아 시작·끝을 다시 정한다.
// AI(Gemini)가 적은 시간은 시작은 대체로 맞고 끝이 자주 일러서 문장이 잘렸다.
//
// 쓰는 법:
//   1) 이 파일 전체를 콘솔에 붙여 넣는다
//   2) await alignAll()            → 표 video_clips 의 모든 장면(공개 읽기)을 영상별로 맞추고 결과 문자열을 돌려준다
//      await alignAll(['영상id',…]) → 일부만
//   3) 돌려받은 줄들을 app/scripts/shadow/out/aligned-*.txt 에 저장 → node app/scripts/shadow/build-aligned-sql.mjs
// 결과 한 줄: <영상id>@<start_sec>|시작,끝;시작,끝;… (0.1초 단위 정수). 맞춘 줄 비율이 절반도 안 되는 장면은 대본을 다시 만들 것.

(() => {
  const SB_URL = 'https://ajxforiicepnhizxwpyf.supabase.co';
  window.__caps = window.__caps || {};
  if (!window.__hooked) {
    window.__hooked = true;
    const oOpen = XMLHttpRequest.prototype.open;
    const oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__u = String(u);
      return oOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (this.__u && this.__u.includes('/api/timedtext') && this.__u.includes('pot=')) {
        this.addEventListener('load', () => {
          const v = new URL(this.__u, location.href).searchParams.get('v');
          if (this.responseText) window.__caps[v] = this.responseText;
        });
      }
      return oSend.apply(this, arguments);
    };
    const oFetch = window.fetch;
    window.fetch = async function (input) {
      const r = await oFetch.apply(this, arguments);
      try {
        const u = typeof input === 'string' ? input : input.url;
        if (u.includes('/api/timedtext') && u.includes('pot=')) {
          const v = new URL(u, location.href).searchParams.get('v');
          r.clone().text().then((t) => t && (window.__caps[v] = t));
        }
      } catch {
        /* 무시 */
      }
      return r;
    };
  }

  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  const lev1 = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; } else {
        if (++d > 1) return false;
        if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
      }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  };

  async function words(id) {
    if (!window.__caps[id]) {
      const p = document.getElementById('movie_player');
      p.mute();
      p.loadVideoById(id);
      for (let i = 0; i < 40 && !window.__caps[id]; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (i % 8 === 4) try { p.loadModule('captions'); p.setOption('captions', 'track', { languageCode: 'en' }); } catch { /* 무시 */ }
      }
      p.pauseVideo();
    }
    const t = window.__caps[id];
    if (!t) return null;
    const out = [];
    for (const e of JSON.parse(t).events || [])
      for (const s of e.segs || [])
        for (const w of (s.utf8 || '').split(/\s+/)) {
          const n = norm(w);
          if (n) out.push([(e.tStartMs + (s.tOffsetMs || 0)) / 1000, n]);
        }
    return out;
  }

  function parse(script) {
    return script.split(/\r?\n/).map((l) => {
      const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)(?:-(\d+):(\d+(?:\.\d+)?))?\]\s*(.*)$/);
      if (!m) return null;
      const s = +m[1] * 60 + +m[2];
      const e = m[3] ? +m[3] * 60 + +m[4] : s + 2;
      const sp = m[5].match(/^([A-Za-z][\w .'-]{0,19}):\s+/);
      const en = (sp ? m[5].slice(sp[0].length) : m[5]).split('|')[0].replace(/\*\*/g, '');
      return { s, e, toks: en.split(/\s+/).map(norm).filter(Boolean) };
    }).filter(Boolean);
  }

  // 대사표 낱말 ↔ 자막 낱말 전역 정렬(장면 구간 근처만, AI 시작에서 8초 안쪽만 짝으로 인정)
  function align(lines, allWords) {
    if (!lines.length) return { fin: [], matched: 0 };
    const lo = lines[0].s - 6, hi = lines[lines.length - 1].e + 12;
    const A = allWords.filter((w) => w[0] >= lo && w[0] <= hi);
    const S = [];
    lines.forEach((ln, li) => ln.toks.forEach((t, k) => S.push({ t, li, k })));
    const n = S.length, m = A.length, W = m + 1;
    const sc = new Int32Array((n + 1) * W), bt = new Uint8Array((n + 1) * W);
    for (let i = 1; i <= n; i++) { sc[i * W] = -i; bt[i * W] = 1; }
    for (let j = 1; j <= m; j++) { sc[j] = 0; bt[j] = 2; }
    const same = (si, b) => (si.t === b[1] || (si.t.length >= 4 && lev1(si.t, b[1]))) && Math.abs(b[0] - lines[si.li].s) < 8 + 0.5 * si.k;
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++) {
        let best = sc[(i - 1) * W + j - 1] + (same(S[i - 1], A[j - 1]) ? 3 : -2), k = 0;
        const up = sc[(i - 1) * W + j] - 1, left = sc[i * W + j - 1] - (j < m ? 1 : 0);
        if (up > best) { best = up; k = 1; }
        if (left > best) { best = left; k = 2; }
        sc[i * W + j] = best;
        bt[i * W + j] = k;
      }
    let bj = 0, bv = -1e9;
    for (let j = 0; j <= m; j++) if (sc[n * W + j] > bv) { bv = sc[n * W + j]; bj = j; }
    const map = new Array(n).fill(-1);
    for (let i = n, j = bj; i > 0 && j > 0; ) {
      const k = bt[i * W + j];
      if (k === 0) { if (same(S[i - 1], A[j - 1])) map[i - 1] = j - 1; i--; j--; } else if (k === 1) i--; else j--;
    }
    const res = lines.map(() => ({ first: null, last: null }));
    S.forEach((s, idx) => { const jj = map[idx]; if (jj < 0) return; const r = res[s.li]; if (!r.first) r.first = { k: s.k, j: jj }; r.last = { k: s.k, j: jj }; });
    const starts = lines.map((ln, li) => {
      const r = res[li];
      if (!r.first) return null;
      const t0 = A[r.first.j][0] - 0.12 - 0.28 * r.first.k;
      return Math.abs(t0 - ln.s) <= 4 ? t0 : null;
    });
    const offs = starts.map((s, li) => (s === null ? null : s - lines[li].s)).filter((x) => x !== null).sort((a, b) => a - b);
    const med = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
    const fin = lines.map((ln, li) => {
      const r = res[li], okStart = starts[li] !== null;
      const s = okStart ? starts[li] : ln.s + med;
      const aiEnd = ln.e + med, aiDur = Math.max(0.6, ln.e - ln.s);
      let e;
      if (okStart && r.last) {
        const jl = r.last.j, tl = A[jl][0], nxt = jl + 1 < A.length ? A[jl + 1][0] : tl + 1;
        const wordEnd = Math.min(nxt - 0.03, tl + 0.3 + 0.06 * A[jl][1].length);
        const tail = ln.toks.length - 1 - r.last.k;
        e = tail === 0 ? wordEnd + 0.25 : Math.max(wordEnd + 0.3 * tail, aiEnd) + 0.2;
      } else e = aiEnd + 0.3;
      e = Math.min(e, s + Math.max(1.5, aiDur * 1.6 + 1));
      return { s: Math.max(0, s), e, ok: okStart };
    });
    for (let k = 1; k < fin.length; k++) if (fin[k].s < fin[k - 1].s) fin[k].s = Math.max(fin[k - 1].s + 0.3, lines[k].s + med);
    for (let k = 0; k < fin.length; k++) {
      if (k + 1 < fin.length && fin[k].e > fin[k + 1].s - 0.02) fin[k].e = Math.max(fin[k].s + 0.5, fin[k + 1].s - 0.02);
      if (fin[k].e - fin[k].s < 0.5) fin[k].e = fin[k].s + 0.5;
    }
    return { fin, matched: fin.filter((f) => f.ok).length };
  }

  window.alignAll = async function (only) {
    // 공개 읽기 열쇠는 우리 사이트 번들에 들어 있는 anon key 를 그대로 쓴다
    const html = await (await fetch('https://pointbank-ten.vercel.app/')).text();
    const code = await (await fetch('https://pointbank-ten.vercel.app/' + html.match(/assets\/index-[^"]+\.js/)[0])).text();
    const key = code.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
    const clips = await (await fetch(`${SB_URL}/rest/v1/video_clips?select=youtube_id,start_sec,script&order=youtube_id,start_sec`, { headers: { apikey: key, Authorization: 'Bearer ' + key } })).json();
    const ids = only ?? [...new Set(clips.map((c) => c.youtube_id))];
    const lines = [];
    for (const id of ids) {
      const w = await words(id);
      if (!w) { console.warn('자막 없음', id); continue; }
      for (const c of clips.filter((x) => x.youtube_id === id)) {
        const { fin, matched } = align(parse(c.script), w);
        console.log(`${id}@${c.start_sec} 맞춘 줄 ${matched}/${fin.length}`);
        lines.push(`${id}@${c.start_sec}|` + fin.map((f) => `${Math.round(f.s * 10)},${Math.round(f.e * 10)}`).join(';'));
      }
    }
    return lines.join('\n');
  };

  // 2차 다듬기(1차 SQL 을 실행한 뒤): 문장 끝 낱말보다 일찍 끝나는 줄은 늘리고(다음 줄 첫 낱말 전까지), 늦게 시작하는 줄은 당긴다.
  // 결과 한 줄: <영상id>@<지금 start_sec>|줄번호:시작,끝;… → out/aligned-patch.txt → build-patch-sql.mjs
  window.polishAll = async function (only) {
    const html = await (await fetch('https://pointbank-ten.vercel.app/')).text();
    const code = await (await fetch('https://pointbank-ten.vercel.app/' + html.match(/assets\/index-[^"]+\.js/)[0])).text();
    const key = code.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
    const clips = await (await fetch(`${SB_URL}/rest/v1/video_clips?select=youtube_id,start_sec,script&order=youtube_id,start_sec`, { headers: { apikey: key, Authorization: 'Bearer ' + key } })).json();
    const out = [];
    for (const id of only ?? [...new Set(clips.map((c) => c.youtube_id))]) {
      const w = await words(id);
      if (!w) continue;
      for (const c of clips.filter((x) => x.youtube_id === id)) {
        const L = parse(c.script).map((l) => ({ ...l }));
        const orig = L.map((l) => [l.s, l.e]);
        const firstT = L.map((ln) => (ln.toks.length ? w.find((x) => x[1] === ln.toks[0] && x[0] > ln.s - 1.5 && x[0] < ln.e) : null)?.[0] ?? null);
        const lastT = L.map((ln) => (ln.toks.length >= 2 ? [...w].reverse().find((x) => x[1] === ln.toks.at(-1) && x[0] > ln.s && x[0] < ln.e + 1.5) : null)?.[0] ?? null);
        for (let i = 0; i < L.length; i++) {
          if (firstT[i] !== null && firstT[i] - 0.15 < L[i].s) L[i].s = Math.max(i ? L[i - 1].e : 0, firstT[i] - 0.15);
          if (lastT[i] !== null && lastT[i] + 0.3 > L[i].e) {
            const nf = i + 1 < L.length ? firstT[i + 1] ?? L[i + 1].s : Infinity;
            const ne = Math.min(lastT[i] + 0.35, nf - 0.05);
            if (ne > L[i].e) {
              L[i].e = ne;
              if (i + 1 < L.length && L[i + 1].s < ne) L[i + 1].s = ne + 0.02;
            }
          }
          if (L[i].e < L[i].s + 0.5) L[i].e = L[i].s + 0.5;
        }
        const diffs = L.map((l, i) => (Math.abs(l.s - orig[i][0]) >= 0.05 || Math.abs(l.e - orig[i][1]) >= 0.05 ? `${i}:${Math.round(l.s * 10)},${Math.round(l.e * 10)}` : null)).filter(Boolean);
        if (diffs.length) out.push(`${id}@${c.start_sec}|${diffs.join(';')}`);
      }
    }
    return out.join('\n');
  };
})();
