import {
  Boxes,
  CarFront,
  ClipboardList,
  LayoutDashboard,
  Package,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const managementNavigation = [
  { label: 'Overview', icon: LayoutDashboard, to: '/' },
  { label: 'Employees', icon: Users, to: '/employees' },
  { label: 'Assets', icon: Boxes, to: '/assets' },
  { label: 'Vehicles', icon: CarFront, to: '/vehicles' },
  { label: 'Inventory', icon: Package, to: '/inventory' },
  { label: 'Requests', icon: ClipboardList, to: '/requests' },
]

const employeeNavigation = [
  { label: 'My workspace', icon: LayoutDashboard, to: '/employee' },
  { label: 'My requests', icon: ClipboardList, to: '/employee/requests' },
  { label: 'Assigned items', icon: Boxes, to: '/employee/assigned' },
]

function Sidebar({ role }) {
  const isManagement = role === 'management'
  const navigation = isManagement ? managementNavigation : employeeNavigation

  return (
    <aside className="sidebar">
      <a className="brand" href={isManagement ? '/' : '/employee'} aria-label="Fieldwork home">
        <span className="brand-mark">f</span>
        <span>
          <strong>fieldwork</strong>
          <small>OPERATIONS</small>
        </span>
      </a>

      <div className="sidebar-label">{isManagement ? 'MANAGEMENT' : 'EMPLOYEE'}</div>
      <nav className="side-nav" aria-label={isManagement ? 'Management navigation' : 'Employee navigation'}>
        {navigation.map(({ label, icon: Icon, to }) => (
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            end={to === '/' || to === '/employee'}
            key={label}
            to={to}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-spacer" />
      <div className="workspace-card">
        <span className="workspace-icon">N</span>
        <span>
          <strong>Northstar Group</strong>
          <small>{isManagement ? 'Management team' : 'Employee workspace'}</small>
        </span>
        <span className="workspace-dots" aria-hidden="true">···</span>
      </div>
      {isManagement && (
        <NavLink className={({ isActive }) => `portal-link${isActive ? ' active' : ''}`} to="/employee">
          <Users size={17} strokeWidth={1.8} />
          <span>Employee portal</span>
        </NavLink>
      )}
    </aside>
  )
}

export default Sidebar
