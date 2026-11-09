const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function api(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error('Could not reach the API. Check that the Flask backend is running.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(`The API returned an invalid response (${response.status}).`)
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (${response.status}).`)
  }
  return payload.data ?? payload
}

export function jsonRequest(method, value) {
  return { method, body: JSON.stringify(value) }
}
