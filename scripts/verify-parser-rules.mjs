import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {
  buildLeapTxt,
  parseBearingLoads,
  parseCapLoads,
  parseColumnLoads,
} from '../src/utils/parsers.js'

const repoRoot = path.resolve(import.meta.dirname, '..')
const ws9Path = path.join(repoRoot, 'tests', 'fixtures', 'WS9.txt')
const ws9Text = fs.readFileSync(ws9Path, 'utf8').replace(/\r\n?/g, '\n').trim()

const columnExample = parseColumnLoads(
  'Col 6 UDL X -0.0312 0.7464 0.000 0.9743',
).validRows[0]?.normalized

assert.equal(
  columnExample,
  '6, UDL, X, -0.0312, 0.7464, 0.9743',
  'Column UDL rows should drop the 6th input column.',
)

const capExamples = parseCapLoads(
  ['Force X 0.00 -1.2 0.5 0.00 0.00', 'UDL Z 0.00 -0.04 0.00 0.00 1.00'].join(
    '\n',
  ),
).validRows.map((row) => row.normalized)

assert.deepEqual(
  capExamples,
  ['Force, X, 0.00, -1.2, 0.5', 'UDL, Z, -0.04, 0.00, 1.00'],
  'Cap Force and UDL rows should trim fields per LEAP export rules.',
)

const ws9Sections = ws9Text.split(/\n\n+/)
const getRows = (section) => section.split('\n').slice(1).join('\n')
const rebuiltWs9 = buildLeapTxt({
  bearing: parseBearingLoads(getRows(ws9Sections[0])),
  column: parseColumnLoads(getRows(ws9Sections[1])),
  cap: parseCapLoads(getRows(ws9Sections[2])),
}).output

assert.equal(
  rebuiltWs9,
  ws9Text,
  'Rebuilt output should exactly match the known-good WS9 fixture.',
)

console.log('Parser rules verified successfully.')
