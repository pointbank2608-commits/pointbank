import type { HwItem } from './types';

export interface HomeworkActivityGroup {
  key: string;
  title: string;
  materialName?: string;
  indices: number[];
  count: number;
}

/** Each recording retains its own server item and permissions. Only its presentation is grouped. */
export function activityCardCount(item: HwItem): number {
  const questions = item.content?.questions?.length ?? 0;
  const block = item.config.block;
  if (item.config.watch) return 1;
  if (block?.method === 'flip') return block.text.split('\n').filter(line => line.split('|')[0].trim()).length;
  if (block && block.completion !== 'answers') return 1;
  return questions + (item.kind === 'shadowing' ? item.content?.lines?.length ?? 0 : 0);
}

export function activityGroups(items: HwItem[]): HomeworkActivityGroup[] {
  const groups = new Map<string, HomeworkActivityGroup>();
  items.forEach((item, index) => {
    const count = activityCardCount(item);
    if (!count) return;
    const block = item.config.block;
    const key = block?.groupKey ?? item.id;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: item.title, materialName: block?.materialName, indices: [], count: 0 };
      groups.set(key, group);
    }
    group.indices.push(index);
    group.count += count;
  });
  return [...groups.values()];
}

export function activityCountLabel(item: HwItem, count: number, en: boolean) {
  const method = item.config.block?.method;
  const activity = method?.startsWith('material:') ? method.slice('material:'.length) : '';
  let unit = ['개', 'card'];
  if (['learn', 'choice', 'say', 'spell', 'sceneWords'].includes(activity)) unit = ['단어', 'word'];
  else if (['listen', 'repeat', 'hide', 'order', 'write', 'echo'].includes(activity)) unit = ['문장', 'sentence'];
  else if (['watch', 'shadow', 'dub'].includes(activity)) unit = ['장면', 'scene'];
  else if (item.content.questions.length) unit = ['문항', 'question'];
  return en ? `${count} ${unit[1]}${count === 1 ? '' : 's'}` : `${count}${unit[0]}`;
}

/** Finish the chosen activity, then follow assignment order, wrapping to earlier unfinished activities. */
export function nextActivityCard(items: HwItem[], groups: HomeworkActivityGroup[], completed: Set<string>, current: number) {
  const position = groups.findIndex(group => group.indices.includes(current));
  for (let offset = 0; offset < groups.length && position >= 0; offset++) {
    const group = groups[(position + offset) % groups.length];
    const index = group.indices.find(i => !completed.has(items[i].id));
    if (index !== undefined) return { index, transition: offset > 0 };
  }
  return null;
}
