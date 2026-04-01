import { ArrowRightLeft, Filter, RotateCcw, Settings2 } from 'lucide-react'

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
  helper,
  enabled,
  toggleLabel,
  onToggle,
  fields,
  onChange,
}) {
  const Icon = icon

  return (
    <section className="transform-group">
      <div className="transform-group-header">
        <div>
          <div className="section-title-row">
            <Icon size={18} />
            <h3>{title}</h3>
          </div>
          <p className="section-helper">{helper}</p>
        </div>

        <label className="remap-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span>{toggleLabel}</span>
        </label>
      </div>

      <div className="remap-grid">
        {fields.map((field) => (
          <article key={field.id} className="remap-box">
            <div className="remap-box-header">
              <div>
                <h4>{field.label}</h4>
                <p>{field.helper}</p>
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
    </section>
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
    <section className="remap-card">
      <div className="section-header">
        <div>
          <div className="section-title-row">
            <Settings2 size={18} />
            <h2>Renumber / Delete Settings</h2>
          </div>
          <p className="section-helper">
            Configure number remaps and default delete filters before export.
            Remaps use one rule per line such as <code>13 = 6</code>. Delete
            filters accept integers or ranges such as <code>1-6</code>.
          </p>
        </div>

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
          helper="Default renumbering now applies to bearing point numbers and column numbers only."
          enabled={remapEnabled}
          toggleLabel="Apply remaps during generation"
          onToggle={onRemapToggle}
          fields={remapFields}
          onChange={onChange}
        />

        <SettingsGroup
          title="Delete Before Export"
          icon={Filter}
          helper="Delete filters act on the original pasted numbers before any remap is applied."
          enabled={deleteEnabled}
          toggleLabel="Apply delete filters during generation"
          onToggle={onDeleteToggle}
          fields={deleteFields}
          onChange={onChange}
        />
      </div>
    </section>
  )
}
