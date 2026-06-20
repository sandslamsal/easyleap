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
// One block of rows is emitted per entry in bearingLines, so passing
// [1, 2] writes the same loads onto both sides of the cap (back and ahead
// span bearing lines).
export function buildCaseTxt(table, totals, def, options = {}) {
  const { bearingLines = [1], direction = 'Y', sign = -1 } = options
  const rows = []
  for (const line of bearingLines) {
    for (const beam of table.beams) {
      const value = totals.get(`${beam.key}::${def.key}`) ?? 0
      rows.push(`${line}, ${beam.beam}, ${direction}, ${formatCaseValue(value, sign)}`)
    }
  }
  return ['Bearing loads', ...rows].join('\n')
}
