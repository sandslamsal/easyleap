// Integration test: run the real LEAP PDFs through pdf.js + the pure parser.
// Usage: node scripts/test-superstructure-parser.mjs <dir-with-pdfs>
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  getDocument,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  parsePagesTextItems,
  buildFileTable,
  buildEnvelopeTable,
} from '../src/utils/superstructureParser.js'

const dir = process.argv[2]
if (!dir) {
  console.error('Pass the directory containing the PDFs.')
  process.exit(1)
}

async function extractPages(path) {
  const data = new Uint8Array(readFileSync(path))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const pages = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    pages.push(content.items)
  }
  return pages
}

const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'))
const fileTables = []

for (const file of files) {
  const pages = await extractPages(join(dir, file))
  const envelopes = parsePagesTextItems(pages)
  const table = buildFileTable(envelopes)
  fileTables.push({ file, table })
  console.log(`\n=== ${file} ===`)
  console.log('beams:', table.beams.map((b) => b.label).join(', '))
  for (const label of table.labels) {
    const cells = table.beams.map(
      (b) => table.values.get(`${b.key}::${label}`) ?? '-',
    )
    console.log(`  ${label.padEnd(22)} ${cells.join('  ')}`)
  }
}

const envelope = buildEnvelopeTable(fileTables.map((f) => f.table))
console.log('\n=== MAX ENVELOPE (across files) ===')
console.log('beams:', envelope.beams.map((b) => b.label).join(', '))
for (const label of envelope.labels) {
  const cells = envelope.beams.map(
    (b) => envelope.values.get(`${b.key}::${label}`) ?? '-',
  )
  console.log(`  ${label.padEnd(22)} ${cells.join('  ')}`)
}

// Assertion against the known Final A / Beam 1 values from the source PDF.
const finalA = fileTables.find((f) => /Final A/i.test(f.file))
if (finalA) {
  const t = finalA.table
  const b1 = t.beams.find((b) => b.beam === 1)?.key
  const expected = {
    'Self wt. (Max)': 69.6,
    'DL-Prec. DC(Max)': 14.3,
    'DL-Prec. DW(Max)': 0.0,
    'Deck + Haunch (Max)': 37.2,
    'Diaphragm (Max)': 8.6,
    'DL-Comp DC(Max)': 10.4,
    'DL-Comp DW(Max)': 7.1,
  }
  let ok = true
  for (const [label, value] of Object.entries(expected)) {
    const got = t.values.get(`${b1}::${label}`)
    if (got !== value) {
      ok = false
      console.log(`MISMATCH ${label}: expected ${value}, got ${got}`)
    }
  }
  console.log(`\nFinal A Beam 1 assertion: ${ok ? 'PASS ✅' : 'FAIL ❌'}`)
  process.exit(ok ? 0 : 1)
}
