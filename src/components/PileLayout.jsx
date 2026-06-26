import { useEffect, useMemo, useState } from 'react'
import {
  Anchor,
  CircleAlert,
  CircleCheck,
  ClipboardCopy,
  Download,
  LayoutGrid,
  Printer,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import {
  AASHTO_SPECS,
  GDOT_SPECS,
  checkCompliance,
  generateLayout,
  minSpacing,
} from '../utils/pileLayout.js'

const num = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const fmt = (value) => (Number.isInteger(value) ? `${value}` : value.toFixed(2))

// Format inches as feet and inches, e.g. 150 -> 12'-6".
const ftIn = (inches) => {
  const ft = Math.floor(inches / 12)
  const rem = Math.round(inches - ft * 12)
  return `${ft}'-${rem}"`
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// A single pile node: gradient body (rounded square or circle by type), a faint
// section glyph for H-piles, and a numbered pill above it.
function PileNode({ x, y, size, type, label, bad, selected, onSelect, fs }) {
  const r = size / 2
  const round = /shell|pipe|round/i.test(type)
  const isH = /h-?pile/i.test(type)
  const pillH = fs * 1.5
  const pillW = Math.max(size * 0.85, label.length * fs * 0.72 + fs)
  const pillY = y - r - pillH * 1.35
  const cls = ['pile-node', selected ? 'is-selected' : '', bad ? 'is-bad' : '']
    .join(' ')
    .trim()
  return (
    <g className={cls} onClick={onSelect}>
      {round ? (
        <circle cx={x} cy={y} r={r} className="pile-node-body" />
      ) : (
        <rect
          x={x - r}
          y={y - r}
          width={size}
          height={size}
          rx={size * 0.2}
          className="pile-node-body"
        />
      )}
      {isH ? (
        <g className="pile-node-web" strokeWidth={Math.max(1, size * 0.08)}>
          <line x1={x - r * 0.5} y1={y - r * 0.55} x2={x - r * 0.5} y2={y + r * 0.55} />
          <line x1={x + r * 0.5} y1={y - r * 0.55} x2={x + r * 0.5} y2={y + r * 0.55} />
          <line x1={x - r * 0.5} y1={y} x2={x + r * 0.5} y2={y} />
        </g>
      ) : null}
      <g className="pile-pill">
        <rect x={x - pillW / 2} y={pillY} width={pillW} height={pillH} rx={pillH / 2} />
        <text x={x} y={pillY + pillH * 0.7} fontSize={fs}>
          {label}
        </text>
      </g>
    </g>
  )
}

// Local coordinate axes at the origin: thin arrows with circular X / Z badges.
function AxisSystem({ ox, oz, len, fs }) {
  const head = fs * 0.85
  const br = fs * 0.95
  return (
    <g className="pile-axes">
      <line x1={ox} y1={oz} x2={ox + len} y2={oz} className="pile-axis-line" />
      <line x1={ox} y1={oz} x2={ox} y2={oz + len} className="pile-axis-line" />
      <polygon
        className="pile-axis-arrow"
        points={`${ox + len + head * 0.6},${oz} ${ox + len - head * 0.4},${oz - head * 0.55} ${ox + len - head * 0.4},${oz + head * 0.55}`}
      />
      <polygon
        className="pile-axis-arrow"
        points={`${ox},${oz + len + head * 0.6} ${ox - head * 0.55},${oz + len - head * 0.4} ${ox + head * 0.55},${oz + len - head * 0.4}`}
      />
      <g className="pile-axis-badge">
        <circle cx={ox + len + br * 1.7} cy={oz} r={br} />
        <text x={ox + len + br * 1.7} y={oz + fs * 0.34} fontSize={fs}>X</text>
      </g>
      <g className="pile-axis-badge">
        <circle cx={ox} cy={oz + len + br * 1.7} r={br} />
        <text x={ox} y={oz + len + br * 1.7 + fs * 0.34} fontSize={fs}>Z</text>
      </g>
    </g>
  )
}

// Centroid of the pile group: gray crosshair with a small red center dot.
function Centroid({ cx, cy, s }) {
  return (
    <g className="pile-centroid">
      <line x1={cx - s} y1={cy} x2={cx + s} y2={cy} className="pile-centroid-cross" />
      <line x1={cx} y1={cy - s} x2={cx} y2={cy + s} className="pile-centroid-cross" />
      <circle cx={cx} cy={cy} r={s * 0.26} className="pile-centroid-dot" />
    </g>
  )
}

// CAD-style dimension with extension lines, arrowheads, and boxed text.
function Dimension({ a, b, off, vertical, label, fs }) {
  const head = fs * 0.5
  const bw = label.length * fs * 0.62 + fs * 0.8
  const bh = fs * 1.5
  const mid = (a + b) / 2
  if (vertical) {
    const x = off
    return (
      <g className="pile-dim-group">
        <line x1={x} y1={a} x2={x + fs * 1.1} y2={a} className="pile-dim-ext" />
        <line x1={x} y1={b} x2={x + fs * 1.1} y2={b} className="pile-dim-ext" />
        <line x1={x} y1={a} x2={x} y2={b} className="pile-dim-line" />
        <polygon className="pile-dim-arrow" points={`${x},${a} ${x - head * 0.55},${a + head} ${x + head * 0.55},${a + head}`} />
        <polygon className="pile-dim-arrow" points={`${x},${b} ${x - head * 0.55},${b - head} ${x + head * 0.55},${b - head}`} />
        <g className="pile-dim-text" transform={`rotate(-90 ${x} ${mid})`}>
          <rect x={x - bw / 2} y={mid - bh / 2} width={bw} height={bh} rx={fs * 0.3} />
          <text x={x} y={mid + fs * 0.34} fontSize={fs * 0.9}>{label}</text>
        </g>
      </g>
    )
  }
  const y = off
  return (
    <g className="pile-dim-group">
      <line x1={a} y1={y} x2={a} y2={y - fs * 1.1} className="pile-dim-ext" />
      <line x1={b} y1={y} x2={b} y2={y - fs * 1.1} className="pile-dim-ext" />
      <line x1={a} y1={y} x2={b} y2={y} className="pile-dim-line" />
      <polygon className="pile-dim-arrow" points={`${a},${y} ${a + head},${y - head * 0.55} ${a + head},${y + head * 0.55}`} />
      <polygon className="pile-dim-arrow" points={`${b},${y} ${b - head},${y - head * 0.55} ${b - head},${y + head * 0.55}`} />
      <g className="pile-dim-text">
        <rect x={mid - bw / 2} y={y - bh / 2} width={bw} height={bh} rx={fs * 0.3} />
        <text x={mid} y={y + fs * 0.34} fontSize={fs * 0.9}>{label}</text>
      </g>
    </g>
  )
}

// Professional plan diagram, LEAP convention: origin mid-left, X right, Z down.
function PileDiagram({ piles, footingX, footingZ, pileType, selected, onSelect }) {
  if (!(footingX > 0 && footingZ > 0)) {
    return null
  }
  const span = Math.max(footingX, footingZ)
  const pad = span * 0.2
  const W = footingX + 2 * pad
  const H = footingZ + 2 * pad
  const ox = pad // footing left edge (x = 0)
  const oz = pad + footingZ / 2 // mid-height (z = 0)
  const fs = span * 0.04

  // Marker size from nearest-neighbour spacing so nodes never overlap.
  let minDist = Infinity
  for (let i = 0; i < piles.length; i += 1) {
    for (let j = i + 1; j < piles.length; j += 1) {
      const d = Math.hypot(piles[i].x - piles[j].x, piles[i].z - piles[j].z)
      if (d < minDist) minDist = d
    }
  }
  if (!Number.isFinite(minDist)) minDist = span * 0.3
  const mk = clamp(minDist * 0.52, span * 0.05, span * 0.13)

  const cx = ox + piles.reduce((s, p) => s + p.x, 0) / piles.length
  const cz = oz + piles.reduce((s, p) => s + p.z, 0) / piles.length
  const axisLen = Math.min(footingX, footingZ) * 0.26
  const gridStep = 12
  const corner = Math.min(8, span * 0.02)

  return (
    <div className="pile-canvas">
      <svg viewBox={`0 0 ${W} ${H}`} className="pile-canvas-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pileGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="pile-grad-a" />
            <stop offset="100%" className="pile-grad-b" />
          </linearGradient>
          <filter id="pileShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy={fs * 0.12} stdDeviation={fs * 0.16} floodColor="#2563EB" floodOpacity="0.18" />
          </filter>
          <filter id="footShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy={fs * 0.1} stdDeviation={fs * 0.18} floodColor="#1f2937" floodOpacity="0.12" />
          </filter>
          <pattern id="pileGrid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} className="pile-grid-line" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={W} height={H} className="pile-canvas-bg" />
        <rect x={ox} y={pad} width={footingX} height={footingZ} rx={corner} className="pile-foundation" filter="url(#footShadow)" />
        <rect x={ox} y={pad} width={footingX} height={footingZ} rx={corner} fill="url(#pileGrid)" />

        <Dimension a={ox} b={ox + footingX} off={pad + footingZ + pad * 0.42} label={ftIn(footingX)} fs={fs} />
        <Dimension a={pad} b={pad + footingZ} off={ox - pad * 0.42} vertical label={ftIn(footingZ)} fs={fs} />

        <AxisSystem ox={ox} oz={oz} len={axisLen} fs={fs} />
        <Centroid cx={cx} cy={cz} s={fs * 0.95} />

        {piles.map((pile) => {
          const px = ox + pile.x
          const py = oz + pile.z
          const bad =
            pile.x < 0 ||
            pile.x > footingX ||
            pile.z < -footingZ / 2 ||
            pile.z > footingZ / 2
          return (
            <PileNode
              key={pile.n}
              x={px}
              y={py}
              size={mk}
              type={pileType}
              label={`${pile.n}`}
              bad={bad}
              selected={selected === pile.n}
              onSelect={onSelect ? () => onSelect(selected === pile.n ? null : pile.n) : undefined}
              fs={fs}
            />
          )
        })}
      </svg>
    </div>
  )
}

const STATUS_ICON = { met: CircleCheck, fail: CircleAlert, advisory: TriangleAlert }

// Excel-style editable coordinate grid.
function CoordGrid({ piles, onEdit, readOnly }) {
  return (
    <table className="pile-grid">
      <thead>
        <tr>
          <th>Pile</th>
          <th>X (in)</th>
          <th>Z (in)</th>
        </tr>
      </thead>
      <tbody>
        {piles.map((pile) => (
          <tr key={pile.n}>
            <td className="pile-idx">{pile.n}</td>
            <td>
              {readOnly ? (
                fmt(pile.x)
              ) : (
                <input
                  type="number"
                  value={pile.x}
                  onChange={(event) => onEdit(pile.n, 'x', event.target.value)}
                />
              )}
            </td>
            <td>
              {readOnly ? (
                fmt(pile.z)
              ) : (
                <input
                  type="number"
                  value={pile.z}
                  onChange={(event) => onEdit(pile.n, 'z', event.target.value)}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ComplianceList({ compliance }) {
  return (
    <ul className="compliance-list">
      {compliance.map((check, index) => {
        const Icon = STATUS_ICON[check.status]
        return (
          <li
            key={`${check.clause}-${index}`}
            className={`compliance-item compliance-${check.status}`}
          >
            <Icon size={16} />
            <span className="compliance-code">{check.code}</span>
            <span className="compliance-label">
              {check.label}{' '}
              <span className="compliance-clause">({check.clause})</span>
            </span>
            <span className="compliance-actual">{check.actual}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function PileLayout() {
  const [footingX, setFootingX] = useState('12')
  const [footingZ, setFootingZ] = useState('12')
  const [count, setCount] = useState('4')
  const [pileSize, setPileSize] = useState('14')
  const [pileType, setPileType] = useState('Steel H-pile')
  const [edge, setEdge] = useState('12')
  const [columns, setColumns] = useState('')
  const [useGdot, setUseGdot] = useState(true)
  const [piles, setPiles] = useState([])
  const [meta, setMeta] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [selected, setSelected] = useState(null)
  const [project, setProject] = useState({ name: '', engineer: '', job: '' })
  const [pageSize, setPageSize] = useState('letter')

  // Footing is entered in feet; the engine and coordinates work in inches.
  const fXin = num(footingX) * 12
  const fZin = num(footingZ) * 12
  const N = Math.max(0, Math.round(num(count)))
  const D = num(pileSize)
  const E = edge.trim() === '' ? 12 : num(edge, 12)
  const cols = columns.trim() === '' ? 0 : Math.round(num(columns))
  const valid = N >= 1 && D > 0 && fXin > 0 && fZin > 0

  const buildOpts = () => ({
    footingX: fXin,
    footingZ: fZin,
    count: N,
    pileSize: D,
    edge: E,
    columns: cols,
    useGdot,
  })

  // Regenerate whenever an input changes. Manual edits persist until then.
  useEffect(() => {
    if (!valid) {
      setPiles([])
      setMeta(null)
      return
    }
    const result = generateLayout(buildOpts())
    setPiles(result.piles)
    setMeta(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fXin, fZin, N, D, E, cols, useGdot])

  const usedFX = meta?.footingX ?? fXin
  const usedFZ = meta?.footingZ ?? fZin

  const compliance = useMemo(
    () =>
      valid && meta
        ? checkCompliance({
            piles,
            footingX: usedFX,
            footingZ: usedFZ,
            pileSize: D,
            useGdot,
          })
        : [],
    [piles, usedFX, usedFZ, D, useGdot, valid, meta],
  )

  const updatePile = (n, field, value) => {
    const parsed = Number.parseFloat(value)
    setPiles((current) =>
      current.map((pile) =>
        pile.n === n
          ? { ...pile, [field]: Number.isFinite(parsed) ? parsed : 0 }
          : pile,
      ),
    )
  }

  const regenerate = () => {
    if (!valid) {
      return
    }
    const result = generateLayout(buildOpts())
    setPiles(result.piles)
    setMeta(result)
    setActionMessage('Layout regenerated.')
  }

  const handleCopy = async () => {
    const lines = [
      'Pile\tX (in)\tZ (in)',
      ...piles.map((p) => `${p.n}\t${fmt(p.x)}\t${fmt(p.z)}`),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setActionMessage('Copied pile coordinates. Paste into Excel or LEAP.')
    } catch {
      setActionMessage('Clipboard copy failed in this browser session.')
    }
  }

  const handleDownload = () => {
    const csv = [
      'Pile,X (in),Z (in)',
      ...piles.map((p) => `${p.n},${fmt(p.x)},${fmt(p.z)}`),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'pile-coordinates.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    setActionMessage('Downloaded pile-coordinates.csv.')
  }

  const handlePdf = async () => {
    if (!ready) {
      return
    }
    setActionMessage('Generating PDF report...')
    try {
      const { generatePilePdf } = await import('../utils/pilePdf.js')
      const now = new Date()
      const dateStr = now.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      await generatePilePdf({
        piles,
        meta,
        pileType,
        pileSize: D,
        footingX: usedFX,
        footingZ: usedFZ,
        compliance,
        project,
        pageSize,
        dateStr,
        useGdot,
      })
      setActionMessage('PDF report downloaded.')
    } catch (error) {
      setActionMessage(`PDF generation failed: ${error.message}`)
    }
  }

  const reqSp = D > 0 ? minSpacing(D) : 0
  const spacingText = meta
    ? Math.abs(meta.spacingX - meta.spacingZ) < 0.05
      ? meta.spacingX.toFixed(1)
      : `${meta.spacingX.toFixed(1)} (X) / ${meta.spacingZ.toFixed(1)} (Z)`
    : ''
  const ready = valid && piles.length > 0

  return (
    <>
      <section className="toolbar-card">
        <div className="results-head">
          <LayoutGrid size={18} />
          <div>
            <h3>Pile Layout</h3>
            <p>
              Footing in feet; pile size, edge distance, and coordinates in
              inches. Coordinates use the LEAP convention: origin at the mid-left
              of the footing, X horizontal (right positive), Z vertical (down
              positive).
            </p>
          </div>
        </div>

        <div className="pile-input-grid">
          <label className="field">
            <span className="field-label">Footing width, X (ft)</span>
            <input className="field-input" type="number" min="0" step="0.25" value={footingX} onChange={(e) => setFootingX(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Footing depth, Z (ft)</span>
            <input className="field-input" type="number" min="0" step="0.25" value={footingZ} onChange={(e) => setFootingZ(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Number of piles</span>
            <input className="field-input" type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Pile size, D (in)</span>
            <input className="field-input" type="number" min="0" value={pileSize} onChange={(e) => setPileSize(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Pile type</span>
            <select className="field-input" value={pileType} onChange={(e) => setPileType(e.target.value)}>
              <option>Steel H-pile</option>
              <option>PSC pile</option>
              <option>Metal shell pile</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Edge distance, side to face (in)</span>
            <input className="field-input" type="number" min="0" value={edge} onChange={(e) => setEdge(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Piles per row</span>
            <input className="field-input" type="number" min="1" placeholder="auto" value={columns} onChange={(e) => setColumns(e.target.value)} />
          </label>
          <label className="field pile-gdot-field">
            <span className="field-label">Code basis</span>
            <span className="pile-code-row">
              <label className="section-toggle pile-code-locked" title="AASHTO LRFD always applies">
                <input type="checkbox" checked readOnly disabled />
                <span>AASHTO LRFD</span>
              </label>
              <label className="section-toggle">
                <input type="checkbox" checked={useGdot} onChange={(e) => setUseGdot(e.target.checked)} />
                <span>GDOT Manual</span>
              </label>
            </span>
          </label>
        </div>
      </section>

      {ready ? (
        <section className="results-card">
          <div className="results-head">
            <Anchor size={18} />
            <div>
              <h3>Layout &amp; Coordinates</h3>
              <p>
                {meta.arrangementName}. Spacing {spacingText} in c/c, edge{' '}
                {meta.edge} in on all sides.{' '}
                {meta.isPreset ? 'GDOT Appendix 4B preset. ' : 'Rectangular grid. '}
                Minimum footing at the minimum spacing ({reqSp} in) is{' '}
                {ftIn(meta.reqX)} x {ftIn(meta.reqZ)}. Edit any X or Z to adjust;
                the checks below update as you edit.
              </p>
            </div>
          </div>

          <div className="pile-layout-grid">
            <PileDiagram
              piles={piles}
              footingX={usedFX}
              footingZ={usedFZ}
              pileType={pileType}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="pile-table-wrap">
              <CoordGrid piles={piles} onEdit={updatePile} />
            </div>
          </div>

          <div className="compliance-panel">
            <h4>Code compliance</h4>
            <ComplianceList compliance={compliance} />
          </div>
        </section>
      ) : null}

      <section className="results-card">
        <div className="results-head">
          <CircleCheck size={18} />
          <div>
            <h3>Specifications &amp; Requirements</h3>
            <p>
              Pile spacing and edge distances follow AASHTO LRFD 10.7.1.2. The
              GDOT provisions below apply additionally when the GDOT Manual
              option is selected.
            </p>
          </div>
        </div>

        <div className="spec-block">
          <h4>AASHTO LRFD</h4>
          {AASHTO_SPECS.map((spec) => (
            <div className="spec-item" key={spec.clause}>
              <div className="spec-item-head">
                <strong>{spec.clause}</strong>
                <span>{spec.title}</span>
              </div>
              <p>{spec.text}</p>
            </div>
          ))}
        </div>

        <div className={`spec-block ${useGdot ? '' : 'spec-block-muted'}`}>
          <h4>
            GDOT Bridge &amp; Structures Design Manual{' '}
            {useGdot ? '(applied)' : '(not applied)'}
          </h4>
          {GDOT_SPECS.map((spec) => (
            <div className="spec-item" key={spec.clause}>
              <div className="spec-item-head">
                <strong>{spec.clause}</strong>
                <span>{spec.title}</span>
              </div>
              <p>{spec.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="toolbar-card">
        <div className="results-head">
          <Printer size={18} />
          <div>
            <h3>Report &amp; Export</h3>
            <p>
              Project details below appear on the PDF report. Copy, download, or
              export the layout.
            </p>
          </div>
        </div>

        <div className="pile-report-grid">
          <label className="field">
            <span className="field-label">Project name (for report)</span>
            <input
              className="field-input"
              type="text"
              placeholder="optional"
              value={project.name}
              onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">Prepared by</span>
            <input
              className="field-input"
              type="text"
              placeholder="optional"
              value={project.engineer}
              onChange={(e) => setProject((p) => ({ ...p, engineer: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">Job No.</span>
            <input
              className="field-input"
              type="text"
              placeholder="optional"
              value={project.job}
              onChange={(e) => setProject((p) => ({ ...p, job: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">Page size</span>
            <select
              className="field-input"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
            >
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
        </div>

        <div className="action-cluster extractor-actions">
          <button className="button button-secondary" type="button" onClick={regenerate} disabled={!valid}>
            <RefreshCw size={16} />
            <span>Regenerate</span>
          </button>
          <button className="button button-primary" type="button" onClick={handleCopy} disabled={!ready}>
            <ClipboardCopy size={16} />
            <span>Copy coordinates</span>
          </button>
          <button className="button button-secondary" type="button" onClick={handleDownload} disabled={!ready}>
            <Download size={16} />
            <span>Download .csv</span>
          </button>
          <button className="button button-primary" type="button" onClick={handlePdf} disabled={!ready}>
            <Printer size={16} />
            <span>Download PDF report</span>
          </button>
          {actionMessage ? <span className="extractor-message">{actionMessage}</span> : null}
        </div>
      </section>
    </>
  )
}
