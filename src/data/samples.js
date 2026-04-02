export const SAMPLE_DATA = {
  bearing: `1 13 X -0.097
1, 12, Z, -0.0284
2\t8\tY\t-17.856\tL
2, 3, X, -4.000`,
  bearingLive: `1, 1, Y, 0
1, 2, Y, -6.912
1, 3, Y, -23.808
2, 1, Y, 0
2, 2, Y, -10.296
2, 3, Y, -35.464
1, 1, Y, 0
1, 2, Y, -5.184
1, 3, Y, -17.856
2, 1, Y, 0
2, 2, Y, -5.184
2, 3, Y, -17.856`,
  column: `Col 13, force, x, 1.1, 1.0
Column 8\tudl\tz\t3.0\t0\t1.0
Col 2, pressure, y, -5.25, 0.0, 0.75
7, settlement, X, 7.0`,
  cap: `force, x, 1.0, 2.0, 0.5
UDL\tY\t4.0\t0\t1.0
moment    Z    7.0    0.5`,
}

export const PLACEHOLDERS = {
  bearing: `Paste bearing rows here.

Examples:
1 13 X -0.097
1, 12, Z, -0.0284
2\t8\tY\t-17.856\tT

Live-load example:
1, 1, Y, 0
...
2, 3, Y, -17.856`,
  column: `Paste column load rows here.

Examples:
Col 13, Force, X, 1.1, 1.0
Column 8\tUDL\tZ\t3.0\t0\t1.0
7    Settlement    X    7.0`,
  cap: `Paste cap load rows here.

Examples:
Force, X, 1.0, 2.0, 0.5
UDL\tY\t4.0\t0\t1.0
Moment    Z    7.0    0.5`,
}

export const BRIDGE_PRESETS = {
  i16_bridge_4: {
    id: 'i16_bridge_4',
    label: 'I-16 Bridge 4',
    applyRemaps: true,
    applyDeleteFilters: true,
    remaps: {
      bearingPoint: `10 = 3
9 = 2
8 = 1`,
      columnNumber: `10 = 3
9 = 2
8 = 1`,
    },
    deletes: {
      bearingPoint: '1-7',
      columnNumber: '1-7',
    },
  },
  i16_bridge_6: {
    id: 'i16_bridge_6',
    label: 'I-16 Bridge 6',
    applyRemaps: true,
    applyDeleteFilters: true,
    remaps: {
      bearingPoint: `13 = 6
12 = 5
11 = 4
10 = 3
9 = 2
8 = 1`,
      columnNumber: `13 = 6
12 = 5
11 = 4
10 = 3
9 = 2
8 = 1`,
    },
    deletes: {
      bearingPoint: '1-7, 14-20',
      columnNumber: '1-7, 14-20',
    },
  },
  i16_bridge_9: {
    id: 'i16_bridge_9',
    label: 'I-16 Bridge 9',
    applyRemaps: true,
    applyDeleteFilters: true,
    remaps: {
      bearingPoint: `10 = 3
9 = 2
8 = 1`,
      columnNumber: `10 = 3
9 = 2
8 = 1`,
    },
    deletes: {
      bearingPoint: '1-7',
      columnNumber: '1-7',
    },
  },
  user: {
    id: 'user',
    label: 'User',
    applyRemaps: true,
    applyDeleteFilters: true,
    remaps: {
      bearingPoint: '',
      columnNumber: '',
    },
    deletes: {
      bearingPoint: '',
      columnNumber: '',
    },
  },
}

export const DEFAULT_BRIDGE_PRESET_ID = 'user'

export const DEFAULT_REMAPS = BRIDGE_PRESETS[DEFAULT_BRIDGE_PRESET_ID].remaps

export const DEFAULT_DELETE_FILTERS =
  BRIDGE_PRESETS[DEFAULT_BRIDGE_PRESET_ID].deletes
