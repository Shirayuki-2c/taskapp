// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FieldSpec } from '../../lib/meta/types'
import DynamicForm from './DynamicForm'
import { validateDynamicForm } from './validation'

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.innerHTML = ''
})

function field(overrides: Partial<FieldSpec>): FieldSpec {
  return {
    key: 'field',
    label: '字段',
    kind: 'text',
    required: false,
    showOnCard: false,
    sortOrder: 0,
    metaId: 'field-id',
    typeId: 'type-id',
    rawFieldType: 'text',
    ...overrides,
  }
}

async function renderControlled(fields: FieldSpec[], initialValue: Record<string, unknown> = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const changes: Record<string, unknown>[] = []

  function Harness() {
    const [value, setValue] = useState(initialValue)
    return (
      <>
        <DynamicForm
          fields={fields}
          value={value}
          onChange={(next) => {
            changes.push(next)
            setValue((current) => ({ ...current, ...next }))
          }}
        />
        <pre>{JSON.stringify(value)}</pre>
      </>
    )
  }

  await act(async () => root.render(<Harness />))
  return { changes, container, root }
}

async function changeValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('DynamicForm', () => {
  it('returns required-field errors from its validation interface', () => {
    const requiredField = field({ key: 'owner', label: '负责人', required: true })

    expect(validateDynamicForm([requiredField], { owner: '   ' })).toEqual({
      ok: false,
      errors: { owner: '负责人必填' },
    })
    expect(validateDynamicForm([requiredField], { owner: '张三' })).toEqual({ ok: true, errors: {} })
  })

  it('emits numbers and removes the key when a number is cleared', async () => {
    const { changes, container, root } = await renderControlled([
      field({ key: 'amount', label: '数值', kind: 'number', rawFieldType: 'number' }),
    ])
    const input = container.querySelector('input[type="number"]') as HTMLInputElement

    await changeValue(input, '12.5')
    expect(container.querySelector('pre')?.textContent).toBe('{"amount":12.5}')

    await changeValue(input, '')
    expect(changes.at(-1)).toHaveProperty('amount', undefined)
    expect(container.querySelector('pre')?.textContent).toBe('{}')
    await act(async () => root.unmount())
  })

  it('emits a local-midnight timestamp and displays an external timestamp', async () => {
    const dateField = field({ key: 'date', label: '日期', kind: 'date', rawFieldType: 'date' })
    const { changes, container, root } = await renderControlled([dateField])
    const input = container.querySelector('input[type="date"]') as HTMLInputElement

    await changeValue(input, '2026-08-15')
    const value = JSON.parse(container.querySelector('pre')?.textContent ?? '{}')
    expect(value.date).toBe(new Date('2026-08-15T00:00:00').getTime())
    expect(changes.at(-1)?.date).toBe(value.date)
    expect(typeof value.date).toBe('number')
    expect(input.value).toBe('2026-08-15')
    await act(async () => root.unmount())
  })

  it('warns once and displays an empty date for an invalid external value', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dateField = field({ key: 'date', label: '日期', kind: 'date', rawFieldType: 'date' })
    const { container, root } = await renderControlled([dateField], { date: 'not-a-date' })

    expect((container.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('')
    expect(warning).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    warning.mockRestore()
  })

  it('renders empty select, readonly fallbacks, and field errors', async () => {
    const fields = [
      field({ key: 'choice', label: '选项', kind: 'select', rawFieldType: 'select', options: [] }),
      field({ key: 'person', label: '人员', kind: 'person', rawFieldType: 'person' }),
      field({ key: 'rating', label: '评分', kind: 'unsupported', rawFieldType: 'rating' }),
      field({ key: 'title', label: '标题', required: true }),
    ]
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(
      <DynamicForm fields={fields} value={{}} onChange={() => {}} errors={{ title: '必填' }} />,
    ))

    expect((container.querySelector('select') as HTMLSelectElement).disabled).toBe(true)
    expect(container.textContent).toContain('无可选值')
    expect(container.textContent).toContain('暂不支持编辑 person 字段(field_type = person)')
    expect(container.textContent).toContain('不支持的字段类型:rating')
    expect(container.querySelectorAll('input[readonly]')).toHaveLength(2)
    expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull()
    expect(container.textContent).toContain('必填')
    await act(async () => root.unmount())
  })
})
