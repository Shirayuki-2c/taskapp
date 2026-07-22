import { useEffect, useState } from 'react'
import { authHeader } from '../lib/feishuAuth'

export default function Dashboard() {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/tasks', { headers: authHeader() })
      .then((r) => {
        if (!r.ok) throw new Error('接口返回 ' + r.status)
        return r.json()
      })
      .then((data) => setTasks(data.tasks || data))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p style={{ color: 'red' }}>加载失败：{error}</p>
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