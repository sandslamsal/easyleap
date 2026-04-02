import { AlertTriangle, CalendarClock, FileText, Info } from 'lucide-react'

export function PreviewPanel({ fileName, generatedAt, output, warnings }) {
  const generatedLabel = generatedAt
    ? generatedAt.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not generated yet'

  return (
    <div className="preview-card">
      <div className="section-header">
        <div>
          <div className="section-title-row">
            <FileText size={18} />
            <h2>Preview / Export</h2>
          </div>
          <p className="section-helper">
            Review the normalized LEAP RC-PIER text below before copying it to
            the clipboard or downloading the TXT file.
          </p>
        </div>
      </div>

      <div className="preview-meta">
        <div className="preview-meta-card">
          <span>Output file</span>
          <strong>{fileName}</strong>
        </div>
        <div className="preview-meta-card">
          <span>Generated</span>
          <strong>{generatedLabel}</strong>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="feedback-panel feedback-panel-warning">
          <div className="feedback-header">
            <AlertTriangle size={16} />
            <span>Notes / Warnings</span>
          </div>
          <div className="warning-list">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="preview-shell">
        {output ? (
          <pre>{output}</pre>
        ) : (
          <div className="empty-preview">
            <CalendarClock size={18} />
            <p>
              Generate the LEAP TXT file to preview the combined bearing,
              column, and cap load sections here.
            </p>
          </div>
        )}
      </div>

      <div className="feedback-panel feedback-panel-info">
        <div className="feedback-header">
          <Info size={16} />
          <span>Import Check</span>
        </div>
        <p>
          Verify LEAP-specific load syntax, directions, and load case intent
          before importing the TXT file into LEAP RC-PIER.
        </p>
      </div>
    </div>
  )
}
