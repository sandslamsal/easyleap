export const SAMPLE_DATA = {
  bearing: `1 13 X -0.097
1, 12, Z, -0.0284
2\t8\tY\t-17.856\tL
2, 3, X, -4.000`,
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
2\t8\tY\t-17.856\tT`,
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

export const DEFAULT_REMAPS = {
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
}

export const DEFAULT_DELETE_FILTERS = {
  bearingPoint: `1-6
14-20`,
  columnNumber: `1-6
14-20`,
}
