// Parser for LEAP "Shear and Moment Envelope" superstructure reports.
//
// Each report page that contains an envelope looks like:
//
//   SHEAR AND MOMENT ENVELOPE : Span : 1, Beam : 1, SERVICE I
//   Shears: kips, Moments: kft
//   Bearing  Trans  H/2  0.10L  0.20L  0.30L  0.40L  Midspan   <- column labels
//   Location, ft  0.00  2.00  3.31  11.50  24.00  36.50  ...    <- column stations
//   Self wt. :     M  0.0 137.0 ...
//   (Max)          V  69.6  67.4 ...
//   DL-Prec. :     M  ...
//   DC(Max)        V  14.3 ...
//   ... (more dead-load components) ...
//   LL + I :       M+ ...            <- live load / totals start here (ignored)
//
// We only want the shear (V) value in the first column ("Bearing", location 0.00)
// for every dead-load component, per Span/Beam, for the SERVICE I limit state.
//
// The functions here are pure and operate on "word" items shaped like
// { x, y, str } so they can be unit-tested without a PDF engine. The browser
// layer feeds them words extracted from pdf.js getTextContent().

// Limit state we extract. SERVICE I carries unfactored dead-load reactions.
export const TARGET_LIMIT_STATE = 'SERVICE I'

// Component markers that terminate the dead-load region (live load + totals).
const STOP_MARKERS = new Set(['M+', 'M-', 'Vmx'])
// Component markers within a data row.
const ROW_MARKERS = new Set(['M', 'V', 'M+', 'M-', 'Vmx'])

const HEADER_RE =
  /SHEAR\s+AND\s+MOMENT\s+ENVELOPE\s*:\s*Span\s*:\s*(\d+)\s*,\s*Beam\s*:\s*(\d+)\s*,\s*(.+)/i

// Canonical ordering of the dead-load rows as they appear in the report.
export const DEAD_LOAD_ORDER = [
  'Self wt. (Max)',
  'DL-Prec. DC(Max)',
  'DL-Prec. DW(Max)',
  'Deck + Haunch (Max)',
  'Diaphragm (Max)',
  'DL-Comp DC(Max)',
  'DL-Comp DW(Max)',
]

// Group word items into visual rows by their y coordinate, then sort each row
// left-to-right by x. yTolerance accounts for tiny baseline jitter within a row.
export function groupWordsIntoRows(words, yTolerance = 3) {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows = []
  let current = null

  for (const word of sorted) {
    if (!current || Math.abs(word.y - current.y) > yTolerance) {
      current = { y: word.y, items: [] }
      rows.push(current)
    }
    current.items.push(word)
  }

  return rows.map((row) => ({
    y: row.y,
    cells: row.items
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((item) => item.str.trim())
      .filter((str) => str.length > 0),
  }))
}

function cleanLabel(tokens) {
  return tokens
    .filter((token) => token !== ':')
    .join(' ')
    .replace(/\s*:\s*$/, '')
    .replace(/\s+/g, ' ')
    // pdf.js tokenizes "DL-Prec." as "DL", "-", "Prec." -> rejoin around hyphens
    .replace(/\s*-\s*/g, '-')
    .trim()
}

function isNumeric(token) {
  return /^-?\d+(\.\d+)?$/.test(token)
}

// Convert pdf.js text items to { x, y, str }. pdf.js gives a transform matrix
// where [4] is x and [5] is y (origin bottom-left, so larger y is higher up).
// We negate y so that visual top-to-bottom ordering matches ascending values.
export function textItemsToWords(items) {
  const words = []
  for (const item of items) {
    const str = (item.str ?? '').trim()
    if (!str) {
      continue
    }
    const transform = item.transform ?? [1, 0, 0, 1, 0, 0]
    words.push({ x: transform[4], y: -transform[5], str })
  }
  return words
}

function isLocationRow(row) {
  return /^Location,?$/i.test(row.cells[0] ?? '')
}

// The first numeric cell of a "Location, ft ..." row is the leftmost station.
// A near-bearing (left-half) table starts at 0.00; a mirrored right-half table
// starts partway along the span (e.g. 47.00).
function firstLocationValue(row) {
  for (const cell of row.cells) {
    if (isNumeric(cell)) {
      return Number(cell)
    }
  }
  return null
}

// Read one dead-load table (the near-bearing / left-half table) starting at the
// row after its "Location," row. The bearing reaction is the first (location
// 0.00) value of each shear (V) row. Stops at the live-load / total rows, the
// next table's location row, or endIdx.
function parseLeftTable(rows, locIndex, endIndex, header) {
  const loads = []
  let pendingLabel = ''

  for (let i = locIndex + 1; i < endIndex; i += 1) {
    const cells = rows[i].cells
    if (cells.length === 0) {
      continue
    }
    // The mirrored right-half table (or the next table) begins with its own
    // "Location," row — stop before we read into it.
    if (isLocationRow(rows[i])) {
      break
    }

    let markerIndex = -1
    for (let j = 0; j < cells.length; j += 1) {
      if (ROW_MARKERS.has(cells[j])) {
        markerIndex = j
        break
      }
    }
    if (markerIndex === -1) {
      continue
    }

    const marker = cells[markerIndex]
    const label = cleanLabel(cells.slice(0, markerIndex))

    if (STOP_MARKERS.has(marker) || /^(LL|Total)\b/i.test(label)) {
      break
    }

    const values = cells.slice(markerIndex + 1).filter(isNumeric)

    if (marker === 'M') {
      pendingLabel = label
      continue
    }

    if (marker === 'V') {
      const fullLabel = `${pendingLabel} ${label}`.replace(/\s+/g, ' ').trim()
      if (fullLabel && values.length > 0) {
        loads.push({ label: fullLabel, bearing: Number(values[0]) })
      }
      pendingLabel = ''
    }
  }

  if (loads.length === 0) {
    return null
  }
  return { span: header.span, beam: header.beam, state: header.state, loads }
}

