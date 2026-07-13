// Shared EasyLEAP PDF report "chrome": the palette, the WinAnsi-safe text
// sanitizer, and the branded header band (with an optional logo) + footer that
// every EasyLEAP report draws. Keeping this in one place is what makes the Pile
// Cap and Superstructure reports share the exact same template and logo
// placement — change the brand here once and both reports follow.

export const APP_VERSION = '1.0'
export const APP_URL = 'sandeshlamsal.com/apps'

// ---- palette (RGB) ----
export const C = {
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

export const ftIn = (inches) => {
  const ft = Math.floor(inches / 12)
  const rem = Math.round(inches - ft * 12)
  return `${ft}'-${rem}"`
}

export const fmt = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(2))

// jsPDF's standard fonts use WinAnsi encoding; map the few non-ASCII symbols
// that appear in labels to safe equivalents so they render.
export const T = (s) =>
  String(s)
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[—–]/g, '-')
    .replace(/×/g, 'x')
    .replace(/≈/g, '~')

// Draw the repeating header band. When `includeLogo` is false the white logo
// mark and "EasyLEAP" wordmark are omitted and the report title left-aligns in
// the band instead — matching the Vessel Impact / Wave Load reports so the
// with/without-logo option behaves identically across the apps.
export function drawHeader(doc, opts) {
  const {
    W,
    M,
    includeLogo = true,
    subtitle = '',
    title = '',
    reference = '',
  } = opts
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2])
  const font = (style = 'normal', size = 10) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }

  setFill(C.band)
  doc.rect(0, 0, W, 58, 'F')
  setFill(C.bandAccent)
  doc.rect(0, 58, W, 3, 'F')

  if (includeLogo) {
    // logo mark: rounded white square with the EasyLEAP pile glyph
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
    if (subtitle) {
      font('normal', 8.5)
      doc.setTextColor(206, 219, 245)
      doc.text(subtitle, M + 36, 42, { baseline: 'middle' })
    }
    // right block
    setText(C.white)
    font('bold', 12)
    doc.text(title, W - M, 25, { align: 'right', baseline: 'middle' })
    if (reference) {
      font('normal', 8.5)
      doc.setTextColor(206, 219, 245)
      doc.text(reference, W - M, 40, { align: 'right', baseline: 'middle' })
    }
  } else {
    // no logo: the report title carries the band, left-aligned
    setText(C.white)
    font('bold', 13)
    doc.text(title, M, 25, { baseline: 'middle' })
    if (reference) {
      font('normal', 8.5)
      doc.setTextColor(206, 219, 245)
      doc.text(reference, M, 41, { baseline: 'middle' })
    }
  }
}

// Footer text is stamped after the total page count is known.
export function stampFooters(doc, opts) {
  const { W, H, M, dateStr = '', label = '', version = APP_VERSION } = opts
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2])
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p)
    setDraw(C.line)
    doc.setLineWidth(0.6)
    doc.line(M, H - 30, W - M, H - 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setText(C.faint)
    doc.text(label, M, H - 20, { baseline: 'middle' })
    if (dateStr) {
      doc.text(dateStr, W / 2, H - 20, { align: 'center', baseline: 'middle' })
    }
    doc.text(`Page ${p} of ${total}  ·  v${version}`, W - M, H - 20, {
      align: 'right',
      baseline: 'middle',
    })
  }
}
