import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import DynamicForm, { validateDynamicForm } from '../DynamicForm'
import { ApiError, tasksApi } from '../../lib/api'
import { STATUS_VALUES, TASK_STATUS } from '../../lib/meta/constants'
import type { FieldSpec } from '../../lib/meta/types'
import { useMeta } from '../../lib/meta/useMeta'

export type Task = {
  id: string
  title?: unknown
  type_id?: unknown
  status?: unknown
  due_date?: unknown
  notes?: unknown
  custom_fields?: unknown
}

type TaskEditorProps = {
  mode: 'create' | 'edit'
  taskId?: string
  initialTask?: Task
  onSuccess?: (task: Task) => void
  onCancel?: () => void
}

function isEmpty(value: unknown) {
  return value === undefined
    || value === null
    || (typeof value === 'string' && value.trim() === '')
}

function visibleCustomFields(fields: FieldSpec[], values: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    const fieldValue = values[field.key]
    if (!isEmpty(fieldValue)) result[field.key] = fieldValue
  }
  return result
}

function parseCustomFields(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { parsed: { ...value as Record<string, unknown> }, raw: null }
  }
  if (typeof value !== 'string' || value === '') return { parsed: {}, raw: null }
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { parsed: parsed as Record<string, unknown>, raw: null }
    }
  } catch {
    // 保留原始字符串用于提示；保存时按空对象处理，避免把非法 JSON 当作字段值。
  }
  return { parsed: {}, raw: value }
}

