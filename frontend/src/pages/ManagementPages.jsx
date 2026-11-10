import { useState } from 'react'
import { ArrowRight, Boxes, CarFront, Check, Package, Pencil, RotateCcw, UserPlus, UserX, Users, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import StatCard from '../components/StatCard.jsx'
import {
  AddButton,
  DataTable,
  LoadingState,
  PageError,
  PageHeader,
  RecordDialog,
  StatusBadge,
} from '../components/ManagementUI.jsx'
import { api, jsonRequest } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.js'
import { useApiData } from '../lib/useApiData.js'

const loadDashboard = (token) => api('/dashboard', { token })
const loadEmployees = (token) => api('/employees', { token })
const loadAssets = (token) => api('/assets', { token })
const loadAssetAssignments = (token) => api('/asset-assignments', { token })
const loadVehicles = (token) => api('/vehicles', { token })
const loadVehicleAssignments = (token) => api('/vehicle-assignments', { token })
const loadInventory = (token) => api('/inventory', { token })
const loadInventoryTransactions = (token) => api('/inventory/transactions', { token })
const loadRequests = (token) => api('/requests', { token })

const employeeFields = [
  { name: 'employee_number', label: 'Employee number', required: true },
  { name: 'first_name', label: 'First name', required: true },
  { name: 'last_name', label: 'Last name', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone' },
  { name: 'department', label: 'Department' },
  { name: 'job_title', label: 'Job title' },
  { name: 'employment_status', label: 'Employment status', type: 'select', options: ['active', 'inactive', 'terminated'], defaultValue: 'active' },
  { name: 'start_date', label: 'Start date', type: 'date' },
  { name: 'end_date', label: 'End date', type: 'date' },
]

const assetFields = [
  { name: 'asset_code', label: 'Asset code', required: true },
  { name: 'name', label: 'Name', required: true },
  { name: 'category', label: 'Category', required: true },
  { name: 'serial_number', label: 'Serial number' },
  { name: 'brand', label: 'Brand' },
  { name: 'model', label: 'Model' },
  { name: 'condition', label: 'Condition', defaultValue: 'good' },
  { name: 'purchase_date', label: 'Purchase date', type: 'date' },
  { name: 'purchase_cost', label: 'Purchase cost', type: 'number', min: 0, step: '0.01', optional: true },
  { name: 'description', label: 'Description', type: 'textarea', wide: true },
  { name: 'status', label: 'Status', type: 'select', options: ['available', 'assigned', 'maintenance', 'retired', 'lost'], defaultValue: 'available' },
]

const vehicleFields = [
  { name: 'registration_number', label: 'Registration number', required: true },
  { name: 'make', label: 'Make', required: true },
  { name: 'model', label: 'Model', required: true },
  { name: 'year', label: 'Year', type: 'number', min: 1900, step: 1, optional: true },
  { name: 'vin', label: 'VIN' },
  { name: 'fuel_type', label: 'Fuel type', required: true },
  { name: 'tank_capacity_litres', label: 'Tank capacity (litres)', type: 'number', min: 0, step: '0.1', optional: true },
  { name: 'current_odometer_km', label: 'Odometer (km)', type: 'number', min: 0, step: '0.1', defaultValue: 0 },
  { name: 'status', label: 'Status', type: 'select', options: ['available', 'assigned', 'maintenance', 'retired'], defaultValue: 'available' },
]

const inventoryFields = [
  { name: 'item_code', label: 'Item code', required: true },
  { name: 'name', label: 'Name', required: true },
  { name: 'category', label: 'Category', required: true },
  { name: 'unit', label: 'Unit', defaultValue: 'each' },
  { name: 'reorder_level', label: 'Reorder level', type: 'number', min: 0, step: '0.001', defaultValue: 0 },
]

function usePageActions(refresh) {
  const { session } = useAuth()
  const [dialog, setDialog] = useState(null)
  const [actionError, setActionError] = useState('')

  async function mutate(path, method, payload) {
    setActionError('')
    const result = await api(path, { token: session.access_token, ...jsonRequest(method, payload) })
    refresh()
    return result
  }

  return { dialog, setDialog, actionError, setActionError, mutate }
}

function ManagementPage({ eyebrow, title, description, loading, error, refresh, action, children }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} onRefresh={refresh} refreshing={loading} />
      <PageError onRetry={refresh}>{error}</PageError>
      {loading ? <LoadingState /> : children}
    </>
  )
}

function FormModal({ dialog, setDialog, onSubmit }) {
  if (!dialog) return null
  return (
    <RecordDialog
      title={dialog.title}
      fields={dialog.fields}
      initial={dialog.initial}
      submitLabel={dialog.submitLabel}
      onSubmit={dialog.onSubmit || onSubmit}
      onClose={() => setDialog(null)}
    />
  )
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'
}

