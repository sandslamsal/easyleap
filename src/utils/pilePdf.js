// Premium engineering PDF report for the Pile Layout tool.
//
// The whole report is drawn with jsPDF vector primitives (no screenshots): the
// pile-cap figure, tables, cards and chrome are all true vector with selectable
// text, so the output stays crisp at any zoom. The module takes plain data and
// has no DOM dependency, which also lets it be rendered head-less for testing.

export const APP_VERSION = '1.0'
export const APP_URL = 'sandeshlamsal.com/apps'

// ---- palette (RGB) ----
const C = {
  band: [30, 58, 138], // deep engineering blue
  bandAccent: [59, 130, 246],
  accent: [37, 99, 235],
  accentDeep: [29, 78, 216],
  ink: [17, 24, 39],
  sub: [75, 85, 99],
  faint: [156, 163, 175],
  line: [209, 214, 222],
  cardFill: [241, 245, 251],
  cardBorder: [214, 221, 232],
  foundation: [55, 65, 81],
  white: [255, 255, 255],
  zebra: [244, 247, 251],
  green: [22, 127, 55],
  red: [180, 35, 24],
  amber: [178, 94, 9],
  gridline: [226, 232, 240],
}

const ftIn = (inches) => {
  const ft = Math.floor(inches / 12)
  const rem = Math.round(inches - ft * 12)
  return `${ft}'-${rem}"`
}
const fmt = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(2))

// jsPDF's standard fonts use WinAnsi encoding; map the few non-ASCII symbols
// that appear in code labels to safe equivalents so they render.
const T = (s) =>
  String(s)
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[—–]/g, '-')
    .replace(/×/g, 'x')
    .replace(/≈/g, '~')

