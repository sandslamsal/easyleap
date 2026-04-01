import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {
  buildLeapTxt,
  parseBearingLoads,
  parseCapLoads,
  parseColumnLoads,
  parseDeleteFilter,
} from '../src/utils/parsers.js'
import {
  createClearedTransformSettings,
  createTransformSettingsFromPreset,
  parseTransformSettingsJson,
  serializeTransformSettings,
} from '../src/utils/transformSettings.js'

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

const columnExampleWithEighth = parseColumnLoads(
  'Col 6 UDL X -0.0312 0.7464 0.000 0.9743 99.9',
).validRows[0]?.normalized

assert.equal(
  columnExampleWithEighth,
  '6, UDL, X, -0.0312, 0.7464, 0.9743',
  'Column rows should also drop an extra 8th input column.',
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

const capExamplesWithEighth = parseCapLoads(
  [
    'Force X 0.00 -1.2 0.5 0.00 0.00 9.99',
    'UDL Z 0.00 -0.04 0.00 0.00 1.00 9.99',
  ].join('\n'),
).validRows.map((row) => row.normalized)

assert.deepEqual(
  capExamplesWithEighth,
  ['Force, X, 0.00, -1.2, 0.5', 'UDL, Z, -0.04, 0.00, 1.00'],
  'Cap rows should also drop an extra 8th input column.',
)

const liveBearingText = [
  '1, 1, Y, 0',
  '1, 2, Y, -6.912',
  '1, 3, Y, -23.808',
  '2, 1, Y, 0',
  '2, 2, Y, -10.296',
  '2, 3, Y, -35.464',
  '1, 1, Y, 0',
  '1, 2, Y, -5.184',
  '1, 3, Y, -17.856',
  '2, 1, Y, 0',
  '2, 2, Y, -5.184',
  '2, 3, Y, -17.856',
].join('\n')

const liveBearingRows = parseBearingLoads(liveBearingText, {
  liveLoadsEnabled: true,
}).validRows.map((row) => row.normalized)

assert.deepEqual(
  liveBearingRows,
  [
    '1, 1, Y, 0, T',
    '1, 2, Y, -6.912, T',
    '1, 3, Y, -23.808, T',
    '2, 1, Y, 0, T',
    '2, 2, Y, -10.296, T',
    '2, 3, Y, -35.464, T',
    '1, 1, Y, 0, L',
    '1, 2, Y, -5.184, L',
    '1, 3, Y, -17.856, L',
    '2, 1, Y, 0, L',
    '2, 2, Y, -5.184, L',
    '2, 3, Y, -17.856, L',
  ],
  'Live bearing rows should be split into Truck and Lane halves.',
)

const oddLiveBearingResult = parseBearingLoads(
  ['1, 1, Y, 0', '1, 2, Y, -6.912', '1, 3, Y, -23.808'].join('\n'),
  { liveLoadsEnabled: true },
)

assert.equal(
  oddLiveBearingResult.sectionErrors[0],
  'Live Loads requires an even number of bearing rows because the rows are split into Truck and Lane halves.',
  'Odd live-load bearing rows should raise a section error.',
)

const manualTagOverrideResult = parseBearingLoads(
  ['1, 1, Y, 0, L', '1, 2, Y, -6.912, L', '1, 1, Y, 0, T', '1, 2, Y, -5.184, T'].join(
    '\n',
  ),
  { liveLoadsEnabled: true },
)

assert.deepEqual(
  manualTagOverrideResult.validRows.map((row) => row.normalized),
  ['1, 1, Y, 0, T', '1, 2, Y, -6.912, T', '1, 1, Y, 0, L', '1, 2, Y, -5.184, L'],
  'Live load auto-tagging should override manually pasted bearing tags.',
)

const compactDeleteValues = parseDeleteFilter(
  '1,2,3,6-8\n4-9,12,15-18',
  'Delete filter',
)

assert.deepEqual(
  [...compactDeleteValues.values],
  [
    '1',
    '2',
    '3',
    '6',
    '7',
    '8',
    '4',
    '5',
    '9',
    '12',
    '15',
    '16',
    '17',
    '18',
  ],
  'Delete filters should parse compact comma-separated integers and ranges.',
)

const bridge6Settings = createTransformSettingsFromPreset('bridge6')
const bridge4Settings = createTransformSettingsFromPreset('bridge4')

assert.equal(
  bridge6Settings.bearingPointDeleteText,
  '1-7, 14-20',
  'Bridge 6 should keep the existing delete defaults.',
)

assert.equal(
  bridge4Settings.bearingPointDeleteText,
  '1-7',
  'Bridge 4 should default bearing delete settings to 1-7.',
)

assert.equal(
  bridge4Settings.columnNumberDeleteText,
  '1-7',
  'Bridge 4 should default column delete settings to 1-7.',
)

const settingsRoundTrip = parseTransformSettingsJson(
  serializeTransformSettings({
    ...bridge6Settings,
    applyDeleteFilters: false,
    columnNumberDeleteText: '4-9,12,15-18',
  }),
)

assert.deepEqual(
  settingsRoundTrip,
  {
    bridgePresetId: 'bridge6',
    applyRemaps: true,
    applyDeleteFilters: false,
    bearingPointRemapText: bridge6Settings.bearingPointRemapText,
    columnNumberRemapText: bridge6Settings.columnNumberRemapText,
    bearingPointDeleteText: bridge6Settings.bearingPointDeleteText,
    columnNumberDeleteText: '4-9,12,15-18',
  },
  'Settings JSON export/import should round-trip current transform state.',
)

assert.deepEqual(
  createClearedTransformSettings('bridge4'),
  {
    bridgePresetId: 'bridge4',
    applyRemaps: false,
    applyDeleteFilters: false,
    bearingPointRemapText: '',
    columnNumberRemapText: '',
    bearingPointDeleteText: '',
    columnNumberDeleteText: '',
  },
  'Clear settings should blank transform inputs without relying on dataset state.',
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
