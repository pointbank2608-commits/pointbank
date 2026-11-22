// Read public chapter markers. Never invent episode boundaries from a fixed duration.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const [input, directory] = process.argv.slice(2);
const sources = JSON.parse(await readFile(input, 'utf8'));
await mkdir(directory, { recursive: true });
const results = [];
function collect(value, key, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (key in value) found.push(value[key]);
  for (const child of Object.values(value)) if (typeof child === 'object') collect(child, key, found);
  return found;
}
for (const source of sources) {
  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${source.youtubeId}`, { signal: AbortSignal.timeout(20000) }).then(r => r.text());
    const initial = html.match(/(?:var\s+)?ytInitialData\s*=\s*(\{.*?\});/s);
    const playerMatch = html.match(/(?:var\s+)?ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
    const player = playerMatch ? JSON.parse(playerMatch[1]) : {};
    const data = initial ? JSON.parse(initial[1]) : {};
    const text = obj => obj?.simpleText ?? obj?.runs?.map(run => run.text).join('') ?? '';
    const chapters = collect(data, 'chapterRenderer').map(chapter => ({
      title: text(chapter.title), start: chapter.timeRangeStartMillis / 1000,
      thumbnail: chapter.thumbnail?.thumbnails?.at(-1)?.url ?? null,
    }));
    const markers = collect(data, 'macroMarkersListItemRenderer').map(marker => ({
      title: text(marker.title), start: marker.onTap?.watchEndpoint?.startTimeSeconds,
      thumbnail: marker.thumbnail?.thumbnails?.at(-1)?.url ?? null,
    }));
    const unique = [...new Map([...chapters, ...markers].filter(chapter => chapter.title && Number.isFinite(chapter.start))
      .map(chapter => [chapter.start,chapter])).values()].sort((a,b)=>a.start-b.start);
    const result = { ...source, chapters: unique, description: player.videoDetails?.shortDescription ?? '',
      storyboard: player.storyboards?.playerStoryboardSpecRenderer?.spec ?? null };
    results.push(result);
    await writeFile(join(directory, `${source.youtubeId}.json`), JSON.stringify(result,null,2));
    console.log(JSON.stringify({id:source.youtubeId,chapters:unique.map(chapter=>[chapter.start,chapter.title]),storyboard:!!result.storyboard}));
  } catch(error) { results.push({...source,chapters:[],error:error.message}); console.log(source.youtubeId,error.message); }
  await writeFile(join(directory,'chapters.json'),JSON.stringify(results,null,2));
}
