import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.js'

function SetPassword() {
  const { session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await updatePassword(password)
      navigate('/employee', { replace: true })
    } catch (updateError) {
      setError(updateError.message || 'Could not set your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="signin-shell">
      <form className="signin-card" onSubmit={handleSubmit}>
        <span className="brand-mark">f</span>
        <h1>Set your password</h1>
        <p>{session ? 'Choose a password to finish setting up your employee account.' : 'This invitation link is invalid or has expired. Ask management to send another invitation.'}</p>
        {error && <div className="page-error" role="alert">{error}</div>}
        {session ? (
          <>
            <label className="form-field">
              <span>New password</span>
              <input autoComplete="new-password" minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <label className="form-field">
              <span>Confirm password</span>
              <input autoComplete="new-password" minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            </label>
            <button className="button button-primary signin-button" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </>
        ) : <a className="button button-secondary signin-button" href="/">Return to sign in</a>}
      </form>
    </main>
  )
}

export default SetPassword
