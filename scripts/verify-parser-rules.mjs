import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {
  buildLeapTxt,
  parseBearingLoads,
  parseCapLoads,
  parseColumnLoads,
  parseDeleteFilter,
  parseIdRemap,
} from '../src/utils/parsers.js'
import {
  createClearedTransformSettings,
  createTransformSettingsFromPreset,
  getBridgePreset,
  parseTransformSettingsJson,
  serializeTransformSettings,
} from '../src/utils/transformSettings.js'
import {
  BRIDGE_PRESETS,
  DEFAULT_BRIDGE_PRESET_ID,
} from '../src/data/samples.js'

const repoRoot = path.resolve(import.meta.dirname, '..')
const ws9Path = path.join(repoRoot, 'tests', 'fixtures', 'WS9.txt')
const ws9Text = fs.readFileSync(ws9Path, 'utf8').replace(/\r\n?/g, '\n').trim()

const columnExample = parseColumnLoads(
  'Col 6 UDL X -0.0312 0.7464 0.000 0.9743',
).validRows[0]?.normalized

assert.equal(
  columnExample,
  '6, UDL, X, -0.0312, 0.7464, 0.9743',
  'Column UDL rows should drop the original 6th input column only.',
)

const columnExampleWithEighth = parseColumnLoads(
  'Col 6 UDL X -0.0312 0.7464 0.000 0.9743 99.9',
).validRows[0]?.normalized

assert.equal(
  columnExampleWithEighth,
  '6, UDL, X, -0.0312, 0.7464, 0.9743',
  'Column rows should also drop an extra 8th normalized field.',
)

const columnExampleBeyondEighth = parseColumnLoads(
  'Col 6 UDL X -0.0312 0.7464 0.000 0.9743 99.9 123.4',
).validRows[0]?.normalized

assert.equal(
  columnExampleBeyondEighth,
  '6, UDL, X, -0.0312, 0.7464, 0.9743',
  'Column rows should ignore any fields beyond the supported structure.',
)

const columnExampleWithTextBeyondSupport = parseColumnLoads(
  'Col 6 UDL X -0.0312 0.7464 0.000 0.9743 NOTE EXTRA',
)

assert.equal(
  columnExampleWithTextBeyondSupport.invalidRows.length,
  0,
  'Column rows should not fail validation because of extra trailing pasted columns.',
)

assert.equal(
  columnExampleWithTextBeyondSupport.validRows[0]?.normalized,
  '6, UDL, X, -0.0312, 0.7464, 0.9743',
  'Column rows should ignore non-numeric columns beyond the supported structure.',
)

const columnUdlExampleFromUser = parseColumnLoads(
  'Col 10 UDL X 2 5 4 3 klf',
).validRows[0]?.normalized

assert.equal(
  columnUdlExampleFromUser,
  '10, UDL, X, 2, 5, 3',
  'Column UDL rows should keep the 7th input value while dropping the 6th and ignoring an extra 8th+ value.',
)

const columnCleanupExamples = parseColumnLoads(
  [
    '4 Pressure Z 5.0 0.0 1.0 9.0',
    '5 Settlement X 7.0 8.0 9.0 10.0',
    '6 Moment Y 1.0 2.0 3.0 4.0',
    '7 Trapezoidal X 6.0 0.0 0.0 1.0',
  ].join('\n'),
).validRows.map((row) => row.normalized)

