import { useEffect, useState } from 'react'

async function errorMessage(response, fallback) {
  const data = await response.json().catch(() => null)
  return data?.error?.message || data?.message || `${fallback}（HTTP ${response.status}）`
}

export default function Dashboard() {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadTasks() {
      try {
        let response = await fetch('/api/tasks')

        // A single load attempt may bootstrap at most once. If the retry still
        // returns 409, it falls through to the normal error handling below.
        if (response.status === 409) {
          if (!cancelled) setIsInitializing(true)

          const bootstrapResponse = await fetch('/api/bootstrap', { method: 'POST' })
          if (!bootstrapResponse.ok) {
            throw new Error(await errorMessage(bootstrapResponse, '初始化数据失败'))
          }

          response = await fetch('/api/tasks')
        }

        if (!response.ok) {
          throw new Error(await errorMessage(response, '加载任务失败'))
        }

        const data = await response.json()
        if (!cancelled) setTasks(Array.isArray(data?.data) ? data.data : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }

    loadTasks()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p style={{ color: 'red' }}>加载失败：{error}</p>
  if (isInitializing) return <p>首次使用，正在初始化数据…</p>
  if (!tasks) return <p>加载中…</p>

  return (
    <div style={{ padding: 16 }}>
      <h2>任务看板</h2>
      {tasks.length === 0 && <p>暂无任务</p>}
      <ul>
        {tasks.map((t) => (
          <li key={t.id}>
            {t.title} — {t.status}{t.due ? `（截止 ${t.due}）` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
