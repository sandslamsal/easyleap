const NUMBER_PATTERN = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/
const DIRECTION_PATTERN = /^[XYZ]$/i

const cleanToken = (token) =>
  token
    .replace(/\u00a0/g, ' ')
    .replace(/[|]+/g, ' ')
    .trim()

const isNumericToken = (token) => NUMBER_PATTERN.test(token)
const isDirectionToken = (token) => DIRECTION_PATTERN.test(token)

function tokenizeRow(rawLine) {
  const line = cleanToken(rawLine)

  if (!line) {
    return []
  }

  // Favor explicit delimiters first, then progressively relax to whitespace.
  if (line.includes(',')) {
    return line
      .split(/\s*,\s*/)
      .map(cleanToken)
      .filter(Boolean)
  }

  if (line.includes('\t')) {
    return line
      .split(/\t+/)
      .map(cleanToken)
      .filter(Boolean)
  }

  if (/\s{2,}/.test(line)) {
    return line
      .split(/\s{2,}/)
      .map(cleanToken)
      .filter(Boolean)
  }

  return line
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean)
}

function parseRows(text, rowParser) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const validRows = []
  const invalidRows = []
  let sourceRowCount = 0

  lines.forEach((rawLine, index) => {
    if (!rawLine.trim()) {
      return
    }

    sourceRowCount += 1

    const tokens = tokenizeRow(rawLine)
    const parsedRow = rowParser(tokens)

    if (parsedRow.error) {
      invalidRows.push({
        lineNumber: index + 1,
        rawLine: rawLine.trim(),
        error: parsedRow.error,
      })
      return
    }

    validRows.push({
      lineNumber: index + 1,
      rawLine: rawLine.trim(),
      normalized: parsedRow.normalized,
    })
  })

  return {
    sourceRowCount,
    validRows,
    invalidRows,
  }
}

function parseBearingRow(tokens) {
  if (tokens.length < 4) {
    return {
      error:
        'Expected bearing line, bearing point number, direction, and load value.',
    }
  }

  if (tokens.length > 5) {
    return {
      error: 'Bearing rows can contain four values plus one optional tag only.',
    }
  }

  const [bearingLine, bearingPoint, direction, loadValue, tag] = tokens

  if (!isNumericToken(bearingLine)) {
    return { error: 'Bearing line must be numeric.' }
  }

  if (!isNumericToken(bearingPoint)) {
    return { error: 'Bearing point number must be numeric.' }
  }

  if (!isDirectionToken(direction)) {
    return { error: 'Bearing direction must be X, Y, or Z.' }
  }

  if (!isNumericToken(loadValue)) {
    return { error: 'Bearing load value must be numeric.' }
  }

  const normalizedTokens = [
    bearingLine,
    bearingPoint,
    direction.toUpperCase(),
    loadValue,
  ]

  if (tag) {
    normalizedTokens.push(tag.toUpperCase())
  }

  return {
    normalized: normalizedTokens.join(', '),
  }
}

function parseColumnRow(tokens) {
  if (tokens.length < 4) {
    return {
      error:
        'Expected column number, load type, direction, and at least one value.',
    }
  }

  const [columnNumber] = tokens
  const directionIndex = tokens.findIndex(
    (token, index) => index >= 2 && isDirectionToken(token),
  )

  if (!isNumericToken(columnNumber)) {
    return { error: 'Column number must be numeric.' }
  }

  if (directionIndex === -1) {
    return { error: 'Column row must include an X, Y, or Z direction value.' }
  }

  const loadType = tokens.slice(1, directionIndex).join(' ').trim()
  const direction = tokens[directionIndex]
  const values = tokens.slice(directionIndex + 1)

  if (!loadType) {
    return { error: 'Column load type is missing.' }
  }

  if (values.length === 0) {
    return { error: 'Column rows need at least one numeric value after direction.' }
  }

  if (values.some((value) => !isNumericToken(value))) {
    return { error: 'Column load values after direction must be numeric.' }
  }

  return {
    normalized: [columnNumber, loadType, direction.toUpperCase(), ...values].join(
      ', ',
    ),
  }
}

function parseCapRow(tokens) {
  if (tokens.length < 3) {
    return {
      error: 'Expected load type, direction, and at least one value.',
    }
  }

  const directionIndex = tokens.findIndex(
    (token, index) => index >= 1 && isDirectionToken(token),
  )

  if (directionIndex === -1) {
    return { error: 'Cap row must include an X, Y, or Z direction value.' }
  }

  const loadType = tokens.slice(0, directionIndex).join(' ').trim()
  const direction = tokens[directionIndex]
  const values = tokens.slice(directionIndex + 1)

  if (!loadType) {
    return { error: 'Cap load type is missing.' }
  }

  if (values.length === 0) {
    return { error: 'Cap rows need at least one numeric value after direction.' }
  }

  if (values.some((value) => !isNumericToken(value))) {
    return { error: 'Cap load values after direction must be numeric.' }
  }

  return {
    normalized: [loadType, direction.toUpperCase(), ...values].join(', '),
  }
}

export function parseBearingLoads(text) {
  return parseRows(text, parseBearingRow)
}

export function parseColumnLoads(text) {
  return parseRows(text, parseColumnRow)
}

export function parseCapLoads(text) {
  return parseRows(text, parseCapRow)
}

export function buildLeapTxt(results) {
  const sections = [
    {
      label: 'Bearing Loads',
      heading: 'Bearing loads',
      rows: results.bearing.validRows.map((row) => row.normalized),
      sourceRowCount: results.bearing.sourceRowCount,
      invalidCount: results.bearing.invalidRows.length,
    },
    {
      label: 'Column Loads',
      heading: 'Column Loads',
      rows: results.column.validRows.map((row) => row.normalized),
      sourceRowCount: results.column.sourceRowCount,
      invalidCount: results.column.invalidRows.length,
    },
    {
      label: 'Cap Loads',
      heading: 'Cap Loads',
      rows: results.cap.validRows.map((row) => row.normalized),
      sourceRowCount: results.cap.sourceRowCount,
      invalidCount: results.cap.invalidRows.length,
    },
  ]

  const includedSections = sections.filter((section) => section.rows.length > 0)
  const warnings = []

  sections.forEach((section) => {
    if (section.sourceRowCount === 0) {
      warnings.push(`${section.label} is empty and was omitted from the export.`)
      return
    }

    if (section.rows.length === 0) {
      warnings.push(
        `${section.label} contains pasted data but no valid rows were parsed.`,
      )
      return
    }

    if (section.invalidCount > 0) {
      warnings.push(
        `${section.label} has ${section.invalidCount} invalid row(s). Only valid rows were included in the export.`,
      )
    }
  })

  return {
    output: includedSections
      .map((section) => [section.heading, ...section.rows].join('\n'))
      .join('\n\n'),
    warnings,
    includedSectionCount: includedSections.length,
    totalValidRows: sections.reduce((sum, section) => sum + section.rows.length, 0),
    totalInvalidRows: sections.reduce(
      (sum, section) => sum + section.invalidCount,
      0,
    ),
  }
}

export function normalizeFileName(fileName) {
  const trimmedName = fileName.trim() || 'leap-loads'
  return /\.txt$/i.test(trimmedName) ? trimmedName : `${trimmedName}.txt`
}
