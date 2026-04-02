import {
  ArrowRightLeft,
  ChevronDown,
  Download,
  Filter,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react'

function RemapStat({ label, value, tone = 'neutral' }) {
  return (
    <div className={`remap-stat remap-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SettingsGroup({
  title,
  icon,
  enabled,
  toggleLabel,
  onToggle,
  fields,
  onChange,
}) {
  const Icon = icon

  return (
    <details className="transform-group accordion-group">
      <summary className="accordion-summary accordion-summary-inner">
        <div className="section-title-row">
          <Icon size={18} />
          <h3>{title}</h3>
        </div>
        <ChevronDown size={18} className="accordion-chevron" />
      </summary>

      <div className="accordion-body">
        <label className="remap-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span>{toggleLabel}</span>
        </label>

        <div className="remap-grid">
          {fields.map((field) => (
            <article key={field.id} className="remap-box">
              <div className="remap-box-header">
                <div>
                  <h4>{field.label}</h4>
                </div>
                <Icon size={16} />
              </div>

              <div className="remap-stats">
                <RemapStat
                  label={field.countLabel}
                  value={field.result.totalCount}
                  tone="success"
                />
                <RemapStat
                  label="Invalid"
                  value={field.result.invalidRows.length}
                  tone="danger"
                />
              </div>

              <textarea
                className={`load-textarea remap-textarea ${field.textareaClassName ?? ''}`}
                rows={field.rows ?? 4}
                wrap="off"
                value={field.value}
                onChange={(event) => onChange(field.id, event.target.value)}
                placeholder={field.placeholder}
                spellCheck={false}
              />

              {field.result.invalidRows.length > 0 ? (
                <div className="remap-error-list">
                  {field.result.invalidRows.map((row) => (
                    <p key={`${field.id}-${row.lineNumber}-${row.error}`}>
                      Line {row.lineNumber}: {row.error}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </details>
  )
}

export function RemapSettings({
  title,
  presetId,
  presetOptions,
  presetLabel,
  remapEnabled,
  deleteEnabled,
  onPresetChange,
  onRemapToggle,
  onDeleteToggle,
  onResetDefaults,
  onExportSettings,
  onImportSettings,
  onClearSettings,
  remapFields,
  deleteFields,
  onChange,
}) {
  return (
    <details className="remap-card accordion-card">
      <summary className="accordion-summary accordion-summary-outer">
        <div className="section-title-row">
          <Settings2 size={18} />
          <h2>{title}</h2>
        </div>
        <ChevronDown size={18} className="accordion-chevron" />
      </summary>

      <div className="accordion-body">
        <div className="remap-toolbar remap-toolbar-top">
          <label className="remap-select-field">
            <span>{presetLabel}</span>
            <select
              className="remap-select"
              value={presetId}
              onChange={(event) => onPresetChange(event.target.value)}
            >
              {presetOptions.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <div className="remap-button-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={onResetDefaults}
            >
              <RotateCcw size={16} />
              <span>Reset Defaults</span>
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onExportSettings}
            >
              <Download size={16} />
              <span>Export Settings JSON</span>
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onImportSettings}
            >
              <Upload size={16} />
              <span>Import Settings JSON</span>
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onClearSettings}
            >
              <Trash2 size={16} />
              <span>Clear Settings</span>
            </button>
          </div>
        </div>

        <div className="transform-stack">
          <SettingsGroup
            title="Delete Before Export"
            icon={Filter}
            enabled={deleteEnabled}
            toggleLabel="Apply delete filters during generation"
            onToggle={onDeleteToggle}
            fields={deleteFields}
            onChange={onChange}
          />

          <SettingsGroup
            title="Renumber Before Export"
            icon={ArrowRightLeft}
            enabled={remapEnabled}
            toggleLabel="Apply remaps during generation"
            onToggle={onRemapToggle}
            fields={remapFields}
            onChange={onChange}
          />
        </div>
      </div>
    </details>
  )
}
