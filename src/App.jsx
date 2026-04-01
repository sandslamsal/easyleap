import { startTransition, useState } from 'react'
import {
  ClipboardCopy,
  Download,
  Eraser,
  Eye,
  FileCog,
  FileText,
  Layers3,
  Pill,
  SquareStack,
  WandSparkles,
} from 'lucide-react'
import './App.css'
import { PreviewPanel } from './components/PreviewPanel.jsx'
import { SectionEditor } from './components/SectionEditor.jsx'
import { StatusBanner } from './components/StatusBanner.jsx'
import { PLACEHOLDERS, SAMPLE_DATA } from './data/samples.js'
import {
  buildLeapTxt,
  normalizeFileName,
  parseBearingLoads,
  parseCapLoads,
  parseColumnLoads,
} from './utils/parsers.js'

const DEFAULT_STATUS = {
  kind: 'ready',
  title: 'Ready',
  message:
    'Paste data into one or more sections, then generate a normalized LEAP RC-PIER TXT export.',
}

const SECTION_META = {
  bearing: {
    id: 'bearing',
    title: 'Bearing Loads',
    shortLabel: 'Bearing',
    helper:
      'Paste rows copied from Excel, TXT, PDF, or other tables. Commas, tabs, and inconsistent spacing are normalized during generation.',
    icon: Pill,
  },
  column: {
    id: 'column',
    title: 'Column Loads',
    shortLabel: 'Column',
    helper:
      'Paste LEAP-style column load rows. The parser keeps the column number, load type, direction, and remaining values in order.',
    icon: SquareStack,
  },
  cap: {
    id: 'cap',
    title: 'Cap Loads',
    shortLabel: 'Cap',
    helper:
      'Paste cap forces, moments, or distributed loads from any copied table. Direction text is uppercased automatically.',
    icon: Layers3,
  },
  preview: {
    id: 'preview',
    title: 'Preview / Export',
    shortLabel: 'Preview',
    helper:
      'Review the assembled TXT output before copying or downloading it.',
    icon: Eye,
  },
}

