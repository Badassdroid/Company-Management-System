import { useState } from 'react'
import { Boxes, CarFront, CheckCircle2, ClipboardList, Package, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoadingState, PageError, RecordDialog } from '../components/ManagementUI.jsx'
import { api, jsonRequest } from '../lib/api.js'
import { useApiData } from '../lib/useApiData.js'
import { useAuth } from '../lib/useAuth.js'

const loadAssets = (token) => api('/assets', { token })
const loadAssetAssignments = (token) => api('/asset-assignments', { token })
const loadVehicles = (token) => api('/vehicles', { token })
const loadVehicleAssignments = (token) => api('/vehicle-assignments', { token })
const loadRequests = (token) => api('/requests', { token })
const loadLeaveBalance = (token) => api('/leave-balance', { token }).catch(() => null)

const requestFields = [
  {
    name: 'request_type',
    label: 'Request type',
    type: 'select',
    required: true,
    defaultValue: 'asset',
    options: [
      { value: 'asset', label: 'Asset' },
      { value: 'inventory', label: 'Inventory' },
      { value: 'vehicle', label: 'Vehicle' },
      { value: 'holiday', label: 'Holiday' },
    ],
  },
  {
    name: 'description',
    label: 'Asset and reason',
    type: 'textarea',
    required: true,
    wide: true,
    placeholder: 'Name the asset and explain why you need it.',
    showWhen: { field: 'request_type', value: 'asset' },
  },
  {
    name: 'description',
    label: 'Item and reason',
    type: 'textarea',
    required: true,
    wide: true,
    placeholder: 'Name the stock item and explain how it will be used.',
    showWhen: { field: 'request_type', value: 'inventory' },
  },
  {
    name: 'description',
    label: 'Vehicle and trip details',
    type: 'textarea',
    required: true,
    wide: true,
    placeholder: 'Describe the vehicle, destination, and business purpose.',
    showWhen: { field: 'request_type', value: 'vehicle' },
  },
  { name: 'odometer_in_km', label: 'Odometer in (km)', type: 'number', required: true, min: 0, step: '0.1', showWhen: { field: 'request_type', value: 'vehicle' } },
  { name: 'fuel_gauge_in_percent', label: 'Fuel gauge in (%)', type: 'number', required: true, min: 0, max: 100, step: 1, showWhen: { field: 'request_type', value: 'vehicle' } },
  { name: 'condition_in', label: 'Condition on return', required: true, showWhen: { field: 'request_type', value: 'vehicle' } },
  { name: 'notes', label: 'Return notes', type: 'textarea', wide: true, showWhen: { field: 'request_type', value: 'vehicle' } },
  {
    name: 'description',
    label: 'Reason for leave',
    type: 'textarea',
    required: true,
    wide: true,
    placeholder: 'Explain the reason for your leave request.',
    showWhen: { field: 'request_type', value: 'holiday' },
  },
  { name: 'quantity', label: 'Quantity (optional)', type: 'number', min: 0.001, step: '0.001', optional: true, showWhen: { field: 'request_type', value: 'asset' } },
  { name: 'quantity', label: 'Quantity needed', type: 'number', min: 0.001, step: '0.001', required: true, showWhen: { field: 'request_type', value: 'inventory' } },
  { name: 'start_date', label: 'Start date', type: 'date', required: true, showWhen: { field: 'request_type', value: 'holiday' } },
  { name: 'end_date', label: 'End date', type: 'date', required: true, showWhen: { field: 'request_type', value: 'holiday' } },
]

const vehicleReturnFields = (odometerOut) => [
  { name: 'odometer_in_km', label: 'Odometer in (km)', type: 'number', required: true, min: Number(odometerOut || 0), step: '0.1' },
  { name: 'fuel_gauge_in_percent', label: 'Fuel gauge in (%)', type: 'number', required: true, min: 0, max: 100, step: 1 },
  { name: 'condition_in', label: 'Condition on return', required: true },
  { name: 'notes', label: 'Return notes', type: 'textarea', wide: true },
]

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString()
}

