import { validateItems } from './blocks';
import { labels } from './materialPlan';
import { isReviewGameGroup } from './materialReviewGames';
import type { HwItemDraft } from './types';

export interface PublicationRow { key: string; item: HwItemDraft }
export interface PublicationGroup { key: string; rows: PublicationRow[] }

/** Keep every persisted row ID for publication edits. The visible unit is the assigned activity. */
export function publicationGroups(rows: PublicationRow[]): PublicationGroup[] {
  const groups = new Map<string, PublicationGroup>();
  for (const row of rows) {
    const block = row.item.config.block;
    const method = block?.method ?? '';
    const grouped = block?.groupKey && (
      (method.startsWith('material:') && Object.hasOwn(labels, method.slice('material:'.length))) ||
      (block.groupKey === 'material-final' && method.startsWith('guided-final:')) ||
      isReviewGameGroup(row.item)
    );
    const key = grouped ? 'group:' + block.groupKey : 'row:' + row.key;
    let group = groups.get(key);
    if (!group) {
      group = { key, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}

export function publicationIssues(groups: PublicationGroup[]): string[] {
  const items = groups.flatMap(group => group.rows.map(row => row.item));
  if (!groups.length || groups.length > 60 || items.length <= 60) return validateItems(items);
  if (new TextEncoder().encode(JSON.stringify(items)).byteLength > 1000000) {
    return ['숙제 자료가 1MB를 넘습니다. / Homework content exceeds 1 MB.'];
  }
  const errors: string[] = [];
  for (let index = 0; index < items.length; index += 60) {
    errors.push(...validateItems(items.slice(index, index + 60)));
  }
  return errors;
}
