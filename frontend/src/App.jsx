import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import EmployeePortal from './pages/EmployeePortal.jsx'
import { AssetsPage, DashboardPage, EmployeeDetailPage, EmployeesPage, InventoryPage, RequestsPage, VehiclesPage } from './pages/ManagementPages.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { api } from './lib/api.js'
import { useAuth } from './lib/useAuth.js'
import SignIn from './components/SignIn.jsx'
import './style.css'

function AppLayout() {
  const { session, loading, signOut } = useAuth()
  const [profileResult, setProfileResult] = useState(null)

  useEffect(() => {
    if (!session) return undefined

    let active = true
    api('/me', { token: session.access_token })
      .then((profile) => { if (active) setProfileResult({ token: session.access_token, profile }) })
      .catch((error) => {
        if (active) setProfileResult({ token: session.access_token, error: error.message || 'Could not load your account profile.' })
      })

    return () => { active = false }
  }, [session])

  const hasCurrentProfile = profileResult?.token === session?.access_token
  if (loading || (session && !hasCurrentProfile)) return <div className="loading-state full-page">Loading workspace…</div>
  if (!session) return <SignIn />
  if (profileResult?.error) {
    return (
      <main className="signin-shell">
        <section className="signin-card" role="alert">
          <h1>Account profile unavailable</h1>
          <p>{profileResult.error}</p>
          <button className="button button-secondary" type="button" onClick={signOut}>Sign out</button>
        </section>
      </main>
    )
  }

  const account = profileResult.profile
  const isManagement = account?.role === 'management'
  const managementPage = (Page) => isManagement ? <Page /> : <Navigate to="/employee" replace />

  return (
    <div className="app-shell">
      <Sidebar role={account?.role} />
      <div className="main-panel">
        <Topbar />
        <main className="page-content">
          <Routes>
            <Route path="/" element={isManagement ? <DashboardPage /> : <Navigate to="/employee" replace />} />
            <Route path="/employees" element={managementPage(EmployeesPage)} />
            <Route path="/employees/:employeeId" element={managementPage(EmployeeDetailPage)} />
            <Route path="/assets" element={managementPage(AssetsPage)} />
            <Route path="/inventory" element={managementPage(InventoryPage)} />
            <Route path="/vehicles" element={managementPage(VehiclesPage)} />
            <Route path="/requests" element={managementPage(RequestsPage)} />
            <Route path="/employee" element={<EmployeePortal account={account} />} />
            <Route path="/employee/requests" element={<EmployeePortal account={account} view="requests" />} />
            <Route path="/employee/assigned" element={<EmployeePortal account={account} view="assigned" />} />
            <Route path="*" element={<Navigate to={isManagement ? '/' : '/employee'} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
