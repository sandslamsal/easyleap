# LEAP Load TXT Builder

LEAP Load TXT Builder is a single-page React app for bridge engineers who need to assemble LEAP RC-PIER import text files from manually pasted datasets.

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