export function DashboardPage() {
  const { data, loading, error, refresh } = useApiData({ dashboard: loadDashboard })
  const dashboard = data.dashboard || {}
  const recentActivity = dashboard.recent_activity || []
  const lowStock = dashboard.low_stock_items || []

  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS OVERVIEW"
        title="Dashboard"
        description="Live statistics and the latest activity across your operations."
        onRefresh={refresh}
        refreshing={loading}
      />
      <PageError onRetry={refresh}>{error}</PageError>
      {loading ? <LoadingState /> : (
        <>
          <section className="stat-grid" aria-label="Operations summary">
            <StatCard label="Total assets" value={dashboard.total_assets ?? 0} change="Live" note="tracked in the system" icon={Boxes} tone="blue" />
            <StatCard label="Active employees" value={dashboard.active_employees ?? 0} change="Live" note="currently active" icon={Users} tone="purple" />
            <StatCard label="Vehicles in use" value={dashboard.vehicles_in_use ?? 0} change="Live" note="currently assigned" icon={CarFront} tone="green" />
            <StatCard label="Open requests" value={dashboard.open_requests ?? 0} change="Review" note="pending requests" icon={Package} tone="orange" trend="down" />
          </section>
          <section className="dashboard-grid">
            <article className="panel management-panel">
              <div className="panel-heading">
                <div><h2>Recent activity</h2><p>Latest requests, checkouts, returns and stock movements.</p></div>
                <Link className="text-button" to="/requests">All requests <ArrowRight size={15} /></Link>
              </div>
              <DataTable
                rows={recentActivity}
                empty="No recent activity."
                columns={[
                  { key: 'type', label: 'Activity' },
                  { key: 'detail', label: 'Record', render: (row) => <span className="truncate-cell" title={row.detail}>{row.detail}</span> },
                  { key: 'employee', label: 'Employee' },
                  { key: 'occurred_at', label: 'When', render: (row) => formatDate(row.occurred_at) },
                ]}
              />
            </article>
            <article className="panel management-panel">
              <div className="panel-heading">
                <div><h2>Inventory health</h2><p>Items at or below their reorder threshold.</p></div>
                <Link className="text-button" to="/inventory">Manage <ArrowRight size={15} /></Link>
              </div>
              {lowStock.length ? (
                <DataTable
                  rows={lowStock}
                  rowKey="item_id"
                  columns={[
                    { key: 'name', label: 'Item' },
                    { key: 'quantity_on_hand', label: 'On hand' },
                    { key: 'reorder_level', label: 'Reorder at' },
                  ]}
                />
              ) : <div className="empty-state">No low-stock items need attention.</div>}
            </article>
          </section>
          <section className="panel management-panel">
            <div className="panel-heading">
              <div><h2>Shortcuts</h2><p>Go directly to common operations.</p></div>
            </div>
            <div className="shortcut-grid">
              {[
                ['/employees', 'Employee management', 'Add, edit, deactivate and view employees.'],
                ['/assets', 'Asset management', 'Register, assign, return and track assets.'],
                ['/vehicles', 'Vehicle management', 'Register vehicles, assign drivers and track usage.'],
                ['/inventory', 'Inventory management', 'Add stock, update quantities and track stock movements.'],
                ['/requests', 'Requests management', 'Review and approve or reject employee requests.'],
              ].map(([to, label, detail]) => (
                <Link className="shortcut-card" to={to} key={to}>
                  <span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  )
}

export function EmployeesPage() {
  const { data, loading, error, refresh } = useApiData({ employees: loadEmployees })
  const employees = data.employees || []
  const actions = usePageActions(refresh)
  async function submitForm(payload) {
    if (actions.dialog.record) {
      await actions.mutate(`/employees/${actions.dialog.record.id}`, 'PATCH', payload)
      return
    }

    const employee = await actions.mutate('/employees', 'POST', payload)
    if (employee.email && employee.employment_status === 'active') {
      try {
        await actions.mutate(`/employees/${employee.id}/account`, 'POST')
      } catch (accountError) {
        actions.setActionError(`Employee added, but account setup failed: ${accountError.message}`)
      }
    }
    refresh()
  }

  async function deactivate(employee) {
    if (!window.confirm(`Deactivate ${employee.first_name} ${employee.last_name}?`)) return
    try {
      await actions.mutate(`/employees/${employee.id}`, 'DELETE')
    } catch (actionError) {
      actions.setActionError(actionError.message)
    }
  }

  async function createLogin(employee) {
    try {
      await actions.mutate(`/employees/${employee.id}/account`, 'POST')
    } catch (accountError) {
      actions.setActionError(accountError.message)
    }
  }

  return (
    <>
      <ManagementPage eyebrow="PEOPLE" title="Employee management" description="Add employees and manage their company sign-in accounts." loading={loading} error={error} refresh={refresh}
        action={<AddButton onClick={() => actions.setDialog({ title: 'Add employee', fields: employeeFields })}>Add employee</AddButton>}>
        <PageError>{actions.actionError}</PageError>
        <section className="panel management-panel">
          <DataTable
            rows={employees}
            empty="No employees have been added yet."
            columns={[
              { key: 'employee_number', label: 'Employee', render: (row) => <div className="person-cell"><span className="person-avatar lavender">{initials(`${row.first_name} ${row.last_name}`)}</span><span><strong>{row.first_name} {row.last_name}</strong><small>{row.employee_number}</small></span></div> },
              { key: 'department', label: 'Department' },
              { key: 'job_title', label: 'Job title' },
              { key: 'email', label: 'Email' },
              { key: 'has_account', label: 'Login', render: (row) => row.has_account ? 'Linked' : 'Not linked' },
              { key: 'employment_status', label: 'Status', render: (row) => <StatusBadge>{row.employment_status}</StatusBadge> },
              {
                key: 'actions', label: 'Actions', render: (row) => (
                  <div className="row-actions">
                    <Link className="icon-button" title="View employee" aria-label="View employee" to={`/employees/${row.id}`}><ArrowRight size={15} /></Link>
                    <button className="icon-button" title="Edit employee" aria-label="Edit employee" type="button" onClick={() => actions.setDialog({ title: 'Edit employee', fields: employeeFields, initial: row, record: row })}><Pencil size={15} /></button>
                    {!row.has_account && row.email && row.employment_status === 'active' && <button className="icon-button" title="Create or link login" aria-label={`Create or link login for ${row.first_name} ${row.last_name}`} type="button" onClick={() => createLogin(row)}><UserPlus size={15} /></button>}
                    {row.employment_status === 'active' && <button className="icon-button danger-icon" title="Deactivate employee" aria-label="Deactivate employee" type="button" onClick={() => deactivate(row)}><UserX size={15} /></button>}
                  </div>
                )
              },
            ]}
          />
        </section>
      </ManagementPage>
      <FormModal dialog={actions.dialog} setDialog={actions.setDialog} onSubmit={submitForm} />
    </>
  )
}

export function EmployeeDetailPage() {
  const { employeeId } = useParams()
  const { session } = useAuth()
  const [leaveBalanceDialog, setLeaveBalanceDialog] = useState(false)
  const { data, loading, error, refresh } = useApiData({
    employee: (token) => api(`/employees/${employeeId}`, { token }),
    assetAssignments: (token) => api(`/asset-assignments?employee_id=${employeeId}`, { token }).catch(() => []),
    vehicleAssignments: (token) => api(`/vehicle-assignments?employee_id=${employeeId}`, { token }).catch(() => []),
    requests: (token) => api(`/requests?employee_id=${employeeId}`, { token }).catch(() => []),
    fuelAllocations: (token) => api(`/fuel-allocations?employee_id=${employeeId}`, { token }).catch(() => []),
    leaveBalance: (token) => api(`/leave-balance?employee_id=${employeeId}`, { token }).catch(() => null),
    assetCatalog: (token) => api('/assets', { token }).catch(() => []),
    vehicleCatalog: (token) => api('/vehicles', { token }).catch(() => []),
  })

  const employee = data.employee || {}
  const assetAssignments = data.assetAssignments || []
  const vehicleAssignments = data.vehicleAssignments || []
  const requests = data.requests || []
  const fuelAllocations = data.fuelAllocations || []
  const leaveBalance = data.leaveBalance || null
  const assetCatalog = data.assetCatalog || []
  const vehicleCatalog = data.vehicleCatalog || []
  const assetMap = Object.fromEntries(assetCatalog.map((asset) => [asset.id, asset]))
  const vehicleMap = Object.fromEntries(vehicleCatalog.map((vehicle) => [vehicle.id, vehicle]))
  const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee profile'
  const profile = {
    employeeId: employee.employee_number || 'EMP001',
    fullName: employeeName,
    department: employee.department || 'IT',
    jobTitle: employee.job_title || 'IT Support Technician',
    employmentType: employee.employment_type || (employee.employment_status === 'active' ? 'Full-time' : 'Contract'),
    phoneNumber: employee.phone || '+267 71234567',
    emailAddress: employee.email || 'john@company.com',
    residentialAddress: employee.residential_address || 'Gaborone, Botswana',
    gender: employee.gender || 'Male',
    dateOfBirth: employee.date_of_birth || '15/06/1998',
    status: employee.employment_status || 'active',
    profilePicture: employee.profile_picture || '',
  }
  const leaveRemaining = leaveBalance ? Number(leaveBalance.annual_entitlement || 0) - Number(leaveBalance.days_taken || 0) : 10

  async function saveLeaveBalance(payload) {
    await api('/leave-balances', {
      token: session.access_token,
      ...jsonRequest('POST', { employee_id: employeeId, ...payload }),
    })
    refresh()
  }

  return (
    <>
      <PageHeader
        eyebrow="EMPLOYEE PROFILE"
        title={employeeName}
        description={`${profile.employeeId} · ${profile.department} · ${profile.jobTitle}`}
        action={<Link className="button button-secondary compact-button" to="/employees">Back to employees</Link>}
        onRefresh={refresh}
        refreshing={loading}
      />
      <PageError onRetry={refresh}>{error}</PageError>
      {loading ? <LoadingState /> : !employee.id ? <PageError>Employee not found.</PageError> : (
        <div className="employee-profile-shell">
          <section className="panel management-panel employee-profile-card">
            <div className="employee-photo-large" aria-label="Profile picture">
              {profile.profilePicture ? <img src={profile.profilePicture} alt={employeeName} /> : <span>{initials(employeeName)}</span>}
            </div>
            <div className="employee-profile-summary">
              <div className="eyebrow muted-label">Employee ID {profile.employeeId}</div>
              <h2>{profile.fullName}</h2>
              <p>{profile.jobTitle} · {profile.department}</p>
              <div className="status-row"><StatusBadge>{profile.status}</StatusBadge></div>
            </div>
          </section>

          <section className="panel management-panel">
            <div className="panel-heading"><div><h2>Personal details</h2><p>Core employee record and contact information.</p></div></div>
            <div className="meta-grid">
              <div className="detail-list">
                <div className="detail-item"><span>Employee ID</span><strong>{profile.employeeId}</strong></div>
                <div className="detail-item"><span>Full Name</span><strong>{profile.fullName}</strong></div>
                <div className="detail-item"><span>Profile Picture</span><strong>{profile.profilePicture ? 'Uploaded photo' : 'Employee photo'}</strong></div>
                <div className="detail-item"><span>Gender</span><strong>{profile.gender}</strong></div>
                <div className="detail-item"><span>Date of Birth</span><strong>{profile.dateOfBirth}</strong></div>
              </div>
              <div className="detail-list">
                <div className="detail-item"><span>Phone Number</span><strong>{profile.phoneNumber}</strong></div>
                <div className="detail-item"><span>Email Address</span><strong>{profile.emailAddress}</strong></div>
                <div className="detail-item"><span>Residential Address</span><strong>{profile.residentialAddress}</strong></div>
                <div className="detail-item"><span>Department</span><strong>{profile.department}</strong></div>
                <div className="detail-item"><span>Job Title</span><strong>{profile.jobTitle}</strong></div>
                <div className="detail-item"><span>Employment Type</span><strong>{profile.employmentType}</strong></div>
              </div>
            </div>
          </section>

          <section className="panel management-panel">
            <div className="panel-heading"><div><h2>Assigned company assets</h2><p>Current and historical asset assignments for this employee.</p></div></div>
            <DataTable rows={assetAssignments} empty="No asset assignments recorded." columns={[
              {
                key: 'asset_id', label: 'Asset', render: (row) => {
                  const asset = assetMap[row.asset_id]
                  return asset ? `${asset.name} (${asset.asset_code})` : row.asset_id
                }
              },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status || 'active'}</StatusBadge> },
              { key: 'condition_out', label: 'Condition out' },
              { key: 'assigned_at', label: 'Assigned', render: (row) => formatDate(row.assigned_at) },
            ]} />
          </section>

          <section className="panel management-panel">
            <div className="panel-heading"><div><h2>Vehicle assignments</h2><p>Vehicles assigned to this employee, with assignment details.</p></div></div>
            <DataTable rows={vehicleAssignments} empty="No vehicle assignments recorded." columns={[
              {
                key: 'vehicle_id', label: 'Vehicle', render: (row) => {
                  const vehicle = vehicleMap[row.vehicle_id]
                  return vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}` : row.vehicle_id
                }
              },
              { key: 'assignment_type', label: 'Assignment type' },
              { key: 'odometer_out_km', label: 'Odometer out (km)' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status || 'active'}</StatusBadge> },
              { key: 'checked_out_at', label: 'Checked out', render: (row) => formatDate(row.checked_out_at) },
            ]} />
          </section>

          <section className="panel management-panel">
            <div className="panel-heading"><div><h2>Fuel allocations</h2><p>Fuel budgets assigned to this employee for travel and fleet use.</p></div></div>
            {fuelAllocations.length ? (
              <DataTable rows={fuelAllocations} empty="No fuel allocations have been recorded." columns={[
                { key: 'allocation_period_start', label: 'Period', render: (row) => `${formatDate(row.allocation_period_start)}${row.allocation_period_end ? ` - ${formatDate(row.allocation_period_end)}` : ''}` },
                { key: 'allocated_amount', label: 'Amount', render: (row) => `${row.allocated_amount || 0} ${row.currency || 'BWP'}` },
                { key: 'reference', label: 'Reference' },
                { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
              ]} />
            ) : <div className="empty-state">No fuel allocations have been configured for this employee.</div>}
          </section>

          <section className="panel management-panel">
            <div className="panel-heading">
              <div><h2>Leave balance</h2><p>Annual leave entitlement and remaining days.</p></div>
              <button className="button button-secondary compact-button" type="button" onClick={() => setLeaveBalanceDialog(true)}>
                {leaveBalance ? 'Update balance' : 'Set balance'}
              </button>
            </div>
            <div className="meta-grid">
              <div className="detail-list">
                <div className="detail-item"><span>Annual entitlement</span><strong>{leaveBalance ? `${leaveBalance.annual_entitlement || 0} days` : 'Not configured'}</strong></div>
                <div className="detail-item"><span>Days taken</span><strong>{leaveBalance ? `${leaveBalance.days_taken || 0} days` : '0 days'}</strong></div>
              </div>
              <div className="detail-list">
                <div className="detail-item"><span>Days remaining</span><strong>{`${leaveRemaining} days`}</strong></div>
              </div>
            </div>
          </section>

          <section className="panel management-panel">
            <div className="panel-heading"><div><h2>Submitted requests</h2><p>Employee requests and review history.</p></div></div>
            <DataTable rows={requests} empty="No requests submitted." columns={[
              { key: 'submitted_at', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
              { key: 'request_type', label: 'Type', render: (row) => <span className="capitalize">{row.request_type}</span> },
              { key: 'description', label: 'Request', render: (row) => <span className="truncate-cell" title={row.description}>{row.description}</span> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status}</StatusBadge> },
            ]} />
          </section>

          <section className="panel management-panel">
            <div className="panel-heading"><div><h2>Account information</h2><p>Linked account and employee access details.</p></div></div>
            <div className="meta-grid">
              <div className="detail-list">
                <div className="detail-item"><span>Employee ID</span><strong>{profile.employeeId}</strong></div>
                <div className="detail-item"><span>Account Email</span><strong>{profile.emailAddress}</strong></div>
                <div className="detail-item"><span>Primary role</span><strong>{employee.role || 'employee'}</strong></div>
              </div>
              <div className="detail-list">
                <div className="detail-item"><span>Employment status</span><strong>{profile.status}</strong></div>
                <div className="detail-item"><span>Department</span><strong>{profile.department}</strong></div>
                <div className="detail-item"><span>Start date</span><strong>{formatDate(employee.start_date)}</strong></div>
              </div>
            </div>
          </section>
        </div>
      )}
      {leaveBalanceDialog && (
        <RecordDialog
          title={leaveBalance ? 'Update leave balance' : 'Set leave balance'}
          fields={[{
            name: 'annual_entitlement',
            label: 'Annual entitlement (days)',
            type: 'number',
            required: true,
            min: 0,
            step: '0.5',
            defaultValue: leaveBalance?.annual_entitlement ?? 10,
          }]}
          submitLabel="Save balance"
          onSubmit={saveLeaveBalance}
          onClose={() => setLeaveBalanceDialog(false)}
        />
      )}
    </>
  )
}

const assetAssignmentFields = (employees, assets) => [
  { name: 'asset_id', label: 'Available asset', type: 'select', required: true, options: assets.map((asset) => ({ value: asset.id, label: `${asset.asset_code} · ${asset.name}` })) },
  { name: 'employee_id', label: 'Employee', type: 'select', required: true, options: employees.filter((employee) => employee.employment_status === 'active').map((employee) => ({ value: employee.id, label: `${employee.employee_number} · ${employee.first_name} ${employee.last_name}` })) },
  { name: 'condition_out', label: 'Condition at checkout', defaultValue: 'good' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
]

export function AssetsPage() {
  const { data, loading, error, refresh } = useApiData({
    assets: loadAssets,
    assignments: loadAssetAssignments,
    employees: loadEmployees,
  })
  const assets = data.assets || []
  const assignments = data.assignments || []
  const employees = data.employees || []
  const actions = usePageActions(refresh)
  const employeeById = Object.fromEntries(employees.map((employee) => [employee.id, employee]))
  const assetById = Object.fromEntries(assets.map((asset) => [asset.id, asset]))
  const activeAssignments = assignments.filter((assignment) => assignment.status === 'active')
  const availableAssets = assets.filter((asset) => asset.status === 'available')
  const submitForm = (payload) => actions.mutate(
    actions.dialog.record ? `/assets/${actions.dialog.record.id}` : '/assets',
    actions.dialog.record ? 'PATCH' : 'POST',
    payload,
  )

  return (
    <>
      <ManagementPage eyebrow="EQUIPMENT" title="Asset management" description="Register assets, assign them to employees and track returns." loading={loading} error={error} refresh={refresh}
        action={<div className="welcome-actions"><AddButton onClick={() => actions.setDialog({ title: 'Register asset', fields: assetFields })}>Register asset</AddButton><button className="button button-secondary" type="button" disabled={!availableAssets.length || !employees.length} onClick={() => actions.setDialog({ title: 'Assign asset', fields: assetAssignmentFields(employees, availableAssets), record: null, operation: 'assign' })}>Assign asset</button></div>}>
        <PageError>{actions.actionError}</PageError>
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Registered assets</h2><p>{assets.length} asset{assets.length === 1 ? '' : 's'} tracked</p></div></div>
          <DataTable rows={assets} empty="No assets have been registered." columns={[
            { key: 'asset_code', label: 'Asset', render: (row) => <div><strong>{row.name}</strong><small className="cell-subtitle">{row.asset_code}</small></div> },
            { key: 'category', label: 'Category' },
            { key: 'serial_number', label: 'Serial number' },
            { key: 'condition', label: 'Condition' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status}</StatusBadge> },
            { key: 'actions', label: 'Actions', render: (row) => <button className="icon-button" title="Edit asset" aria-label="Edit asset" type="button" onClick={() => actions.setDialog({ title: 'Edit asset', fields: assetFields, initial: row, record: row })}><Pencil size={15} /></button> },
          ]} />
        </section>
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Active assignments</h2><p>Assets currently checked out to employees.</p></div></div>
          <DataTable rows={activeAssignments} empty="No assets are currently assigned." columns={[
            { key: 'asset_id', label: 'Asset', render: (row) => assetById[row.asset_id]?.name || row.asset_id },
            { key: 'employee_id', label: 'Employee', render: (row) => employeeLabel(employeeById[row.employee_id]) },
            { key: 'assigned_at', label: 'Assigned', render: (row) => formatDate(row.assigned_at) },
            { key: 'condition_out', label: 'Condition out' },
            { key: 'actions', label: 'Actions', render: (row) => <button className="button button-secondary compact-button" type="button" onClick={() => actions.setDialog({ title: 'Return asset', submitLabel: 'Confirm return', fields: [{ name: 'condition_in', label: 'Condition on return' }, { name: 'notes', label: 'Return notes', type: 'textarea', wide: true }], onSubmit: async (payload) => { await actions.mutate(`/asset-assignments/${row.id}/return`, 'POST', payload) } })}><RotateCcw size={14} /> Return</button> },
          ]} />
        </section>
      </ManagementPage>
      {actions.dialog?.operation === 'assign' ? (
        <FormModal dialog={{ ...actions.dialog, onSubmit: (payload) => actions.mutate('/asset-assignments', 'POST', payload) }} setDialog={actions.setDialog} />
      ) : <FormModal dialog={actions.dialog} setDialog={actions.setDialog} onSubmit={submitForm} />}
    </>
  )
}

const vehicleAssignmentFields = (employees, vehicles) => [
  { name: 'vehicle_id', label: 'Available vehicle', type: 'select', required: true, options: vehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.registration_number} · ${vehicle.make} ${vehicle.model}` })) },
  { name: 'employee_id', label: 'Driver', type: 'select', required: true, options: employees.filter((employee) => employee.employment_status === 'active').map((employee) => ({ value: employee.id, label: `${employee.employee_number} · ${employee.first_name} ${employee.last_name}` })) },
  { name: 'assignment_type', label: 'Assignment type', type: 'select', required: true, options: ['permanent', 'temporary'] },
  { name: 'odometer_out_km', label: 'Odometer out (km)', type: 'number', required: true, min: 0, step: '0.1' },
  { name: 'expected_return_at', label: 'Expected return date', type: 'date' },
  { name: 'fuel_gauge_out_percent', label: 'Fuel gauge out (%)', type: 'number', min: 0, max: 100, step: 1, optional: true },
  { name: 'purpose', label: 'Purpose' },
  { name: 'condition_out', label: 'Condition at checkout' },
]

export function VehiclesPage() {
  const { data, loading, error, refresh } = useApiData({
    vehicles: loadVehicles,
    assignments: loadVehicleAssignments,
    employees: loadEmployees,
  })
  const vehicles = data.vehicles || []
  const assignments = data.assignments || []
  const employees = data.employees || []
  const actions = usePageActions(refresh)
  const employeeById = Object.fromEntries(employees.map((employee) => [employee.id, employee]))
  const vehicleById = Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const activeAssignments = assignments.filter((assignment) => assignment.status === 'active')
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === 'available')
  const submitForm = (payload) => actions.mutate(
    actions.dialog.record ? `/vehicles/${actions.dialog.record.id}` : '/vehicles',
    actions.dialog.record ? 'PATCH' : 'POST',
    payload,
  )

  return (
    <>
      <ManagementPage eyebrow="FLEET" title="Vehicle management" description="Register vehicles, assign drivers and track checkouts and returns." loading={loading} error={error} refresh={refresh}
        action={<div className="welcome-actions"><AddButton onClick={() => actions.setDialog({ title: 'Register vehicle', fields: vehicleFields })}>Register vehicle</AddButton><button className="button button-secondary" type="button" disabled={!availableVehicles.length || !employees.length} onClick={() => actions.setDialog({ title: 'Assign vehicle', fields: vehicleAssignmentFields(employees, availableVehicles), operation: 'assign' })}>Assign driver</button></div>}>
        <PageError>{actions.actionError}</PageError>
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Vehicles</h2><p>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} in the fleet</p></div></div>
          <DataTable rows={vehicles} empty="No vehicles have been registered." columns={[
            { key: 'registration_number', label: 'Vehicle', render: (row) => <div><strong>{row.registration_number}</strong><small className="cell-subtitle">{row.make} {row.model}{row.year ? ` · ${row.year}` : ''}</small></div> },
            { key: 'fuel_type', label: 'Fuel type' },
            { key: 'current_odometer_km', label: 'Odometer (km)' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status}</StatusBadge> },
            { key: 'actions', label: 'Actions', render: (row) => <button className="icon-button" title="Edit vehicle" aria-label="Edit vehicle" type="button" onClick={() => actions.setDialog({ title: 'Edit vehicle', fields: vehicleFields, initial: row, record: row })}><Pencil size={15} /></button> },
          ]} />
        </section>
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Current drivers</h2><p>Vehicles currently checked out.</p></div></div>
          <DataTable rows={activeAssignments} empty="No vehicles are currently assigned." columns={[
            { key: 'vehicle_id', label: 'Vehicle', render: (row) => vehicleById[row.vehicle_id]?.registration_number || row.vehicle_id },
            { key: 'employee_id', label: 'Driver', render: (row) => employeeLabel(employeeById[row.employee_id]) },
            { key: 'assignment_type', label: 'Assignment' },
            { key: 'checked_out_at', label: 'Checked out', render: (row) => formatDate(row.checked_out_at) },
            {
              key: 'actions', label: 'Actions', render: (row) => <button className="button button-secondary compact-button" type="button" onClick={() => actions.setDialog({
                title: 'Return vehicle', submitLabel: 'Confirm return', fields: [
                  { name: 'odometer_in_km', label: 'Odometer in (km)', type: 'number', required: true, min: Number(row.odometer_out_km || 0), step: '0.1' },
                  { name: 'fuel_gauge_in_percent', label: 'Fuel gauge in (%)', type: 'number', min: 0, max: 100, step: 1, optional: true },
                  { name: 'condition_in', label: 'Condition on return' },
                  { name: 'notes', label: 'Return notes', type: 'textarea', wide: true },
                ], onSubmit: async (payload) => { await actions.mutate(`/vehicle-assignments/${row.id}/return`, 'POST', payload) }
              })}><RotateCcw size={14} /> Return</button>
            },
          ]} />
        </section>
      </ManagementPage>
      {actions.dialog?.operation === 'assign' ? (
        <FormModal dialog={{ ...actions.dialog, onSubmit: (payload) => actions.mutate('/vehicle-assignments', 'POST', payload) }} setDialog={actions.setDialog} />
      ) : <FormModal dialog={actions.dialog} setDialog={actions.setDialog} onSubmit={submitForm} />}
    </>
  )
}

const stockMovementFields = (items, employees) => [
  { name: 'item_id', label: 'Inventory item', type: 'select', required: true, options: items.map((item) => ({ value: item.item_id, label: `${item.item_code} · ${item.name} (${item.quantity_on_hand} ${item.unit})` })) },
  {
    name: 'movement_type', label: 'Movement', type: 'select', required: true, options: [
      { value: 'purchase', label: 'Purchase (add stock)' },
      { value: 'return', label: 'Return (add stock)' },
      { value: 'adjustment_in', label: 'Adjustment in (add stock)' },
      { value: 'issue', label: 'Issue (remove stock)' },
      { value: 'adjustment_out', label: 'Adjustment out (remove stock)' },
    ]
  },
  { name: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0.001, step: '0.001' },
  { name: 'unit_cost', label: 'Unit cost', type: 'number', min: 0, step: '0.01', optional: true },
  { name: 'employee_id', label: 'Employee (optional)', type: 'select', options: employees.filter((employee) => employee.employment_status === 'active').map((employee) => ({ value: employee.id, label: `${employee.employee_number} · ${employee.first_name} ${employee.last_name}` })) },
  { name: 'reference', label: 'Reference' },
  { name: 'reason', label: 'Reason', type: 'textarea', wide: true },
]

export function InventoryPage() {
  const { data, loading, error, refresh } = useApiData({
    inventory: loadInventory,
    transactions: loadInventoryTransactions,
    employees: loadEmployees,
  })
  const inventory = data.inventory || []
  const transactions = data.transactions || []
  const employees = data.employees || []
  const actions = usePageActions(refresh)
  const itemById = Object.fromEntries(inventory.map((item) => [item.item_id, item]))
  const employeeById = Object.fromEntries(employees.map((employee) => [employee.id, employee]))

  return (
    <>
      <ManagementPage eyebrow="STOCKROOM" title="Inventory management" description="Add items, adjust quantities and review stock movement history." loading={loading} error={error} refresh={refresh}
        action={<div className="welcome-actions"><AddButton onClick={() => actions.setDialog({ title: 'Add inventory item', fields: inventoryFields, operation: 'new-item' })}>Add item</AddButton><button className="button button-secondary" type="button" disabled={!inventory.length} onClick={() => actions.setDialog({ title: 'Record stock movement', fields: stockMovementFields(inventory, employees), operation: 'movement' })}>Update quantity</button></div>}>
        <PageError>{actions.actionError}</PageError>
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Stock on hand</h2><p>Current quantities and reorder thresholds.</p></div></div>
          <DataTable rows={inventory} rowKey="item_id" empty="No inventory items have been added." columns={[
            { key: 'item_code', label: 'Item', render: (row) => <div><strong>{row.name}</strong><small className="cell-subtitle">{row.item_code} · {row.category}</small></div> },
            { key: 'quantity_on_hand', label: 'Quantity', render: (row) => `${row.quantity_on_hand} ${row.unit}` },
            { key: 'reorder_level', label: 'Reorder level' },
            { key: 'quantity_on_hand', label: 'Stock status', render: (row) => Number(row.quantity_on_hand) <= Number(row.reorder_level) ? <StatusBadge>low stock</StatusBadge> : <StatusBadge>in stock</StatusBadge> },
          ]} />
        </section>
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Recent stock movements</h2><p>Purchases, issues, returns and adjustments.</p></div></div>
          <DataTable rows={transactions} empty="No stock movements have been recorded." columns={[
            { key: 'occurred_at', label: 'Date', render: (row) => formatDate(row.occurred_at) },
            { key: 'item_id', label: 'Item', render: (row) => itemById[row.item_id]?.name || row.item_id },
            { key: 'movement_type', label: 'Movement', render: (row) => <span className="capitalize">{row.movement_type?.replaceAll('_', ' ')}</span> },
            { key: 'quantity', label: 'Quantity' },
            { key: 'employee_id', label: 'Employee', render: (row) => row.employee_id ? employeeLabel(employeeById[row.employee_id]) : '—' },
            { key: 'reference', label: 'Reference' },
          ]} />
        </section>
      </ManagementPage>
      <FormModal
        dialog={actions.dialog}
        setDialog={actions.setDialog}
        onSubmit={(payload) => actions.mutate(
          actions.dialog?.operation === 'movement' ? '/inventory/transactions' : '/inventory/items',
          'POST',
          payload,
        )}
      />
    </>
  )
}

export function RequestsPage() {
  const { data, loading, error, refresh } = useApiData({ requests: loadRequests })
  const requests = data.requests || []
  const actions = usePageActions(refresh)

  function review(row, status) {
    actions.setDialog({
      title: `${status === 'approved' ? 'Approve' : 'Reject'} request`,
      submitLabel: `Confirm ${status}`,
      fields: [{ name: 'review_notes', label: 'Review notes', type: 'textarea', wide: true }],
      onSubmit: (payload) => actions.mutate(`/requests/${row.id}/review`, 'PATCH', { ...payload, status }),
    })
  }

  return (
    <>
      <ManagementPage eyebrow="INBOX" title="Requests management" description="Review employee requests and record approval decisions." loading={loading} error={error} refresh={refresh} />
      <PageError>{actions.actionError}</PageError>
      {!loading && (
        <section className="panel management-panel">
          <div className="panel-heading"><div><h2>Employee requests</h2><p>{requests.filter((row) => row.status === 'pending').length} pending review</p></div></div>
          <DataTable rows={requests} empty="No employee requests found." columns={[
            { key: 'submitted_at', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
            { key: 'employee_id', label: 'Employee', render: (row) => row.employee_id },
            { key: 'request_type', label: 'Type', render: (row) => <span className="capitalize">{row.request_type}</span> },
            { key: 'description', label: 'Request', render: (row) => <span className="truncate-cell" title={row.description}>{row.description}</span> },
            { key: 'quantity', label: 'Quantity' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status}</StatusBadge> },
            { key: 'review_notes', label: 'Review notes' },
            {
              key: 'actions', label: 'Actions', render: (row) => row.status === 'pending' ? (
                <div className="row-actions">
                  <button className="icon-button success-icon" type="button" title="Approve request" aria-label="Approve request" onClick={() => review(row, 'approved')}><Check size={16} /></button>
                  <button className="icon-button danger-icon" type="button" title="Reject request" aria-label="Reject request" onClick={() => review(row, 'rejected')}><X size={16} /></button>
                </div>
              ) : '—'
            },
          ]} />
        </section>
      )}
      <FormModal dialog={actions.dialog} setDialog={actions.setDialog} />
    </>
  )
}

function employeeLabel(employee) {
  return employee ? `${employee.first_name} ${employee.last_name} (${employee.employee_number})` : 'Employee not found'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString()
}
