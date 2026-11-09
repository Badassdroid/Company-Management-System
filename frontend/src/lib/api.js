const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function api(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const url = `${API_BASE_URL}${path}`
  let response
  try {
    response = await fetch(url, { ...options, headers })
  } catch (error) {
    const reason = error instanceof Error ? ` ${error.message}` : ''
    throw new Error(`Could not reach API: ${url}.${reason}`)
  }

  const responseText = await response.text()
  let payload
  try {
    payload = JSON.parse(responseText)
  } catch {
    console.error('Invalid API response:', {
      url,
      responseUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type'),
    })
    throw new Error(`API returned non-JSON (${response.status}) from ${url}. Check browser console.`)
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (${response.status}).`)
  }
  return payload.data ?? payload
}

export function jsonRequest(method, value) {
  return { method, body: JSON.stringify(value) }


}
