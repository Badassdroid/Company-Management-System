import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

function StatCard({ label, value, change, note, icon: Icon, tone = 'blue', trend = 'up' }) {
  const TrendIcon = trend === 'down' ? ArrowDownRight : ArrowUpRight

  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={18} strokeWidth={1.9} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-footer">
        <span className={`stat-change ${trend}`}>
          <TrendIcon size={14} />
          {change}
        </span>
        <span>{note}</span>
      </div>
    </article>
  )
}

export default StatCard
