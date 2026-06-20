import { useMemo, useRef, useState } from 'react'
import {
  ClipboardCopy,
  Download,
  Eraser,
  FileSpreadsheet,
  FileText,
  FileUp,
  Layers3,
  LoaderCircle,
  Table2,
  TriangleAlert,
  Trash2,
} from 'lucide-react'
import { extractBearingReactions } from '../utils/pdfEnvelope.js'
import { buildEnvelopeTable } from '../utils/superstructureParser.js'
import {
  buildClipboardTsv,
  downloadWorkbook,
  formatValue,
} from '../utils/exportReactions.js'
import {
  LOAD_CASE_DEFS,
  buildCaseTxt,
  computeLoadCases,
} from '../utils/loadCases.js'

let fileCounter = 0

function ReactionTable({ title, table, subtitle }) {
  if (!table || table.beams.length === 0) {
    return null
  }

  return (
    <div className="reaction-table-wrap">
      <div className="reaction-table-head">
        <h4>{title}</h4>
        {subtitle ? <span className="reaction-table-sub">{subtitle}</span> : null}
      </div>
      <div className="reaction-table-scroll">
        <table className="reaction-table">
          <thead>
            <tr>
              <th className="reaction-table-label">Load Component</th>
              {table.beams.map((beam) => (
                <th key={beam.key}>{beam.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.labels.map((label) => (
              <tr key={label}>
                <td className="reaction-table-label">{label}</td>
                {table.beams.map((beam) => {
                  const value = table.values.get(`${beam.key}::${label}`)
                  return (
                    <td key={beam.key}>
                      {value === undefined ? '—' : formatValue(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SuperstructureExtractor() {
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [caseSource, setCaseSource] = useState('envelope')
  const [bearingLine, setBearingLine] = useState('1')
  const [bothSides, setBothSides] = useState(true)

  const doneFiles = useMemo(
    () => files.filter((file) => file.status === 'done' && file.result),
    [files],
  )

  const fileTables = useMemo(
    () =>
      doneFiles.map((file) => ({
        name: file.name,
        table: file.result.table,
      })),
    [doneFiles],
  )

  const envelopeTable = useMemo(
    () => buildEnvelopeTable(fileTables.map((file) => file.table)),
    [fileTables],
  )

  // Source table for the DC/DW case files: the governing max envelope by
  // default, or a specific uploaded stage file when selected.
  const caseTable = useMemo(() => {
    if (caseSource !== 'envelope') {
      const match = doneFiles.find((file) => file.id === caseSource)
      if (match) {
        return match.result.table
      }
    }
    return envelopeTable
  }, [caseSource, doneFiles, envelopeTable])

  const loadCases = useMemo(() => computeLoadCases(caseTable), [caseTable])

  const isParsing = files.some((file) => file.status === 'parsing')
  const hasResults = doneFiles.length > 0

  const updateFile = (id, patch) => {
    setFiles((current) =>
      current.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    )
  }

  const addFiles = async (fileList) => {
    const pdfs = Array.from(fileList).filter((file) =>
      /\.pdf$/i.test(file.name),
    )

    if (pdfs.length === 0) {
      setActionMessage('Only PDF report files are supported.')
      return
    }

    setActionMessage('')

    const queued = pdfs.map((file) => {
      fileCounter += 1
      return { id: `f${fileCounter}`, name: file.name, status: 'parsing', file }
    })

    setFiles((current) => [...current, ...queued])

    for (const entry of queued) {
      try {
        const result = await extractBearingReactions(entry.file)
        if (result.table.beams.length === 0) {
          updateFile(entry.id, {
            status: 'error',
            error: 'No SERVICE I shear/moment envelopes found in this PDF.',
            file: undefined,
          })
        } else {
          updateFile(entry.id, { status: 'done', result, file: undefined })
        }
      } catch (error) {
        updateFile(entry.id, {
          status: 'error',
          error:
            error instanceof Error ? error.message : 'Failed to read this PDF.',
          file: undefined,
        })
      }
    }
  }

  const handleInputChange = (event) => {
    if (event.target.files?.length) {
      addFiles(event.target.files)
    }
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer?.files?.length) {
      addFiles(event.dataTransfer.files)
    }
  }

  const handleRemove = (id) => {
    setFiles((current) => current.filter((file) => file.id !== id))
  }

  const handleClearAll = () => {
    setFiles([])
    setActionMessage('')
  }

  const handleCopy = async () => {
    if (!hasResults) {
      return
    }
    try {
      await navigator.clipboard.writeText(buildClipboardTsv(fileTables))
      setActionMessage('Copied all tables. Paste directly into Excel.')
    } catch {
      setActionMessage('Clipboard copy failed in this browser session.')
    }
  }

  const handleDownload = async () => {
    if (!hasResults) {
      return
    }
    try {
      await downloadWorkbook(fileTables, 'bearing-reactions')
      setActionMessage('Downloaded bearing-reactions.xlsx.')
    } catch {
      setActionMessage('Excel export failed in this browser session.')
    }
  }

  const startLine = Number.parseInt(bearingLine, 10) || 1
  const caseOptions = {
    bearingLines: bothSides ? [startLine, startLine + 1] : [startLine],
  }

  const downloadTextFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  }

  const handleDownloadCase = (def) => {
    const content = buildCaseTxt(caseTable, loadCases.totals, def, caseOptions)
    downloadTextFile(`${def.key}.txt`, content)
    setActionMessage(`Downloaded ${def.key}.txt.`)
  }

  const handleCopyCase = async (def) => {
    try {
      const content = buildCaseTxt(caseTable, loadCases.totals, def, caseOptions)
      await navigator.clipboard.writeText(content)
      setActionMessage(`Copied ${def.key} bearing loads to the clipboard.`)
    } catch {
      setActionMessage('Clipboard copy failed in this browser session.')
    }
  }

  return (
    <>
      <section className="toolbar-card">
        <div
          className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              inputRef.current?.click()
            }
          }}
        >
          <FileUp size={28} />
          <div className="dropzone-copy">
            <strong>Drop LEAP superstructure report PDFs here</strong>
            <span>
              or click to browse. Drop several stages at once; each is parsed
              locally in your browser.
            </span>
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleInputChange}
          />
        </div>

        {files.length > 0 ? (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.id} className={`file-row file-row-${file.status}`}>
                <FileText size={16} />
                <span className="file-name">{file.name}</span>
                <span className="file-status">
                  {file.status === 'parsing' ? (
                    <>
                      <LoaderCircle size={14} className="spin" /> Parsing…
                    </>
                  ) : file.status === 'error' ? (
                    <>
                      <TriangleAlert size={14} /> {file.error}
                    </>
                  ) : (
                    `${file.result.beamCount} beam(s) · ${file.result.pageCount} pages`
                  )}
                </span>
                <button
                  type="button"
                  className="file-remove"
                  onClick={() => handleRemove(file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="action-cluster extractor-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={handleCopy}
            disabled={!hasResults || isParsing}
          >
            <ClipboardCopy size={16} />
            <span>Copy All (Excel)</span>
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={handleDownload}
            disabled={!hasResults || isParsing}
          >
            <FileSpreadsheet size={16} />
            <span>Download .xlsx</span>
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={handleClearAll}
            disabled={files.length === 0}
          >
            <Eraser size={16} />
            <span>Clear All</span>
          </button>
          {actionMessage ? (
            <span className="extractor-message">{actionMessage}</span>
          ) : null}
        </div>
      </section>

      {hasResults ? (
        <section className="results-card">
          <div className="results-head">
            <Table2 size={18} />
            <div>
              <h3>Bearing Reactions: Shear V at Bearing (SERVICE I)</h3>
              <p>
                Unfactored dead-load shear at the bearing for each beam. Values
                in kips.
              </p>
            </div>
          </div>

          {doneFiles.map((file) => (
            <ReactionTable
              key={file.id}
              title={file.name}
              table={file.result.table}
            />
          ))}

          <ReactionTable
            title="Max Envelope"
            subtitle={`Governing maximum across ${doneFiles.length} file(s)`}
            table={envelopeTable}
          />
        </section>
      ) : null}

      {hasResults ? (
        <section className="results-card">
          <div className="results-head">
            <Layers3 size={18} />
            <div>
              <h3>LEAP Load Cases: DC1 / DC2 / DW</h3>
              <p>
                Per-beam reactions grouped into substructure dead-load cases,
                exported as LEAP bearing-loads import files. Values in kips,
                applied downward (negative Y).
              </p>
            </div>
          </div>

          <div className="case-controls">
            <label className="case-field">
              <span>Source reactions</span>
              <select
                value={caseSource}
                onChange={(event) => setCaseSource(event.target.value)}
              >
                <option value="envelope">Max Envelope (governing)</option>
                {doneFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="case-field">
              <span>Bearing line</span>
              <input
                type="number"
                min="1"
                step="1"
                value={bearingLine}
                onChange={(event) => setBearingLine(event.target.value)}
              />
            </label>
            <label className="section-toggle case-toggle">
              <input
                type="checkbox"
                checked={bothSides}
                onChange={(event) => setBothSides(event.target.checked)}
              />
              <span>
                Both sides of cap (duplicate to line {startLine + 1})
              </span>
            </label>
          </div>

          <div className="reaction-table-wrap">
            <div className="reaction-table-scroll">
              <table className="reaction-table">
                <thead>
                  <tr>
                    <th className="reaction-table-label">Beam</th>
                    {LOAD_CASE_DEFS.map((def) => (
                      <th key={def.key}>{def.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {caseTable.beams.map((beam) => (
                    <tr key={beam.key}>
                      <td className="reaction-table-label">{beam.label}</td>
                      {LOAD_CASE_DEFS.map((def) => (
                        <td key={def.key}>
                          {formatValue(
                            loadCases.totals.get(`${beam.key}::${def.key}`) ?? 0,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="case-actions">
            {LOAD_CASE_DEFS.map((def) => (
              <div key={def.key} className="case-export">
                <div className="case-export-head">
                  <strong>{def.label}</strong>
                  <span>{def.description}</span>
                </div>
                <div className="case-export-buttons">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => handleDownloadCase(def)}
                  >
                    <Download size={16} />
                    <span>{def.key}.txt</span>
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => handleCopyCase(def)}
                  >
                    <ClipboardCopy size={16} />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
