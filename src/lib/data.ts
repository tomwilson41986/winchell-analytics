import { parseCsv, type ParsedCsv } from './csv'

/**
 * Build-time access to the source data files under /data.
 *
 * Vite's `import.meta.glob` bundles the raw text of every CSV/JSON in /data so
 * pages can read it without a runtime fetch (and without copying /data into
 * /public). Keys are the file paths relative to this module, e.g.
 * "../../data/horses/horses.csv".
 *
 * Add a new file under /data/<section>/ and it is picked up automatically.
 */
const csvFiles = import.meta.glob('../../data/**/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const jsonFiles = import.meta.glob('../../data/**/*.json', {
  import: 'default',
  eager: true,
}) as Record<string, unknown>

function resolveKey(map: Record<string, unknown>, section: string, file: string) {
  const suffix = `/data/${section}/${file}`
  return Object.keys(map).find((k) => k.endsWith(suffix))
}

/**
 * Load and parse a CSV from /data/<section>/<file>.
 * Returns empty headers/rows if the file is not found.
 */
export function loadCsv(section: string, file: string): ParsedCsv {
  const key = resolveKey(csvFiles, section, file)
  if (!key) {
    console.warn(`[data] CSV not found: /data/${section}/${file}`)
    return { headers: [], rows: [] }
  }
  return parseCsv(csvFiles[key])
}

/**
 * Load a JSON file from /data/<section>/<file>.
 */
export function loadJson<T = unknown>(section: string, file: string): T | null {
  const key = resolveKey(jsonFiles, section, file)
  if (!key) {
    console.warn(`[data] JSON not found: /data/${section}/${file}`)
    return null
  }
  return jsonFiles[key] as T
}

/** List the available data files in a section (handy for debugging). */
export function listSectionFiles(section: string): string[] {
  const prefix = `/data/${section}/`
  return [...Object.keys(csvFiles), ...Object.keys(jsonFiles)]
    .filter((k) => k.includes(prefix))
    .map((k) => k.slice(k.indexOf(prefix) + prefix.length))
}
