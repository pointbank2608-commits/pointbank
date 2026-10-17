// Operator-only. Dry run by default. Uses Storage API (never delete storage.objects directly).
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required; never expose the service key to Vite.",
  );
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.rpc("hw_recording_cleanup_candidates");
if (error) throw error;
console.log(
  `${data.length} expired/unreferenced recordings. Retention: 180 days; abandoned upload: 24 hours.`,
);
if (process.argv.includes("--execute")) {
  for (let i = 0; i < data.length; i += 100) {
    const result = await client.storage
      .from("homework-recordings")
      .remove(data.slice(i, i + 100));
    if (result.error) throw result.error;
  }
  console.log(
    "Removed expired objects. Submission and review records retained.",
  );
} else
  console.log(
    "Dry run only. Pass --execute after reviewing retention and backups.",
  );
