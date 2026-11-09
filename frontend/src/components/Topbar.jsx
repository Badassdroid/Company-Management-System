import { LogOut } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../lib/useAuth.js'

const pageNames = {
  '/': 'Dashboard',
  '/employees': 'Employee management',
  '/assets': 'Asset management',
  '/vehicles': 'Vehicle management',
  '/inventory': 'Inventory management',
  '/requests': 'Requests management',
  '/employee': 'Employee portal',
}

function Topbar() {
  const { pathname } = useLocation()
  const { session, signOut } = useAuth()
  const [error, setError] = useState('')
  const email = session?.user?.email || 'Account'
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Northstar Group</span>
        <span className="breadcrumb-divider">/</span>
        <strong>{pageNames[pathname] || 'Operations'}</strong>
      </div>
      <div className="topbar-actions">
        {error && <span className="topbar-error" role="alert">{error}</span>}
        <span className="profile-button">
          <span className="avatar">{initials}</span>
          <span className="profile-name">{email}</span>
        </span>
        <button className="icon-button signout-button" type="button" aria-label="Sign out" title="Sign out" onClick={async () => {
          setError('')
          try { await signOut() } catch (signOutError) { setError(signOutError.message || 'Could not sign out.') }
        }}>
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}

export default Topbar
