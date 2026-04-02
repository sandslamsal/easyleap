const INTEGER_PATTERN = /^[-+]?\d+$/
const NUMBER_PATTERN = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/
const DIRECTION_PATTERN = /^[XYZ]$/i
const LIVE_LOAD_TAG_PATTERN = /^[TL]$/i
const MAX_COLUMN_FIELDS = 7
const MAX_CAP_FIELDS = 7

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
const formatFields = (fields) => fields.join(', ')

function normalizeLoadType(loadType) {
  const normalized = loadType.replace(/\s+/g, ' ').trim()
  return LOAD_TYPE_CASE_MAP.get(normalized.toLowerCase()) ?? normalized
}

function truncateFields(fields, maxCount) {
  if (fields.length <= maxCount) {
    return fields
  }

  return fields.slice(0, maxCount)
}

function removeFieldsByOneBasedPosition(fields, positionsToDelete) {
  const nextFields = [...fields]

  ;[...positionsToDelete]
    .sort((left, right) => right - left)
    .forEach((position) => {
      const index = position - 1

      if (index >= 0 && index < nextFields.length) {
        nextFields.splice(index, 1)
      }
    })

  return nextFields
}

function cleanupNormalizedColumnFields(fields) {
  const loadType = fields[1]?.toLowerCase()
  const positionsToDelete = new Set()

  if (loadType === 'udl') {
    // UDL rows omit normalized fields 6 and 7.
    positionsToDelete.add(6)
    positionsToDelete.add(7)
  }

  if (loadType === 'pressure') {
    // Pressure rows omit normalized field 6.
    positionsToDelete.add(6)
  }

  if (loadType === 'settlement') {
    // Settlement rows omit normalized fields 5, 6, and 7.
    positionsToDelete.add(5)
    positionsToDelete.add(6)
    positionsToDelete.add(7)
  }

  if (loadType === 'moment') {
    // Moment rows omit normalized fields 6 and 7.
    positionsToDelete.add(6)
    positionsToDelete.add(7)
  }

  return removeFieldsByOneBasedPosition(fields, positionsToDelete)
}

function cleanupNormalizedCapFields(fields) {
  const loadType = fields[0]?.toLowerCase()
  const positionsToDelete = new Set()

  if (loadType === 'force') {
    // Force rows omit normalized fields 6 and 7.
    positionsToDelete.add(6)
    positionsToDelete.add(7)
  }

  if (loadType === 'udl') {
    // UDL rows omit normalized fields 3 and 6.
    positionsToDelete.add(3)
    positionsToDelete.add(6)
  }

  if (loadType === 'moment') {
    // Moment rows omit normalized fields 3, 6, and 7.
    positionsToDelete.add(3)
    positionsToDelete.add(6)
    positionsToDelete.add(7)
  }

  return removeFieldsByOneBasedPosition(fields, positionsToDelete)
}

function applyIntegerRemap(token, remapMap) {
  if (!remapMap || remapMap.size === 0) {
    return token
  }

  return remapMap.get(token) ?? token
}

function shouldDeleteInteger(token, deleteSet) {
  if (!deleteSet || deleteSet.size === 0) {
    return false
  }

  return deleteSet.has(token)
}

function tokenizeRow(rawLine) {
  const line = cleanToken(rawLine)

  if (!line) {
    return []
  }

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

function tokenizeCompactDeleteEntries(rawLine) {
  return rawLine
    .split(',')
    .map(cleanToken)
    .filter(Boolean)
}

function tokenizeRemapEntries(rawLine) {
  return rawLine
    .split(/[|,]/)
    .map(cleanToken)
    .filter(Boolean)
}

function parseRows(text, rowParser) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const validRows = []
  const invalidRows = []
  const filteredRows = []
  let sourceRowCount = 0

  lines.forEach((rawLine, index) => {
    if (!rawLine.trim()) {
      return
    }

    sourceRowCount += 1

    const tokens = tokenizeRow(rawLine)
    const parsedRow = rowParser(tokens)

    if (parsedRow.skip) {
      filteredRows.push({
        lineNumber: index + 1,
        rawLine: rawLine.trim(),
        reason: parsedRow.reason,
      })
      return
    }

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
      ...parsedRow,
    })
  })

  return {
    sourceRowCount,
    validRows,
    invalidRows,
    filteredRows,
    sectionErrors: [],
    sectionWarnings: [],
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

  const [bearingLine, rawBearingPoint, direction, loadValue, tag] = tokens

  if (!isIntegerToken(bearingLine)) {
    return { error: 'Bearing line must be an integer.' }
  }

  if (!isIntegerToken(rawBearingPoint)) {
    return { error: 'Bearing point number must be an integer.' }
  }

  if (shouldDeleteInteger(rawBearingPoint, options.bearingPointDeleteSet)) {
    return {
      skip: true,
      reason: `Removed because bearing point ${rawBearingPoint} matches the delete filter.`,
    }
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
    fields: normalizedTokens,
    normalized: formatFields(normalizedTokens),
  }
}