function App() {
  const [fileName, setFileName] = useState('leap-loads')
  const [description, setDescription] = useState('')
  const [bearingText, setBearingText] = useState('')
  const [columnText, setColumnText] = useState('')
  const [capText, setCapText] = useState('')
  const [activeTab, setActiveTab] = useState('bearing')
  const [generatedOutput, setGeneratedOutput] = useState('')
  const [generatedMeta, setGeneratedMeta] = useState(null)
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [actionMessage, setActionMessage] = useState('')

  const liveResults = {
    bearing: parseBearingLoads(bearingText),
    column: parseColumnLoads(columnText),
    cap: parseCapLoads(capText),
  }

  const liveTotals = {
    sectionsWithData: Object.values(liveResults).filter(
      (result) => result.sourceRowCount > 0,
    ).length,
    parsedRows: Object.values(liveResults).reduce(
      (sum, result) => sum + result.validRows.length,
      0,
    ),
    invalidRows: Object.values(liveResults).reduce(
      (sum, result) => sum + result.invalidRows.length,
      0,
    ),
  }

  const resolvedFileName = normalizeFileName(fileName)

  const invalidateGeneratedOutput = () => {
    setGeneratedOutput('')
    setGeneratedMeta(null)
    setStatus(DEFAULT_STATUS)
    setActionMessage('')
  }

  const handleSectionChange = (sectionId, nextValue) => {
    if (sectionId === 'bearing') {
      setBearingText(nextValue)
    }

    if (sectionId === 'column') {
      setColumnText(nextValue)
    }

    if (sectionId === 'cap') {
      setCapText(nextValue)
    }

    invalidateGeneratedOutput()
  }

  const handlePasteSample = (sectionId) => {
    if (sectionId === 'bearing') {
      setBearingText(SAMPLE_DATA.bearing)
    }

    if (sectionId === 'column') {
      setColumnText(SAMPLE_DATA.column)
    }

    if (sectionId === 'cap') {
      setCapText(SAMPLE_DATA.cap)
    }

    setActiveTab(sectionId)
    invalidateGeneratedOutput()
  }

  const handleGenerate = () => {
    const buildResult = buildLeapTxt(liveResults)

    startTransition(() => {
      setGeneratedOutput(buildResult.output)
      setGeneratedMeta({
        generatedAt: new Date(),
        warnings: buildResult.warnings,
        includedSectionCount: buildResult.includedSectionCount,
        totalValidRows: buildResult.totalValidRows,
        totalInvalidRows: buildResult.totalInvalidRows,
      })
      setActiveTab('preview')
      setActionMessage('')

      if (buildResult.totalValidRows === 0) {
        setStatus({
          kind: 'error',
          title: 'Errors Found',
          message:
            'No valid rows are available to export yet. Fix the highlighted rows or paste data into at least one section.',
        })
        return
      }

      if (buildResult.totalInvalidRows > 0) {
        setStatus({
          kind: 'error',
          title: 'Errors Found',
          message: `${buildResult.totalInvalidRows} invalid row(s) were skipped. ${buildResult.totalValidRows} valid row(s) are still ready for export.`,
        })
        return
      }

      setStatus({
        kind: 'success',
        title: 'Parsed Successfully',
        message: `${buildResult.totalValidRows} valid row(s) were normalized into ${buildResult.includedSectionCount} section(s).`,
      })
    })
  }

  const handleClearAll = () => {
    setFileName('leap-loads')
    setDescription('')
    setBearingText('')
    setColumnText('')
    setCapText('')
    setGeneratedOutput('')
    setGeneratedMeta(null)
    setStatus(DEFAULT_STATUS)
    setActionMessage('')
    setActiveTab('bearing')
  }

  const handleCopyOutput = async () => {
    if (!generatedOutput) {
      setActionMessage('Generate a TXT preview before copying the output.')
      return
    }

    try {
      await navigator.clipboard.writeText(generatedOutput)
      setActionMessage('TXT output copied to the clipboard.')
    } catch {
      setActionMessage('Clipboard copy failed in this browser session.')
    }
  }

  const handleDownload = () => {
    if (!generatedOutput) {
      setActionMessage('Generate a TXT preview before downloading the file.')
      return
    }

    const blob = new Blob([generatedOutput], {
      type: 'text/plain;charset=utf-8',
    })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = objectUrl
    anchor.download = resolvedFileName
    anchor.click()

    URL.revokeObjectURL(objectUrl)
    setActionMessage(`Downloaded ${resolvedFileName}.`)
  }

  const sectionConfigs = [
    {
      ...SECTION_META.bearing,
      value: bearingText,
      placeholder: PLACEHOLDERS.bearing,
      result: liveResults.bearing,
    },
    {
      ...SECTION_META.column,
      value: columnText,
      placeholder: PLACEHOLDERS.column,
      result: liveResults.column,
    },
    {
      ...SECTION_META.cap,
      value: capText,
      placeholder: PLACEHOLDERS.cap,
      result: liveResults.cap,
    },
  ]

  const activeSection = sectionConfigs.find((section) => section.id === activeTab)

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <div className="eyebrow">
            <FileCog size={16} />
            <span>Bridge Engineering Utility</span>
          </div>
          <h1>LEAP Load TXT Builder</h1>
          <p className="hero-text">
            Convert pasted bearing, column, and cap load data into one clean
            LEAP RC-PIER import file without Excel uploads or backend tools.
          </p>
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <span className="metric-label">Sections with data</span>
            <strong>{liveTotals.sectionsWithData}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Parsed rows</span>
            <strong>{liveTotals.parsedRows}</strong>
          </div>
          <div
            className={`metric-card ${liveTotals.invalidRows ? 'metric-card-alert' : ''}`}
          >
            <span className="metric-label">Invalid rows</span>
            <strong>{liveTotals.invalidRows}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar-card">
        <div className="toolbar-grid">
          <label className="field">
            <span className="field-label">Output TXT file name</span>
            <input
              className="field-input"
              type="text"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="leap-loads"
            />
            <span className="field-help">
              Downloads as <strong>{resolvedFileName}</strong>
            </span>
          </label>

          <label className="field">
            <span className="field-label">Optional load case / description</span>
            <input
              className="field-input"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Service II, Pier 3, Stage 1"
            />
            <span className="field-help">
              Kept for your workflow notes only and not written into the TXT
              export.
            </span>
          </label>

          <div className="action-cluster">
            <button className="button button-primary" type="button" onClick={handleGenerate}>
              <WandSparkles size={16} />
              <span>Generate LEAP TXT</span>
            </button>
            <button className="button button-secondary" type="button" onClick={handleClearAll}>
              <Eraser size={16} />
              <span>Clear All</span>
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={handleDownload}
              disabled={!generatedOutput}
            >
              <Download size={16} />
              <span>Download TXT</span>
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={handleCopyOutput}
              disabled={!generatedOutput}
            >
              <ClipboardCopy size={16} />
              <span>Copy Output</span>
            </button>
            <p className="action-message" aria-live="polite">
              {actionMessage || 'Generate output to enable export actions.'}
            </p>
          </div>
        </div>
      </section>

      <StatusBanner status={status} />

      <section className="tabs-card">
        <div className="tab-list" role="tablist" aria-label="Load data sections">
          {Object.values(SECTION_META).map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`tab-button ${isActive ? 'tab-button-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.title}</span>
              </button>
            )
          })}
        </div>

        {activeTab === 'preview' ? (
          <PreviewPanel
            description={description}
            fileName={resolvedFileName}
            generatedAt={generatedMeta?.generatedAt ?? null}
            output={generatedOutput}
            warnings={generatedMeta?.warnings ?? []}
          />
        ) : (
          <SectionEditor
            key={activeSection.id}
            title={activeSection.title}
            helper={activeSection.helper}
            placeholder={activeSection.placeholder}
            value={activeSection.value}
            result={activeSection.result}
            onChange={(nextValue) => handleSectionChange(activeSection.id, nextValue)}
            onPasteSample={() => handlePasteSample(activeSection.id)}
            icon={activeSection.icon}
          />
        )}
      </section>

      <section className="info-strip">
        <div className="info-card">
          <FileText size={18} />
          <div>
            <h2>Normalization Rules</h2>
            <p>
              The parser checks comma-delimited rows first, then tabs, then
              repeated spaces. Blank lines are ignored automatically.
            </p>
          </div>
        </div>
        <div className="info-card">
          <ClipboardCopy size={18} />
          <div>
            <h2>Accepted Sources</h2>
            <p>
              Paste copied rows from Excel, TXT, PDFs, or other tables directly
              into the app. No upload or server processing is used.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
