export const SAMPLE_DATA = {
  bearing: `8 13 X -0.097
8, 12, Z, -0.0284
2\t3\tY\t-17.856\tL`,
  column: `13, force, x, 1.1, 1.0
8\tudl\tz\t3.0\t0\t1.0
2    pressure    y    -5.25    0.0    0.75
3, settlement, X, 7.0`,
  cap: `force, x, 1.0, 2.0, 0.5
UDL\tY\t4.0\t0\t1.0
moment    Z    7.0    0.5`,
}

export const PLACEHOLDERS = {
  bearing: `Paste bearing rows here.

Examples:
8 13 X -0.097
8, 12, Z, -0.0284
2\t3\tY\t-17.856\tT`,
  column: `Paste column load rows here.

Examples:
13, Force, X, 1.1, 1.0
8\tUDL\tZ\t3.0\t0\t1.0
2    Settlement    X    7.0`,
  cap: `Paste cap load rows here.

Examples:
Force, X, 1.0, 2.0, 0.5
UDL\tY\t4.0\t0\t1.0
Moment    Z    7.0    0.5`,
}

export const DEFAULT_REMAPS = {
  bearingLine: `8 = 1`,
  bearingPoint: `13 = 6
12 = 5`,
  columnNumber: `13 = 6
12 = 5
8 = 1`,
}
