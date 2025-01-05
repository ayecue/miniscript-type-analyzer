export function mergeUnique<T>(
  target: T[],
  source: T[],
  chunkSize: number = 10000
): void {
  const items = Array.from(new Set([...target, ...source]));
  target.length = 0;
  if (items.length <= chunkSize) {
    Array.prototype.push.apply(target, items);
    return;
  }
  for (let i = 0; i < items.length; i += chunkSize) {
    Array.prototype.push.apply(target, items.slice(i, i + chunkSize));
  }
}
