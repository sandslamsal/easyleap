import { startTransition, useRef, useState } from 'react'
import {
  ClipboardCopy,
  Download,
  Eraser,
  Eye,
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
  BRIDGE_PRESETS,
  DEFAULT_BRIDGE_PRESET_ID,
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
import {
  createClearedTransformSettings,
  createTransformSettingsFromPreset,
  getBridgePreset,
  parseTransformSettingsJson,
  serializeTransformSettings,
} from './utils/transformSettings.js'

const DEFAULT_STATUS = {
  kind: 'ready',
  title: 'Ready',
  message:
    'Paste data into one or more sections, then generate a normalized LEAP RC-PIER TXT export.',
}

const EMPTY_REMAP = new Map()
const EMPTY_DELETE_SET = new Set()
const REMAP_DISPLAY_SEPARATOR = ' | '
const DEFAULT_TRANSFORM_SETTINGS = createTransformSettingsFromPreset(
  DEFAULT_BRIDGE_PRESET_ID,
)
const BRIDGE_PRESET_OPTIONS = [
  'i16_bridge_4',
  'i16_bridge_6',
  'i16_bridge_9',
  'user',
].map(
  (presetId) => BRIDGE_PRESETS[presetId],
)

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, '\n')
}

function toSingleLineSettingDisplay(value, separator) {
  return normalizeLineEndings(value)
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(separator)
}

