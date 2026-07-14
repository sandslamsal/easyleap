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
  Printer,
  RotateCcw,
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
  guessSpanFromText,
} from '../utils/loadCases.js'

let fileCounter = 0

const baseName = (name) => name.replace(/\.pdf$/i, '')

// Plain ruled table used in the printable report.
function PrintTable({ title, subtitle, headers, rows }) {
  return (
    <div className="print-block">
      <h3>
        {title}
        {subtitle ? (
          <span className="print-block-sub"> ({subtitle})</span>
        ) : null}
      </h3>
      <table className="print-table">
        <thead>
          <tr>
            {headers.map((head, index) => (
              <th key={index} className={index === 0 ? 'left' : ''}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={cellIndex === 0 ? 'left' : ''}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function reactionRows(table) {
  return table.labels.map((label) => [
    label,
    ...table.beams.map((beam) => {
      const value = table.values.get(`${beam.key}::${label}`)
      return value === undefined ? '—' : formatValue(value)
    }),
  ])
}

function caseRows(span) {
  return span.beams.map((beam) => [
    beam.label,
    ...LOAD_CASE_DEFS.map((def) =>
      formatValue(span.totals.get(`${beam.key}::${def.key}`) ?? 0),
    ),
  ])
}

// Hidden on screen; revealed and styled for print/PDF only.
function PrintReport({ files, envelopeTable, caseSpans, multiSpan }) {
  const caseHeaders = ['Beam', ...LOAD_CASE_DEFS.map((def) => def.label)]
  return (
    <div className="print-report">
      <header className="print-head">
        <h1>Superstructure Bearing Reactions</h1>
        <p className="print-sub">Shear (V) at Bearing, SERVICE I &middot; Units: kips</p>
      </header>

      <h2>Source files</h2>
      <ul className="print-files">
        {files.map((file) => (
          <li key={file.id}>
            {baseName(file.name)} (Span {file.span ?? 1},{' '}
            {file.result.beamCount} beams)
          </li>
        ))}
      </ul>

      <h2>Extracted reactions</h2>
      {files.map((file) => (
        <PrintTable
          key={file.id}
          title={baseName(file.name)}
          subtitle={`Span ${file.span ?? 1}`}
          headers={['Load Component', ...file.result.table.beams.map((b) => b.label)]}
          rows={reactionRows(file.result.table)}
        />
      ))}
      <PrintTable
        title="Max Envelope"
        subtitle="governing across files"
        headers={['Load Component', ...envelopeTable.beams.map((b) => b.label)]}
        rows={reactionRows(envelopeTable)}
      />

      <h2>Load cases (per beam)</h2>
      {caseSpans.map((span) => (
        <PrintTable
          key={span.tag}
          title={multiSpan ? `Span ${span.tag}` : 'Per-beam case totals'}
          subtitle={`bearing line ${span.line}`}
          headers={caseHeaders}
          rows={caseRows(span)}
        />
      ))}
    </div>
  )
}

function ReactionTable({
  title,
  table,
  subtitle,
  editable = false,
  fileId,
  cellRaw,
  onEditCell,
  isEdited,
}) {
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
                  if (editable) {
                    return (
                      <td key={beam.key} className="reaction-cell">
                        <input
                          className={`reaction-cell-input${
                            isEdited(fileId, beam.key, label) ? ' edited' : ''
                          }`}
                          type="text"
                          inputMode="decimal"
                          aria-label={`${label} for ${beam.label}`}
                          value={cellRaw(fileId, beam.key, label, value)}
                          onChange={(event) =>
                            onEditCell(fileId, beam.key, label, event.target.value)
                          }
                        />
                      </td>
                    )
                  }
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
  const [bearingLine, setBearingLine] = useState('1')
  const [bothSides, setBothSides] = useState(true)
  const [project, setProject] = useState({ name: '', engineer: '', job: '' })
  const [pageSize, setPageSize] = useState('letter')
  const [includeLogo, setIncludeLogo] = useState(true)
  // Manual overrides for extracted cells, so a wrong parsed value can be fixed
  // by hand before exporting: { [fileId]: { `${beamKey}::${label}`: rawString } }
  const [edits, setEdits] = useState({})

  const doneFiles = useMemo(
    () => files.filter((file) => file.status === 'done' && file.result),
    [files],
  )

  // Apply the manual edits on top of the parsed values. Everything downstream
  // (envelope, load cases, every export and the PDF) reads from these edited
  // tables, so a correction made in the UI flows through the whole report.
  const editedDoneFiles = useMemo(() => {
    return doneFiles.map((file) => {
      const fileEdits = edits[file.id]
      if (!fileEdits || Object.keys(fileEdits).length === 0) {
        return file
      }
      const values = new Map(file.result.table.values)
      for (const [key, raw] of Object.entries(fileEdits)) {
        const num = Number(raw)
        if (raw !== '' && Number.isFinite(num)) {
          values.set(key, num)
        }
      }
      return {
        ...file,
        result: { ...file.result, table: { ...file.result.table, values } },
      }
    })
  }, [doneFiles, edits])

  const fileTables = useMemo(
    () =>
      editedDoneFiles.map((file) => ({
        name: file.name,
        table: file.result.table,
      })),
    [editedDoneFiles],
  )

  const envelopeTable = useMemo(
    () => buildEnvelopeTable(fileTables.map((file) => file.table)),
    [fileTables],
  )

  const startLine = Number.parseInt(bearingLine, 10) || 1

  // Group the parsed files by their Span tag. Each span is enveloped only
  // within its own files, so two separate single-span LEAP models (both
  // reporting "Span 1") never contaminate each other. Span N maps to the
  // bearing line at startLine + (N - 1).
  const caseSpans = useMemo(() => {
    const tags = [...new Set(editedDoneFiles.map((file) => file.span ?? 1))].sort(
      (a, b) => a - b,
    )
    return tags.map((tag, index) => {
      const tables = editedDoneFiles
        .filter((file) => (file.span ?? 1) === tag)
        .map((file) => file.result.table)
      const table = buildEnvelopeTable(tables)
      const cases = computeLoadCases(table)
      return {
        tag,
        line: startLine + index,
        fileCount: tables.length,
        beams: cases.beams,
        totals: cases.totals,
      }
    })
  }, [editedDoneFiles, startLine])

  const multiSpan = caseSpans.length > 1

  // One bearing line per span. For a single span, the "both sides" toggle
  // duplicates it onto a second line (identical values).
  const lineSpecs = useMemo(() => {
    const specs = caseSpans.map((span) => ({
      line: span.line,
      beams: span.beams,
      totals: span.totals,
    }))
    if (caseSpans.length === 1 && bothSides) {
      specs.push({
        line: startLine + 1,
        beams: caseSpans[0].beams,
        totals: caseSpans[0].totals,
      })
    }
    return specs
  }, [caseSpans, bothSides, startLine])

  const isParsing = files.some((file) => file.status === 'parsing')
  const hasResults = doneFiles.length > 0

  const hasEdits = useMemo(
    () => Object.values(edits).some((fe) => fe && Object.keys(fe).length > 0),
    [edits],
  )

  // The string shown in an editable cell: the override if one exists, else the
  // parsed value formatted the same way as the read-only tables.
  const cellRaw = (fileId, beamKey, label, value) => {
    const fileEdits = edits[fileId]
    const key = `${beamKey}::${label}`
    if (fileEdits && key in fileEdits) {
      return fileEdits[key]
    }
    return value === undefined ? '' : formatValue(value)
  }

  const isEdited = (fileId, beamKey, label) => {
    const fileEdits = edits[fileId]
    return Boolean(fileEdits && `${beamKey}::${label}` in fileEdits)
  }

  const onEditCell = (fileId, beamKey, label, raw) => {
    setEdits((prev) => {
      const fileEdits = { ...(prev[fileId] || {}) }
      const key = `${beamKey}::${label}`
      if (raw.trim() === '') {
        delete fileEdits[key]
      } else {
        fileEdits[key] = raw
      }
      return { ...prev, [fileId]: fileEdits }
    })
    setActionMessage('')
  }

  const resetEdits = () => {
    setEdits({})
    setActionMessage('Reverted all manual edits back to the extracted values.')
  }

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
      return {
        id: `f${fileCounter}`,
        name: file.name,
        status: 'parsing',
        file,
        span: guessSpanFromText(file.name),
      }
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
          updateFile(entry.id, {
            status: 'done',
            result,
            file: undefined,
            // Refine the span guess now that the internal model name is known.
            span: guessSpanFromText(`${entry.name} ${result.modelName ?? ''}`),
          })
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
      await navigator.clipboard.writeText(buildClipboardTsv(fileTables, caseSpans))
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
      await downloadWorkbook(fileTables, caseSpans, 'bearing-reactions')
      setActionMessage('Downloaded bearing-reactions.xlsx.')
    } catch {
      setActionMessage('Excel export failed in this browser session.')
    }
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
    downloadTextFile(`${def.key}.txt`, buildCaseTxt(def, lineSpecs))
    setActionMessage(`Downloaded ${def.key}.txt.`)
  }

  const handleCopyCase = async (def) => {
    try {
      await navigator.clipboard.writeText(buildCaseTxt(def, lineSpecs))
      setActionMessage(`Copied ${def.key} bearing loads to the clipboard.`)
    } catch {
      setActionMessage('Clipboard copy failed in this browser session.')
    }
  }

  const handleGeneratePdf = async () => {
    if (!hasResults) {
      return
    }
    setActionMessage('Generating PDF report...')
    try {
      const { generateSuperstructurePdf } = await import(
        '../utils/superstructurePdf.js'
      )
      const now = new Date()
      const dateStr = now.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      await generateSuperstructurePdf({
        files: editedDoneFiles,
        envelopeTable,
        caseSpans,
        multiSpan,
        bothSides,
        project,
        pageSize,
        dateStr,
        includeLogo,
      })
      setActionMessage('PDF report downloaded.')
    } catch (error) {
      setActionMessage(
        `PDF generation failed: ${
          error instanceof Error ? error.message : error
        }`,
      )
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
                {file.status === 'done' ? (
                  <select
                    className="file-span"
                    value={file.span ?? 1}
                    onChange={(event) =>
                      updateFile(file.id, { span: Number(event.target.value) })
                    }
                    aria-label={`Cap span for ${file.name}`}
                  >
                    <option value={1}>Span 1</option>
                    <option value={2}>Span 2</option>
                  </select>
                ) : null}
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
              <h3>Bearing Reactions: Shear (V) at Bearing (SERVICE I)</h3>
              <p>
                Unfactored dead-load shear at the bearing for each beam, in kips.
                Click any value to edit it — corrections flow into the Max
                Envelope, the load cases, and every export.
              </p>
            </div>
            {hasEdits ? (
              <button
                type="button"
                className="button button-secondary reset-edits-btn"
                onClick={resetEdits}
              >
                <RotateCcw size={16} />
                <span>Reset edits</span>
              </button>
            ) : null}
          </div>

          {editedDoneFiles.map((file) => (
            <ReactionTable
              key={file.id}
              title={baseName(file.name)}
              subtitle={`Span ${file.span ?? 1}`}
              table={file.result.table}
              editable
              fileId={file.id}
              cellRaw={cellRaw}
              onEditCell={onEditCell}
              isEdited={isEdited}
            />
          ))}

          <ReactionTable
            title="Max Envelope"
            subtitle={`Governing maximum across ${doneFiles.length} file(s) · computed`}
            table={envelopeTable}
          />
        </section>
      ) : null}

      {hasResults ? (
        <section className="results-card">
          <div className="results-head">
            <Layers3 size={18} />
            <div>
              <h3>LEAP Load Cases: DC1 / DC2 / DC / DW</h3>
              <p>
                Per-beam reactions grouped into substructure dead-load cases
                (DC = DC1 + DC2), exported as LEAP bearing-loads import files.
                Values in kips, applied downward (negative Y).
              </p>
            </div>
          </div>

          <div className="case-controls">
            <label className="case-field">
              <span>Bearing line{multiSpan ? ' (Span 1)' : ''}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={bearingLine}
                onChange={(event) => setBearingLine(event.target.value)}
              />
            </label>
            {multiSpan ? (
              <span className="case-note">
                Two spans tagged. Span 1 goes on line {startLine}, Span 2 on
                line {startLine + 1}. Tag files with the selector on each row.
              </span>
            ) : (
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
            )}
          </div>

          {caseSpans.map((span) => (
            <div className="reaction-table-wrap" key={span.tag}>
              <div className="reaction-table-head">
                <h4>{multiSpan ? `Span ${span.tag}` : 'Per-beam case totals'}</h4>
                <span className="reaction-table-sub">
                  Bearing line {span.line} · {span.fileCount} file(s)
                </span>
              </div>
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
                    {span.beams.map((beam) => (
                      <tr key={beam.key}>
                        <td className="reaction-table-label">{beam.label}</td>
                        {LOAD_CASE_DEFS.map((def) => (
                          <td key={def.key}>
                            {formatValue(
                              span.totals.get(`${beam.key}::${def.key}`) ?? 0,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

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

      {hasResults ? (
        <section className="toolbar-card">
          <div className="results-head">
            <FileText size={18} />
            <div>
              <h3>Report &amp; Export</h3>
              <p>
                Project details below appear on the PDF report. It uses the
                EasyLEAP report template — the same header, logo, and layout as
                the Pile Cap report — with your bearing-reaction and load-case
                tables.
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
                onChange={(e) =>
                  setProject((p) => ({ ...p, name: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Prepared by</span>
              <input
                className="field-input"
                type="text"
                placeholder="optional"
                value={project.engineer}
                onChange={(e) =>
                  setProject((p) => ({ ...p, engineer: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Job No.</span>
              <input
                className="field-input"
                type="text"
                placeholder="optional"
                value={project.job}
                onChange={(e) =>
                  setProject((p) => ({ ...p, job: e.target.value }))
                }
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
              onClick={() => window.print()}
              disabled={!hasResults || isParsing}
            >
              <Printer size={16} />
              <span>Print / PDF</span>
            </button>
            <label className="section-toggle case-toggle">
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
              />
              <span>Include EasyLEAP logo</span>
            </label>
            <button
              className="button button-primary"
              type="button"
              onClick={handleGeneratePdf}
              disabled={!hasResults || isParsing}
            >
              <FileText size={16} />
              <span>Download PDF report</span>
            </button>
          </div>
        </section>
      ) : null}

      {hasResults ? (
        <PrintReport
          files={editedDoneFiles}
          envelopeTable={envelopeTable}
          caseSpans={caseSpans}
          multiSpan={multiSpan}
        />
      ) : null}
    </>
  )
}
