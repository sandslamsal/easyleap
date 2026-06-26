// Pile layout generator for LEAP RC-PIER, based on AASHTO LRFD 10.7.1.2
// (mandatory) and the GDOT Bridge and Structures Design Manual Appendix 4B
// preset layouts (optional).
//
// Coordinate convention matches LEAP's "Edit: Pile Locations" dialog:
//   - Origin at the MID-LEFT of the footing.
//   - X is horizontal, positive to the right (X = 0 at the left face).
//   - Z is vertical, positive DOWN (Z = 0 at mid-height; top row negative,
//     bottom row positive).
//   - Pile 1 is the top-left pile; numbering increases left-to-right across a
//     row, then continues on the next row down.

// AASHTO LRFD 10.7.1.2: center-to-center spacing not less than the greater of
// 30 in or 2.5 pile diameters/widths; pile side to nearest footing edge > 9 in.
export const AASHTO = { minSpacingAbs: 30, spacingFactor: 2.5, minEdge: 9 }

export function minSpacing(pileSize) {
  return Math.max(AASHTO.minSpacingAbs, AASHTO.spacingFactor * pileSize)
}

// GDOT Appendix 4B, Figure 4B-1 preset arrangements (4 to 12 piles). Each is a
// list of [col, row] cells on a base grid (row 0 = top), plus the grid size.
const grid = (cols, rows, cells) => ({ cols, rows, cells })
export const GDOT_PRESETS = {
  4: grid(2, 2, [[0, 0], [1, 0], [0, 1], [1, 1]]),
  5: grid(3, 3, [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]),
  6: grid(2, 3, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]),
  7: grid(3, 3, [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]),
  8: grid(3, 3, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]]),
  9: grid(3, 3, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]),
  10: grid(3, 4, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2], [0, 3], [1, 3], [2, 3]]),
  11: grid(3, 4, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]]),
  12: grid(3, 4, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]]),
}

export const GDOT_ARRANGEMENT_NAMES = {
  4: '2 x 2 grid',
  5: 'Quincunx (4 corners + center)',
  6: '2 x 3 grid',
  7: '3-1-3',
  8: '8-pile ring (3 x 3 without center)',
  9: '3 x 3 grid',
  10: '3 x 4 perimeter',
  11: '3 x 4 less one interior',
  12: '3 x 4 grid',
}

// Rectangular grid for any count. columns auto-picks a near-square grid that
// favors the footing aspect ratio when not supplied.
function gridArrangement(count, columns, aspect = 1) {
  let cols = columns
  if (!cols || cols < 1) {
    cols = Math.max(1, Math.round(Math.sqrt(count * aspect)))
  }
  cols = Math.min(cols, count)
  const rows = Math.ceil(count / cols)
  const cells = []
  for (let i = 0; i < count; i += 1) {
    cells.push([i % cols, Math.floor(i / cols)])
  }
  return grid(cols, rows, cells)
}

// Generate the layout. Piles are spread so the outer piles sit exactly at the
// edge distance from every face of the footing, with uniform spacing in each
// direction (derived from the footing, the edge distance, and the arrangement
// grid). Returns piles in LEAP convention plus metadata.
export function generateLayout(opts) {
  const { footingX, footingZ, count, pileSize, edge, columns, useGdot } = opts

  const e = edge > 0 ? edge : AASHTO.minEdge // pile side to footing face
  const endOffset = e + pileSize / 2 // pile center to footing face

  const preset = useGdot ? GDOT_PRESETS[count] : null
  const arrangement = preset
    ? preset
    : gridArrangement(count, columns, footingZ > 0 ? footingX / footingZ : 1)
  const arrangementName = preset
    ? `GDOT Appendix 4B: ${GDOT_ARRANGEMENT_NAMES[count]}`
    : `${arrangement.cols} x ${arrangement.rows} grid${
        arrangement.cols * arrangement.rows !== count ? ' (partial last row)' : ''
      }`

  const { cols, rows, cells } = arrangement
  const spanX = footingX - 2 * endOffset
  const spanZ = footingZ - 2 * endOffset
  const spacingX = cols > 1 ? spanX / (cols - 1) : 0
  const spacingZ = rows > 1 ? spanZ / (rows - 1) : 0

  const round = useGdot ? (v) => Math.round(v) : (v) => Math.round(v * 100) / 100
  const symRound = useGdot
    ? (v) => Math.sign(v) * Math.round(Math.abs(v))
    : (v) => Math.round(v * 100) / 100

  // Outer piles at the edge distance; single column/row is centered.
  const px = (col) => (cols === 1 ? footingX / 2 : endOffset + col * spacingX)
  const pz = (row) => (rows === 1 ? 0 : -spanZ / 2 + row * spacingZ)

  let piles = cells.map(([col, row]) => ({
    col,
    row,
    x: round(px(col)),
    z: symRound(pz(row)),
  }))
  piles.sort((a, b) => a.row - b.row || a.col - b.col)
  piles = piles.map((pile, index) => ({
    n: index + 1,
    x: pile.x,
    z: pile.z,
    batterZ: 0,
    batterX: 0,
  }))

  // Minimum footing for this arrangement at the AASHTO minimum spacing.
  const minSp = minSpacing(pileSize)
  const reqX = (cols - 1) * minSp + 2 * endOffset
  const reqZ = (rows - 1) * minSp + 2 * endOffset

  return {
    piles,
    cols,
    rows,
    spacingX,
    spacingZ,
    edge: e,
    reqX,
    reqZ,
    arrangementName,
    isPreset: Boolean(preset),
  }
}

