// Exercise the actual Edge handler with synthetic auth/Storage adapters and real audio parsing.
// No environment credentials or network requests are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { File } from "node:buffer";
import ts from "typescript";
import { parseBuffer } from "../../node_modules/homework-test-tools/node_modules/music-metadata/lib/index.js";
globalThis.File = File;
const source = readFileSync(
  "../supabase/functions/homework-recording/index.ts",
  "utf8",
).replace(/^import .*;\r?\n/gm, "");
const js = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None,
  },
}).outputText;
let handler;
let access = false;
let uploadCount = 0;
let storedMetadata;
const token = "10000000-0000-4000-8000-000000000001",
  item = "20000000-0000-4000-8000-000000000001";
const client = {
  rpc: async (name, args) =>
    name === "hw_recording_target"
      ? {
          data:
            args.p_token === token && args.p_item === item
              ? "synthetic/item/audio"
              : null,
          error: null,
        }
      : { data: access, error: null },
  storage: {
    from: () => ({
      upload: async (_path, _bytes, options) => {
        uploadCount++;
        storedMetadata = options.metadata;
        return { error: null };
      },
      createSignedUrl: async () => ({
        data: { signedUrl: "http://synthetic.invalid/private" },
        error: null,
      }),
    }),
  },
};
new Function("createClient", "parseBuffer", "Deno", js)(
  () => client,
  parseBuffer,
  {
    env: { get: () => "synthetic-only" },
    serve: (fn) => {
      handler = fn;
    },
  },
);
const bytes = readFileSync(
  "node_modules/homework-test-tools/synthetic-recording.webm",
);
const request = (audio, options = {}) => {
  const form = new FormData();
  form.set("token", options.token || token);
  form.set("item", item);
  form.set("duration", String(options.duration ?? 1));
  form.set(
    "audio",
    new File([audio], "synthetic.webm", { type: options.mime || "audio/webm" }),
  );
  return new Request("http://synthetic.invalid/record", {
    method: "POST",
    body: form,
  });
};
assert.equal((await handler(request(bytes))).status, 200);
assert.equal(uploadCount, 1);
assert(Number(storedMetadata.duration) >= 0.5);
assert.equal(
  (
    await handler(
      request(bytes, { token: "30000000-0000-4000-8000-000000000001" }),
    )
  ).status,
  403,
);
assert.equal((await handler(request(bytes, { duration: 121 }))).status, 400);
assert.equal((await handler(request(new Uint8Array(9000000)))).status, 400);
assert.equal((await handler(request(new Uint8Array(1000)))).status, 400);
assert.equal(
  (await handler(request(bytes, { mime: "text/html" }))).status,
  400,
);
const playback = () =>
  new Request("http://synthetic.invalid/record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer synthetic",
    },
    body: JSON.stringify({ path: "synthetic/item/audio" }),
  });
assert.equal((await handler(playback())).status, 403);
access = true;
assert.equal((await handler(playback())).status, 200);
assert.equal(uploadCount, 1);
console.log(
  "8 recording Edge handler checks passed: real audio parsing, private upload, size/format/duration rejection, staff playback authorization. Synthetic adapters only.",
);
