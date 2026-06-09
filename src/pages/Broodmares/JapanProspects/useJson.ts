import { useEffect, useState } from 'react'
import { fetchJson } from '../../../lib/fetchData'

export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * Fetch a JSON asset (from `public/`) into React state. Mirrors the loading /
 * error handling used by Historic Sales Analysis, shared across the Japan
 * Prospects pages. `path` of `null` is treated as "nothing to load".
 */
export function useJson<T>(path: string | null): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(path != null)

  useEffect(() => {
    if (path == null) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    fetchJson<T>(path)
      .then((d) => {
        if (active) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (active) {
          setError(String(e.message ?? e))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [path])

  return { data, error, loading }
}
