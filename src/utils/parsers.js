const INTEGER_PATTERN = /^[-+]?\d+$/
const NUMBER_PATTERN = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/
const DIRECTION_PATTERN = /^[XYZ]$/i
const LIVE_LOAD_TAG_PATTERN = /^[TL]$/i

const LOAD_TYPE_CASE_MAP = new Map([
  ['force', 'Force'],
  ['udl', 'UDL'],
  ['pressure', 'Pressure'],
  ['settlement', 'Settlement'],
  ['moment', 'Moment'],
  ['trapezoid', 'Trapezoid'],
  ['trapezoidal', 'Trapezoidal'],
  ['unit strain', 'Unit Strain'],
])

const cleanToken = (token) =>
  token
    .replace(/\u00a0/g, ' ')
    .replace(/[|]+/g, ' ')
    .trim()

const isIntegerToken = (token) => INTEGER_PATTERN.test(token)
const isNumericToken = (token) => NUMBER_PATTERN.test(token)
const isDirectionToken = (token) => DIRECTION_PATTERN.test(token)

const toUpperDirection = (token) => token.toUpperCase()

function normalizeLoadType(loadType) {
  const normalized = loadType.replace(/\s+/g, ' ').trim()
  return LOAD_TYPE_CASE_MAP.get(normalized.toLowerCase()) ?? normalized
}

function applyIntegerRemap(token, remapMap) {
  if (!remapMap || remapMap.size === 0) {
    return token
  }

  return remapMap.get(token) ?? token
}

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

function parseBearingRow(tokens, options = {}) {
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

  const [rawBearingLine, rawBearingPoint, direction, loadValue, tag] = tokens

  if (!isIntegerToken(rawBearingLine)) {
    return { error: 'Bearing line must be an integer.' }
  }

  if (!isIntegerToken(rawBearingPoint)) {
    return { error: 'Bearing point number must be an integer.' }
  }

  if (!isDirectionToken(direction)) {
    return { error: 'Bearing direction must be X, Y, or Z.' }
  }

  if (!isNumericToken(loadValue)) {
    return { error: 'Bearing load value must be numeric.' }
  }

  if (tag && !LIVE_LOAD_TAG_PATTERN.test(tag)) {
    return { error: 'Bearing tag must be T or L when provided.' }
  }

  const bearingLine = applyIntegerRemap(rawBearingLine, options.bearingLineMap)
  const bearingPoint = applyIntegerRemap(rawBearingPoint, options.bearingPointMap)

  const normalizedTokens = [
    bearingLine,
    bearingPoint,
    toUpperDirection(direction),
    loadValue,
  ]

  if (tag) {
    normalizedTokens.push(tag.toUpperCase())
  }

  return {
    normalized: normalizedTokens.join(', '),
  }
}

function parseColumnRow(tokens, options = {}) {
  if (tokens.length < 4) {
    return {
      error:
        'Expected column number, load type, direction, and at least one value.',
    }
  }

  const [rawColumnNumber] = tokens
  const directionIndex = tokens.findIndex(
    (token, index) => index >= 2 && isDirectionToken(token),
  )

  if (!isIntegerToken(rawColumnNumber)) {
    return { error: 'Column number must be an integer.' }
  }

  if (directionIndex === -1) {
    return { error: 'Column row must include an X, Y, or Z direction value.' }
  }

  const loadType = normalizeLoadType(tokens.slice(1, directionIndex).join(' '))
  const direction = tokens[directionIndex]
  const values = tokens.slice(directionIndex + 1)
  const columnNumber = applyIntegerRemap(rawColumnNumber, options.columnNumberMap)

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
    normalized: [columnNumber, loadType, toUpperDirection(direction), ...values].join(
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

  const loadType = normalizeLoadType(tokens.slice(0, directionIndex).join(' '))
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
    normalized: [loadType, toUpperDirection(direction), ...values].join(', '),
  }
}

export function parseIdRemap(text, label) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const validRows = []
  const invalidRows = []
  const map = new Map()
  let sourceRowCount = 0

  lines.forEach((rawLine, index) => {
    if (!rawLine.trim()) {
      return
    }

    sourceRowCount += 1
    const matches = rawLine.match(/-?\d+/g) ?? []

    if (matches.length !== 2) {
      invalidRows.push({
        lineNumber: index + 1,
        rawLine: rawLine.trim(),
        error: `${label} rules must contain exactly one source integer and one target integer.`,
      })
      return
    }

    const [from, to] = matches

    map.set(from, to)
    validRows.push({
      lineNumber: index + 1,
      rawLine: rawLine.trim(),
      from,
      to,
    })
  })

  return {
    sourceRowCount,
    validRows,
    invalidRows,
    map,
  }
}

export function parseBearingLoads(text, options = {}) {
  return parseRows(text, (tokens) => parseBearingRow(tokens, options))
}

export function parseColumnLoads(text, options = {}) {
  return parseRows(text, (tokens) => parseColumnRow(tokens, options))
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