function extractColumnNumber(tokens) {
  if (tokens.length === 0) {
    return {
      error: 'Column number is missing.',
    }
  }

  const [firstToken, secondToken] = tokens
  const combinedMatch = firstToken.match(/^col(?:umn)?\s*(-?\d+)$/i)

  if (isIntegerToken(firstToken)) {
    return {
      columnNumber: firstToken,
      remainingTokens: tokens.slice(1),
    }
  }

  if (combinedMatch) {
    return {
      columnNumber: combinedMatch[1],
      remainingTokens: tokens.slice(1),
    }
  }

  if (/^col(?:umn)?$/i.test(firstToken) && isIntegerToken(secondToken ?? '')) {
    return {
      columnNumber: secondToken,
      remainingTokens: tokens.slice(2),
    }
  }

  return {
    error:
      'Column number must be an integer or a label such as "Col 3" or "Column 3".',
  }
}

function parseColumnRow(tokens, options = {}) {
  if (tokens.length < 4) {
    return {
      error:
        'Expected column number, load type, direction, and at least one value.',
    }
  }

  const columnId = extractColumnNumber(tokens)

  if (columnId.error) {
    return { error: columnId.error }
  }

  if (shouldDeleteInteger(columnId.columnNumber, options.columnNumberDeleteSet)) {
    return {
      skip: true,
      reason: `Removed because column ${columnId.columnNumber} matches the delete filter.`,
    }
  }

  const directionIndex = columnId.remainingTokens.findIndex(
    (token, index) => index >= 1 && isDirectionToken(token),
  )

  if (directionIndex === -1) {
    return { error: 'Column row must include an X, Y, or Z direction value.' }
  }

  const loadType = normalizeLoadType(
    columnId.remainingTokens.slice(0, directionIndex).join(' '),
  )
  const direction = columnId.remainingTokens[directionIndex]
  const values = columnId.remainingTokens.slice(directionIndex + 1)
  const columnNumber = applyIntegerRemap(
    columnId.columnNumber,
    options.columnNumberMap,
  )

  if (!loadType) {
    return { error: 'Column load type is missing.' }
  }

  if (values.length === 0) {
    return { error: 'Column rows need at least one numeric value after direction.' }
  }

  if (values.some((value) => !isNumericToken(value))) {
    return { error: 'Column load values after direction must be numeric.' }
  }

  const normalizedFields = [
    columnNumber,
    loadType,
    toUpperDirection(direction),
    ...values,
  ]
  // Ignore any pasted fields beyond the supported normalized column structure.
  const cleanedFields = cleanupNormalizedColumnFields(
    truncateFields(normalizedFields, MAX_COLUMN_FIELDS),
  )

  if (cleanedFields.length < 4) {
    return { error: 'Column cleanup removed all numeric values from this row.' }
  }

  return {
    fields: cleanedFields,
    normalized: formatFields(cleanedFields),
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

  const normalizedFields = [loadType, toUpperDirection(direction), ...values]
  // Ignore any pasted fields beyond the supported normalized cap structure.
  const cleanedFields = cleanupNormalizedCapFields(
    truncateFields(normalizedFields, MAX_CAP_FIELDS),
  )

  if (cleanedFields.length < 3) {
    return { error: 'Cap cleanup removed all numeric values from this row.' }
  }

  return {
    fields: cleanedFields,
    normalized: formatFields(cleanedFields),
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

    tokenizeRemapEntries(rawLine).forEach((entry) => {
      const matches = entry.match(/-?\d+/g) ?? []

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
  })

  return {
    sourceRowCount,
    validRows,
    invalidRows,
    map,
    totalCount: validRows.length,
  }
}

export function parseDeleteFilter(text, label) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const validRows = []
  const invalidRows = []
  const values = new Set()
  let sourceRowCount = 0

  lines.forEach((rawLine, index) => {
    if (!rawLine.trim()) {
      return
    }

    sourceRowCount += 1

    tokenizeCompactDeleteEntries(rawLine).forEach((entry) => {
      const rangeMatch = entry.match(/^(-?\d+)\s*-\s*(-?\d+)$/)

      if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1], 10)
        const end = Number.parseInt(rangeMatch[2], 10)
        const low = Math.min(start, end)
        const high = Math.max(start, end)

        for (let value = low; value <= high; value += 1) {
          values.add(String(value))
        }

        validRows.push({
          lineNumber: index + 1,
          rawLine: rawLine.trim(),
          entry,
        })
        return
      }

      if (isIntegerToken(entry)) {
        values.add(entry)
        validRows.push({
          lineNumber: index + 1,
          rawLine: rawLine.trim(),
          entry,
        })
        return
      }

      invalidRows.push({
        lineNumber: index + 1,
        rawLine: rawLine.trim(),
        error: `${label} entries must be integers or ranges such as 1-7, 9, 12-14.`,
      })
    })
  })

  return {
    sourceRowCount,
    validRows,
    invalidRows,
    values,
    totalCount: values.size,
  }
}

