import * as XLSX from 'xlsx'

/**
 * Trigger a browser download of `columns` as a real .xlsx file (single sheet, header row
 * only — no fabricated sample data). A genuine spreadsheet has real cell boundaries, so
 * unlike a raw CSV string it can never render with everything crammed into one column
 * (a delimiter-detection problem some CSV viewers have), and a comma typed inside a value
 * later can never shift other columns out of alignment.
 */
export function downloadXlsxTemplate(columns: string[], filename: string): void {
  const ws = XLSX.utils.aoa_to_sheet([columns])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename)
}

/**
 * Parse an uploaded spreadsheet file (.xlsx or .csv — SheetJS reads both) into row objects
 * keyed by the first row's header text, mirroring the `{header: true}` shape the codebase's
 * existing Papa.parse-based CSV importers already expect. Every cell is read as its
 * formatted display text (`raw: false`), not the underlying value, so a phone number typed
 * into a text-formatted cell keeps a leading zero instead of being silently reinterpreted
 * as a number. Rows that are entirely blank are dropped.
 */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  const [header, ...data] = rows
  if (!header || header.length === 0) return []
  const cols = header.map(h => String(h ?? '').trim())
  return data
    .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
    .map(row => Object.fromEntries(cols.map((c, i) => [c, String(row[i] ?? '').trim()])))
}
