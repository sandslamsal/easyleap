export const SAMPLE_DATA = {
  bearing: `1 1 X -0.097
1, 2, Z, -0.0284
2\t3\tY\t-17.856\tL`,
  column: `1, Force, X, 1.1, 1.0
1\tUDL\tZ\t3.0\t0\t1.0
2    Pressure    Y    -5.25    0.0    0.75
3, Settlement, X, 7.0`,
  cap: `Force, X, 1.0, 2.0, 0.5
UDL\tY\t4.0\t0\t1.0
Moment    Z    7.0    0.5`,
}

export const PLACEHOLDERS = {
  bearing: `Paste bearing rows here.

Examples:
1 1 X -0.097
1, 2, Z, -0.0284
2\t3\tY\t-17.856\tT`,
  column: `Paste column load rows here.

Examples:
1, Force, X, 1.1, 1.0
1\tUDL\tZ\t3.0\t0\t1.0
2    Settlement    X    7.0`,
  cap: `Paste cap load rows here.

Examples:
Force, X, 1.0, 2.0, 0.5
UDL\tY\t4.0\t0\t1.0
Moment    Z    7.0    0.5`,
}
