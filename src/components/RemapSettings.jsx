import {
  ArrowRightLeft,
  ChevronDown,
  Filter,
  RotateCcw,
  Settings2,
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
                className="load-textarea remap-textarea"
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
              ) : (
                <p className="remap-note">
                  {enabled
                    ? field.activeNote
                    : 'These settings are stored but currently not applied to output.'}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </details>
  )
}

export function RemapSettings({
  remapEnabled,
  deleteEnabled,
  onRemapToggle,
  onDeleteToggle,
  onResetDefaults,
  remapFields,
  deleteFields,
  onChange,
}) {
  return (
    <details className="remap-card accordion-card">
      <summary className="accordion-summary accordion-summary-outer">
        <div className="section-title-row">
          <Settings2 size={18} />
          <h2>Renumber / Delete Settings</h2>
        </div>
        <ChevronDown size={18} className="accordion-chevron" />
      </summary>

      <div className="accordion-body">
        <div className="remap-toolbar">
          <button
            className="button button-secondary"
            type="button"
            onClick={onResetDefaults}
          >
            <RotateCcw size={16} />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="transform-stack">
          <SettingsGroup
            title="Renumber Before Export"
            icon={ArrowRightLeft}
            enabled={remapEnabled}
            toggleLabel="Apply remaps during generation"
            onToggle={onRemapToggle}
            fields={remapFields}
            onChange={onChange}
          />

          <SettingsGroup
            title="Delete Before Export"
            icon={Filter}
            enabled={deleteEnabled}
            toggleLabel="Apply delete filters during generation"
            onToggle={onDeleteToggle}
            fields={deleteFields}
            onChange={onChange}
          />
        </div>
      </div>
    </details>
  )
}
