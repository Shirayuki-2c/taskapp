import { useEffect, useState } from 'react'
import DynamicForm from '../components/DynamicForm/DynamicForm'
import { useMeta } from '../lib/meta/useMeta'

export default function DynamicFormPreview() {
  const result = useMeta()
  const [typeId, setTypeId] = useState('')
  const [value, setValue] = useState<Record<string, unknown>>({})

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'DynamicForm Preview (dev only)'
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    if (result.status !== 'success' || typeId) return
    setTypeId(result.meta.activeTypes[0]?.id ?? '')
  }, [result, typeId])

  if (result.status === 'loading') {
    return <main className="dynamic-preview"><p>元数据加载中…</p></main>
  }

  if (result.status === 'error') {
    return (
      <main className="dynamic-preview">
        <h1>DynamicForm Preview (dev only)</h1>
        <p className="dynamic-form-error">元数据加载失败：{result.error.message}</p>
        <button type="button" onClick={result.refetch} className="dashboard-button">重试</button>
      </main>
    )
  }

  const fields = result.meta.fieldsByTypeId[typeId] ?? []

  return (
    <main className="dynamic-preview">
      <h1>DynamicForm Preview (dev only)</h1>
      <label className="dynamic-form-field">
        <span className="dynamic-form-label">任务类型</span>
        <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className="dynamic-form-control">
          {result.meta.activeTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.icon} {type.name}</option>
          ))}
        </select>
      </label>

      <div className="dynamic-preview-grid">
        <DynamicForm
          fields={fields}
          value={value}
          onChange={(next) => setValue((current) => ({ ...current, ...next }))}
        />
        <pre className="dynamic-preview-value">{JSON.stringify(value, null, 2)}</pre>
      </div>
    </main>
  )
}
