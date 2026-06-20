// Browser layer: read a PDF File with pdf.js and extract SERVICE I bearing
// reactions using the pure parser in superstructureParser.js.
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  parsePagesTextItems,
  buildFileTable,
} from './superstructureParser.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Extract every page's text items, then parse to envelopes and a file table.
export async function extractBearingReactions(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjsLib.getDocument({ data }).promise

  try {
    const pagesItems = []
    let modelName = ''
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pagesItems.push(content.items)
      // The report footer carries the LEAP model file (e.g.
      // "File Name: SR25_Span2_...lbcx"), a useful span hint.
      if (!modelName) {
        const joined = content.items.map((item) => item.str).join(' ')
        const match = joined.match(/File Name:\s*([^\s]+\.lbcx)/i)
        if (match) {
          modelName = match[1]
        }
      }
      page.cleanup()
    }

    const envelopes = parsePagesTextItems(pagesItems)
    const table = buildFileTable(envelopes)

    return {
      name: file.name,
      modelName,
      pageCount: doc.numPages,
      beamCount: table.beams.length,
      envelopes,
      table,
    }
  } finally {
    doc.destroy()
  }
}
