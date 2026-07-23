import { useEffect, useState } from 'react'

const TASK_POLL_INTERVAL_MS = 2000
const TASK_POLL_MAX_ATTEMPTS = 30

async function errorMessage(response, fallback) {
  const data = await response.json().catch(() => null)
  return data?.error?.message || data?.message || `${fallback}（HTTP ${response.status}）`
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function Dashboard() {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function pollTasksUntilReady() {
      for (let attempt = 0; attempt < TASK_POLL_MAX_ATTEMPTS && !cancelled; attempt += 1) {
        await wait(TASK_POLL_INTERVAL_MS)
        if (cancelled) return null

        const response = await fetch('/api/tasks')
        if (response.status === 200) return response
        if (response.status !== 409) {
          throw new Error(await errorMessage(response, '加载任务失败'))
        }
      }

      if (cancelled) return null
      throw new Error('初始化超时，请刷新重试')
    }

    async function loadTasks() {
      try {
        let response = await fetch('/api/tasks')

        // 只有另一个请求正在初始化（202）时才轮询；同步完成（200）只重试一次。
        if (response.status === 409) {
          if (!cancelled) setIsInitializing(true)

          const bootstrapResponse = await fetch('/api/bootstrap', { method: 'POST' })
          if (bootstrapResponse.status === 202) {
            response = await pollTasksUntilReady()
            if (!response) return
          } else if (bootstrapResponse.status === 200) {
            response = await fetch('/api/tasks')
          } else {
            throw new Error(await errorMessage(bootstrapResponse, '初始化数据失败'))
          }
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
