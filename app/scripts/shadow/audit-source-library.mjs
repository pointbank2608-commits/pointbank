// Public, read-only source metadata. No account cookies or API credentials.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const clips = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = process.argv[3];
if (!output) throw new Error('Pass a library JSON snapshot and an output directory');
await mkdir(output, { recursive: true });
const ids = [...new Set(clips.filter(clip => !clip.hidden && !clip.pack?.phonicsSong).map(clip => clip.youtube_id))];
const records = [];
for (const id of ids) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${id}`, { signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    const match = html.match(/(?:var\s+)?ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
    const player = match ? JSON.parse(match[1]) : null;
    const details = player?.videoDetails;
    const duration = Number(details?.lengthSeconds);
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const record = { youtubeId: id, title: details?.title ?? null,
      duration: Number.isFinite(duration) && duration > 0 ? duration : null,
      status: player?.playabilityStatus?.status ?? `http-${response.status}`,
      captionLanguages: tracks.map(track => track.languageCode), checkedAt: new Date().toISOString() };
    records.push(record);
    console.log(JSON.stringify(record));
    const track = tracks.find(track => track.languageCode === 'en') ?? tracks.find(track => track.languageCode?.startsWith('en'));
    if (track) {
      const captions = await fetch(track.baseUrl + '&fmt=json3', { signal: AbortSignal.timeout(20000) });
      const text = await captions.text();
      if (captions.ok && text.trim()) await writeFile(join(output, `${id}.captions.json`), text);
    }
  } catch (error) {
    records.push({ youtubeId: id, duration: null, title: null, status: 'unavailable', error: error.message, checkedAt: new Date().toISOString() });
    console.log(id, 'unavailable');
  }
  await writeFile(join(output, 'sources.json'), JSON.stringify(records, null, 2));
}
