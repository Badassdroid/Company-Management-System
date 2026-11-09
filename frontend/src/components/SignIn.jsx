import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { useAuth } from '../lib/useAuth.js'

function SignIn() {
  const { signIn, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (signInError) {
      setError(signInError.message || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="signin-shell">
      <form className="signin-card" onSubmit={handleSubmit}>
        <span className="brand-mark">f</span>
        <h1>Welcome back</h1>
        <p>Sign in with your company Supabase account.</p>
        {!configured && (
          <div className="page-error">
            Supabase sign-in is not configured. Set SUPABASE_URL and
            SUPABASE_PUBLISHABLE_KEY in the workspace .env file, then restart Vite.
          </div>
        )}
        {error && <div className="page-error" role="alert">{error}</div>}
        <label className="form-field">
          <span>Email</span>
          <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="button button-primary signin-button" type="submit" disabled={!configured || busy}>
          <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

export default SignIn