assert.deepEqual(
  columnCleanupExamples,
  [
    '4, Pressure, Z, 5.0, 0.0, 9.0',
    '5, Settlement, X, 7.0',
    '6, Moment, Y, 1.0, 2.0',
    '7, Trapezoidal, X, 6.0, 0.0, 0.0, 1.0',
  ],
  'Column cleanup rules should apply by normalized field position.',
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

const capExamplesBeyondEighth = parseCapLoads(
  [
    'Force X 0.00 -1.2 0.5 0.00 0.00 9.99 8.88',
    'Moment Y 0 12 3 4 5 999 111',
  ].join('\n'),
).validRows.map((row) => row.normalized)

assert.deepEqual(
  capExamplesBeyondEighth,
  ['Force, X, 0.00, -1.2, 0.5', 'Moment, Y, 12, 3'],
  'Cap rows should ignore any fields beyond the supported structure.',
)

const capExampleWithTextBeyondSupport = parseCapLoads(
  'Moment Y 0 12 3 4 5 NOTE EXTRA',
)

assert.equal(
  capExampleWithTextBeyondSupport.invalidRows.length,
  0,
  'Cap rows should not fail validation because of extra trailing pasted columns.',
)

assert.equal(
  capExampleWithTextBeyondSupport.validRows[0]?.normalized,
  'Moment, Y, 12, 3',
  'Cap rows should ignore non-numeric columns beyond the supported structure.',
)

const capMomentExample = parseCapLoads(
  'Moment Z 7.0 0.5 0.25 0.125 0.0625',
).validRows[0]?.normalized

assert.equal(
  capMomentExample,
  'Moment, Z, 0.5, 0.25',
  'Cap Moment rows should drop normalized fields 3, 6, and 7.',
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

const deleteSyntaxExamples = [
  {
    input: '1,2,3',
    expected: ['1', '2', '3'],
  },
  {
    input: '5-10',
    expected: ['5', '6', '7', '8', '9', '10'],
  },
  {
    input: '1,2,3,6-9',
    expected: ['1', '2', '3', '6', '7', '8', '9'],
  },
  {
    input: '4-6,10,12-14',
    expected: ['4', '5', '6', '10', '12', '13', '14'],
  },
  {
    input: '1,2,3,4,9-16',
    expected: ['1', '2', '3', '4', '9', '10', '11', '12', '13', '14', '15', '16'],
  },
]

deleteSyntaxExamples.forEach(({ input, expected }) => {
  assert.deepEqual(
    [...parseDeleteFilter(input, 'Delete filter').values],
    expected,
    `Delete filter syntax should parse "${input}".`,
  )
})

assert.deepEqual(
  [...parseDeleteFilter(' 1, 2,2, 4-6, 6 ', 'Delete filter').values],
  ['1', '2', '4', '5', '6'],
  'Delete filters should ignore extra spaces and remove duplicates automatically.',
)

const compactRemapExamples = [
  {
    input: '10=3, 9=2, 8=1',
    expectedEntries: [
      ['10', '3'],
      ['9', '2'],
      ['8', '1'],
    ],
  },
  {
    input: '10 = 3 | 9 = 2 | 8 = 1',
    expectedEntries: [
      ['10', '3'],
      ['9', '2'],
      ['8', '1'],
    ],
  },
  {
    input: '10=3, 9 = 2 | 8=1',
    expectedEntries: [
      ['10', '3'],
      ['9', '2'],
      ['8', '1'],
    ],
  },
]

compactRemapExamples.forEach(({ input, expectedEntries }) => {
  const result = parseIdRemap(input, 'Remap')

  assert.deepEqual(
    [...result.map.entries()],
    expectedEntries,
    `Remap syntax should parse "${input}".`,
  )
})

assert.equal(
  DEFAULT_BRIDGE_PRESET_ID,
  'user',
  'User should be the default preset on first load.',
)

assert.deepEqual(
  Object.values(BRIDGE_PRESETS).map((preset) => preset.label),
  ['I-16 Bridge 4', 'I-16 Bridge 6', 'I-16 Bridge 9', 'User'],
  'Preset labels should match the new I-16 naming and User mode.',
)

const bridge6Settings = createTransformSettingsFromPreset('i16_bridge_6')
const bridge4Settings = createTransformSettingsFromPreset('i16_bridge_4')
const bridge9Settings = createTransformSettingsFromPreset('i16_bridge_9')
const userSettings = createTransformSettingsFromPreset('user')

assert.equal(
  bridge6Settings.bearingPointDeleteText,
  '1-7, 14-20',
  'I-16 Bridge 6 should keep the existing delete defaults.',
)

assert.equal(
  bridge6Settings.bearingPointRemapText,
  ['13 = 6', '12 = 5', '11 = 4', '10 = 3', '9 = 2', '8 = 1'].join('\n'),
  'I-16 Bridge 6 should keep the existing remap defaults.',
)

assert.equal(
  bridge4Settings.bearingPointDeleteText,
  '1-7',
  'I-16 Bridge 4 should default bearing delete settings to 1-7.',
)

assert.equal(
  bridge4Settings.columnNumberDeleteText,
  '1-7',
  'I-16 Bridge 4 should default column delete settings to 1-7.',
)

assert.equal(
  bridge4Settings.bearingPointRemapText,
  ['10 = 3', '9 = 2', '8 = 1'].join('\n'),
  'I-16 Bridge 4 should use the shorter bearing remap preset.',
)

assert.equal(
  bridge4Settings.columnNumberRemapText,
  ['10 = 3', '9 = 2', '8 = 1'].join('\n'),
  'I-16 Bridge 4 should use the shorter column remap preset.',
)

assert.deepEqual(
  bridge9Settings,
  {
    bridgePresetId: 'i16_bridge_9',
    applyRemaps: true,
    applyDeleteFilters: true,
    bearingPointRemapText: bridge4Settings.bearingPointRemapText,
    columnNumberRemapText: bridge4Settings.columnNumberRemapText,
    bearingPointDeleteText: bridge4Settings.bearingPointDeleteText,
    columnNumberDeleteText: bridge4Settings.columnNumberDeleteText,
  },
  'I-16 Bridge 9 should use the same defaults as I-16 Bridge 4.',
)

assert.equal(
  getBridgePreset('bridge4').id,
  'i16_bridge_4',
  'Legacy bridge4 ids should map to I-16 Bridge 4.',
)

assert.equal(
  getBridgePreset('bridge6').id,
  'i16_bridge_6',
  'Legacy bridge6 ids should map to I-16 Bridge 6.',
)

assert.equal(
  getBridgePreset('bridge9').id,
  'i16_bridge_9',
  'Legacy bridge9 ids should map to I-16 Bridge 9.',
)

assert.deepEqual(
  userSettings,
  {
    bridgePresetId: 'user',
    applyRemaps: true,
    applyDeleteFilters: true,
    bearingPointRemapText: '',
    columnNumberRemapText: '',
    bearingPointDeleteText: '',
    columnNumberDeleteText: '',
  },
  'User mode should start as a blank custom settings preset.',
)

const bridge4BearingResult = parseBearingLoads(
  ['1 10 X -1.0', '1 7 X -2.0'].join('\n'),
  {
    bearingPointMap: parseIdRemap(
      bridge4Settings.bearingPointRemapText,
      'I-16 Bridge 4 bearing point remap',
    ).map,
    bearingPointDeleteSet: parseDeleteFilter(
      bridge4Settings.bearingPointDeleteText,
      'I-16 Bridge 4 bearing point delete filter',
    ).values,
  },
)

assert.deepEqual(
  bridge4BearingResult.validRows.map((row) => row.normalized),
  ['1, 3, X, -1.0'],
  'I-16 Bridge 4 should renumber bearing point 10 to 3.',
)

assert.equal(
  bridge4BearingResult.filteredRows.length,
  1,
  'I-16 Bridge 4 should delete bearing point 7.',
)

const bridge6ColumnResult = parseColumnLoads(
  ['Col 13 Force X 1.0', 'Col 15 Force X 2.0'].join('\n'),
  {
    columnNumberMap: parseIdRemap(
      bridge6Settings.columnNumberRemapText,
      'I-16 Bridge 6 column number remap',
    ).map,
    columnNumberDeleteSet: parseDeleteFilter(
      bridge6Settings.columnNumberDeleteText,
      'I-16 Bridge 6 column number delete filter',
    ).values,
  },
)

assert.deepEqual(
  bridge6ColumnResult.validRows.map((row) => row.normalized),
  ['6, Force, X, 1.0'],
  'I-16 Bridge 6 should keep the existing column renumbering behavior.',
)

assert.equal(
  bridge6ColumnResult.filteredRows.length,
  1,
  'I-16 Bridge 6 should keep the existing column delete behavior.',
)

const settingsRoundTrip = parseTransformSettingsJson(
  serializeTransformSettings({
    ...userSettings,
    bearingPointRemapText: '16 = 4',
    columnNumberRemapText: '16 = 4',
    bearingPointDeleteText: '2,4-6',
    columnNumberDeleteText: '3,7-8',
  }),
)

assert.deepEqual(
  settingsRoundTrip,
  {
    bridgePresetId: 'user',
    applyRemaps: true,
    applyDeleteFilters: true,
    bearingPointRemapText: '16 = 4',
    columnNumberRemapText: '16 = 4',
    bearingPointDeleteText: '2,4-6',
    columnNumberDeleteText: '3,7-8',
  },
  'Settings JSON export/import should preserve the selected bridge mode and values.',
)

const legacyCreateImport = parseTransformSettingsJson(
  JSON.stringify({
    bridgePresetId: 'create',
    applyRemaps: true,
    applyDeleteFilters: false,
    bearingPointRemapText: '',
    columnNumberRemapText: '',
    bearingPointDeleteText: '',
    columnNumberDeleteText: '',
  }),
)

assert.equal(
  legacyCreateImport.bridgePresetId,
  'user',
  'Legacy settings JSON with bridgePresetId=create should load as user mode.',
)

const legacyBridgeImport = parseTransformSettingsJson(
  JSON.stringify({
    bridgePresetId: 'bridge6',
    applyRemaps: true,
    applyDeleteFilters: true,
    bearingPointRemapText: bridge6Settings.bearingPointRemapText,
    columnNumberRemapText: bridge6Settings.columnNumberRemapText,
    bearingPointDeleteText: bridge6Settings.bearingPointDeleteText,
    columnNumberDeleteText: bridge6Settings.columnNumberDeleteText,
  }),
)

assert.equal(
  legacyBridgeImport.bridgePresetId,
  'i16_bridge_6',
  'Legacy settings JSON with bridgePresetId=bridge6 should load as I-16 Bridge 6.',
)

assert.deepEqual(
  createClearedTransformSettings('i16_bridge_4'),
  {
    bridgePresetId: 'i16_bridge_4',
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

const expectedRebuiltWs9 = [
  ws9Sections[0],
  ['Column Loads', '1, Force, X, 1.1, 1.0', '1, UDL, Z, 3.0, 0, 1.0', '1, Pressure, Z, 5.0, 0'].join(
    '\n',
  ),
  ['Cap Loads', 'Force, X, 1.0, 2.0, 0.5', 'UDL, Y, 4.0, 0, 1.0', 'Moment, Z, 7.0, 0.5'].join(
    '\n',
  ),
].join('\n\n')

assert.equal(
  rebuiltWs9,
  expectedRebuiltWs9,
  'Rebuilt output should match the updated cleanup rules and LEAP TXT formatting.',
)

console.log('Parser rules verified successfully.')
