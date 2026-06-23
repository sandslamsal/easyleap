// Build clipboard (TSV) and Excel (.xlsx) exports for the extracted bearing
// reactions. Layout is a single stacked sheet: one block per file, then a
// governing max-envelope block at the bottom.
import { buildEnvelopeTable } from './superstructureParser.js'
import { LOAD_CASE_DEFS } from './loadCases.js'

const TITLE = 'Superstructure Bearing Reactions: Shear (V) at Bearing (SERVICE I)'
const UNITS = 'Units: kips'

export function formatValue(value) {
  return Number.isFinite(value) ? value.toFixed(1) : ''
}

// Produce a stacked array-of-arrays plus a matching mask marking numeric cells.
// fileTables: [{ name, table }]. caseSpans: [{ tag, line, beams, totals }] from
// the load-case panel, appended as a per-beam DC1/DC2/DC/DW summary.
function buildStackedAoa(fileTables, envelopeTable, caseSpans = []) {
  const aoa = []
  const numeric = []

  const pushRow = (cells, numericFlags) => {
    aoa.push(cells)
    numeric.push(numericFlags ?? cells.map(() => false))
  }

  const pushBlock = (title, table) => {
    pushRow([title])
    const headerCells = ['Load Component', ...table.beams.map((b) => b.label)]
    pushRow(headerCells)
    for (const label of table.labels) {
      const valueCells = table.beams.map((beam) => {
        const value = table.values.get(`${beam.key}::${label}`)
        return value === undefined ? '' : value
      })
      pushRow(
        [label, ...valueCells],
        [false, ...valueCells.map((v) => v !== '')],
      )
    }
    pushRow([])
  }

  const pushCaseBlock = (title, span) => {
    pushRow([title])
    pushRow(['Beam', ...LOAD_CASE_DEFS.map((def) => def.label)])
    for (const beam of span.beams) {
      const valueCells = LOAD_CASE_DEFS.map(
        (def) => span.totals.get(`${beam.key}::${def.key}`) ?? 0,
      )
      pushRow(
        [beam.label, ...valueCells],
        [false, ...valueCells.map(() => true)],
      )
    }
    pushRow([])
  }

  pushRow([TITLE])
  pushRow([UNITS])
  pushRow([])

  for (const { name, table } of fileTables) {
    pushBlock(name, table)
  }

  pushBlock('MAX ENVELOPE (governing across files)', envelopeTable)

  for (const span of caseSpans) {
    const title =
      caseSpans.length > 1
        ? `LOAD CASES (Span ${span.tag}, line ${span.line})`
        : 'LOAD CASES (per beam)'
    pushCaseBlock(title, span)
  }

  return { aoa, numeric }
}

export function buildClipboardTsv(fileTables, caseSpans = []) {
  const envelopeTable = buildEnvelopeTable(fileTables.map((f) => f.table))
  const { aoa, numeric } = buildStackedAoa(fileTables, envelopeTable, caseSpans)

  return aoa
    .map((row, r) =>
      row
        .map((cell, c) => (numeric[r][c] ? formatValue(cell) : cell ?? ''))
        .join('\t'),
    )
    .join('\n')
}

export async function downloadWorkbook(
  fileTables,
  caseSpans = [],
  fileBaseName = 'bearing-reactions',
) {
  // Lazy-load SheetJS so it stays out of the initial bundle.
  const XLSX = await import('xlsx')
  const envelopeTable = buildEnvelopeTable(fileTables.map((f) => f.table))
  const { aoa, numeric } = buildStackedAoa(fileTables, envelopeTable, caseSpans)

  const worksheet = XLSX.utils.aoa_to_sheet(aoa)

  // Apply a one-decimal number format to every numeric cell.
  for (let r = 0; r < aoa.length; r += 1) {
    for (let c = 0; c < aoa[r].length; c += 1) {
      if (!numeric[r][c]) {
        continue
      }
      const ref = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[ref]
      if (cell) {
        cell.t = 'n'
        cell.z = '0.0'
      }
    }
  }

  // Column widths: wide first column for labels, even beam columns.
  const maxCols = aoa.reduce((max, row) => Math.max(max, row.length), 0)
  worksheet['!cols'] = Array.from({ length: maxCols }, (_, index) => ({
    wch: index === 0 ? 32 : 11,
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bearing Reactions')
  XLSX.writeFile(workbook, `${fileBaseName}.xlsx`)
}