// High-level: given an array of pages (each an array of pdf.js text items),
// return all matching envelopes in document order.
//
// LEAP paginates the report as one continuous stream: a beam's "SHEAR AND
// MOMENT ENVELOPE : ... Beam : N" header and its data table are NOT guaranteed
// to sit on the same page — the header can fall at the bottom of one page while
// its table is at the top of the next, and a beam's mirrored right-half table
// can sit on the page between its own header and the previous beam's. So we must
// flatten every page into one row stream and bind each header to the table that
// FOLLOWS it, rather than parsing page by page (which mislabels beams).
export function parsePagesTextItems(pagesItems, options = {}) {
  const { limitState = TARGET_LIMIT_STATE } = options

  // Flatten all pages, preserving reading order (page order, top-to-bottom).
  const rows = []
  for (const items of pagesItems) {
    const pageRows = groupWordsIntoRows(textItemsToWords(items))
    for (const row of pageRows) {
      rows.push(row)
    }
  }

  // Locate every beam header.
  const headers = []
  for (let i = 0; i < rows.length; i += 1) {
    const match = rows[i].cells.join(' ').match(HEADER_RE)
    if (match) {
      headers.push({
        idx: i,
        span: Number(match[1]),
        beam: Number(match[2]),
        state: match[3].trim().toUpperCase(),
      })
    }
  }

  const envelopes = []
  for (let k = 0; k < headers.length; k += 1) {
    const header = headers[k]
    if (limitState && header.state !== limitState.toUpperCase()) {
      continue
    }
    const endIdx = k + 1 < headers.length ? headers[k + 1].idx : rows.length

    // Find this beam's near-bearing (left-half) table: the first "Location,"
    // row starting at 0.00 that appears after the header and before the next
    // header. That table holds the bearing reactions for THIS beam.
    let locIndex = -1
    for (let i = header.idx + 1; i < endIdx; i += 1) {
      if (isLocationRow(rows[i])) {
        const first = firstLocationValue(rows[i])
        if (first !== null && Math.abs(first) < 0.5) {
          locIndex = i
          break
        }
      }
    }
    if (locIndex === -1) {
      continue
    }

    const envelope = parseLeftTable(rows, locIndex, endIdx, header)
    if (envelope) {
      envelopes.push(envelope)
    }
  }

  return envelopes
}

// Build a per-file result: ordered beam keys, ordered load labels, and a lookup
// of values. Handles multiple spans by keying columns as "S{span} B{beam}".
export function buildFileTable(envelopes) {
  const spanSet = new Set(envelopes.map((e) => e.span))
  const multiSpan = spanSet.size > 1

  const beams = []
  const beamKeys = new Set()
  const loadOrder = []
  const loadSeen = new Set()
  const values = new Map() // key `${beamKey}::${label}` -> number

  for (const env of envelopes) {
    const beamKey = `${env.span}-${env.beam}`
    if (!beamKeys.has(beamKey)) {
      beamKeys.add(beamKey)
      beams.push({
        key: beamKey,
        span: env.span,
        beam: env.beam,
        label: multiSpan ? `S${env.span} B${env.beam}` : `Beam ${env.beam}`,
      })
    }
    for (const load of env.loads) {
      if (!loadSeen.has(load.label)) {
        loadSeen.add(load.label)
        loadOrder.push(load.label)
      }
      values.set(`${beamKey}::${load.label}`, load.bearing)
    }
  }

  // Prefer the canonical dead-load ordering, then append any unexpected labels.
  const labels = [
    ...DEAD_LOAD_ORDER.filter((label) => loadSeen.has(label)),
    ...loadOrder.filter((label) => !DEAD_LOAD_ORDER.includes(label)),
  ]

  beams.sort((a, b) => a.span - b.span || a.beam - b.beam)

  return { beams, labels, values, multiSpan }
}

// Combine multiple file tables into a governing max-envelope table.
export function buildEnvelopeTable(fileTables) {
  const beamMap = new Map()
  const labelOrder = []
  const labelSeen = new Set()
  const values = new Map()
  let multiSpan = false

  for (const table of fileTables) {
    if (table.multiSpan) {
      multiSpan = true
    }
    for (const beam of table.beams) {
      if (!beamMap.has(beam.key)) {
        beamMap.set(beam.key, { ...beam })
      }
    }
    for (const label of table.labels) {
      if (!labelSeen.has(label)) {
        labelSeen.add(label)
        labelOrder.push(label)
      }
    }
    for (const beam of table.beams) {
      for (const label of table.labels) {
        const cellKey = `${beam.key}::${label}`
        const value = table.values.get(cellKey)
        if (value === undefined) {
          continue
        }
        const existing = values.get(cellKey)
        if (existing === undefined || value > existing) {
          values.set(cellKey, value)
        }
      }
    }
  }

  const beams = [...beamMap.values()].sort(
    (a, b) => a.span - b.span || a.beam - b.beam,
  )
  const labels = [
    ...DEAD_LOAD_ORDER.filter((label) => labelSeen.has(label)),
    ...labelOrder.filter((label) => !DEAD_LOAD_ORDER.includes(label)),
  ]

  return { beams, labels, values, multiSpan }
}
