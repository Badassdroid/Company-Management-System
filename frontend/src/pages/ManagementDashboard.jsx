import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CarFront,
  CircleAlert,
  Package,
  Plus,
  Users,
} from 'lucide-react'
import StatCard from '../components/StatCard.jsx'

const activity = [
  { initials: 'AM', name: 'Alex Morgan', action: 'checked out', detail: 'MacBook Pro 14”', time: '10:42 AM', tone: 'lavender' },
  { initials: 'SK', name: 'Sam Kim', action: 'requested', detail: '2 × Safety helmets', time: '9:18 AM', tone: 'peach' },
  { initials: 'JT', name: 'Jamie Taylor', action: 'returned', detail: 'Toyota Hilux · B 438 AXY', time: 'Yesterday', tone: 'mint' },
  { initials: 'RW', name: 'Riley Williams', action: 'reported', detail: 'Damaged power drill', time: 'Yesterday', tone: 'blue' },
]

const inventory = [
  { name: 'Safety helmets', category: 'Protective equipment', quantity: '8 / 25', fill: 32, tone: 'orange' },
  { name: 'First aid kits', category: 'Safety supplies', quantity: '12 / 20', fill: 60, tone: 'blue' },
  { name: 'Work gloves', category: 'Protective equipment', quantity: '18 / 30', fill: 60, tone: 'green' },
]

function ManagementDashboard() {
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot" /> MONDAY, MAY 19, 2025</div>
          <h1>Good morning, Jordan <span className="wave">✳</span></h1>
          <p className="page-subtitle">Here’s what’s happening across your operations today.</p>
        </div>
        <div className="welcome-actions">
          <button className="button button-secondary" type="button">
            <ArrowDownToLine size={16} /> Export report
          </button>
          <button className="button button-primary" type="button">
            <Plus size={17} /> Add new
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="Operations summary">
        <StatCard label="Total assets" value="248" change="12.8%" note="vs. last month" icon={Boxes} tone="blue" />
        <StatCard label="Active employees" value="64" change="4.2%" note="vs. last month" icon={Users} tone="purple" />
        <StatCard label="Vehicles in use" value="18" change="2.4%" note="vs. last month" icon={CarFront} tone="green" />
        <StatCard label="Open requests" value="07" change="3 new" note="need your attention" icon={Package} tone="orange" trend="down" />
      </section>

      <section className="dashboard-grid">
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>A live feed of what’s happening in your workspace.</p>
            </div>
            <button className="text-button" type="button">View all <ArrowRight size={15} /></button>
          </div>
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-item" key={`${item.name}-${item.detail}`}>
                <span className={`person-avatar ${item.tone}`}>{item.initials}</span>
                <div className="activity-copy">
                  <p><strong>{item.name}</strong> {item.action} <span>{item.detail}</span></p>
                  <small>{item.time}</small>
                </div>
                <ArrowUpRight className="activity-arrow" size={16} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel inventory-panel">
          <div className="panel-heading">
            <div>
              <h2>Inventory health</h2>
              <p>Items getting close to their reorder level.</p>
            </div>
            <button className="more-button" type="button" aria-label="More inventory options">···</button>
          </div>
          <div className="inventory-list">
            {inventory.map((item) => (
              <div className="inventory-item" key={item.name}>
                <div className="inventory-item-heading">
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.category}</small>
                  </div>
                  <span>{item.quantity}</span>
                </div>
                <div className="progress-track">
                  <span className={`progress-fill ${item.tone}`} style={{ width: `${item.fill}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button className="panel-footer-link" type="button">Manage inventory <ArrowRight size={15} /></button>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="notice-card">
          <span className="notice-icon"><CircleAlert size={18} /></span>
          <div>
            <strong>3 items need attention</strong>
            <p>Some inventory is running low. Review and restock to keep your team moving.</p>
          </div>
          <button type="button" aria-label="Review low inventory"><ArrowRight size={17} /></button>
        </article>
        <article className="quick-card">
          <div className="quick-icon"><Package size={18} /></div>
          <div>
            <strong>Everything in its place.</strong>
            <p>248 assets tracked across your workspace.</p>
          </div>
          <span className="quick-stat">96% <small>accounted for</small></span>
        </article>
      </section>
    </>
  )
}

export default ManagementDashboard