function fromSingleLineRemapInput(value) {
  return normalizeLineEndings(value)
    .split(/\s*(?:\||;|,)\s*|\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n')
}

function fromSingleLineDeleteInput(value) {
  return normalizeLineEndings(value)
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(', ')
}

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
  const settingsImportRef = useRef(null)
  const [fileName, setFileName] = useState('leap-loads')
  const [bearingText, setBearingText] = useState('')
  const [bearingLiveLoads, setBearingLiveLoads] = useState(false)
  const [columnText, setColumnText] = useState('')
  const [capText, setCapText] = useState('')
  const [activeTab, setActiveTab] = useState('bearing')
  const [generatedOutput, setGeneratedOutput] = useState('')
  const [generatedMeta, setGeneratedMeta] = useState(null)
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [actionMessage, setActionMessage] = useState('')
  const [bridgePresetId, setBridgePresetId] = useState(
    DEFAULT_TRANSFORM_SETTINGS.bridgePresetId,
  )
  const [applyRemaps, setApplyRemaps] = useState(
    DEFAULT_TRANSFORM_SETTINGS.applyRemaps,
  )
  const [applyDeleteFilters, setApplyDeleteFilters] = useState(
    DEFAULT_TRANSFORM_SETTINGS.applyDeleteFilters,
  )
  const [bearingPointRemapText, setBearingPointRemapText] = useState(
    DEFAULT_TRANSFORM_SETTINGS.bearingPointRemapText,
  )
  const [columnNumberRemapText, setColumnNumberRemapText] = useState(
    DEFAULT_TRANSFORM_SETTINGS.columnNumberRemapText,
  )
  const [bearingPointDeleteText, setBearingPointDeleteText] = useState(
    DEFAULT_TRANSFORM_SETTINGS.bearingPointDeleteText,
  )
  const [columnNumberDeleteText, setColumnNumberDeleteText] = useState(
    DEFAULT_TRANSFORM_SETTINGS.columnNumberDeleteText,
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
      liveLoadsEnabled: bearingLiveLoads,
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

  const resolvedFileName = normalizeFileName(fileName)
  const activeBridgePreset = getBridgePreset(bridgePresetId)
  const bridgeHeaderMessage =
    actionMessage ||
    (generatedOutput
      ? 'TXT output is ready for download or copy.'
      : 'Generate output to enable export actions.')
  const transformSettings = {
    bridgePresetId,
    applyRemaps,
    applyDeleteFilters,
    bearingPointRemapText,
    columnNumberRemapText,
    bearingPointDeleteText,
    columnNumberDeleteText,
  }

  const remapFields = [
    {
      id: 'bearingPointRemap',
      label: 'Bearing Point Remap',
      placeholder: `13 = 6${REMAP_DISPLAY_SEPARATOR}12 = 5`,
      value: bearingPointRemapText,
      displayValue: toSingleLineSettingDisplay(
        bearingPointRemapText,
        REMAP_DISPLAY_SEPARATOR,
      ),
      result: remapResults.bearingPoint,
      countLabel: 'Rules',
      control: 'single-line',
      inputClassName: 'remap-single-input',
      parseInputValue: fromSingleLineRemapInput,
      parsePastedValue: fromSingleLineRemapInput,
    },
    {
      id: 'columnNumberRemap',
      label: 'Column Number Remap',
      placeholder: `13 = 6${REMAP_DISPLAY_SEPARATOR}12 = 5`,
      value: columnNumberRemapText,
      displayValue: toSingleLineSettingDisplay(
        columnNumberRemapText,
        REMAP_DISPLAY_SEPARATOR,
      ),
      result: remapResults.columnNumber,
      countLabel: 'Rules',
      control: 'single-line',
      inputClassName: 'remap-single-input',
      parseInputValue: fromSingleLineRemapInput,
      parsePastedValue: fromSingleLineRemapInput,
    },
  ]

  const deleteFields = [
    {
      id: 'bearingPointDelete',
      label: 'Bearing Point Delete Filter',
      placeholder: '1-7, 14-20',
      value: bearingPointDeleteText,
      displayValue: toSingleLineSettingDisplay(bearingPointDeleteText, ', '),
      result: deleteResults.bearingPoint,
      countLabel: 'Values',
      control: 'single-line',
      inputClassName: 'remap-single-input',
      parseInputValue: fromSingleLineDeleteInput,
      parsePastedValue: fromSingleLineDeleteInput,
    },
    {
      id: 'columnNumberDelete',
      label: 'Column Number Delete Filter',
      placeholder: '1-7, 14-20',
      value: columnNumberDeleteText,
      displayValue: toSingleLineSettingDisplay(columnNumberDeleteText, ', '),
      result: deleteResults.columnNumber,
      countLabel: 'Values',
      control: 'single-line',
      inputClassName: 'remap-single-input',
      parseInputValue: fromSingleLineDeleteInput,
      parsePastedValue: fromSingleLineDeleteInput,
    },
  ]

  const invalidateGeneratedOutput = () => {
    setGeneratedOutput('')
    setGeneratedMeta(null)
    setStatus(DEFAULT_STATUS)
    setActionMessage('')
  }

  const applyTransformSettings = (settings) => {
    setBridgePresetId(settings.bridgePresetId)
    setApplyRemaps(settings.applyRemaps)
    setApplyDeleteFilters(settings.applyDeleteFilters)
    setBearingPointRemapText(settings.bearingPointRemapText)
    setColumnNumberRemapText(settings.columnNumberRemapText)
    setBearingPointDeleteText(settings.bearingPointDeleteText)
    setColumnNumberDeleteText(settings.columnNumberDeleteText)
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
      setBearingText(bearingLiveLoads ? SAMPLE_DATA.bearingLive : SAMPLE_DATA.bearing)
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

  const handlePresetChange = (nextPresetId) => {
    applyTransformSettings(createTransformSettingsFromPreset(nextPresetId))
    invalidateGeneratedOutput()
    setActionMessage(`${getBridgePreset(nextPresetId).label} preset loaded.`)
  }

  const handleResetDefaults = () => {
    applyTransformSettings(createTransformSettingsFromPreset(bridgePresetId))
    invalidateGeneratedOutput()
    setActionMessage(`${activeBridgePreset.label} defaults restored.`)
  }

  const handleClearSettings = () => {
    applyTransformSettings(createClearedTransformSettings(bridgePresetId))
    invalidateGeneratedOutput()
    setActionMessage('Transformation settings cleared.')
  }

  const handleExportSettings = () => {
    const blob = new Blob([serializeTransformSettings(transformSettings)], {
      type: 'application/json;charset=utf-8',
    })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const baseName = resolvedFileName.replace(/\.txt$/i, '') || 'leap-loads'

    anchor.href = objectUrl
    anchor.download = `${baseName}-settings.json`
    anchor.click()

    URL.revokeObjectURL(objectUrl)
    setActionMessage(`Downloaded ${baseName}-settings.json.`)
  }

  const handleImportSettingsClick = () => {
    settingsImportRef.current?.click()
  }

  const handleImportSettingsFile = async (event) => {
    const [file] = event.target.files ?? []

    if (!file) {
      return
    }

    try {
      const importedSettings = parseTransformSettingsJson(await file.text())
      applyTransformSettings(importedSettings)
      invalidateGeneratedOutput()
      setActionMessage(`Imported settings from ${file.name}.`)
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : 'Settings import failed.',
      )
    } finally {
      event.target.value = ''
    }
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

    const combinedWarnings = [
      ...buildResult.sectionErrors,
      ...transformWarnings,
      ...buildResult.warnings,
    ]
    const totalIssueCount =
      buildResult.totalInvalidRows +
      remapTotals.invalidRules +
      deleteTotals.invalidRules +
      buildResult.totalSectionErrors

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
            buildResult.sectionErrors[0] ??
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

        if (buildResult.totalSectionErrors > 0) {
          issueParts.push(buildResult.sectionErrors.join(' '))
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
    setBearingText('')
    setBearingLiveLoads(false)
    setColumnText('')
    setCapText('')
    applyTransformSettings(DEFAULT_TRANSFORM_SETTINGS)
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
      sectionNote: bearingLiveLoads
        ? 'When enabled, the first half of bearing rows will be tagged as Truck (T) and the second half as Lane (L). Active bearing-point delete filters are still applied before tagging.'
        : null,
      controlsContent: (
        <label className="section-toggle">
          <input
            type="checkbox"
            checked={bearingLiveLoads}
            onChange={(event) => {
              setBearingLiveLoads(event.target.checked)
              invalidateGeneratedOutput()
            }}
          />
          <span>Live Loads</span>
        </label>
      ),
    },
    {
      ...SECTION_META.column,
      value: columnText,
      placeholder: PLACEHOLDERS.column,
      result: liveResults.column,
      sectionNote: null,
      controlsContent: null,
    },
    {
      ...SECTION_META.cap,
      value: capText,
      placeholder: PLACEHOLDERS.cap,
      result: liveResults.cap,
      sectionNote: null,
      controlsContent: null,
    },
  ]

  const activeSection = sectionConfigs.find((section) => section.id === activeTab)

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <h1>LEAP Load TXT Builder</h1>
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
          </div>
        </div>
      </section>

      <RemapSettings
        title={`Bridge Setting (${activeBridgePreset.label})`}
        presetId={bridgePresetId}
        presetOptions={BRIDGE_PRESET_OPTIONS}
        presetLabel="Bridge"
        headerMessage={bridgeHeaderMessage}
        remapEnabled={applyRemaps}
        deleteEnabled={applyDeleteFilters}
        onPresetChange={handlePresetChange}
        onRemapToggle={(nextValue) => {
          setApplyRemaps(nextValue)
          invalidateGeneratedOutput()
        }}
        onDeleteToggle={(nextValue) => {
          setApplyDeleteFilters(nextValue)
          invalidateGeneratedOutput()
        }}
        onResetDefaults={handleResetDefaults}
        onExportSettings={handleExportSettings}
        onImportSettings={handleImportSettingsClick}
        onClearSettings={handleClearSettings}
        remapFields={remapFields}
        deleteFields={deleteFields}
        onChange={handleTransformChange}
      />
      <input
        ref={settingsImportRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        onChange={handleImportSettingsFile}
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
            controlsContent={activeSection.controlsContent}
            sectionNote={activeSection.sectionNote}
          />
        )}
      </section>
    </main>
  )
}

export default App