export async function generatePilePdf(data) {
  const { jsPDF } = await import('jspdf')
  const {
    piles,
    meta,
    pileType,
    pileSize,
    footingX,
    footingZ,
    compliance = [],
    project = {},
    pageSize = 'letter',
    dateStr = '',
    useGdot = true,
  } = data

  const doc = new jsPDF({ unit: 'pt', format: pageSize, compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 42
  const contentTop = 78
  const contentBottom = H - 40
  const innerW = W - 2 * M

  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2])
  const font = (style = 'normal', size = 10) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }
  // shrink a value to fit one line, or wrap to two lines at the smallest size
  const fitValue = (text, maxW) => {
    for (const sz of [11, 10, 9, 8.5]) {
      font('bold', sz)
      if (doc.getTextWidth(text) <= maxW) return { size: sz, lines: [text] }
    }
    font('bold', 8.5)
    return { size: 8.5, lines: doc.splitTextToSize(text, maxW).slice(0, 2) }
  }

  // ---- repeating header band ----
  const drawHeader = () => {
    setFill(C.band)
    doc.rect(0, 0, W, 58, 'F')
    setFill(C.bandAccent)
    doc.rect(0, 58, W, 3, 'F')
    // logo mark: rounded square with a pile glyph
    setFill(C.white)
    doc.roundedRect(M, 16, 26, 26, 5, 5, 'F')
    setDraw(C.accent)
    doc.setLineWidth(2)
    doc.line(M + 8, 22, M + 8, 36)
    doc.line(M + 18, 22, M + 18, 36)
    doc.line(M + 8, 29, M + 18, 29)
    // wordmark
    setText(C.white)
    font('bold', 17)
    doc.text('EasyLEAP', M + 36, 28, { baseline: 'middle' })
    font('normal', 8.5)
    doc.setTextColor(206, 219, 245)
    doc.text('Pile Foundation Layout', M + 36, 42, { baseline: 'middle' })
    // right block
    setText(C.white)
    font('bold', 12)
    doc.text('PILE CAP LAYOUT REPORT', W - M, 25, { align: 'right', baseline: 'middle' })
    font('normal', 8.5)
    doc.setTextColor(206, 219, 245)
    doc.text(
      `AASHTO LRFD 10.7.1.2${useGdot ? '  +  GDOT Appendix 4B' : ''}`,
      W - M,
      40,
      { align: 'right', baseline: 'middle' },
    )
  }

  // footer text is stamped after total pages are known
  const stampFooters = () => {
    const total = doc.getNumberOfPages()
    for (let p = 1; p <= total; p += 1) {
      doc.setPage(p)
      setDraw(C.line)
      doc.setLineWidth(0.6)
      doc.line(M, H - 30, W - M, H - 30)
      font('normal', 7.5)
      setText(C.faint)
      doc.text('EasyLEAP  ·  Pile Foundation Layout', M, H - 20, { baseline: 'middle' })
      if (dateStr) {
        doc.text(dateStr, W / 2, H - 20, { align: 'center', baseline: 'middle' })
      }
      doc.text(`Page ${p} of ${total}  ·  v${APP_VERSION}`, W - M, H - 20, {
        align: 'right',
        baseline: 'middle',
      })
    }
  }

  let y = contentTop
  const newPage = () => {
    doc.addPage()
    drawHeader()
    y = contentTop
  }
  const ensure = (space) => {
    if (y + space > contentBottom) newPage()
  }

  // ---- section heading (keep keeps this much following content on the page) ----
  const sectionTitle = (text, keep = 0) => {
    ensure(22 + keep)
    font('bold', 11.5)
    setText(C.accentDeep)
    doc.text(text.toUpperCase(), M, y, { baseline: 'middle' })
    setDraw(C.accent)
    doc.setLineWidth(1.2)
    const tw = doc.getTextWidth(text.toUpperCase())
    doc.line(M, y + 9, M + tw, y + 9)
    setDraw(C.line)
    doc.setLineWidth(0.6)
    doc.line(M + tw + 8, y + 9, W - M, y + 9)
    y += 22
  }

  // ---------- build ----------
  drawHeader()

  // Project information
  sectionTitle('Project Information')
  const pinfo = [
    ['Project', T(project.name || '-')],
    ['Prepared by', T(project.engineer || '-')],
    ['Job No.', T(project.job || '-')],
    ['Date', dateStr || '-'],
  ]
  {
    const colW = innerW / 4
    const rowH = 34
    setFill(C.cardFill)
    setDraw(C.cardBorder)
    doc.setLineWidth(0.8)
    doc.roundedRect(M, y, innerW, rowH, 5, 5, 'FD')
    pinfo.forEach((kv, i) => {
      const x = M + i * colW
      if (i > 0) {
        setDraw(C.cardBorder)
        doc.line(x, y + 6, x, y + rowH - 6)
      }
      font('normal', 7.5)
      setText(C.faint)
      doc.text(kv[0].toUpperCase(), x + 12, y + 12, { baseline: 'middle' })
      font('bold', 10)
      setText(C.ink)
      doc.text(String(kv[1]), x + 12, y + 24, { baseline: 'middle' })
    })
    y += rowH + 18
  }

  // Design summary cards
  sectionTitle('Design Summary')
  {
    const spacingText =
      Math.abs(meta.spacingX - meta.spacingZ) < 0.05
        ? `${meta.spacingX.toFixed(1)} in`
        : `${meta.spacingX.toFixed(1)} / ${meta.spacingZ.toFixed(1)} in`
    const cards = [
      ['Footing (X x Z)', `${ftIn(footingX)} x ${ftIn(footingZ)}`],
      ['Number of Piles', `${piles.length}`],
      ['Pile Type', pileType],
      ['Pile Size', `${pileSize} in`],
      ['Spacing c/c', spacingText],
      ['Edge Distance', `${meta.edge} in`],
      ['Arrangement', meta.arrangementName],
      ['Design Standard', `AASHTO LRFD${useGdot ? ' + GDOT' : ''}`],
    ]
    const cols = 4
    const gap = 10
    const cardW = (innerW - gap * (cols - 1)) / cols
    const cardH = 50
    cards.forEach((c, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      if (col === 0) ensure(cardH + gap)
      const x = M + col * (cardW + gap)
      const cy = y + row * (cardH + gap)
      setFill(C.cardFill)
      setDraw(C.cardBorder)
      doc.setLineWidth(0.8)
      doc.roundedRect(x, cy, cardW, cardH, 6, 6, 'FD')
      setFill(C.accent)
      doc.roundedRect(x, cy, 3.5, cardH, 1.5, 1.5, 'F')
      font('normal', 7.5)
      setText(C.sub)
      doc.text(c[0].toUpperCase(), x + 12, cy + 16, { baseline: 'middle' })
      const { size, lines } = fitValue(T(String(c[1])), cardW - 20)
      setText(C.ink)
      const startY = cy + (lines.length === 1 ? 33 : 28)
      lines.forEach((ln, k) => {
        doc.text(ln, x + 12, startY + k * (size + 1.5), { baseline: 'middle' })
      })
    })
    y += Math.ceil(cards.length / cols) * (cardH + gap) + 8
  }

  // Pile cap figure
  const figH = 360
  sectionTitle('Pile Cap Layout', figH + 4)
  {
    const boxX = M
    const boxY = y
    const boxW = innerW
    const boxH = figH
    setFill(C.white)
    setDraw(C.cardBorder)
    doc.setLineWidth(0.8)
    doc.roundedRect(boxX, boxY, boxW, boxH, 6, 6, 'FD')
    drawFigure(doc, {
      piles,
      footingX,
      footingZ,
      pileType,
      box: { x: boxX + 14, y: boxY + 12, w: boxW - 28, h: boxH - 40 },
      C,
      font,
      setFill,
      setDraw,
      setText,
    })
    // figure title block
    const tbY = boxY + boxH - 22
    setDraw(C.cardBorder)
    doc.setLineWidth(0.6)
    doc.line(boxX + 10, tbY, boxX + boxW - 10, tbY)
    font('bold', 8.5)
    setText(C.ink)
    doc.text('Figure 1  ·  Pile Cap Plan', boxX + 14, tbY + 12, { baseline: 'middle' })
    font('normal', 8)
    setText(C.sub)
    doc.text('Units: inches', boxX + boxW / 2, tbY + 12, { align: 'center', baseline: 'middle' })
    doc.text('Scale: NTS', boxX + boxW - 14, tbY + 12, { align: 'right', baseline: 'middle' })
    y += boxH + 16
  }

  // Coordinate table
  {
    const headers = ['Pile', 'X (in)', 'Z (in)']
    const colW = [innerW * 0.3, innerW * 0.35, innerW * 0.35]
    const bounds = [M, M + colW[0], M + colW[0] + colW[1], M + innerW]
    const rowH = 18
    const cellBorders = () => {
      setDraw(C.line)
      doc.setLineWidth(0.5)
      bounds.forEach((bx) => doc.line(bx, y, bx, y + rowH))
      doc.line(M, y + rowH, M + innerW, y + rowH)
    }
    const drawTableHead = () => {
      setFill(C.accentDeep)
      doc.rect(M, y, innerW, rowH, 'F')
      font('bold', 9)
      setText(C.white)
      headers.forEach((htxt, i) => {
        doc.text(htxt, bounds[i] + colW[i] / 2, y + rowH / 2, { align: 'center', baseline: 'middle' })
      })
      cellBorders()
      y += rowH
    }
    sectionTitle('Pile Coordinates', rowH * 5)
    drawTableHead()
    piles.forEach((p, idx) => {
      if (y + rowH > contentBottom) {
        newPage()
        drawTableHead()
      }
      if (idx % 2 === 1) {
        setFill(C.zebra)
        doc.rect(M, y, innerW, rowH, 'F')
      }
      const vals = [`${p.n}`, fmt(p.x), fmt(p.z)]
      vals.forEach((v, i) => {
        if (i === 0) {
          font('bold', 9)
          setText(C.accentDeep)
        } else {
          font('normal', 9)
          setText(C.ink)
        }
        doc.text(v, bounds[i] + colW[i] / 2, y + rowH / 2, { align: 'center', baseline: 'middle' })
      })
      cellBorders()
      y += rowH
    })
    y += 16
  }

  // Code compliance checklist
  sectionTitle('Code Compliance', 28)
  {
    const rowH = 24
    compliance.forEach((chk) => {
      ensure(rowH + 5)
      const col =
        chk.status === 'met' ? C.green : chk.status === 'fail' ? C.red : C.amber
      const statusText =
        chk.status === 'met' ? 'PASS' : chk.status === 'fail' ? 'FAIL' : 'REVIEW'
      // row card
      setFill(C.white)
      setDraw(C.cardBorder)
      doc.setLineWidth(0.6)
      doc.roundedRect(M, y, innerW, rowH, 4, 4, 'S')
      // mark circle with a vector check / cross / bang
      const mcx = M + 14
      const mcy = y + rowH / 2
      setFill(col)
      doc.circle(mcx, mcy, 6, 'F')
      setDraw(C.white)
      doc.setLineWidth(1.3)
      if (chk.status === 'met') {
        doc.line(mcx - 3, mcy + 0.3, mcx - 1, mcy + 2.6)
        doc.line(mcx - 1, mcy + 2.6, mcx + 3.2, mcy - 2.4)
      } else if (chk.status === 'fail') {
        doc.line(mcx - 2.6, mcy - 2.6, mcx + 2.6, mcy + 2.6)
        doc.line(mcx + 2.6, mcy - 2.6, mcx - 2.6, mcy + 2.6)
      } else {
        doc.line(mcx, mcy - 2.8, mcx, mcy + 1)
        setFill(C.white)
        doc.circle(mcx, mcy + 2.9, 0.7, 'F')
      }
      font('bold', 8.5)
      setText(C.faint)
      doc.text(chk.code, M + 28, y + rowH / 2, { baseline: 'middle' })
      font('bold', 9)
      setText(C.ink)
      const label = doc.splitTextToSize(T(chk.label), innerW * 0.56)
      doc.text(label[0], M + 64, y + rowH / 2 - 4, { baseline: 'middle' })
      font('normal', 7.5)
      setText(C.sub)
      doc.text(T(`${chk.clause}  ·  ${chk.actual}`), M + 64, y + rowH / 2 + 7, { baseline: 'middle' })
      // status badge
      setFill(col)
      const badgeW = 46
      doc.roundedRect(W - M - badgeW - 6, y + rowH / 2 - 8, badgeW, 16, 8, 8, 'F')
      setText(C.white)
      font('bold', 8)
      doc.text(statusText, W - M - badgeW / 2 - 6, y + rowH / 2, { align: 'center', baseline: 'middle' })
      y += rowH + 5
    })
    y += 8
  }

  // Notes
  sectionTitle('Notes', 40)
  {
    const notes = [
      'Coordinates are in inches in the LEAP RC-PIER convention: origin at the mid-left of the footing, X positive to the right, Z positive downward.',
      'Center-to-center pile spacing satisfies AASHTO LRFD 10.7.1.2: the greater of 30 in or 2.5 times the pile width.',
      'Pile side to nearest footing edge exceeds the 9 in AASHTO minimum.',
      useGdot
        ? 'GDOT Bridge & Structures Design Manual (Appendix 4B) provisions are applied as an optional overlay.'
        : 'GDOT provisions were not applied to this layout.',
      'This is a geometric layout check; pile axial/lateral capacity, group effects, and cap reinforcement are not included.',
      'Verify all dimensions against the contract drawings before construction.',
    ]
    font('normal', 8.5)
    notes.forEach((n, i) => {
      const lines = doc.splitTextToSize(n, innerW - 18)
      ensure(lines.length * 11 + 4)
      setFill(C.accent)
      doc.circle(M + 4, y + 4, 1.6, 'F')
      setText(C.sub)
      font('bold', 8.5)
      doc.text(`${i + 1}.`, M + 10, y + 4, { baseline: 'middle' })
      font('normal', 8.5)
      doc.text(lines, M + 24, y + 4, { baseline: 'middle' })
      y += lines.length * 11 + 5
    })
  }

  stampFooters()

  if (data.save !== false) {
    const safe = (project.name || 'pile-cap-layout')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
    doc.save(`${safe}-report.pdf`)
  }
  return doc
}