function formatLocalDate(value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  const timestamp = typeof value === 'number' ? value : Number(value)
  const date = new Date(timestamp)
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizedStatus(value: unknown): (typeof STATUS_VALUES)[number] {
  return STATUS_VALUES.includes(value as (typeof STATUS_VALUES)[number])
    ? value as (typeof STATUS_VALUES)[number]
    : TASK_STATUS.TODO
}

export default function TaskEditor({
  mode,
  taskId,
  initialTask,
  onSuccess,
  onCancel,
}: TaskEditorProps) {
  const metaResult = useMeta()
  const titleRef = useRef<HTMLInputElement>(null)
  const initializedTaskId = useRef<string | null>(null)
  const taskRequestRef = useRef<{ key: string; promise: ReturnType<typeof tasksApi.get> } | null>(null)
  const [initialized, setInitialized] = useState(mode === 'create')
  const [fetchedTask, setFetchedTask] = useState<Task | null>(null)
  const [taskLoading, setTaskLoading] = useState(mode === 'edit' && !initialTask)
  const [taskError, setTaskError] = useState<Error | null>(null)
  const [taskRequestVersion, setTaskRequestVersion] = useState(0)
  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState('')
  const [originalTypeId, setOriginalTypeId] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_VALUES)[number]>(TASK_STATUS.TODO)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({})
  const [unknownCustomFields, setUnknownCustomFields] = useState<Record<string, unknown>>({})
  const [rawCustomFields, setRawCustomFields] = useState<string | null>(null)
  const [titleError, setTitleError] = useState('')
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (mode !== 'edit' || initialTask) return undefined
    if (!taskId) {
      setTaskError(new Error('缺少任务 ID'))
      setTaskLoading(false)
      return undefined
    }

    let active = true
    const requestKey = `${taskId}:${taskRequestVersion}`
    if (taskRequestRef.current?.key !== requestKey) {
      setTaskLoading(true)
      setTaskError(null)
      taskRequestRef.current = { key: requestKey, promise: tasksApi.get(taskId) }
    }
    taskRequestRef.current.promise
      .then((response) => {
        if (!response?.data || typeof response.data !== 'object') {
          throw new Error('任务数据格式错误')
        }
        if (active) setFetchedTask(response.data as Task)
      })
      .catch((error) => {
        if (active) setTaskError(error instanceof Error ? error : new Error(String(error)))
      })
      .finally(() => {
        if (active) setTaskLoading(false)
      })

    return () => {
      active = false
    }
  }, [initialTask, mode, taskId, taskRequestVersion])

  useEffect(() => {
    if (mode !== 'edit' || metaResult.status !== 'success') return
    const task = initialTask ?? fetchedTask
    if (!taskId || !task) return
    if (initializedTaskId.current === taskId) return

    const initialTypeId = String(task.type_id ?? '')
    const initialFields = metaResult.meta.fieldsByTypeId[initialTypeId] ?? []
    const knownKeys = new Set(initialFields.map((field) => field.key))
    const { parsed, raw } = parseCustomFields(task.custom_fields)
    const known: Record<string, unknown> = {}
    const unknown: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (knownKeys.has(key)) known[key] = value
      else unknown[key] = value
    }

    setTitle(String(task.title ?? ''))
    setTypeId(initialTypeId)
    setOriginalTypeId(initialTypeId)
    setStatus(normalizedStatus(task.status))
    setDueDate(formatLocalDate(task.due_date))
    setNotes(String(task.notes ?? ''))
    setCustomFields(known)
    setUnknownCustomFields(unknown)
    setRawCustomFields(raw)
    setInitialized(true)
    initializedTaskId.current = taskId
  }, [fetchedTask, initialTask, metaResult, mode, taskId])

  const fields = useMemo(() => (
    metaResult.status === 'success' && typeId
      ? metaResult.meta.fieldsByTypeId[typeId] ?? []
      : []
  ), [metaResult, typeId])

  function handleCustomChange(next: Record<string, unknown>) {
    setCustomFields((current) => ({ ...current, ...next }))
    setCustomErrors((current) => {
      const updated = { ...current }
      for (const [key, value] of Object.entries(next)) {
        if (!isEmpty(value)) delete updated[key]
      }
      return updated
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('标题必填')
      titleRef.current?.focus()
      return
    }

    const validation = validateDynamicForm(fields, customFields)
    setCustomErrors(validation.errors)
    if (!validation.ok) return

    const payload: Record<string, unknown> = { title: trimmedTitle, status }
    if (mode === 'create') {
      if (typeId) payload.type_id = typeId
      if (dueDate) payload.due_date = new Date(`${dueDate}T00:00:00`).getTime()
      if (notes.trim()) payload.notes = notes.trim()
      if (typeId) {
        const currentCustomFields = visibleCustomFields(fields, customFields)
        if (Object.keys(currentCustomFields).length > 0) payload.custom_fields = currentCustomFields
      }
    } else {
      payload.type_id = typeId || null
      payload.due_date = dueDate ? new Date(`${dueDate}T00:00:00`).getTime() : null
      payload.notes = notes
      payload.custom_fields = {
        ...(typeId === originalTypeId ? unknownCustomFields : {}),
        ...visibleCustomFields(fields, customFields),
      }
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      if (mode === 'create') {
        const response = await tasksApi.create(payload)
        if (!response?.data || typeof response.data !== 'object') throw new Error('创建响应缺少任务数据')
        onSuccess?.(response.data as Task)
      } else if (taskId) {
        await tasksApi.update(taskId, payload)
        onSuccess?.({ ...(initialTask ?? fetchedTask ?? { id: taskId }), ...payload, id: taskId })
      } else {
        throw new Error('缺少任务 ID')
      }
    } catch (error) {
      const fallback = mode === 'create' ? '新建任务失败，请重试' : '保存任务失败，请重试'
      setSubmitError(error instanceof Error && error.message ? error.message : fallback)
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'edit' && (taskLoading || metaResult.status === 'loading')) {
    return <main className="task-editor-page"><p>正在加载任务…</p></main>
  }

  if (mode === 'edit' && (taskError || metaResult.status === 'error')) {
    const error = taskError ?? (metaResult.status === 'error' ? metaResult.error : null)
    const isNotFound = error instanceof ApiError && error.status === 404
    const canRetry = !isNotFound && Boolean(taskId)
    return (
      <main className="task-editor-page">
        <div className="task-editor-load-error" role="alert">
          {isNotFound ? '任务不存在' : `任务加载失败：${error?.message || '未知错误'}`}
        </div>
        <div className="task-editor-actions task-editor-load-actions">
          <button type="button" onClick={onCancel} className="dashboard-button">返回列表</button>
          {canRetry && (
            <button
              type="button"
              onClick={() => {
                if (taskError) setTaskRequestVersion((version) => version + 1)
                else if (metaResult.status === 'error') metaResult.refetch()
              }}
              className="dashboard-button dashboard-button-primary"
            >
              重试
            </button>
          )}
        </div>
      </main>
    )
  }

  if (mode === 'edit' && !initialized) {
    return <main className="task-editor-page"><p>正在加载任务…</p></main>
  }

  return (
    <main className="task-editor-page">
      <div className="task-editor-heading">
        <h1>{mode === 'create' ? '新建任务' : '编辑任务'}</h1>
        <button type="button" onClick={onCancel} className="dashboard-button">取消</button>
      </div>

      <form onSubmit={handleSubmit} className="task-editor-form" noValidate>
        <label className="dynamic-form-field">
          <span className="dynamic-form-label">标题<span className="dynamic-form-required">*</span></span>
          <input
            ref={titleRef}
            name="title"
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (event.target.value.trim()) setTitleError('')
            }}
            disabled={submitting}
            aria-invalid={titleError ? true : undefined}
            className={`dynamic-form-control ${titleError ? 'dynamic-form-control-error' : ''}`}
          />
          {titleError && <span className="dynamic-form-error">{titleError}</span>}
        </label>

        {metaResult.status === 'loading' && <p>任务类型加载中…</p>}
        {metaResult.status === 'error' && (
          <div className="task-editor-meta-error" role="alert">
            <span>任务类型加载失败：{metaResult.error.message}</span>
            <button type="button" onClick={metaResult.refetch} className="dashboard-button">重试</button>
          </div>
        )}
        {metaResult.status === 'success' && (
          <label className="dynamic-form-field">
            <span className="dynamic-form-label">任务类型</span>
            <select
              name="type_id"
              value={typeId}
              onChange={(event) => {
                setTypeId(event.target.value)
                setCustomErrors({})
              }}
              disabled={submitting}
              className="dynamic-form-control"
            >
              <option value="">未选择</option>
              {metaResult.meta.activeTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.icon} {type.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="dynamic-form-field">
          <span className="dynamic-form-label">状态</span>
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof STATUS_VALUES)[number])}
            disabled={submitting}
            className="dynamic-form-control"
          >
            {STATUS_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        <label className="dynamic-form-field">
          <span className="dynamic-form-label">截止日期</span>
          <input
            name="due_date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={submitting}
            className="dynamic-form-control"
          />
        </label>

        <label className="dynamic-form-field">
          <span className="dynamic-form-label">备注</span>
          <textarea
            name="notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={submitting}
            className="dynamic-form-control"
          />
        </label>

        <section className="task-editor-custom-fields">
          <h2>自定义字段</h2>
          {!typeId ? (
            <p className="dynamic-form-empty">未选择任务类型,无自定义字段</p>
          ) : (
            <DynamicForm
              fields={fields}
              value={customFields}
              onChange={handleCustomChange}
              errors={customErrors}
              disabled={submitting}
            />
          )}
          {rawCustomFields !== null && (
            <p className="dynamic-form-hint">原自定义字段格式异常，保存时将按空对象处理</p>
          )}
        </section>

        {submitError && <p className="task-editor-submit-error" role="alert">{submitError}</p>}

        <div className="task-editor-actions">
          <button type="button" onClick={onCancel} disabled={submitting} className="dashboard-button">取消</button>
          <button type="submit" disabled={submitting} className="dashboard-button dashboard-button-primary">
            {submitting ? '保存中…' : mode === 'create' ? '创建任务' : '保存任务'}
          </button>
        </div>
      </form>
    </main>
  )
}