// Check the current (possibly user-edited) pile coordinates against the ticked
// codes. Returns a list of { code, clause, label, actual, status } where status
// is 'met' | 'fail' | 'advisory'.
export function checkCompliance({ piles, footingX, footingZ, pileSize, useGdot }) {
  const checks = []
  const half = pileSize / 2
  const EPS = 1e-6

  // AASHTO 10.7.1.2 — center-to-center spacing.
  const reqCC = minSpacing(pileSize)
  let minCC = Infinity
  for (let i = 0; i < piles.length; i += 1) {
    for (let j = i + 1; j < piles.length; j += 1) {
      const d = Math.hypot(piles[i].x - piles[j].x, piles[i].z - piles[j].z)
      if (d < minCC) minCC = d
    }
  }
  checks.push({
    code: 'AASHTO',
    clause: 'LRFD 10.7.1.2',
    label: `Center-to-center spacing ≥ greater of 30 in or 2.5D (= ${reqCC} in)`,
    actual: piles.length > 1 ? `${minCC.toFixed(1)} in min` : 'n/a',
    status: piles.length < 2 ? 'advisory' : minCC + EPS >= reqCC ? 'met' : 'fail',
  })

  // AASHTO 10.7.1.2 — pile side to nearest footing edge.
  let minEdge = Infinity
  for (const pile of piles) {
    const centerToEdge = Math.min(
      pile.x,
      footingX - pile.x,
      pile.z + footingZ / 2,
      footingZ / 2 - pile.z,
    )
    const sideToEdge = centerToEdge - half
    if (sideToEdge < minEdge) minEdge = sideToEdge
  }
  checks.push({
    code: 'AASHTO',
    clause: 'LRFD 10.7.1.2',
    label: 'Pile side to nearest footing edge > 9 in',
    actual: piles.length ? `${minEdge.toFixed(1)} in min` : 'n/a',
    status: !piles.length ? 'advisory' : minEdge > 9 - EPS ? 'met' : 'fail',
  })

  if (useGdot) {
    // GDOT 4.2.5.3 — coordinates detailed in 1 inch increments.
    const allInteger = piles.every(
      (pile) => Number.isInteger(pile.x) && Number.isInteger(pile.z),
    )
    checks.push({
      code: 'GDOT',
      clause: 'GDOT 4.2.5.3',
      label: 'Pile coordinates detailed in 1 in increments',
      actual: allInteger ? 'all integer' : 'non-integer values',
      status: allInteger ? 'met' : 'fail',
    })

    // GDOT 4.2.5.1 — plan dimensions in 3 inch increments.
    const foot3 =
      Math.abs(footingX % 3) < EPS && Math.abs(footingZ % 3) < EPS
    checks.push({
      code: 'GDOT',
      clause: 'GDOT 4.2.5.1',
      label: 'Footing plan dimensions in 3 in increments',
      actual: `${footingX} x ${footingZ} in`,
      status: foot3 ? 'met' : 'fail',
    })

    // GDOT 4.2.5.1 — square footing whenever possible (advisory).
    const square = Math.abs(footingX - footingZ) < EPS
    checks.push({
      code: 'GDOT',
      clause: 'GDOT 4.2.5.1',
      label: 'Square footing (use whenever possible)',
      actual: square ? 'square' : `${footingX} x ${footingZ} in`,
      status: square ? 'met' : 'advisory',
    })

    // GDOT 4.2.5.3 / Appendix 4B — preset arrangement coverage.
    const encoded = GDOT_PRESETS[piles.length] != null // Figure 4B-1, 4 to 12
    const inRange = piles.length >= 4 && piles.length <= 25
    checks.push({
      code: 'GDOT',
      clause: 'GDOT Appendix 4B',
      label: encoded
        ? 'Arrangement matches an encoded Figure 4B-1 preset'
        : inRange
          ? 'Grid approximation — verify against Figure 4B-2 / 4B-3'
          : 'Outside the Appendix 4B range (4 to 25 piles)',
      actual: `${piles.length} piles`,
      status: encoded ? 'met' : inRange ? 'advisory' : 'fail',
    })
  }

  return checks
}

// Reference clauses for the specification panel (quoted from the sources).
export const AASHTO_SPECS = [
  {
    clause: 'AASHTO LRFD 10.7.1.2',
    title: 'Pile Spacing, Clearances, and Embedment',
    text: 'Center-to-center pile spacing shall not be less than the greater of 30.0 in. or 2.5 pile diameters (or widths). The distance from the side of any pile to the nearest edge of the footing shall be greater than 9.0 in.',
  },
]

export const GDOT_SPECS = [
  {
    clause: 'GDOT 4.2.5.3',
    title: 'Pile Layouts',
    text: 'Use one of the GDOT pile layouts presented in Appendix 4B to design pile footings. Minimum pile spacing and edge distances shall be determined in accordance with LRFD 10.7.1.2 and detailed in 1 inch increments.',
  },
  {
    clause: 'GDOT 4.2.5.1',
    title: 'Footing Dimensions',
    text: 'Use a square pile footing whenever possible. Plan footing dimensions shall be detailed in 3 inch increments in each direction. Pile footings shall be a minimum of 3 ft 3 in thick when steel H-piles are used and 3 ft 6 in when PSC piles or metal shell piles are used.',
  },
  {
    clause: 'GDOT 4.2.5.4',
    title: 'Design',
    text: 'Pile footings shall be designed for zero tension (no uplift) in the piling for the strength limit state only.',
  },
  {
    clause: 'GDOT Appendix 4B',
    title: 'Preset Pile Layouts',
    text: 'Standard pile arrangements: Figure 4B-1 (4 to 12 piles), Figure 4B-2 (13 to 21 piles), Figure 4B-3 (22 to 25 piles).',
  },
]
