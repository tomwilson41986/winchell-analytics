/**
 * Runtime fetch for large datasets served as static assets from `public/`
 * (kept out of the JS bundle). Results are cached per-path for the session.
 */
const cache = new Map<string, Promise<unknown>>()

export function fetchJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`)
        }
        return res.json()
      }),
    )
  }
  return cache.get(path) as Promise<T>
}
