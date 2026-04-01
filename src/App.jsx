import { startTransition, useState } from 'react'
import {
  ArrowRightLeft,
  ClipboardCopy,
  Download,
  Eraser,
  Eye,
  FileCog,
  FileText,
  Filter,
  Layers3,
  Pill,
  SquareStack,
  WandSparkles,
} from 'lucide-react'
import './App.css'
import { PreviewPanel } from './components/PreviewPanel.jsx'
import { RemapSettings } from './components/RemapSettings.jsx'
import { SectionEditor } from './components/SectionEditor.jsx'
import { StatusBanner } from './components/StatusBanner.jsx'
import {
  DEFAULT_DELETE_FILTERS,
  DEFAULT_REMAPS,
  PLACEHOLDERS,
  SAMPLE_DATA,
} from './data/samples.js'
import {
  buildLeapTxt,
  normalizeFileName,
  parseBearingLoads,
  parseCapLoads,
  parseColumnLoads,
  parseDeleteFilter,
  parseIdRemap,
} from './utils/parsers.js'

const DEFAULT_STATUS = {
  kind: 'ready',
  title: 'Ready',
  message:
    'Paste data into one or more sections, then generate a normalized LEAP RC-PIER TXT export.',
}

const EMPTY_REMAP = new Map()
const EMPTY_DELETE_SET = new Set()

