import { useEffect, useMemo, useState } from 'react'
import {
  Anchor,
  CircleAlert,
  CircleCheck,
  ClipboardCopy,
  Download,
  LayoutGrid,
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

// Plan-view diagram in LEAP convention: origin mid-left, X right, Z down.
function PileDiagram({ piles, footingX, footingZ, pileSize }) {
  if (!(footingX > 0 && footingZ > 0)) {
    return null
  }
  const pad = Math.max(16, footingX * 0.12)
  const W = footingX + 2 * pad
  const H = footingZ + 2 * pad
  const ox = pad // footing left edge (x = 0)
  const oz = pad + footingZ / 2 // mid-height (z = 0)
  const pileEdge = Math.max(6, pileSize)

  return (
    <div className="pile-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <rect
          x={pad}
          y={pad}
          width={footingX}
          height={footingZ}
          className="pile-footing"
        />
        {/* origin axes (mid-left) */}
        <line x1={ox} y1={oz} x2={ox + footingX * 0.42} y2={oz} className="pile-axis" />
        <line x1={ox} y1={oz} x2={ox} y2={oz + footingZ * 0.42} className="pile-axis" />
        <text x={ox + footingX * 0.42 + 4} y={oz + 4} className="pile-axis-label">
          X
        </text>
        <text x={ox - 3} y={oz + footingZ * 0.42 + 12} className="pile-axis-label">
          Z
        </text>
        {piles.map((pile) => {
          const cx = ox + pile.x
          const cy = oz + pile.z
          const outside =
            pile.x < 0 ||
            pile.x > footingX ||
            pile.z < -footingZ / 2 ||
            pile.z > footingZ / 2
          return (
            <g key={pile.n}>
              <rect
                x={cx - pileEdge / 2}
                y={cy - pileEdge / 2}
                width={pileEdge}
                height={pileEdge}
                className={`pile-marker ${outside ? 'pile-marker-bad' : ''}`}
              />
              <text x={cx} y={cy - pileEdge / 2 - 3} className="pile-number">
                {pile.n}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const STATUS_ICON = {
  met: CircleCheck,
  fail: CircleAlert,
  advisory: TriangleAlert,
}

export function PileLayout() {
  const [footingX, setFootingX] = useState('144')
  const [footingZ, setFootingZ] = useState('144')
  const [count, setCount] = useState('4')
  const [pileSize, setPileSize] = useState('14')
  const [pileType, setPileType] = useState('Steel H-pile')
  const [edge, setEdge] = useState('12')
  const [spacing, setSpacing] = useState('')
  const [columns, setColumns] = useState('')
  const [fit, setFit] = useState(true)
  const [useGdot, setUseGdot] = useState(true)
  const [piles, setPiles] = useState([])
  const [meta, setMeta] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  const fX = num(footingX)
  const fZ = num(footingZ)
  const N = Math.max(0, Math.round(num(count)))
  const D = num(pileSize)
  const E = edge.trim() === '' ? 12 : num(edge, 12)
  const SP = spacing.trim() === '' ? 0 : num(spacing)
  const cols = columns.trim() === '' ? 0 : Math.round(num(columns))
  const valid = N >= 1 && D > 0 && (fit || (fX > 0 && fZ > 0))

  // Regenerate the layout whenever an input changes. Manual coordinate edits
  // persist until an input is changed again.
  useEffect(() => {
    if (!valid) {
      setPiles([])
      setMeta(null)
      return
    }
    const result = generateLayout({
      footingX: fX,
      footingZ: fZ,
      count: N,
      pileSize: D,
      edge: E,
      spacing: SP,
      columns: cols,
      useGdot,
      fit,
    })
    setPiles(result.piles)
    setMeta(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fX, fZ, N, D, E, SP, cols, useGdot, fit])

  // Footing actually used (computed in fit mode, otherwise the entered value).
  const usedFX = meta?.footingX ?? fX
  const usedFZ = meta?.footingZ ?? fZ

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
    const result = generateLayout({
      footingX: fX,
      footingZ: fZ,
      count: N,
      pileSize: D,
      edge: E,
      spacing: SP,
      columns: cols,
      useGdot,
      fit,
    })
    setPiles(result.piles)
    setMeta(result)
    setActionMessage('Layout regenerated.')
  }

  const coordRows = () =>
    piles.map(
      (p) =>
        `${p.n}\t${fmt(p.x)}\t${fmt(p.z)}\t${p.batterZ.toFixed(2)}\t${p.batterX.toFixed(2)}`,
    )

  const handleCopy = async () => {
    const header = 'Pile\tX (in)\tZ (in)\tBatter Z-dir\tBatter X-dir'
    try {
      await navigator.clipboard.writeText([header, ...coordRows()].join('\n'))
      setActionMessage('Copied pile coordinates. Paste into Excel or LEAP.')
    } catch {
      setActionMessage('Clipboard copy failed in this browser session.')
    }
  }

  const handleDownload = () => {
    const header = 'Pile,X (in),Z (in),Batter Z-dir (deg),Batter X-dir (deg)'
    const csv = [
      header,
      ...piles.map(
        (p) =>
          `${p.n},${fmt(p.x)},${fmt(p.z)},${p.batterZ.toFixed(2)},${p.batterX.toFixed(2)}`,
      ),
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

  const reqSp = D > 0 ? minSpacing(D) : 0
  const spacingText = meta
    ? Math.abs(meta.spacingX - meta.spacingZ) < 0.05
      ? meta.spacingX.toFixed(1)
      : `${meta.spacingX.toFixed(1)} (X) / ${meta.spacingZ.toFixed(1)} (Z)`
    : ''

  return (
    <>
      <section className="toolbar-card">
        <div className="results-head">
          <LayoutGrid size={18} />
          <div>
            <h3>Pile Layout (GDOT &amp; AASHTO LRFD)</h3>
            <p>
              Enter the footing size, pile count, and pile size. Coordinates use
              the LEAP convention: origin at the mid-left of the footing, X
              horizontal (right positive), Z vertical (down positive). Values in
              inches.
            </p>
          </div>
        </div>

        <div className="pile-input-grid">
          <label className="field pile-fit-field">
            <span className="field-label">Footing size</span>
            <label className="section-toggle">
              <input
                type="checkbox"
                checked={fit}
                onChange={(event) => setFit(event.target.checked)}
              />
              <span>Fit to piles</span>
            </label>
          </label>
          <label className="field">
            <span className="field-label">
              Footing width, X (in){fit ? ' (fit)' : ''}
            </span>
            <input
              className="field-input"
              type="number"
              min="0"
              value={fit ? (meta ? `${meta.footingX}` : '') : footingX}
              onChange={(event) => setFootingX(event.target.value)}
              disabled={fit}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Footing depth, Z (in){fit ? ' (fit)' : ''}
            </span>
            <input
              className="field-input"
              type="number"
              min="0"
              value={fit ? (meta ? `${meta.footingZ}` : '') : footingZ}
              onChange={(event) => setFootingZ(event.target.value)}
              disabled={fit}
            />
          </label>
          <label className="field">
            <span className="field-label">Number of piles</span>
            <input
              className="field-input"
              type="number"
              min="1"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Pile size, D (in)</span>
            <input
              className="field-input"
              type="number"
              min="0"
              value={pileSize}
              onChange={(event) => setPileSize(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Pile type</span>
            <select
              className="field-input"
              value={pileType}
              onChange={(event) => setPileType(event.target.value)}
            >
              <option>Steel H-pile</option>
              <option>PSC pile</option>
              <option>Metal shell pile</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Edge distance, side to face (in)</span>
            <input
              className="field-input"
              type="number"
              min="0"
              value={edge}
              onChange={(event) => setEdge(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Spacing c/c (in)</span>
            <input
              className="field-input"
              type="number"
              min="0"
              placeholder={reqSp ? `${reqSp} (min)` : 'min'}
              value={spacing}
              onChange={(event) => setSpacing(event.target.value)}
              disabled={!fit}
            />
          </label>
          <label className="field">
            <span className="field-label">Piles per row</span>
            <input
              className="field-input"
              type="number"
              min="1"
              placeholder="auto"
              value={columns}
              onChange={(event) => setColumns(event.target.value)}
            />
          </label>
          <label className="field pile-gdot-field">
            <span className="field-label">Code basis</span>
            <span className="pile-code-row">
              <span className="pile-code-mandatory">AASHTO LRFD (mandatory)</span>
              <label className="section-toggle">
                <input
                  type="checkbox"
                  checked={useGdot}
                  onChange={(event) => setUseGdot(event.target.checked)}
                />
                <span>GDOT Manual</span>
              </label>
            </span>
          </label>
        </div>

        <div className="action-cluster extractor-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={regenerate}
            disabled={!valid}
          >
            <RefreshCw size={16} />
            <span>Regenerate</span>
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleCopy}
            disabled={!piles.length}
          >
            <ClipboardCopy size={16} />
            <span>Copy coordinates</span>
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={handleDownload}
            disabled={!piles.length}
          >
            <Download size={16} />
            <span>Download .csv</span>
          </button>
          {actionMessage ? (
            <span className="extractor-message">{actionMessage}</span>
          ) : null}
        </div>
      </section>

      {valid && piles.length ? (
        <section className="results-card">
          <div className="results-head">
            <Anchor size={18} />
            <div>
              <h3>Layout &amp; Coordinates</h3>
              <p>
                {meta?.arrangementName}.{' '}
                {meta
                  ? `Spacing ${spacingText} in c/c, edge ${meta.edge} in on all sides. `
                  : ''}
                {meta?.isPreset
                  ? 'GDOT Appendix 4B preset. '
                  : 'Rectangular grid. '}
                {meta
                  ? `Minimum footing at min spacing (${reqSp} in) is ${meta.reqX} x ${meta.reqZ} in. `
                  : ''}
                Edit any X or Z to adjust; the checks below update live.
              </p>
            </div>
          </div>

          <div className="pile-layout-grid">
            <PileDiagram
              piles={piles}
              footingX={usedFX}
              footingZ={usedFZ}
              pileSize={D}
            />

            <div className="pile-table-wrap">
              <table className="reaction-table pile-table">
                <thead>
                  <tr>
                    <th className="reaction-table-label">Pile</th>
                    <th>X (in)</th>
                    <th>Z (in)</th>
                    <th>Batter Z-dir</th>
                    <th>Batter X-dir</th>
                  </tr>
                </thead>
                <tbody>
                  {piles.map((pile) => (
                    <tr key={pile.n}>
                      <td className="reaction-table-label">{pile.n}</td>
                      <td>
                        <input
                          className="pile-cell-input"
                          type="number"
                          value={pile.x}
                          onChange={(event) =>
                            updatePile(pile.n, 'x', event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="pile-cell-input"
                          type="number"
                          value={pile.z}
                          onChange={(event) =>
                            updatePile(pile.n, 'z', event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="pile-cell-input"
                          type="number"
                          value={pile.batterZ}
                          onChange={(event) =>
                            updatePile(pile.n, 'batterZ', event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="pile-cell-input"
                          type="number"
                          value={pile.batterX}
                          onChange={(event) =>
                            updatePile(pile.n, 'batterX', event.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="compliance-panel">
            <h4>Code compliance (live)</h4>
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
          </div>
        </section>
      ) : null}

      <section className="results-card">
        <div className="results-head">
          <CircleCheck size={18} />
          <div>
            <h3>Specifications &amp; Requirements</h3>
            <p>
              AASHTO LRFD is mandatory. GDOT is applied when the GDOT Manual box
              is ticked.
            </p>
          </div>
        </div>

        <div className="spec-block">
          <h4>AASHTO LRFD (mandatory)</h4>
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
    </>
  )
}
