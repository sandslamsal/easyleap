import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'

const STATUS_CONFIG = {
  ready: {
    icon: Clock3,
  },
  success: {
    icon: CheckCircle2,
  },
  error: {
    icon: AlertTriangle,
  },
}

export function StatusBanner({ status }) {
  const Icon = STATUS_CONFIG[status.kind].icon

  return (
    <section className={`status-banner status-banner-${status.kind}`}>
      <div className="status-banner-icon">
        <Icon size={18} />
      </div>
      <div>
        <strong>{status.title}</strong>
        <p>{status.message}</p>
      </div>
    </section>
  )
}
