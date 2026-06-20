import { useMemo, useRef, useState } from 'react'
import {
  ClipboardCopy,
  Eraser,
  FileSpreadsheet,
  FileText,
  FileUp,
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
              or click to browse. Drop several stages at once — each is parsed
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
              <h3>Bearing Reactions — Shear V at Bearing (SERVICE I)</h3>
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
    </>
  )
}
