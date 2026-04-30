// Build a CSV string with a UTF-8 BOM and an optional TOTAL row at the bottom.
// Mirrors the POS's CSV style (so spreadsheets render Arabic/Kurdish correctly).

export function buildCSV(opts: {
  headers: string[]
  rows: (string | number | null)[][]
  totals?: (string | number | null)[]   // optional "TOTAL" row
}) {
  const esc = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    opts.headers.map(esc).join(','),
    ...opts.rows.map((r) => r.map(esc).join(',')),
  ]
  if (opts.totals) lines.push(opts.totals.map(esc).join(','))
  return '﻿' + lines.join('\r\n')
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
