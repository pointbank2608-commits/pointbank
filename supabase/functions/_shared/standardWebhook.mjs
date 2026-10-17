// Standard Webhooks 서명 검증(포트원 V2 웹훅이 이 규격을 쓴다). Deno(Edge Function)와 Node 20+ 모두에서 같은 파일로 돈다.
//  서명 = base64( HMAC-SHA256( secret, `${webhook-id}.${webhook-timestamp}.${본문}` ) ), 헤더 `webhook-signature: v1,<서명> v1,<서명2>`.
//  시크릿은 `whsec_`로 시작하는 base64 문자열(앞의 whsec_는 뗀다). 시간 허용 오차 5분(재전송 공격 방지), 비교는 상수 시간.
//  이 파일은 시크릿을 로그에 남기지 않는다.

const TOLERANCE_SECONDS = 300;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sign(secret, id, timestamp, body) {
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey('raw', b64ToBytes(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToB64(new Uint8Array(mac));
}

/** 올바른 서명이면 true. 헤더가 없거나 시간이 너무 어긋나거나 서명이 하나도 맞지 않으면 false. */
export async function verify({ secret, id, timestamp, signature, body, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  let expected;
  try {
    expected = await sign(secret, id, timestamp, body);
  } catch {
    return false;
  }
  return signature
    .split(' ')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('v1,'))
    .some((p) => safeEqual(p.slice(3), expected));
}