const SECTION_META = {
  bearing: {
    id: 'bearing',
    title: 'Bearing Loads',
    helper:
      'Paste rows copied from Excel, TXT, PDF, or other tables. Bearing point delete filters and remaps are applied during export when enabled.',
    icon: Pill,
  },
  column: {
    id: 'column',
    title: 'Column Loads',
    helper:
      'Paste LEAP-style column load rows. Labels such as "Col 13" or "Column 8" are normalized automatically.',
    icon: SquareStack,
  },
  cap: {
    id: 'cap',
    title: 'Cap Loads',
    helper:
      'Paste cap forces, moments, or distributed loads from any copied table. Common load types are normalized to expected capitalization.',
    icon: Layers3,
  },
  preview: {
    id: 'preview',
    title: 'Preview / Export',
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
  const [applyRemaps, setApplyRemaps] = useState(true)
  const [applyDeleteFilters, setApplyDeleteFilters] = useState(true)
  const [bearingPointRemapText, setBearingPointRemapText] = useState(
    DEFAULT_REMAPS.bearingPoint,
  )
  const [columnNumberRemapText, setColumnNumberRemapText] = useState(
    DEFAULT_REMAPS.columnNumber,
  )
  const [bearingPointDeleteText, setBearingPointDeleteText] = useState(
    DEFAULT_DELETE_FILTERS.bearingPoint,
  )
  const [columnNumberDeleteText, setColumnNumberDeleteText] = useState(
    DEFAULT_DELETE_FILTERS.columnNumber,
  )

  const remapResults = {
    bearingPoint: parseIdRemap(bearingPointRemapText, 'Bearing point remap'),
    columnNumber: parseIdRemap(columnNumberRemapText, 'Column number remap'),
  }

  const deleteResults = {
    bearingPoint: parseDeleteFilter(
      bearingPointDeleteText,
      'Bearing point delete filter',
    ),
    columnNumber: parseDeleteFilter(
      columnNumberDeleteText,
      'Column number delete filter',
    ),
  }

  const activeMaps = {
    bearingPointMap: applyRemaps ? remapResults.bearingPoint.map : EMPTY_REMAP,
    columnNumberMap: applyRemaps ? remapResults.columnNumber.map : EMPTY_REMAP,
    bearingPointDeleteSet: applyDeleteFilters
      ? deleteResults.bearingPoint.values
      : EMPTY_DELETE_SET,
    columnNumberDeleteSet: applyDeleteFilters
      ? deleteResults.columnNumber.values
      : EMPTY_DELETE_SET,
  }

  const liveResults = {
    bearing: parseBearingLoads(bearingText, {
      bearingPointMap: activeMaps.bearingPointMap,
      bearingPointDeleteSet: activeMaps.bearingPointDeleteSet,
    }),
    column: parseColumnLoads(columnText, {
      columnNumberMap: activeMaps.columnNumberMap,
      columnNumberDeleteSet: activeMaps.columnNumberDeleteSet,
    }),
    cap: parseCapLoads(capText),
  }

  const remapTotals = {
    validRules: Object.values(remapResults).reduce(
      (sum, result) => sum + result.totalCount,
      0,
    ),
    invalidRules: Object.values(remapResults).reduce(
      (sum, result) => sum + result.invalidRows.length,
      0,
    ),
  }

  const deleteTotals = {
    values: Object.values(deleteResults).reduce(
      (sum, result) => sum + result.totalCount,
      0,
    ),
    invalidRules: Object.values(deleteResults).reduce(
      (sum, result) => sum + result.invalidRows.length,
      0,
    ),
  }

  const liveTotals = {
    sectionsWithData: Object.values(liveResults).filter(
      (result) => result.sourceRowCount > 0,
    ).length,
    parsedRows: Object.values(liveResults).reduce(
      (sum, result) => sum + result.validRows.length,
      0,
    ),
    filteredRows: Object.values(liveResults).reduce(
      (sum, result) => sum + result.filteredRows.length,
      0,
    ),
    invalidRows: Object.values(liveResults).reduce(
      (sum, result) => sum + result.invalidRows.length,
      0,
    ),
  }

  const resolvedFileName = normalizeFileName(fileName)

  const remapFields = [
    {
      id: 'bearingPointRemap',
      label: 'Bearing Point Remap',
      helper: 'Default: 13 -> 6 down through 8 -> 1.',
      placeholder: '13 = 6\n12 = 5\n11 = 4\n10 = 3\n9 = 2\n8 = 1',
      value: bearingPointRemapText,
      result: remapResults.bearingPoint,
      countLabel: 'Rules',
      activeNote: 'These remap rules are active for bearing point numbers.',
    },
    {
      id: 'columnNumberRemap',
      label: 'Column Number Remap',
      helper: 'Uses the same default renumbering as bearing points.',
      placeholder: '13 = 6\n12 = 5\n11 = 4\n10 = 3\n9 = 2\n8 = 1',
      value: columnNumberRemapText,
      result: remapResults.columnNumber,
      countLabel: 'Rules',
      activeNote: 'These remap rules are active for column numbers.',
    },
  ]

  const deleteFields = [
    {
      id: 'bearingPointDelete',
      label: 'Bearing Point Delete Filter',
      helper: 'Default removal set: 1-6 and 14-20 before any remap occurs.',
      placeholder: '1-6\n14-20',
      value: bearingPointDeleteText,
      result: deleteResults.bearingPoint,
      countLabel: 'Values',
      activeNote: 'Rows with these original bearing point numbers are removed.',
    },
    {
      id: 'columnNumberDelete',
      label: 'Column Number Delete Filter',
      helper: 'Default removal set: 1-7 and 14-20 before any remap occurs.',
      placeholder: '1-7\n14-20',
      value: columnNumberDeleteText,
      result: deleteResults.columnNumber,
      countLabel: 'Values',
      activeNote: 'Rows with these original column numbers are removed.',
    },
  ]

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

  const handleTransformChange = (fieldId, nextValue) => {
    if (fieldId === 'bearingPointRemap') {
      setBearingPointRemapText(nextValue)
    }

    if (fieldId === 'columnNumberRemap') {
      setColumnNumberRemapText(nextValue)
    }

    if (fieldId === 'bearingPointDelete') {
      setBearingPointDeleteText(nextValue)
    }

    if (fieldId === 'columnNumberDelete') {
      setColumnNumberDeleteText(nextValue)
    }

    invalidateGeneratedOutput()
  }

  const handleResetDefaults = () => {
    setApplyRemaps(true)
    setApplyDeleteFilters(true)
    setBearingPointRemapText(DEFAULT_REMAPS.bearingPoint)
    setColumnNumberRemapText(DEFAULT_REMAPS.columnNumber)
    setBearingPointDeleteText(DEFAULT_DELETE_FILTERS.bearingPoint)
    setColumnNumberDeleteText(DEFAULT_DELETE_FILTERS.columnNumber)
    invalidateGeneratedOutput()
  }

  const handleGenerate = () => {
    const buildResult = buildLeapTxt(liveResults)
    const transformWarnings = []

    if (applyRemaps) {
      remapFields.forEach((field) => {
        if (field.result.totalCount > 0) {
          transformWarnings.push(
            `${field.label} applied ${field.result.totalCount} rule(s) before export.`,
          )
        }
      })
    } else if (remapTotals.validRules > 0) {
      transformWarnings.push('Renumber rules are stored but disabled for this export.')
    }

    if (applyDeleteFilters) {
      deleteFields.forEach((field) => {
        if (field.result.totalCount > 0) {
          transformWarnings.push(
            `${field.label} checks ${field.result.totalCount} number(s) before export.`,
          )
        }
      })
    } else if (deleteTotals.values > 0) {
      transformWarnings.push('Delete filters are stored but disabled for this export.')
    }

    remapFields.forEach((field) => {
      if (field.result.invalidRows.length > 0) {
        transformWarnings.push(
          `${field.label} has ${field.result.invalidRows.length} invalid rule(s). Only valid rules were applied.`,
        )
      }
    })

    deleteFields.forEach((field) => {
      if (field.result.invalidRows.length > 0) {
        transformWarnings.push(
          `${field.label} has ${field.result.invalidRows.length} invalid entry(ies). Only valid values were applied.`,
        )
      }
    })

    const combinedWarnings = [...transformWarnings, ...buildResult.warnings]
    const totalIssueCount =
      buildResult.totalInvalidRows +
      remapTotals.invalidRules +
      deleteTotals.invalidRules

    startTransition(() => {
      setGeneratedOutput(buildResult.output)
      setGeneratedMeta({
        generatedAt: new Date(),
        warnings: combinedWarnings,
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

      if (totalIssueCount > 0) {
        const issueParts = []

        if (buildResult.totalInvalidRows > 0) {
          issueParts.push(`${buildResult.totalInvalidRows} invalid data row(s) were skipped`)
        }

        if (remapTotals.invalidRules > 0) {
          issueParts.push(`${remapTotals.invalidRules} invalid remap rule(s) were ignored`)
        }

        if (deleteTotals.invalidRules > 0) {
          issueParts.push(`${deleteTotals.invalidRules} invalid delete entry(ies) were ignored`)
        }

        setStatus({
          kind: 'error',
          title: 'Errors Found',
          message: `${issueParts.join('. ')}. ${buildResult.totalValidRows} valid row(s) are still ready for export.`,
        })
        return
      }

      if (buildResult.totalFilteredRows > 0) {
        setStatus({
          kind: 'success',
          title: 'Parsed Successfully',
          message: `${buildResult.totalValidRows} valid row(s) exported. ${buildResult.totalFilteredRows} row(s) were removed by active delete filters.`,
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
    setApplyRemaps(true)
    setApplyDeleteFilters(true)
    setBearingPointRemapText(DEFAULT_REMAPS.bearingPoint)
    setColumnNumberRemapText(DEFAULT_REMAPS.columnNumber)
    setBearingPointDeleteText(DEFAULT_DELETE_FILTERS.bearingPoint)
    setColumnNumberDeleteText(DEFAULT_DELETE_FILTERS.columnNumber)
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
          <div className="metric-card">
            <span className="metric-label">Delete-filtered rows</span>
            <strong>{liveTotals.filteredRows}</strong>
          </div>
          <div
            className={`metric-card ${liveTotals.invalidRows || remapTotals.invalidRules || deleteTotals.invalidRules ? 'metric-card-alert' : ''}`}
          >
            <span className="metric-label">Invalid items</span>
            <strong>
              {liveTotals.invalidRows + remapTotals.invalidRules + deleteTotals.invalidRules}
            </strong>
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

      <RemapSettings
        remapEnabled={applyRemaps}
        deleteEnabled={applyDeleteFilters}
        onRemapToggle={(nextValue) => {
          setApplyRemaps(nextValue)
          invalidateGeneratedOutput()
        }}
        onDeleteToggle={(nextValue) => {
          setApplyDeleteFilters(nextValue)
          invalidateGeneratedOutput()
        }}
        onResetDefaults={handleResetDefaults}
        remapFields={remapFields}
        deleteFields={deleteFields}
        onChange={handleTransformChange}
      />

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
            <h2>LEAP Formatting</h2>
            <p>
              Exports use the exact section titles <code>Bearing loads</code>,{' '}
              <code>Column Loads</code>, and <code>Cap Loads</code>, with
              uppercase directions and normalized <code>, </code> separators.
            </p>
          </div>
        </div>
        <div className="info-card">
          <ArrowRightLeft size={18} />
          <div>
            <h2>Default Renumbering</h2>
            <p>
              Bearing point numbers and column numbers default to{' '}
              <code>13-8</code> remapped down to <code>6-1</code>.
            </p>
          </div>
        </div>
        <div className="info-card">
          <Filter size={18} />
          <div>
            <h2>Default Deletions</h2>
            <p>
              Original bearing point numbers in <code>1-6</code> and{' '}
              <code>14-20</code>, plus original column numbers in <code>1-7</code>{' '}
              and <code>14-20</code>, are removed when delete filters are enabled.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