// ---- the pile-cap figure, drawn as vector to match the on-screen diagram ----
function drawFigure(doc, opts) {
  const { piles, footingX, footingZ, pileType, box, C, setFill, setDraw, setText } = opts
  const span = Math.max(footingX, footingZ)
  const pad = span * 0.2
  const Ww = footingX + 2 * pad
  const Hw = footingZ + 2 * pad
  const s = Math.min(box.w / Ww, box.h / Hw)
  const dw = Ww * s
  const dh = Hw * s
  const offX = box.x + (box.w - dw) / 2
  const offY = box.y + (box.h - dh) / 2
  const px = (wx) => offX + wx * s
  const py = (wy) => offY + wy * s

  const ox = pad
  const oz = pad + footingZ / 2
  const fs = Math.max(6, span * 0.04 * s) // pt

  // nearest-neighbour marker size
  let minDist = Infinity
  for (let i = 0; i < piles.length; i += 1) {
    for (let j = i + 1; j < piles.length; j += 1) {
      const d = Math.hypot(piles[i].x - piles[j].x, piles[i].z - piles[j].z)
      if (d < minDist) minDist = d
    }
  }
  if (!Number.isFinite(minDist)) minDist = span * 0.3
  const mk = Math.max(span * 0.05, Math.min(span * 0.13, minDist * 0.52)) * s // pt

  const isH = /h-?pile/i.test(pileType)
  const isRound = /shell|pipe|round/i.test(pileType)

  // footing
  setFill(C.white)
  setDraw(C.foundation)
  doc.setLineWidth(1.6)
  doc.roundedRect(px(pad), py(pad), footingX * s, footingZ * s, 4, 4, 'FD')

  // light interior grid every 12 in
  setDraw(C.gridline)
  doc.setLineWidth(0.4)
  for (let gx = 12; gx < footingX; gx += 12) {
    doc.line(px(pad + gx), py(pad), px(pad + gx), py(pad + footingZ))
  }
  for (let gz = 12; gz < footingZ; gz += 12) {
    doc.line(px(pad), py(pad + gz), px(pad + footingX), py(pad + gz))
  }

  // dimensions
  drawDim(doc, opts, px(pad), px(pad + footingX), py(pad + footingZ) + pad * 0.42 * s, false, ftIn(footingX), fs)
  drawDim(doc, opts, py(pad), py(pad + footingZ), px(pad) - pad * 0.42 * s, true, ftIn(footingZ), fs)

  // axes
  const axisLen = Math.min(footingX, footingZ) * 0.26 * s
  const aox = px(ox)
  const aoz = py(oz)
  setDraw(C.red)
  doc.setLineWidth(1.6)
  doc.line(aox, aoz, aox + axisLen, aoz)
  doc.line(aox, aoz, aox, aoz + axisLen)
  setFill(C.red)
  const ah = fs * 0.8
  doc.triangle(aox + axisLen + ah * 0.5, aoz, aox + axisLen - ah * 0.4, aoz - ah * 0.5, aox + axisLen - ah * 0.4, aoz + ah * 0.5, 'F')
  doc.triangle(aox, aoz + axisLen + ah * 0.5, aox - ah * 0.5, aoz + axisLen - ah * 0.4, aox + ah * 0.5, aoz + axisLen - ah * 0.4, 'F')
  const br = fs * 0.85
  doc.circle(aox + axisLen + br * 1.7, aoz, br, 'F')
  doc.circle(aox, aoz + axisLen + br * 1.7, br, 'F')
  setText(C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fs * 0.95)
  doc.text('X', aox + axisLen + br * 1.7, aoz, { align: 'center', baseline: 'middle' })
  doc.text('Z', aox, aoz + axisLen + br * 1.7, { align: 'center', baseline: 'middle' })

  // centroid
  const cgx = px(ox + piles.reduce((a, p) => a + p.x, 0) / piles.length)
  const cgy = py(oz + piles.reduce((a, p) => a + p.z, 0) / piles.length)
  const cs = fs * 0.95
  setDraw([122, 135, 150])
  doc.setLineWidth(1)
  doc.line(cgx - cs, cgy, cgx + cs, cgy)
  doc.line(cgx, cgy - cs, cgx, cgy + cs)
  setFill([229, 57, 53])
  doc.circle(cgx, cgy, cs * 0.26, 'F')

  // piles
  piles.forEach((p) => {
    const x = px(ox + p.x)
    const z = py(oz + p.z)
    const r = mk / 2
    setFill(C.accent)
    setDraw(C.accentDeep)
    doc.setLineWidth(1)
    if (isRound) {
      doc.circle(x, z, r, 'FD')
    } else {
      doc.roundedRect(x - r, z - r, mk, mk, mk * 0.2, mk * 0.2, 'FD')
    }
    if (isH) {
      setDraw(C.white)
      doc.setLineWidth(Math.max(0.8, mk * 0.08))
      doc.line(x - r * 0.5, z - r * 0.55, x - r * 0.5, z + r * 0.55)
      doc.line(x + r * 0.5, z - r * 0.55, x + r * 0.5, z + r * 0.55)
      doc.line(x - r * 0.5, z, x + r * 0.5, z)
    }
    // number pill above
    const label = `${p.n}`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fs * 0.95)
    const tw = doc.getTextWidth(label)
    const pillW = Math.max(mk * 0.8, tw + fs * 0.9)
    const pillH = fs * 1.4
    const pillY = z - r - pillH * 1.3
    setFill(C.white)
    setDraw(C.cardBorder)
    doc.setLineWidth(0.7)
    doc.roundedRect(x - pillW / 2, pillY, pillW, pillH, pillH / 2, pillH / 2, 'FD')
    setText(C.ink)
    doc.text(label, x, pillY + pillH / 2, { align: 'center', baseline: 'middle' })
  })
}

