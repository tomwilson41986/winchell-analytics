export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * Minimal CSV parser. Handles quoted fields, escaped quotes ("") and
 * commas/newlines inside quotes. Good enough for the tabular source files in
 * /data; swap for a library (e.g. papaparse) if you need streaming or
 * type coercion.
 */
export function parseCsv(text: string): ParsedCsv {
  const records = tokenize(text)
  if (records.length === 0) {
    return { headers: [], rows: [] }
  }

  const [headers, ...dataRows] = records

  const rows = dataRows
    // Drop fully-empty lines and lines marked as placeholders.
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .filter((cells) => !cells[0].trim().startsWith('#'))
    .map((cells) => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = cells[i] ?? ''
      })
      return row
    })

  return { headers, rows }
}

function tokenize(text: string): string[][] {
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      records.push(row)
      field = ''
      row = []
    } else {
      field += ch
    }
  }

  // Flush trailing field/row (file without trailing newline).
  if (field !== '' || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  return records
}
