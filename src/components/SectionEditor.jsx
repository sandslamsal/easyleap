import {
  AlertTriangle,
  ClipboardPaste,
  Filter,
  Info,
  Rows3,
  ShieldCheck,
} from 'lucide-react'

function StatChip({ label, value, tone = 'neutral' }) {
  return (
    <div className={`stat-chip stat-chip-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function SectionEditor({
  title,
  helper,
  placeholder,
  value,
  result,
  onChange,
  onPasteSample,
  icon,
  controlsContent,
  sectionNote,
}) {
  const Icon = icon

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <div className="section-title-row">
            <Icon size={18} />
            <h2>{title}</h2>
          </div>
          <p className="section-helper">{helper}</p>
        </div>

        <div className="section-actions">
          <button className="button button-secondary" type="button" onClick={onPasteSample}>
            <ClipboardPaste size={16} />
            <span>Paste Sample</span>
          </button>
          {controlsContent}
        </div>
      </div>

      <div className="section-stats">
        <StatChip label="Pasted Rows" value={result.sourceRowCount} />
        <StatChip label="Parsed Rows" value={result.validRows.length} tone="success" />
        <StatChip label="Filtered Rows" value={result.filteredRows.length} />
        <StatChip label="Invalid Rows" value={result.invalidRows.length} tone="danger" />
      </div>

      {sectionNote ? (
        <div className="feedback-panel feedback-panel-info">
          <div className="feedback-header">
            <Info size={16} />
            <span>Note</span>
          </div>
          <p>{sectionNote}</p>
        </div>
      ) : null}

      <label className="textarea-wrap">
        <span className="sr-only">{title} input</span>
        <textarea
          className="load-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
      </label>

      {result.sectionErrors?.length > 0 ? (
        <div className="feedback-panel feedback-panel-danger">
          <div className="feedback-header">
            <AlertTriangle size={16} />
            <span>Section validation</span>
          </div>
          <div className="feedback-list">
            {result.sectionErrors.map((error) => (
              <article key={error} className="issue-card">
                <p>{error}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {result.sectionWarnings?.length > 0 ? (
        <div className="feedback-panel feedback-panel-warning">
          <div className="feedback-header">
            <Info size={16} />
            <span>Section notes</span>
          </div>
          <div className="feedback-list">
            {result.sectionWarnings.map((warning) => (
              <article key={warning} className="issue-card">
                <p>{warning}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {result.invalidRows.length > 0 ? (
        <div className="feedback-panel feedback-panel-danger">
          <div className="feedback-header">
            <AlertTriangle size={16} />
            <span>Rows needing attention</span>
          </div>
          <div className="feedback-list">
            {result.invalidRows.map((row) => (
              <article key={`${row.lineNumber}-${row.rawLine}`} className="issue-card">
                <div className="issue-card-header">
                  <Rows3 size={14} />
                  <strong>Line {row.lineNumber}</strong>
                </div>
                <p>{row.error}</p>
                <code>{row.rawLine}</code>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="feedback-panel feedback-panel-success">
          <div className="feedback-header">
            <ShieldCheck size={16} />
            <span>Validation</span>
          </div>
          <p>
            {result.sourceRowCount > 0
              ? 'No row-level issues detected in this section.'
              : 'Paste data here to see parsed counts and validation feedback.'}
          </p>
        </div>
      )}

      {result.filteredRows.length > 0 ? (
        <div className="feedback-panel feedback-panel-info">
          <div className="feedback-header">
            <Filter size={16} />
            <span>Rows removed by filters</span>
          </div>
          <div className="feedback-list">
            {result.filteredRows.map((row) => (
              <article key={`${row.lineNumber}-${row.rawLine}`} className="issue-card">
                <div className="issue-card-header">
                  <Rows3 size={14} />
                  <strong>Line {row.lineNumber}</strong>
                </div>
                <p>{row.reason}</p>
                <code>{row.rawLine}</code>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
