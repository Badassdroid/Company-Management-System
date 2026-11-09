import { useEffect, useState } from 'react'
import { useAuth } from './useAuth.js'

export function useApiData(loaders, dependencies = []) {
  const { session } = useAuth()
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all(Object.entries(loaders).map(async ([key, load]) => [key, await load(session.access_token)]))
      .then((entries) => {
        if (active) setData(Object.fromEntries(entries))
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  // Loaders are page-specific stable module functions; callers list changing inputs below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token, revision, ...dependencies])

  function refresh() {
    setLoading(true)
    setError('')
    setRevision((value) => value + 1)
  }

  return { data, loading, error, refresh }
}
