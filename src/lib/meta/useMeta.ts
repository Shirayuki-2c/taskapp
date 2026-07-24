import { useCallback, useEffect, useState } from 'react'
import { metaApi } from '../api'
import { normalizeMeta } from './normalizeMeta'
import type { NormalizedMeta } from './types'

export type UseMetaResult =
  | { status: 'loading' }
  | { status: 'error'; error: Error; refetch: () => void }
  | { status: 'success'; meta: NormalizedMeta; refetch: () => void }

function responseError(response: unknown) {
  if (!response || typeof response !== 'object') return null
  const record = response as Record<string, unknown>
  if (record.ok !== false) return null
  const error = record.error
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string' && message) return new Error(message)
  }
  if (typeof error === 'string' && error) return new Error(error)
  return new Error('元数据加载失败')
}

export function useMeta(): UseMetaResult {
  const [requestVersion, setRequestVersion] = useState(0)
  const [state, setState] = useState<UseMetaResult>({ status: 'loading' })
  const refetch = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })

    async function load() {
      try {
        const response = await metaApi.fetch()
        const backendError = responseError(response)
        if (backendError) throw backendError
        const meta = normalizeMeta(response)
        if (active) setState({ status: 'success', meta, refetch })
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error))
        if (active) setState({ status: 'error', error: normalizedError, refetch })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [refetch, requestVersion])

  return state
}
