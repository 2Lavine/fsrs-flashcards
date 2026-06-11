/** Simple request cache that clears on version change. */

const cache = new Map<string, { result: unknown; version: number }>();
let currentVersion = 0;

export function setCacheVersion(v: number) {
  if (v !== currentVersion) {
    cache.clear();
    currentVersion = v;
  }
}

export function cached<T>(key: string, version: number, fetcher: () => Promise<T>): Promise<T> {
  setCacheVersion(version);
  const hit = cache.get(key);
  if (hit && hit.version === version) return Promise.resolve(hit.result as T);
  return fetcher().then(result => {
    cache.set(key, { result, version });
    return result;
  });
}