function EmployeePortal({ account, view = 'dashboard' }) {
  const { session } = useAuth()
  const { data, loading, error, refresh } = useApiData({
    assets: loadAssets,
    assetAssignments: loadAssetAssignments,
    vehicles: loadVehicles,
    vehicleAssignments: loadVehicleAssignments,
    requests: loadRequests,
    leaveBalance: loadLeaveBalance,
  })
  const [requestDialog, setRequestDialog] = useState(false)
  const [returnVehicleAssignment, setReturnVehicleAssignment] = useState(null)
  const employee = account?.employee || {}
  const employeeName = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || session?.user?.email || 'Employee'
  const employeeId = employee.employee_number || account?.employee_id || 'EMP001'
  const department = employee.department || 'IT Department'
  const jobTitle = employee.job_title || 'IT Support Technician'
  const employmentType = employee.employment_type || 'Full-time'
  const fullName = employeeName
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'JS'
  const activeAssetAssignments = (data.assetAssignments || []).filter((assignment) => assignment.status === 'active')
  const activeVehicleAssignments = (data.vehicleAssignments || []).filter((assignment) => assignment.status === 'active')
  const assetById = Object.fromEntries((data.assets || []).map((asset) => [asset.id, asset]))
  const vehicleById = Object.fromEntries((data.vehicles || []).map((vehicle) => [vehicle.id, vehicle]))
  const requests = data.requests || []
  const assignedItems = [
    ...activeAssetAssignments.map((assignment) => {
      const asset = assetById[assignment.asset_id] || {}
      return {
        key: `asset-${assignment.id}`,
        icon: Boxes,
        name: asset.name || 'Assigned asset',
        identifier: asset.asset_code || assignment.asset_id,
        detail: `Assigned ${formatDate(assignment.assigned_at)}`,
        tone: 'blue',
      }
    }),
    ...activeVehicleAssignments.map((assignment) => {
      const vehicle = vehicleById[assignment.vehicle_id] || {}
      return {
        key: `vehicle-${assignment.id}`,
        icon: CarFront,
        assignmentId: assignment.id,
        odometerOut: assignment.odometer_out_km,
        name: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Assigned vehicle',
        specs: [
          { label: 'Registration number', value: vehicle.registration_number },
          { label: 'Make', value: vehicle.make },
          { label: 'Model', value: vehicle.model },
          { label: 'Year', value: vehicle.year },
          { label: 'VIN', value: vehicle.vin },
          { label: 'Fuel type', value: vehicle.fuel_type },
          { label: 'Tank capacity (litres)', value: vehicle.tank_capacity_litres },
          { label: 'Odometer (km)', value: vehicle.current_odometer_km },
        ],
        detail: `Checked out ${formatDate(assignment.checked_out_at)}`,
        tone: 'green',
      }
    }),
  ]
  const assignedItemCount = assignedItems.length
  const vehicleAssignmentCount = activeVehicleAssignments.length || 0
  const fuelRemaining = employee.fuel_remaining ?? 600
  const leaveBalance = data.leaveBalance || null
  const leaveRemaining = leaveBalance
    ? Number(leaveBalance.days_remaining ?? (Number(leaveBalance.annual_entitlement || 0) - Number(leaveBalance.days_taken || 0)))
    : null
  const displayedRequests = (view === 'requests' ? requests : requests.slice(0, 3)).map((request) => ({
    title: request.description || request.request_type || 'New request',
    status: request.status || 'pending',
    date: formatDate(request.submitted_at),
    notes: request.review_notes || (request.status === 'pending' ? 'Awaiting management review.' : 'No review notes provided.'),
  }))

  const details = [
    { label: 'Employee ID', value: employeeId },
    { label: 'Full name', value: fullName },
    { label: 'Gender', value: employee.gender || 'Male' },
    { label: 'Date of birth', value: employee.date_of_birth ? formatDate(employee.date_of_birth) : '15/06/1998' },
    { label: 'Phone', value: employee.phone || '+267 71234567' },
    { label: 'Email', value: employee.email || session?.user?.email || 'john@company.com' },
    { label: 'Address', value: employee.residential_address || 'Gaborone, Botswana' },
    { label: 'Department', value: department },
    { label: 'Job title', value: jobTitle },
    { label: 'Employment type', value: employmentType },
  ]

  async function submitRequest(payload) {
    const requestPayload = { ...payload }
    if (requestPayload.request_type === 'vehicle') {
      const { odometer_in_km, fuel_gauge_in_percent, condition_in, notes } = requestPayload
      requestPayload.description = [
        requestPayload.description,
        '',
        'Vehicle return details:',
        `Odometer in (km): ${odometer_in_km}`,
        `Fuel gauge in (%): ${fuel_gauge_in_percent}`,
        `Condition on return: ${condition_in}`,
        `Return notes: ${notes || 'Not provided'}`,
      ].join('\n')
      delete requestPayload.odometer_in_km
      delete requestPayload.fuel_gauge_in_percent
      delete requestPayload.condition_in
      delete requestPayload.notes
    }
    await api('/requests', {
      token: session.access_token,
      ...jsonRequest('POST', requestPayload),
    })
    refresh()
  }

  async function submitVehicleReturn(payload) {
    await api(`/vehicle-assignments/${returnVehicleAssignment.id}/return`, {
      token: session.access_token,
      ...jsonRequest('POST', payload),
    })
    refresh()
  }

  return (
    <>
      <section className="employee-portal-hero panel">
        <div className="employee-portal-copy">
          <div className="eyebrow"><span className="live-dot" /> Employee Portal · {employeeId}</div>
          <h1>{view === 'requests' ? 'My requests' : view === 'assigned' ? 'Assigned items' : `Welcome back, ${fullName.split(' ')[0] || 'Employee'}!`}</h1>
        </div>
        <span className="status-pill status-pill-active"><span className="live-dot" /> Active</span>
      </section>

      <PageError onRetry={refresh}>{error}</PageError>
      {loading ? <LoadingState /> : (
        <div className="employee-portal-shell">
          {view === 'dashboard' && <>
            <section className="employee-identity panel">
              <div className="employee-avatar-large" aria-label="Profile picture">{initials}</div>
              <div className="employee-identify-copy">
                <div className="employee-profile-title">{fullName}</div>
                <div className="employee-profile-role">{jobTitle} · {department}</div>
                <div className="employee-profile-meta">{employmentType} employee</div>
              </div>
            </section>

            <section className="employee-stat-grid">
              <div className="employee-stat-card panel">
                <div className="employee-stat-top">
                  <span className="employee-stat-label">Assigned assets</span>
                  <span className="employee-stat-icon blue"><Boxes size={18} /></span>
                </div>
                <div className="employee-stat-value">{assignedItemCount}</div>
                <div className="employee-stat-caption">Company equipment</div>
              </div>

              <div className="employee-stat-card panel">
                <div className="employee-stat-top">
                  <span className="employee-stat-label">Fuel remaining</span>
                  <span className="employee-stat-icon purple"><Package size={18} /></span>
                </div>
                <div className="employee-stat-value">P{fuelRemaining}</div>
                <div className="employee-stat-caption">Current allocation</div>
              </div>

              <div className="employee-stat-card panel">
                <div className="employee-stat-top">
                  <span className="employee-stat-label">Vehicle assignments</span>
                  <span className="employee-stat-icon green"><CarFront size={18} /></span>
                </div>
                <div className="employee-stat-value">{vehicleAssignmentCount}</div>
                <div className="employee-stat-caption">Currently assigned</div>
              </div>

              <div className="employee-stat-card panel">
                <div className="employee-stat-top">
                  <span className="employee-stat-label">Leave remaining</span>
                  <span className="employee-stat-icon orange"><CheckCircle2 size={18} /></span>
                </div>
                <div className="employee-stat-value">{leaveRemaining === null ? 'Not configured' : `${leaveRemaining} days`}</div>
                <div className="employee-stat-caption">Annual leave</div>
              </div>
            </section>

            <section className="employee-detail-grid">
              <article className="panel employee-detail-panel" id="personal-details">
                <div className="panel-heading employee-panel-heading">
                  <div>
                    <h2>Personal details</h2>
                    <p>Information</p>
                  </div>
                </div>
                <div className="detail-columns">
                  <div className="employee-detail-list">
                    {details.slice(0, 5).map((detail) => (
                      <div className="employee-detail-row" key={detail.label}>
                        <span>{detail.label}</span>
                        <strong>{detail.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="employee-detail-list">
                    {details.slice(5).map((detail) => (
                      <div className="employee-detail-row" key={detail.label}>
                        <span>{detail.label}</span>
                        <strong>{detail.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

            </section>

            <section className="shortcut-grid employee-shortcut-grid" aria-label="Employee pages">
              <Link className="shortcut-card" to="/employee/requests">
                <span><strong>My requests</strong><small>Check request status and management notes.</small></span>
                <ClipboardList size={17} />
              </Link>
              <Link className="shortcut-card" to="/employee/assigned">
                <span><strong>Assigned items</strong><small>See the equipment and vehicle assigned to you.</small></span>
                <Boxes size={17} />
              </Link>
            </section>
          </>}

          {view === 'requests' && <article className="panel employee-request-panel employee-full-page-panel">
            <div className="panel-heading employee-panel-heading">
              <div>
                <h2>Request history</h2>
                <p>Review the status and management response for each request.</p>
              </div>
              <button className="button button-primary" type="button" onClick={() => setRequestDialog(true)}>
                New request
              </button>
            </div>

            {displayedRequests.map((request) => (
              <div key={`${request.title}-${request.date}`} className="employee-request-item">
                <div className="employee-request-copy">
                  <strong>{request.title}</strong>
                  <small>{request.date}</small>
                  <span className="request-review-note">{request.notes}</span>
                </div>
                <span className={`status-pill ${request.status === 'approved' ? 'approved' : request.status === 'rejected' ? 'rejected' : 'pending'}`}>
                  {request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Rejected' : 'Pending'}
                </span>
              </div>
            ))}
            {!displayedRequests.length && <div className="empty-state">You have not submitted any requests yet.</div>}
          </article>}

          {view === 'assigned' && <article className="panel assigned-panel employee-full-page-panel">
            <div className="panel-heading">
              <div>
                <h2>Assigned items</h2>
                <p>Vehicles and equipment currently assigned to you.</p>
              </div>
            </div>
            <div className="assigned-list">
              {assignedItems.length ? assignedItems.map(({ icon: Icon, ...item }) => (
                <div className="assigned-item" key={item.key}>
                  <span className={`assigned-icon ${item.tone}`}><Icon size={19} /></span>
                  <div className="assigned-copy">
                    <strong>{item.name}</strong>
                    <small>{item.identifier && <>{item.identifier} <span>·</span> </>}{item.detail}</small>
                    {item.specs && <div className="vehicle-specs">
                      {item.specs.map((spec) => (
                        <div className="vehicle-spec" key={spec.label}>
                          <span>{spec.label}</span>
                          <strong>{spec.value ?? 'Not recorded'}</strong>
                        </div>
                      ))}
                    </div>}
                  </div>
                  {item.assignmentId ? (
                    <button className="button button-secondary compact-button" type="button" onClick={() => setReturnVehicleAssignment({ id: item.assignmentId, odometerOut: item.odometerOut })}>
                      <RotateCcw size={14} /> Return vehicle
                    </button>
                  ) : <span className="checked-out-badge">Current</span>}
                </div>
              )) : <div className="empty-state">No assets or vehicles are currently assigned to you.</div>}
            </div>
          </article>}

          {view === 'dashboard' && <div className="employee-illustrative-note">Your workspace information is kept up to date from company records.</div>}
        </div>
      )}

      {requestDialog && (
        <RecordDialog
          title="New request"
          fields={requestFields}
          submitLabel="Submit request"
          onSubmit={submitRequest}
          onClose={() => setRequestDialog(false)}
        />
      )}
      {returnVehicleAssignment && (
        <RecordDialog
          title="Return vehicle"
          fields={vehicleReturnFields(returnVehicleAssignment.odometerOut)}
          submitLabel="Confirm return"
          onSubmit={submitVehicleReturn}
          onClose={() => setReturnVehicleAssignment(null)}
        />
      )}
    </>
  )
}

export default EmployeePortal
