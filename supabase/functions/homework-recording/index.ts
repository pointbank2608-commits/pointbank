import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseBuffer } from "npm:music-metadata@12.2.1";

// This endpoint accepts a homework capability token for uploads and a staff JWT for playback.
// Never sends student audio to an AI provider. Configure verify_jwt=false: student auth is the homework token.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Streaming WebM from MediaRecorder can omit the optional Duration element.
// Measure Opus blocks from EBML timecodes and packet durations, independently
// of the client's clock. Unknown-length Segment/Cluster elements are common.
function streamingOpusSeconds(bytes: Uint8Array): number | undefined {
  function vint(at: number, id: boolean) {
    const first = bytes[at];
    if (!first) return null;
    const width = Math.clz32(first) - 23;
    if (width > (id ? 4 : 8) || at + width > bytes.length) return null;
    const mask = 0xff >> width;
    let value = id ? first : first & mask;
    let unknown = !id && value === mask;
    for (let i = 1; i < width; i++) {
      value = value * 256 + bytes[at+i];
      unknown = unknown && bytes[at+i] === 255;
    }
    return { width, value, unknown };
  }
  let cursor = 0, scale = 1e6, cluster = 0, finish = 0;
  const parents: number[] = [];
  while (cursor < bytes.length) {
    while (parents.length && cursor === parents[parents.length-1]) parents.pop();
    const parentEnd = parents[parents.length-1] ?? bytes.length;
    const tag = vint(cursor, true);
    if (!tag) return;
    cursor += tag.width;
    const size = vint(cursor, false);
    if (!size) return;
    cursor += size.width;
    const end = size.unknown ? parentEnd : cursor + size.value;
    if (end > parentEnd || end < cursor) return;
    if ([0x18538067,0x1549a966,0x1f43b675,0xa0].includes(tag.value)) {
      if (!size.unknown) {
        if (parents.length > 8) return;
        parents.push(end);
      }
      continue;
    }
    if (size.unknown) return;
    if ((tag.value === 0x2ad7b1 || tag.value === 0xe7) && size.value <= 7) {
      let value = 0;
      for (let p = cursor; p < end; p++) value = value * 256 + bytes[p];
      if (tag.value === 0xe7) cluster = value;
      else scale = value;
    }
    if (tag.value === 0xa3 || tag.value === 0xa1) {
      const track = vint(cursor, false);
      if (!track || cursor + track.width + 3 >= end) return;
      const pos = cursor + track.width;
      const ticks = (bytes[pos] << 24 | bytes[pos+1] << 16) >> 16;
      if (bytes[pos+2] & 0x06) return; // Laced packets need their own duration calculation.
      const toc = bytes[pos+3], config = toc >> 3;
      const frameMs = config >= 16 ? 2.5 * 2 ** (config % 4) : config >= 12 ? 10 * 2 ** (config % 2) : [10,20,40,60][config % 4];
      const count = [1,2,2,bytes[pos+4] & 63][toc & 3];
      if (!count || frameMs * count > 120) return;
      finish = Math.max(finish, (cluster + ticks) * scale / 1e9 + frameMs * count / 1000);
    }
    cursor = end;
  }
  return finish || undefined;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const respond = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (req.method !== "POST") return respond(405, { error: "method" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (req.headers.get("content-type")?.includes("application/json")) {
      const { path } = await req.json();
      if (typeof path !== "string" || path.length > 150)
        return respond(400, { error: "path" });
      const staff = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: {
          headers: { Authorization: req.headers.get("Authorization") || "" },
        },
        auth: { persistSession: false },
      });
      const access = await staff.rpc("hw_recording_access", { p_path: path });
      if (access.error || access.data !== true)
        return respond(403, { error: "not_found" });
      const { data, error } = await service.storage
        .from("homework-recordings")
        .createSignedUrl(path, 120);
      if (error) return respond(404, { error: "not_found" });
      return respond(200, { url: data.signedUrl });
    }
    if (Number(req.headers.get("content-length") || "0") > 8500000)
      return respond(413, { error: "too_large" });
    const form = await req.formData();
    const token = String(form.get("token"));
    const item = String(form.get("item"));
    const duration = Number(form.get("duration"));
    const audio = form.get("audio");
    if (
      !uuid.test(token) ||
      !uuid.test(item) ||
      !Number.isFinite(duration) ||
      duration < 0.5 ||
      duration > 1205 ||
      !(audio instanceof File) ||
      audio.size > 8388608 ||
      audio.size < 64
    )
      return respond(400, { error: "bad_recording" });
    const mime = audio.type.split(";")[0];
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const signature =
      (mime === "audio/webm" &&
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3) ||
      (mime === "audio/ogg" &&
        new TextDecoder().decode(bytes.slice(0, 4)) === "OggS") ||
      (mime === "audio/mp4" &&
        new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp");
    if (!signature) return respond(400, { error: "bad_format" });
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    const target = await service.rpc("hw_recording_target_v2", {
      p_token: token, p_item: item, p_digest: digest,
    });
    if (target.error || typeof target.data?.path !== "string")
      return respond(403, { error: "not_found" });
    const { path, limit } = target.data;
    if (!Number.isFinite(limit) || duration > limit)
      return respond(400, { error: "bad_duration" });
    if (target.data.stored) return respond(200, { path });
    const metadata = await parseBuffer(
      bytes,
      { mimeType: mime, size: bytes.length },
      { duration: true, skipCovers: true },
    );
    const measured = metadata.format.duration ??
      (mime === "audio/webm" && /opus/i.test(metadata.format.codec ?? "") ? streamingOpusSeconds(bytes) : undefined);
    if (
      !measured ||
      !Number.isFinite(measured) ||
      measured < 0.5 ||
      measured > limit + 0.25
    )
      return respond(400, { error: "bad_duration" });
    const { error } = await service.storage
      .from("homework-recordings")
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
        metadata: { duration: String(measured) },
      });
    if (error) {
      // Another request for the same bytes may have won the insert.
      const retry = await service.rpc("hw_recording_target_v2", {
        p_token: token, p_item: item, p_digest: digest,
      });
      if (retry.data?.path !== path || retry.data?.stored !== true)
        return respond(503, { error: "upload_failed" });
    }
    return respond(200, { path });
  } catch {
    return respond(400, { error: "invalid_request" });
  }
});