export function parseBearingLoads(text, options = {}) {
  const result = parseRows(text, (tokens) => parseBearingRow(tokens, options))

  if (!options.liveLoadsEnabled) {
    return result
  }

  if (result.validRows.length === 0) {
    return result
  }

  if (result.validRows.length % 2 !== 0) {
    return {
      ...result,
      sectionErrors: [
        'Live Loads requires an even number of bearing rows because the rows are split into Truck and Lane halves.',
      ],
    }
  }

  const manualTagCount = result.validRows.filter((row) => row.fields.length >= 5).length
  const halfRowCount = result.validRows.length / 2

  // When Live Loads is enabled, any pasted manual tags are overridden so the
  // first half is always Truck (T) and the second half is always Lane (L).
  const validRows = result.validRows.map((row, index) => {
    const tag = index < halfRowCount ? 'T' : 'L'
    const fields = [...row.fields.slice(0, 4), tag]

    return {
      ...row,
      fields,
      normalized: formatFields(fields),
    }
  })

  return {
    ...result,
    validRows,
    sectionWarnings:
      manualTagCount > 0
        ? [
            'Live Loads is enabled, so any manually pasted bearing tags were overridden with auto-generated Truck (T) and Lane (L) tags.',
          ]
        : result.sectionWarnings,
  }
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
      filteredCount: results.bearing.filteredRows.length,
      sectionErrors: results.bearing.sectionErrors ?? [],
      sectionWarnings: results.bearing.sectionWarnings ?? [],
    },
    {
      label: 'Column Loads',
      heading: 'Column Loads',
      rows: results.column.validRows.map((row) => row.normalized),
      sourceRowCount: results.column.sourceRowCount,
      invalidCount: results.column.invalidRows.length,
      filteredCount: results.column.filteredRows.length,
      sectionErrors: results.column.sectionErrors ?? [],
      sectionWarnings: results.column.sectionWarnings ?? [],
    },
    {
      label: 'Cap Loads',
      heading: 'Cap Loads',
      rows: results.cap.validRows.map((row) => row.normalized),
      sourceRowCount: results.cap.sourceRowCount,
      invalidCount: results.cap.invalidRows.length,
      filteredCount: results.cap.filteredRows.length,
      sectionErrors: results.cap.sectionErrors ?? [],
      sectionWarnings: results.cap.sectionWarnings ?? [],
    },
  ]

  const includedSections = sections.filter(
    (section) => section.rows.length > 0 && section.sectionErrors.length === 0,
  )
  const warnings = []
  const sectionErrors = []

  sections.forEach((section) => {
    section.sectionWarnings.forEach((warning) => {
      warnings.push(`${section.label}: ${warning}`)
    })

    section.sectionErrors.forEach((error) => {
      sectionErrors.push(`${section.label}: ${error}`)
    })

    if (section.sectionErrors.length > 0) {
      return
    }

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

    if (section.filteredCount > 0) {
      warnings.push(
        `${section.label} filtered out ${section.filteredCount} row(s) using delete settings.`,
      )
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
    sectionErrors,
    includedSectionCount: includedSections.length,
    totalValidRows: includedSections.reduce(
      (sum, section) => sum + section.rows.length,
      0,
    ),
    totalInvalidRows: sections.reduce(
      (sum, section) => sum + section.invalidCount,
      0,
    ),
    totalFilteredRows: sections.reduce(
      (sum, section) => sum + section.filteredCount,
      0,
    ),
    totalSectionErrors: sections.reduce(
      (sum, section) => sum + section.sectionErrors.length,
      0,
    ),
  }
}

export function normalizeFileName(fileName) {
  const trimmedName = fileName.trim() || 'leap-loads'
  return /\.txt$/i.test(trimmedName) ? trimmedName : `${trimmedName}.txt`
}
