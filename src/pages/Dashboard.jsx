import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TaskCard from '../components/TaskCard'
import { ApiError, tasksApi } from '../lib/api'
import { TASK_STATUS } from '../lib/meta/constants'
import { useMeta } from '../lib/meta/useMeta'

const TASK_POLL_INTERVAL_MS = 2000
const TASK_POLL_MAX_ATTEMPTS = 30
const ERROR_DURATION_MS = 4000

async function errorMessage(response, fallback) {
  const data = await response.json().catch(() => null)
  return data?.error?.message || data?.message || `${fallback}（HTTP ${response.status}）`
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function applyCreatedTask(tasks, task) {
  const index = tasks.findIndex((item) => item.id === task.id)
  if (index < 0) return [task, ...tasks]
  return tasks.map((item, itemIndex) => itemIndex === index ? task : item)
}

function applyUpdatedTask(tasks, task) {
  const index = tasks.findIndex((item) => item.id === task.id)
  if (index < 0) return [...tasks, task]
  return tasks.map((item, itemIndex) => itemIndex === index ? task : item)
}

export default function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const metaResult = useMeta()
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [operationErrors, setOperationErrors] = useState([])
  const loadPromiseRef = useRef(null)
  const mountedRef = useRef(false)
  const pendingPayloadRef = useRef({
    createdTask: location.state?.createdTask,
    updatedTask: location.state?.updatedTask,
  })
  const consumedStateRef = useRef(null)
  const pendingDeletesRef = useRef(new Map())
  const errorSequenceRef = useRef(0)
  const errorTimersRef = useRef(new Map())
  const cardMeta = useMemo(() => {
    if (metaResult.status !== 'success') return { typeMap: {}, fieldsByTypeId: {} }
    return {
      typeMap: Object.fromEntries(metaResult.meta.types.map((type) => [type.id, type])),
      fieldsByTypeId: metaResult.meta.fieldsByTypeId,
    }
  }, [metaResult])

  const commitTasks = useCallback((updater) => {
    setTasks((current) => updater(current ?? []))
  }, [])

  const addOperationError = useCallback((message) => {
    errorSequenceRef.current += 1
    const id = errorSequenceRef.current
    setOperationErrors((current) => [
      ...current,
      { id, message },
    ])
    const timer = setTimeout(() => {
      setOperationErrors((current) => current.filter((item) => item.id !== id))
      errorTimersRef.current.delete(id)
    }, ERROR_DURATION_MS)
    errorTimersRef.current.set(id, timer)
  }, [])

  const dismissOperationError = useCallback((id) => {
    clearTimeout(errorTimersRef.current.get(id))
    errorTimersRef.current.delete(id)
    setOperationErrors((current) => current.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    const state = location.state
    const createdTask = state?.createdTask
    const updatedTask = state?.updatedTask
    if ((!createdTask && !updatedTask) || consumedStateRef.current === state) return

    consumedStateRef.current = state
    pendingPayloadRef.current = { createdTask, updatedTask }
    if (tasks !== null) {
      commitTasks((current) => {
        let next = current
        if (createdTask) next = applyCreatedTask(next, createdTask)
        if (updatedTask) next = applyUpdatedTask(next, updatedTask)
        return next
      })
      pendingPayloadRef.current = null
    }
    navigate(location.pathname, { replace: true, state: null })
  }, [commitTasks, location.pathname, location.state, navigate, tasks])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    async function pollTasksUntilReady() {
      for (let attempt = 0; attempt < TASK_POLL_MAX_ATTEMPTS; attempt += 1) {
        await wait(TASK_POLL_INTERVAL_MS)
        try {
          return await tasksApi.list()
        } catch (pollError) {
          if (!(pollError instanceof ApiError) || pollError.status !== 409) throw pollError
        }
      }
      throw new Error('初始化超时，请刷新重试')
    }

    async function loadTasksData() {
      let data
      try {
        data = await tasksApi.list()
      } catch (loadError) {
        if (!(loadError instanceof ApiError) || loadError.status !== 409) throw loadError
        if (mountedRef.current) setIsInitializing(true)

        const bootstrapResponse = await fetch('/api/bootstrap', { method: 'POST' })
        if (bootstrapResponse.status === 202) data = await pollTasksUntilReady()
        else if (bootstrapResponse.status === 200) data = await tasksApi.list()
        else throw new Error(await errorMessage(bootstrapResponse, '初始化数据失败'))
      }
      return Array.isArray(data?.data) ? data.data : []
    }

    if (!loadPromiseRef.current) loadPromiseRef.current = loadTasksData()
    loadPromiseRef.current
      .then((items) => {
        if (cancelled) return
        const payload = pendingPayloadRef.current
        let next = items
        if (payload?.createdTask) next = applyCreatedTask(next, payload.createdTask)
        if (payload?.updatedTask) next = applyUpdatedTask(next, payload.updatedTask)
        pendingPayloadRef.current = null
        setTasks(next)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError))
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false)
      })

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const timers = errorTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  async function handleToggleDone(task) {
    const previousStatus = task.status
    const previousCompletedAt = task.completed_at
    const nextStatus = previousStatus === TASK_STATUS.DONE ? TASK_STATUS.TODO : TASK_STATUS.DONE
    const nextCompletedAt = nextStatus === TASK_STATUS.DONE ? Date.now() : null
    commitTasks((current) => current.map((item) => (
      item.id === task.id
        ? { ...item, status: nextStatus, completed_at: nextCompletedAt }
        : item
    )))

    try {
      await tasksApi.update(task.id, { status: nextStatus })
    } catch (toggleError) {
      commitTasks((current) => current.map((item) => (
        item.id === task.id && item.status === nextStatus
          ? { ...item, status: previousStatus, completed_at: previousCompletedAt }
          : item
      )))
      addOperationError(toggleError instanceof Error && toggleError.message
        ? toggleError.message
        : '标记任务失败')
    }
  }

  async function handleDelete(task) {
    const currentTasks = tasks ?? []
    const index = currentTasks.findIndex((item) => item.id === task.id)
    const pending = { id: task.id, snapshot: task, index }
    pendingDeletesRef.current.set(task.id, pending)
    commitTasks((current) => current.filter((item) => item.id !== task.id))

    try {
      await tasksApi.remove(task.id)
    } catch (deleteError) {
      commitTasks((current) => {
        if (current.some((item) => item.id === pending.id)) return current
        const insertAt = Math.min(Math.max(pending.index, 0), current.length)
        const next = [...current]
        next.splice(insertAt, 0, pending.snapshot)
        return next
      })
      addOperationError(deleteError instanceof Error && deleteError.message
        ? deleteError.message
        : '删除任务失败')
    } finally {
      if (pendingDeletesRef.current.get(task.id) === pending) {
        pendingDeletesRef.current.delete(task.id)
      }
    }
  }

  if (error) return <p style={{ color: 'red' }}>加载失败：{error}</p>
  if (isInitializing) return <p>首次使用，正在初始化数据…</p>
  if (!tasks) return <p>加载中…</p>

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h2>我的任务</h2>
        <div className="dashboard-actions">
          <button type="button" onClick={() => navigate('/settings')} className="dashboard-button">
            设置
          </button>
          <button type="button" onClick={() => navigate('/tasks/new')} className="dashboard-button dashboard-button-primary">
            新建任务
          </button>
        </div>
      </header>

      {tasks.length === 0 ? (
        <div className="dashboard-empty">
          <p>暂无任务</p>
          <button type="button" onClick={() => navigate('/tasks/new')} className="dashboard-button dashboard-button-primary">
            新建任务
          </button>
        </div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              typeMeta={cardMeta.typeMap[task.type_id]}
              fields={cardMeta.fieldsByTypeId[task.type_id] ?? []}
              onToggleComplete={handleToggleDone}
              onEdit={(item) => navigate(`/tasks/${item.id}/edit`, { state: { task: item } })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {operationErrors.length > 0 && (
        <div className="dashboard-error-stack" role="status">
          {operationErrors.map((operationError) => (
            <div key={operationError.id} className="dashboard-toast dashboard-toast-error" role="alert">
              <span>{operationError.message}</span>
              <button
                type="button"
                onClick={() => dismissOperationError(operationError.id)}
                className="dashboard-toast-close"
                aria-label="关闭错误提示"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
