// Premium engineering PDF report for the Superstructure bearing-reaction
// extractor. It uses the exact same EasyLEAP report chrome (branded header with
// the optional logo, footer, section titles) as the Pile Cap report, so the two
// modules share one template. Everything is drawn with jsPDF vector primitives
// with selectable text; the module takes plain data and has no DOM dependency.

import {
  C,
  T,
  drawHeader as drawReportHeader,
  stampFooters as stampReportFooters,
} from './reportChrome.js'
import { LOAD_CASE_DEFS } from './loadCases.js'
import { formatValue } from './exportReactions.js'

const baseName = (name) => name.replace(/\.pdf$/i, '')

export async function generateSuperstructurePdf(data) {
  const { jsPDF } = await import('jspdf')
  const {
    files = [],
    envelopeTable,
    caseSpans = [],
    multiSpan = false,
    bothSides = false,
    project = {},
    pageSize = 'letter',
    dateStr = '',
    includeLogo = true,
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

  // ---- shared EasyLEAP chrome ----
  const drawHeaderBand = () =>
    drawReportHeader(doc, {
      W,
      M,
      includeLogo,
      subtitle: 'Superstructure Loads',
      title: 'BEARING REACTION REPORT',
      reference: 'SERVICE I  ·  LEAP RC-PIER',
    })
  const stampFooters = () =>
    stampReportFooters(doc, {
      W,
      H,
      M,
      dateStr,
      label: 'EasyLEAP  ·  Superstructure Loads',
    })

  let y = contentTop
  const newPage = () => {
    doc.addPage()
    drawHeaderBand()
    y = contentTop
  }
  const ensure = (space) => {
    if (y + space > contentBottom) newPage()
  }

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

  const subHeading = (text, accent = false) => {
    ensure(20)
    font('bold', 9.5)
    setText(accent ? C.accentDeep : C.ink)
    doc.text(T(text), M, y, { baseline: 'middle' })
    y += 14
  }

  // Generic zebra data table: first column is a left-aligned label, the rest
  // are centered numeric columns; header repeats after a page break.
  const drawTable = (headers, rows) => {
    const n = headers.length
    const firstW = innerW * Math.min(0.34, Math.max(0.18, 1.7 / n))
    const dataW = (innerW - firstW) / (n - 1)
    const colW = [firstW, ...Array(n - 1).fill(dataW)]
    const bounds = [M]
    colW.forEach((w) => bounds.push(bounds[bounds.length - 1] + w))
    const rowH = 17

    const cellBorders = () => {
      setDraw(C.line)
      doc.setLineWidth(0.5)
      bounds.forEach((bx) => doc.line(bx, y, bx, y + rowH))
      doc.line(M, y + rowH, M + innerW, y + rowH)
    }
    const drawHead = () => {
      setFill(C.accentDeep)
      doc.rect(M, y, innerW, rowH, 'F')
      font('bold', 8.5)
      setText(C.white)
      headers.forEach((h, i) => {
        const left = i === 0
        const tx = left ? bounds[i] + 7 : bounds[i] + colW[i] / 2
        doc.text(T(String(h)), tx, y + rowH / 2, {
          align: left ? 'left' : 'center',
          baseline: 'middle',
        })
      })
      cellBorders()
      y += rowH
    }

    ensure(rowH * 3)
    drawHead()
    rows.forEach((row, idx) => {
      if (y + rowH > contentBottom) {
        newPage()
        drawHead()
      }
      if (idx % 2 === 1) {
        setFill(C.zebra)
        doc.rect(M, y, innerW, rowH, 'F')
      }
      row.forEach((cell, i) => {
        const left = i === 0
        const tx = left ? bounds[i] + 7 : bounds[i] + colW[i] / 2
        if (left) {
          font('bold', 8.5)
          setText(C.accentDeep)
        } else {
          font('normal', 8.5)
          setText(C.ink)
        }
        doc.text(T(String(cell)), tx, y + rowH / 2, {
          align: left ? 'left' : 'center',
          baseline: 'middle',
        })
      })
      cellBorders()
      y += rowH
    })
    y += 14
  }

  // ---- row builders (mirror the on-screen tables) ----
  const reactionRows = (table) =>
    table.labels.map((label) => [
      label,
      ...table.beams.map((beam) => {
        const v = table.values.get(`${beam.key}::${label}`)
        return v === undefined ? '—' : formatValue(v)
      }),
    ])
  const caseRows = (span) =>
    span.beams.map((beam) => [
      beam.label,
      ...LOAD_CASE_DEFS.map((def) =>
        formatValue(span.totals.get(`${beam.key}::${def.key}`) ?? 0),
      ),
    ])

  // ---------- build ----------
  drawHeaderBand()

  // Project information (identical card to the Pile Cap report)
  sectionTitle('Project Information')
  {
    const pinfo = [
      ['Project', T(project.name || '-')],
      ['Prepared by', T(project.engineer || '-')],
      ['Job No.', T(project.job || '-')],
      ['Date', dateStr || '-'],
    ]
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

  // Report summary cards
  sectionTitle('Report Summary')
  {
    const cards = [
      ['Source Files', `${files.length}`],
      ['Beams', `${envelopeTable?.beams?.length ?? 0}`],
      ['Spans', `${caseSpans.length}`],
      ['Bearing Lines', `${multiSpan ? caseSpans.length : bothSides ? 2 : 1}`],
    ]
    const cols = 4
    const gap = 10
    const cardW = (innerW - gap * (cols - 1)) / cols
    const cardH = 50
    ensure(cardH + gap)
    cards.forEach((c, i) => {
      const x = M + i * (cardW + gap)
      setFill(C.cardFill)
      setDraw(C.cardBorder)
      doc.setLineWidth(0.8)
      doc.roundedRect(x, y, cardW, cardH, 6, 6, 'FD')
      setFill(C.accent)
      doc.roundedRect(x, y, 3.5, cardH, 1.5, 1.5, 'F')
      font('normal', 7.5)
      setText(C.sub)
      doc.text(c[0].toUpperCase(), x + 12, y + 16, { baseline: 'middle' })
      let sz = 11
      const maxW = cardW - 20
      font('bold', sz)
      while (doc.getTextWidth(String(c[1])) > maxW && sz > 7.5) {
        sz -= 0.5
        font('bold', sz)
      }
      setText(C.ink)
      doc.text(String(c[1]), x + 12, y + 33, { baseline: 'middle' })
    })
    y += cardH + 16
  }

  // Extracted bearing reactions (per source file) + governing envelope
  sectionTitle('Extracted Bearing Reactions', 60)
  files.forEach((file) => {
    subHeading(`${baseName(file.name)}  -  Span ${file.span ?? 1}`)
    const headers = [
      'Load Component',
      ...file.result.table.beams.map((b) => b.label),
    ]
    drawTable(headers, reactionRows(file.result.table))
  })
  if (envelopeTable?.beams?.length) {
    subHeading('Max Envelope  -  governing across files', true)
    drawTable(
      ['Load Component', ...envelopeTable.beams.map((b) => b.label)],
      reactionRows(envelopeTable),
    )
  }

  // LEAP load cases per span / bearing line
  sectionTitle('LEAP Load Cases (DC1 / DC2 / DC / DW)', 60)
  caseSpans.forEach((span) => {
    let heading
    if (multiSpan) {
      heading = `Span ${span.tag}  -  bearing line ${span.line}`
    } else if (bothSides) {
      // "Both sides of cap" duplicates the same reactions onto the next line.
      heading = `Per-beam case totals  -  both sides of cap, bearing lines ${span.line} & ${span.line + 1}`
    } else {
      heading = `Per-beam case totals  -  bearing line ${span.line}`
    }
    subHeading(`${heading}  (${span.fileCount} file(s))`)
    drawTable(['Beam', ...LOAD_CASE_DEFS.map((d) => d.label)], caseRows(span))
  })

  // Notes
  sectionTitle('Notes', 40)
  {
    const notes = [
      'Reactions are the unfactored SERVICE I dead-load shear (V) at each bearing, in kips, extracted from the LEAP RC-PIER superstructure analysis report(s).',
      'The Max Envelope is the governing (maximum) reaction for each load component across all imported stage files.',
      'Load cases group the reactions into substructure dead-load demands: DC = DC1 (non-composite) + DC2 (composite), and DW (wearing surface / utilities), per beam and bearing line.',
      'Case values are applied downward (negative Y) in the LEAP substructure model; signs follow the exported bearing-loads import files.',
      'Verify beam numbering and bearing-line assignment against the contract drawings before importing into the substructure model.',
    ]
    font('normal', 8.5)
    notes.forEach((note, i) => {
      const lines = doc.splitTextToSize(note, innerW - 18)
      ensure(lines.length * 11 + 5)
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
    const safe = (project.name || 'superstructure-bearing-reactions')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
    doc.save(`${safe}-report.pdf`)
  }
  return doc
}
