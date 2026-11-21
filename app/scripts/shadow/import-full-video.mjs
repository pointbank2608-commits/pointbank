// Local preparation only. Emits a preview snapshot and a reviewed, explicit SQL patch.
// The original transcript is not bundled in application source code.
import { readFile, writeFile } from 'node:fs/promises';

const [snapshot, metadata, videoId, transcript, output] = process.argv.slice(2);
if (!output) throw new Error('Pass snapshot, metadata, video ID, exported transcript and output JSON');
const clips = JSON.parse(await readFile(snapshot, 'utf8'));
const source = JSON.parse(await readFile(metadata, 'utf8')).find(source => source.youtubeId === videoId);
if (!(source?.duration > 0)) throw new Error('Original duration is required');
const raw = await readFile(transcript, 'utf8');
if (!raw.includes(`Video ID: ${videoId}`) || !raw.includes('Language: en')) throw new Error('Transcript identity/language mismatch');
const cues = raw.split(/\r?\n/).flatMap(row => {
  const match = row.match(/^\[(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)\]\s*(.*)$/);
  if (!match) return [];
  return [{ start: Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]), text: match[4] }];
});
const lines = [];
for (let index = 0; index < cues.length; index++) {
  const cue = cues[index];
  const text = cue.text.replace(/>>\s*/g, '').replace(/\[[^\]]*\]/g, '').replace(/[♪♫]/g, '').replace(/\s+/g, ' ').trim();
  if (!/[a-z]/i.test(text) || cue.start >= source.duration) continue;
  const end = Math.min(source.duration, cue.start + 8, cues[index + 1]?.start ?? source.duration);
  if (end <= cue.start) continue;
  const previous = lines.at(-1);
  if (previous && !/[.!?]$/.test(previous.text) && !cue.text.startsWith('>>') && cue.start - previous.end < 2 && end - previous.start < 18) {
    previous.text += ' ' + text;
    previous.end = end;
  } else lines.push({ start: cue.start, end, text });
}
if (lines.length < 5 || lines.at(-1).end < source.duration - 60) throw new Error('Transcript does not reach the final minute');
const fmt = value => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}`;
const fullVideo = { version: 1, title: source.title, duration: source.duration,
  script: lines.map(line => `[${fmt(line.start)}-${fmt(line.end)}] ${line.text}`).join('\n'),
  origin: 'youtube-captions', timing: 'subtitle-cues', fetchedAt: new Date().toISOString() };
const canonical = clips.find(clip => clip.youtube_id === videoId && !clip.hidden);
if (!canonical) throw new Error('Original is not in this library');
canonical.pack = { ...canonical.pack, fullVideo };
await writeFile(output, JSON.stringify(clips, null, 2));
const sql = value => `'${value.replace(/'/g, "''")}'`;
await writeFile(output + '.sql', `-- Not executed. Adds full transcript while preserving the existing scene, pack and hidden status.\nUPDATE public.video_clips SET pack = jsonb_set(COALESCE(pack, '{}'::jsonb), '{fullVideo}', ${sql(JSON.stringify(fullVideo))}::jsonb) WHERE id = ${sql(canonical.id)}::uuid AND youtube_id = ${sql(videoId)} AND hidden = false;\n`);
console.log(JSON.stringify({videoId,duration:source.duration,lines:lines.length,first:lines[0].start,last:lines.at(-1).end,output}));
