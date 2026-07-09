import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseSpreadsheetFile } from './xlsx'

/** Build a real .xlsx File in memory (no download side effect) to feed into parseSpreadsheetFile. */
function xlsxFile(rows: unknown[][], name = 'test.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new File([buf], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function csvFile(text: string, name = 'test.csv'): File {
  return new File([text], name, { type: 'text/csv' })
}

describe('parseSpreadsheetFile (.xlsx)', () => {
  it('parses rows keyed by the header row', async () => {
    const file = xlsxFile([
      ['name', 'username', 'platform'],
      ['Caesar Anggie', 'caesar.anggi', 'TikTok'],
      ['Lovita Lim', 'lovita.lim', 'Instagram'],
    ])
    const rows = await parseSpreadsheetFile(file)
    expect(rows).toEqual([
      { name: 'Caesar Anggie', username: 'caesar.anggi', platform: 'TikTok' },
      { name: 'Lovita Lim', username: 'lovita.lim', platform: 'Instagram' },
    ])
  })

  it('keeps a leading-zero phone number intact when the cell is text, not a reinterpreted number', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['name', 'contact'], ['Budi', '0812111122']])
    // Force the contact cell to a text type ('s'), matching how a real "format as text"
    // phone-number cell would be stored — the read-back must not silently drop the leading 0.
    ws['B2'] = { t: 's', v: '0812111122' }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const file = new File([buf], 'contacts.xlsx')

    const rows = await parseSpreadsheetFile(file)
    expect(rows[0].contact).toBe('0812111122')
  })

  it('drops entirely-blank rows', async () => {
    const file = xlsxFile([
      ['name', 'niche'],
      ['A', 'Beauty'],
      ['', ''],
      ['B', 'Lifestyle'],
    ])
    const rows = await parseSpreadsheetFile(file)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.name)).toEqual(['A', 'B'])
  })

  it('returns an empty array for a sheet with no header row', async () => {
    const file = xlsxFile([])
    const rows = await parseSpreadsheetFile(file)
    expect(rows).toEqual([])
  })

  it('trims header whitespace', async () => {
    const file = xlsxFile([[' name ', ' username'], ['Sari', 'sari_ig']])
    const rows = await parseSpreadsheetFile(file)
    expect(rows[0]).toEqual({ name: 'Sari', username: 'sari_ig' })
  })
})

describe('parseSpreadsheetFile (.csv fallback)', () => {
  it('also parses a plain CSV file through the same code path', async () => {
    const file = csvFile('name,platform\nBudi,Instagram\nSari,TikTok\n')
    const rows = await parseSpreadsheetFile(file)
    expect(rows).toEqual([
      { name: 'Budi', platform: 'Instagram' },
      { name: 'Sari', platform: 'TikTok' },
    ])
  })
})
