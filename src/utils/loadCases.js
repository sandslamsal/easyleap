// Group the extracted dead-load components into substructure load cases and
// emit LEAP bearing-loads import text for each case.
//
// Confirmed grouping (DC1 + DC2 + DW):
//   DC1 (non-composite DC) = Self wt + DL-Prec DC + Deck+Haunch + Diaphragm
//   DC2 (composite DC)     = DL-Comp DC (barriers, rail)
//   DW  (wearing surface)  = DL-Comp DW + DL-Prec DW
//
// Component labels match DEAD_LOAD_ORDER in superstructureParser.js. A load
// case sums only the components present in the source table, so files that
// lack a component (e.g. a zero DW) still produce a valid 0.0 row.

export const LOAD_CASE_DEFS = [
  {
    key: 'DC1',
    label: 'DC1',
    description: 'Non-composite DC: girder self wt, precast DC, deck + haunch, diaphragm',
    components: [
      'Self wt. (Max)',
      'DL-Prec. DC(Max)',
      'Deck + Haunch (Max)',
      'Diaphragm (Max)',
    ],
  },
  {
    key: 'DC2',
    label: 'DC2',
    description: 'Composite DC: barriers, rail',
    components: ['DL-Comp DC(Max)'],
  },
  {
    key: 'DW',
    label: 'DW',
    description: 'Wearing surface and utilities',
    components: ['DL-Comp DW(Max)', 'DL-Prec. DW(Max)'],
  },
]

// Best-effort guess of which cap span a file belongs to, from its file name
// and internal LEAP model name. Two separate single-span models both report
// "Span 1" in the body, so the span number there is unreliable; the name is
// the only signal. Returns 1 or 2 (clamped to the two-span pier case); the
// user can always override. The digit must not be part of a longer number so
// span lengths like "Span250ft" do not read as span 2.
export function guessSpanFromText(text) {
  const lower = (text || '').toLowerCase()
  const match = lower.match(/(?:^|[^a-z])s(?:pan)?[\s_.-]*([1-9])(?!\d)/)
  if (match) {
    return Number(match[1]) >= 2 ? 2 : 1
  }
  if (/\bahead/.test(lower)) {
    return 2
  }
  return 1
}

function roundTenth(value) {
  return Math.round(value * 10) / 10
}

// Sum a case's components for one beam from the table's values map.
function sumCase(table, beamKey, components) {
  let total = 0
  for (const label of components) {
    const value = table.values.get(`${beamKey}::${label}`)
    if (value !== undefined) {
      total += value
    }
  }
  return roundTenth(total)
}

// Per-beam totals for every case. Returns { beams, totals } where totals is a
// Map keyed `${beamKey}::${caseKey}` -> number (the unfactored reaction, kips).
export function computeLoadCases(table) {
  const totals = new Map()
  if (!table) {
    return { beams: [], totals }
  }
  for (const beam of table.beams) {
    for (const def of LOAD_CASE_DEFS) {
      totals.set(`${beam.key}::${def.key}`, sumCase(table, beam.key, def.components))
    }
  }
  return { beams: table.beams, totals }
}

// Format a reaction as a signed, one-decimal load value. Gravity reactions act
// downward, so the exported value is negative by default. Never emit "-0.0".
export function formatCaseValue(value, sign = -1) {
  const signed = sign < 0 ? -value : value
  const cleaned = Object.is(signed, -0) || signed === 0 ? 0 : signed
  return cleaned.toFixed(1)
}

// Build the LEAP bearing-loads import text for a single case.
// Each row is: "<bearing line>, <bearing point>, <direction>, <value>".
//
// lineSpecs is an array of { line, beams, totals }, one entry per bearing line
// on the cap. Each line carries its own beam list and case totals, so a line
// can come from a different span (back vs ahead) with different beam counts and
// values. Passing two specs that share the same beams/totals at lines 1 and 2
// writes identical loads onto both sides of the cap.
export function buildCaseTxt(def, lineSpecs, options = {}) {
  const { direction = 'Y', sign = -1 } = options
  const rows = []
  for (const spec of lineSpecs) {
    for (const beam of spec.beams) {
      const value = spec.totals.get(`${beam.key}::${def.key}`) ?? 0
      rows.push(
        `${spec.line}, ${beam.beam}, ${direction}, ${formatCaseValue(value, sign)}`,
      )
    }
  }
  return ['Bearing loads', ...rows].join('\n')
}
