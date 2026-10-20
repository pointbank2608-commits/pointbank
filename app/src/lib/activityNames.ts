/** Titles are labels, never identifiers. Explicit titles are preserved; empty ones get a useful default. */
export function activityName(value: string | undefined, base: string, existing: readonly string[] = []): string {
  if (value?.trim()) return value.trim();
  const used = new Set(existing.map(name => name.trim()));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
