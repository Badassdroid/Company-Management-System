import { useState } from 'react'
import { LoaderCircle, Plus, RefreshCw, X } from 'lucide-react'

export function PageHeader({ eyebrow, title, description, action, onRefresh, refreshing }) {
  return (
    <section className="welcome-row management-welcome">
      <div>
        <div className="eyebrow"><span className="live-dot" /> {eyebrow}</div>
        <h1>{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      <div className="welcome-actions">
        <button className="button button-secondary" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh data">
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
        {action}
      </div>
    </section>
  )
}

export function DataTable({ columns, rows, rowKey = 'id', empty = 'No records found.' }) {
  if (!rows.length) return <div className="empty-state">{empty}</div>
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row[rowKey] ?? index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : (row[column.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RecordDialog({ title, fields, initial = {}, submitLabel = 'Save', onSubmit, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(
    fields.map((field) => [field.name, initial[field.name] ?? field.defaultValue ?? '']),
  ))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const visibleFields = fields.filter((field) => (
    !field.showWhen || values[field.showWhen.field] === field.showWhen.value
  ))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {}
      visibleFields.forEach((field) => {
        const value = values[field.name]
        if (value !== '' && value !== undefined) {
          payload[field.name] = field.type === 'number' ? Number(value) : value
        } else if (field.type === 'number' && field.optional) {
          payload[field.name] = null
        }
      })
      await onSubmit(payload)
      onClose()
    } catch (submitError) {
      setError(submitError.message || 'Could not save this record.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <form className="record-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        {error && <div className="page-error" role="alert">{error}</div>}
        <div className="form-grid">
          {visibleFields.map((field) => (
            <label className={`form-field ${field.wide ? 'wide' : ''}`} key={field.name}>
              <span>{field.label}{field.required && <b> *</b>}</span>
              {field.type === 'select' ? (
                <select
                  value={values[field.name]}
                  required={field.required}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                >
                  <option value="">Select…</option>
                  {field.options.map((option) => (
                    <option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>
                      {typeof option === 'string' ? option : option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  rows={3}
                  placeholder={field.placeholder}
                  value={values[field.name]}
                  required={field.required}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  value={values[field.name]}
                  required={field.required}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy && <LoaderCircle size={15} className="spin" />}{submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export function AddButton({ children = 'Add new', onClick }) {
  return <button className="button button-primary" type="button" onClick={onClick}><Plus size={16} /> {children}</button>
}

export function PageError({ children, onRetry }) {
  if (!children) return null
  return (
    <div className="page-error" role="alert">
      <span>{children}</span>
      {onRetry && <button className="text-button" type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function LoadingState() {
  return <div className="loading-state"><LoaderCircle size={18} className="spin" /> Loading…</div>
}

export function StatusBadge({ children }) {
  return <span className={`record-status ${String(children).toLowerCase()}`}>{children || 'unknown'}</span>
}
