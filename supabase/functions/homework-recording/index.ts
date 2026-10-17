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
      duration > 120 ||
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
    const metadata = await parseBuffer(
      bytes,
      { mimeType: mime, size: bytes.length },
      { duration: true, skipCovers: true },
    );
    const measured = metadata.format.duration;
    if (
      !measured ||
      !Number.isFinite(measured) ||
      measured < 0.5 ||
      measured > 120.25
    )
      return respond(400, { error: "bad_duration" });
    const target = await service.rpc("hw_recording_target", {
      p_token: token,
      p_item: item,
    });
    if (target.error || typeof target.data !== "string")
      return respond(403, { error: "not_found" });
    const { error } = await service.storage
      .from("homework-recordings")
      .upload(target.data, bytes, {
        contentType: mime,
        upsert: false,
        metadata: { duration: String(measured) },
      });
    if (error) return respond(503, { error: "upload_failed" });
    return respond(200, { path: target.data });
  } catch {
    return respond(400, { error: "invalid_request" });
  }
});
