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

// Parse a single page's rows into one envelope record, or null if the page is
// not a SERVICE-I-style envelope (or limitState filter rejects it).
export function parseEnvelopeRows(rows, { limitState = TARGET_LIMIT_STATE } = {}) {
  let header = null

  for (let i = 0; i < rows.length; i += 1) {
    const text = rows[i].cells.join(' ')
    const match = text.match(HEADER_RE)
    if (match) {
      header = match
      break
    }
  }

  if (!header) {
    return null
  }

  const span = Number(header[1])
  const beam = Number(header[2])
  const state = header[3].trim().toUpperCase()

  if (limitState && state !== limitState.toUpperCase()) {
    return null
  }

  // LEAP prints the beam from one support. Odd beams show the left half
  // (Bearing is the first/leftmost station column) while even beams show the
  // mirrored right half (Bearing is the last/rightmost column). We must read
  // the value under the "Bearing" column, not blindly the first column.
  //
  // On the mirrored pages the title caption is rendered at the bottom of the
  // page while the data table sits at the top, so the header row is NOT a
  // reliable anchor for the table. We search the whole page for the station
  // label row ("Bearing ... Midspan") and the "Location, ft" row instead.
  let bearingSide = null
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].cells
    const idx = cells.indexOf('Bearing')
    if (idx !== -1) {
      bearingSide = idx === cells.length - 1 && idx !== 0 ? 'right' : 'left'
      break
    }
  }

  if (bearingSide === null) {
    return null
  }

  // Find the "Location, ft" row; data rows follow it in top-to-bottom order.
  let locationIndex = -1
  for (let i = 0; i < rows.length; i += 1) {
    if (/^Location,?$/i.test(rows[i].cells[0] ?? '')) {
      locationIndex = i
      break
    }
  }

  if (locationIndex === -1) {
    return null
  }

  const loads = []
  let pendingLabel = ''

  for (let i = locationIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i].cells
    if (cells.length === 0) {
      continue
    }

    // Locate the component marker (M / V / M+ / ...) inside the row.
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

    // Stop once we reach live load / total rows.
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
        const raw = bearingSide === 'right' ? values[values.length - 1] : values[0]
        loads.push({ label: fullLabel, bearing: Number(raw) })
      }
      pendingLabel = ''
    }
  }

  if (loads.length === 0) {
    return null
  }

  return { span, beam, state, loads }
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

// High-level: given an array of pages, each an array of pdf.js text items,
// return all matching envelopes in document order.
export function parsePagesTextItems(pagesItems, options) {
  const envelopes = []
  for (const items of pagesItems) {
    const words = textItemsToWords(items)
    const rows = groupWordsIntoRows(words)
    const envelope = parseEnvelopeRows(rows, options)
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
