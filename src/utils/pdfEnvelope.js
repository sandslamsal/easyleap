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
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pagesItems.push(content.items)
      page.cleanup()
    }

    const envelopes = parsePagesTextItems(pagesItems)
    const table = buildFileTable(envelopes)

    return {
      name: file.name,
      pageCount: doc.numPages,
      beamCount: table.beams.length,
      envelopes,
      table,
    }
  } finally {
    doc.destroy()
  }
}
