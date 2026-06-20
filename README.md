# LEAP Load TXT Builder

A single-page React app for bridge engineers, with two tools selectable from the
toggle in the top-left:

1. **LEAP Load TXT Builder** — assemble LEAP RC-PIER import text files from
   manually pasted datasets (the original tool, described below).
2. **Superstructure Loads** — drop one or more LEAP superstructure analysis
   report PDFs and extract the dead-load bearing reactions per beam.

## Superstructure Loads (PDF reaction extractor)

Drop one or more LEAP "Shear and Moment Envelope" report PDFs. Each file is
parsed entirely in your browser (nothing is uploaded). For every beam, the tool
reads the **SERVICE I** envelope and extracts the shear `V` at the **Bearing**
station (the unfactored dead-load reaction) for each dead-load component:

- Self wt. (Max)
- DL-Prec. DC(Max)
- DL-Prec. DW(Max)
- Deck + Haunch (Max)
- Diaphragm (Max)
- DL-Comp DC(Max)
- DL-Comp DW(Max)

It produces one table per file (loads x beams) plus a **Max Envelope** table that
takes the governing maximum across all dropped files. Results can be copied
(tab-separated, ready to paste into Excel) or downloaded as a `.xlsx` workbook.

Pages are scanned dynamically by header, so the number of beams/spans and the
page positions can vary between reports. Mirrored beam pages (where the bearing
is the right-most station) are handled automatically.

## LEAP Load TXT Builder (text file assembler)

This tool assembles LEAP RC-PIER import text files from manually pasted
datasets.

The app accepts three separate inputs:

- Bearing Loads
- Column Loads
- Cap Loads

Users can paste copied rows from Excel, TXT files, PDFs, or other tables directly into the browser. The app normalizes formatting, validates rows, previews the combined output, and lets the user copy or download the final `.txt` file.

## Features

- Large paste areas for bearing, column, and cap load data
- Robust parsing for comma-delimited, tab-delimited, and whitespace-delimited rows
- Row-level validation feedback with invalid line reporting
- Automatic uppercase normalization for load directions
- Optional support for a fifth bearing tag value such as `T` or `L`
- LEAP-style preview with exact section headings
- Copy-to-clipboard and `.txt` download actions
- Responsive UI for desktop and mobile

## Tech Stack

- React
- Vite
- Lucide React
- pdf.js (`pdfjs-dist`) for in-browser PDF text extraction
- SheetJS (`xlsx`) for Excel export

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Notes

- The optional load case / description field is shown in the UI for workflow context and is not written into the exported TXT file.
- Empty sections are allowed and are omitted from the export with a visible warning.
- Engineers should still verify LEAP-specific syntax and intent before import.
