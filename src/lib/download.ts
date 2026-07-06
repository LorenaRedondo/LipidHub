// Small client-side download helpers (data + images).

export function downloadText(filename: string, mime: string, text: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJSON(filename: string, data: unknown) {
  downloadText(filename, 'application/json', JSON.stringify(data, null, 2))
}

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  downloadText(filename, 'text/csv', toCSV(headers, rows))
}

/** Serialize an <svg> element to a standalone, downloadable file. */
export function downloadSVG(filename: string, svg: SVGSVGElement | null) {
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const src = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
  downloadText(filename, 'image/svg+xml', src)
}
