import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import type { FieldSpec } from '../../lib/meta/types'

type DynamicFormProps = {
  fields: FieldSpec[]
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  errors?: Record<string, string>
  disabled?: boolean
}

function displayValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value)
}

function readonlyValue(value: unknown) {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return String(value)
  }
}

function formatDate(value: unknown, field: FieldSpec, warned: Set<string>) {
  if (value === undefined || value === null || value === '') return ''
  const timestamp = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN
  const date = new Date(timestamp)
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
    const warningKey = `${field.metaId}:${String(value)}`
    if (!warned.has(warningKey)) {
      warned.add(warningKey)
      console.warn(`DynamicForm: invalid date value for field "${field.key}"`)
    }
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function DynamicForm({
  fields,
  value,
  onChange,
  errors = {},
  disabled = false,
}: DynamicFormProps) {
  const warnedDates = useRef(new Set<string>())

  // 只发出当前 fields 中的最新值；未渲染的旧 key 不会被组件删除，需由调用方负责合并保留。
  function updateField(key: string, nextValue: unknown) {
    const renderedKeys = new Set(fields.map((field) => field.key))
    const next: Record<string, unknown> = {}
    for (const [currentKey, currentValue] of Object.entries(value)) {
      if (renderedKeys.has(currentKey)) next[currentKey] = currentValue
    }
    next[key] = nextValue
    onChange(next)
  }

  if (fields.length === 0) return <p className="dynamic-form-empty">该任务类型没有自定义字段</p>

  return (
    <div className="dynamic-form">
      {fields.map((field) => {
        const error = errors[field.key]
        const controlClass = `dynamic-form-control ${error ? 'dynamic-form-control-error' : ''}`
        const invalid = error ? true : undefined
        let control

        if (field.kind === 'textarea') {
          control = (
            <textarea
              rows={3}
              value={displayValue(value[field.key])}
              onChange={(event) => updateField(field.key, event.target.value)}
              disabled={disabled}
              aria-invalid={invalid}
              className={controlClass}
            />
          )
        } else if (field.kind === 'number') {
          control = (
            <input
              type="number"
              value={displayValue(value[field.key])}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const input = event.target.value
                if (input === '') updateField(field.key, undefined)
                else {
                  const parsed = Number.parseFloat(input)
                  updateField(field.key, Number.isNaN(parsed) ? input : parsed)
                }
              }}
              disabled={disabled}
              aria-invalid={invalid}
              className={controlClass}
            />
          )
        } else if (field.kind === 'date') {
          control = (
            <input
              type="date"
              value={formatDate(value[field.key], field, warnedDates.current)}
              onChange={(event) => {
                const input = event.target.value
                updateField(field.key, input ? new Date(`${input}T00:00:00`).getTime() : undefined)
              }}
              disabled={disabled}
              aria-invalid={invalid}
              className={controlClass}
            />
          )
        } else if (field.kind === 'select') {
          const noOptions = (field.options?.length ?? 0) === 0
          control = (
            <>
              <select
                value={displayValue(value[field.key])}
                onChange={(event) => updateField(field.key, event.target.value || undefined)}
                disabled={disabled || noOptions}
                aria-invalid={invalid}
                className={controlClass}
              >
                <option value="">-- 请选择 --</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {noOptions && <p className="dynamic-form-hint">无可选值</p>}
            </>
          )
        } else if (field.kind === 'person') {
          control = (
            <>
              <input
                type="text"
                value={readonlyValue(value[field.key])}
                readOnly
                disabled={disabled}
                aria-invalid={invalid}
                className={controlClass}
              />
              <p className="dynamic-form-hint">暂不支持编辑 person 字段(field_type = person)</p>
            </>
          )
        } else if (field.kind === 'unsupported') {
          control = (
            <>
              <input
                type="text"
                value={readonlyValue(value[field.key])}
                readOnly
                disabled={disabled}
                aria-invalid={invalid}
                className={controlClass}
              />
              <p className="dynamic-form-hint">不支持的字段类型:{field.rawFieldType}</p>
            </>
          )
        } else {
          control = (
            <input
              type={field.kind === 'url' ? 'url' : 'text'}
              value={displayValue(value[field.key])}
              onChange={(event) => updateField(field.key, event.target.value)}
              disabled={disabled}
              aria-invalid={invalid}
              placeholder={field.kind === 'url' ? 'https://...' : undefined}
              className={controlClass}
            />
          )
        }

        return (
          <label key={field.metaId || `${field.typeId}:${field.key}`} className="dynamic-form-field">
            <span className="dynamic-form-label">
              {field.label}{field.required && <span className="dynamic-form-required">*</span>}
            </span>
            {control}
            {error && <span className="dynamic-form-error">{error}</span>}
          </label>
        )
      })}
    </div>
  )
}
