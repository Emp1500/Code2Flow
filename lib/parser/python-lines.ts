export interface LogicalLine { text: string; indent: number; lineNum: number }

export function getIndent(line: string): number {
  let n = 0
  for (const c of line) { if (c === ' ') n++; else if (c === '\t') n += 4; else break }
  return n
}

/**
 * Joins physical lines into logical lines: open brackets, trailing-backslash
 * continuations, and triple-quoted strings all continue onto the next line.
 * Comments are stripped only outside strings. Total: unclosed state at EOF
 * flushes the pending logical line instead of erroring.
 */
export function toLogicalLines(code: string): LogicalLine[] {
  const physical = code.split('\n')
  const out: LogicalLine[] = []
  let buf: string[] = []
  let indent = 0
  let lineNum = 0
  let depth = 0
  let str: string | null = null // open string delimiter: ', ", ''' or """

  const flush = () => {
    const text = buf.join(' ').trim()
    if (text) out.push({ text, indent, lineNum })
    buf = []
  }

  for (let i = 0; i < physical.length; i++) {
    const raw = physical[i]
    if (buf.length === 0 && str === null) {
      if (!raw.trim() || raw.trim().startsWith('#')) continue
      indent = getIndent(raw)
      lineNum = i + 1
    }

    let piece = ''
    for (let j = 0; j < raw.length; j++) {
      const c = raw[j]
      if (str !== null) {
        piece += c
        if (str.length === 3) {
          if (raw.startsWith(str, j)) { piece += str.slice(1); j += 2; str = null }
        } else if (c === '\\') { piece += raw[j + 1] ?? ''; j++ }
        else if (c === str) str = null
        continue
      }
      if (c === '#') break
      if (c === "'" || c === '"') {
        if (raw.startsWith(c.repeat(3), j)) { str = c.repeat(3); piece += str; j += 2 }
        else { str = c; piece += c }
        continue
      }
      if ('([{'.includes(c)) depth++
      else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
      piece += c
    }

    // a single-quoted string cannot span physical lines — recover
    if (str !== null && str.length === 1) str = null

    const continued = piece.trimEnd().endsWith('\\')
    buf.push((continued ? piece.trimEnd().slice(0, -1) : piece).trim())

    if (depth === 0 && str === null && !continued) flush()
  }
  flush()
  return out
}

/** Index of the first `target` char at bracket-depth 0 outside strings, at or after `from`. */
export function topLevelIndexOf(text: string, target: string, from = 0): number {
  let depth = 0
  let str: string | null = null
  for (let j = 0; j < text.length; j++) {
    const c = text[j]
    if (str !== null) {
      if (str.length === 3) { if (text.startsWith(str, j)) { j += 2; str = null } }
      else if (c === '\\') j++
      else if (c === str) str = null
      continue
    }
    if (c === "'" || c === '"') { str = text.startsWith(c.repeat(3), j) ? c.repeat(3) : c; if (str.length === 3) j += 2; continue }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
    else if (c === target && depth === 0 && j >= from) return j
  }
  return -1
}

/** Splits on `sep` occurring at bracket-depth 0 outside strings; drops empty parts. */
export function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = []
  let start = 0
  let idx = topLevelIndexOf(text, sep, 0)
  while (idx !== -1) {
    parts.push(text.slice(start, idx))
    start = idx + 1
    idx = topLevelIndexOf(text, sep, start)
  }
  parts.push(text.slice(start))
  return parts.filter(p => p.trim())
}