function drawDim(doc, opts, a, b, off, vertical, label, fs) {
  const { C, setDraw, setFill, setText } = opts
  const head = fs * 0.5
  const mid = (a + b) / 2
  setDraw(C.faint)
  doc.setLineWidth(0.7)
  setFill(C.faint)
  if (vertical) {
    const x = off
    doc.line(x, a, x + fs * 1.1, a)
    doc.line(x, b, x + fs * 1.1, b)
    doc.line(x, a, x, b)
    doc.triangle(x, a, x - head * 0.55, a + head, x + head * 0.55, a + head, 'F')
    doc.triangle(x, b, x - head * 0.55, b - head, x + head * 0.55, b - head, 'F')
    // boxed label, rotated to read along Z
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fs * 0.9)
    const tw = doc.getTextWidth(label)
    const bw = tw + fs * 0.7
    const bh = fs * 1.4
    setFill(C.white)
    setDraw(C.cardBorder)
    doc.setLineWidth(0.6)
    // rotated rect approximated by drawing then text; jsPDF rect cannot rotate,
    // so draw an unrotated box sized for vertical text (bh wide x bw tall).
    doc.roundedRect(x - bh / 2, mid - bw / 2, bh, bw, 2, 2, 'FD')
    setText(C.sub)
    doc.text(label, x, mid, { align: 'center', baseline: 'middle', angle: 90 })
    return
  }
  const yy = off
  doc.line(a, yy, a, yy - fs * 1.1)
  doc.line(b, yy, b, yy - fs * 1.1)
  doc.line(a, yy, b, yy)
  doc.triangle(a, yy, a + head, yy - head * 0.55, a + head, yy + head * 0.55, 'F')
  doc.triangle(b, yy, b - head, yy - head * 0.55, b - head, yy + head * 0.55, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fs * 0.9)
  const tw = doc.getTextWidth(label)
  const bw = tw + fs * 0.9
  const bh = fs * 1.4
  setFill(C.white)
  setDraw(C.cardBorder)
  doc.setLineWidth(0.6)
  doc.roundedRect(mid - bw / 2, yy - bh / 2, bw, bh, 2, 2, 'FD')
  setText(C.sub)
  doc.text(label, mid, yy, { align: 'center', baseline: 'middle' })
}
