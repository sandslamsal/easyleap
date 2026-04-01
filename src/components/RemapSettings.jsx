import { ArrowRightLeft, RotateCcw, Settings2 } from 'lucide-react'

function RemapStat({ label, value, tone = 'neutral' }) {
  return (
    <div className={`remap-stat remap-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function RemapSettings({
  enabled,
  onToggle,
  onResetDefaults,
  fields,
  onChange,
}) {
  return (
    <section className="remap-card">
      <div className="section-header">
        <div>
          <div className="section-title-row">
            <Settings2 size={18} />
            <h2>Default Remap Settings</h2>
          </div>
          <p className="section-helper">
            Apply editable integer remap rules before export. Use one rule per
            line such as <code>13 = 6</code>, <code>8 -&gt; 1</code>, or{' '}
            <code>12, 5</code>.
          </p>
        </div>

        <div className="remap-actions">
          <label className="remap-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onToggle(event.target.checked)}
            />
            <span>Apply remaps during generation</span>
          </label>

          <button
            className="button button-secondary"
            type="button"
            onClick={onResetDefaults}
          >
            <RotateCcw size={16} />
            <span>Reset Samples</span>
          </button>
        </div>
      </div>

      <div className="remap-grid">
        {fields.map((field) => (
          <article key={field.id} className="remap-box">
            <div className="remap-box-header">
              <div>
                <h3>{field.label}</h3>
                <p>{field.helper}</p>
              </div>
              <ArrowRightLeft size={16} />
            </div>

            <div className="remap-stats">
              <RemapStat label="Rules" value={field.result.validRows.length} tone="success" />
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
                  <p key={`${field.id}-${row.lineNumber}`}>
                    Line {row.lineNumber}: {row.error}
                  </p>
                ))}
              </div>
            ) : (
              <p className="remap-note">
                {enabled
                  ? 'These rules are active and will be applied to normalized output.'
                  : 'These rules are stored but currently not applied to output.'}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
