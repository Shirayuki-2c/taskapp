// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS } from '../../lib/meta/constants'
import TaskEditor from './TaskEditor'

const metaResponse = {
  ok: true,
  data: {
    types: [
      { id: 'type-a', name: '类型 A', sort_order: 1, is_archived: false },
      { id: 'type-b', name: '类型 B', sort_order: 2, is_archived: false },
    ],
    fieldDefs: [
      { id: 'field-a', type_id: 'type-a', name: 'A字段', field_type: 'text', required: true, sort_order: 1 },
      { id: 'field-b', type_id: 'type-b', name: 'B字段', field_type: 'text', required: false, sort_order: 1 },
    ],
  },
}

let roots: Root[] = []
let fetchMock: ReturnType<typeof vi.fn>
let taskResponse = { status: 200, body: { ok: true, data: { id: 'task-1' } } }
let pendingMeta: Promise<ReturnType<typeof responseStub>> | null = null

function responseStub(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  taskResponse = { status: 200, body: { ok: true, data: { id: 'task-1' } } }
  pendingMeta = null
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/meta' && pendingMeta) return pendingMeta
    const response = url === '/api/meta' ? { status: 200, body: metaResponse } : taskResponse
    return {
      ...responseStub(response.status, response.body),
      requestInit: init,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount())
  roots = []
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function renderEditor(onSuccess = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => root.render(<TaskEditor mode="create" onSuccess={onSuccess} />))
  await waitFor(() => container.querySelector('select[name="type_id"]'))
  return { container, onSuccess }
}

async function renderEdit(initialTask: Parameters<typeof TaskEditor>[0]['initialTask'], onSuccess = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => root.render(
    <TaskEditor mode="edit" taskId="task-1" initialTask={initialTask} onSuccess={onSuccess} />,
  ))
  await waitFor(() => container.querySelector('form'))
  return { container, onSuccess }
}

async function waitFor(check: () => unknown) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (check()) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error('condition not reached')
}

async function setControlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value)
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}

async function submit(container: HTMLElement) {
  await act(async () => {
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function taskCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/tasks'))
}

function singleTaskGetCalls() {
  return taskCalls().filter(([url, init]) => String(url).includes('?id=') && init?.method === 'GET')
}

function postedBody() {
  const call = taskCalls().at(-1)
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>
}

describe('TaskEditor create mode', () => {
  it('blocks an empty title, focuses it, and does not POST', async () => {
    const { container } = await renderEditor()
    await submit(container)

    const title = container.querySelector('input[name="title"]') as HTMLInputElement
    expect(container.textContent).toContain('标题必填')
    expect(document.activeElement).toBe(title)
    expect(taskCalls()).toHaveLength(0)
  })

  it('blocks a whitespace-only title', async () => {
    const { container } = await renderEditor()
    const title = container.querySelector('input[name="title"]') as HTMLInputElement
    await setControlValue(title, '   ')
    await submit(container)

    expect(container.textContent).toContain('标题必填')
    expect(taskCalls()).toHaveLength(0)
  })

  it('POSTs only trimmed title and status for a minimal task and calls onSuccess once', async () => {
    const onSuccess = vi.fn()
    const { container } = await renderEditor(onSuccess)
    await setControlValue(container.querySelector('input[name="title"]') as HTMLInputElement, '  简单任务  ')
    await submit(container)
    await waitFor(() => onSuccess.mock.calls.length === 1)

    expect(postedBody()).toEqual({ title: '简单任务', status: TASK_STATUS.TODO })
    expect(postedBody()).not.toEqual(expect.objectContaining({
      type_id: expect.anything(), due_date: expect.anything(), notes: expect.anything(), custom_fields: expect.anything(),
    }))
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('validates required custom fields and submits only fields from the selected type', async () => {
    const { container } = await renderEditor()
    await setControlValue(container.querySelector('input[name="title"]') as HTMLInputElement, '带类型任务')
    await setControlValue(container.querySelector('select[name="type_id"]') as HTMLSelectElement, 'type-a')
    await submit(container)
    expect(container.textContent).toContain('A字段必填')
    expect(taskCalls()).toHaveLength(0)

    const customInput = container.querySelector('.task-editor-custom-fields input') as HTMLInputElement
    await setControlValue(customInput, 'A 值')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    expect(postedBody()).toEqual(expect.objectContaining({
      type_id: 'type-a',
      custom_fields: { A字段: 'A 值' },
    }))
  })

  it('keeps old values in state but excludes the previous type from the new payload', async () => {
    const { container } = await renderEditor()
    await setControlValue(container.querySelector('input[name="title"]') as HTMLInputElement, '切换类型')
    const typeSelect = container.querySelector('select[name="type_id"]') as HTMLSelectElement
    await setControlValue(typeSelect, 'type-a')
    await setControlValue(container.querySelector('.task-editor-custom-fields input') as HTMLInputElement, '旧值')
    await setControlValue(typeSelect, 'type-b')
    await setControlValue(container.querySelector('.task-editor-custom-fields input') as HTMLInputElement, '新值')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    expect(postedBody()).toEqual(expect.objectContaining({
      type_id: 'type-b',
      custom_fields: { B字段: '新值' },
    }))
    expect(postedBody().custom_fields).not.toHaveProperty('A字段')
  })

  it('converts a due date to a millisecond timestamp', async () => {
    const { container } = await renderEditor()
    await setControlValue(container.querySelector('input[name="title"]') as HTMLInputElement, '有日期')
    await setControlValue(container.querySelector('input[name="due_date"]') as HTMLInputElement, '2026-01-15')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    const timestamp = postedBody().due_date
    expect(timestamp).toEqual(expect.any(Number))
    expect(timestamp).toBeGreaterThan(new Date('2026-01-14T00:00:00').getTime())
    expect(timestamp).toBeLessThan(new Date('2026-01-16T00:00:00').getTime())
  })

  it('shows a backend message, preserves the form, and can submit again', async () => {
    taskResponse = { status: 500, body: { ok: false, error: { message: '服务暂不可用' } } }
    const onSuccess = vi.fn()
    const { container } = await renderEditor(onSuccess)
    const title = container.querySelector('input[name="title"]') as HTMLInputElement
    await setControlValue(title, '保留此标题')
    await submit(container)
    await waitFor(() => container.textContent?.includes('服务暂不可用'))

    expect(title.value).toBe('保留此标题')
    expect(onSuccess).not.toHaveBeenCalled()

    taskResponse = { status: 200, body: { ok: true, data: { id: 'task-2' } } }
    await submit(container)
    await waitFor(() => onSuccess.mock.calls.length === 1)
    expect(taskCalls()).toHaveLength(2)
  })
})

const fullTask = {
  id: 'task-1',
  title: '原任务',
  type_id: 'type-a',
  status: TASK_STATUS.DOING,
  due_date: new Date(2026, 0, 15).getTime(),
  notes: '原备注',
  custom_fields: JSON.stringify({ A字段: '已知值', legacy_field: '老数据' }),
}

describe('TaskEditor edit mode', () => {
  it('uses route-state data without requesting the single-task endpoint', async () => {
    await renderEdit(fullTask)
    expect(singleTaskGetCalls()).toHaveLength(0)
  })

  it('shows loading until metadata resolves, then renders the form', async () => {
    let resolveMeta: (value: ReturnType<typeof responseStub>) => void = () => {}
    pendingMeta = new Promise((resolve) => { resolveMeta = resolve })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)

    await act(async () => root.render(
      <TaskEditor mode="edit" taskId="task-1" initialTask={fullTask} />,
    ))
    expect(container.textContent).toContain('正在加载任务…')
    expect(container.querySelector('form')).toBeNull()

    await act(async () => resolveMeta(responseStub(200, metaResponse)))
    await waitFor(() => container.querySelector('form'))
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('fetches and prefills the task when route-state data is unavailable', async () => {
    taskResponse = { status: 200, body: { ok: true, data: fullTask } }
    const { container } = await renderEdit(undefined)

    expect(singleTaskGetCalls()).toHaveLength(1)
    expect((container.querySelector('input[name="title"]') as HTMLInputElement).value).toBe('原任务')
    expect((container.querySelector('.task-editor-custom-fields input') as HTMLInputElement).value).toBe('已知值')
  })

  it('shows 任务不存在 and no form when the single-task request returns 404', async () => {
    taskResponse = { status: 404, body: { message: '任务不存在' } }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(
      <TaskEditor mode="edit" taskId="missing" onCancel={() => {}} />,
    ))
    await waitFor(() => container.textContent?.includes('任务不存在'))

    expect(singleTaskGetCalls()).toHaveLength(1)
    expect(container.textContent).toContain('任务不存在')
    expect(container.textContent).toContain('返回列表')
    expect(container.textContent).not.toContain('重试')
    expect(container.querySelector('form')).toBeNull()
  })

  it('shows the backend message and a retry button for a single-task 500', async () => {
    taskResponse = { status: 500, body: { message: '读取任务失败' } }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(
      <TaskEditor mode="edit" taskId="task-1" onCancel={() => {}} />,
    ))
    await waitFor(() => container.textContent?.includes('读取任务失败'))

    expect(container.textContent).toContain('任务加载失败：读取任务失败')
    expect(container.textContent).toContain('重试')
    expect(container.querySelector('form')).toBeNull()
  })

  it('prefills standard fields, local date, and known custom fields', async () => {
    const { container } = await renderEdit(fullTask)

    expect((container.querySelector('input[name="title"]') as HTMLInputElement).value).toBe('原任务')
    expect((container.querySelector('select[name="type_id"]') as HTMLSelectElement).value).toBe('type-a')
    expect((container.querySelector('select[name="status"]') as HTMLSelectElement).value).toBe(TASK_STATUS.DOING)
    expect((container.querySelector('input[name="due_date"]') as HTMLInputElement).value).toBe('2026-01-15')
    expect((container.querySelector('textarea[name="notes"]') as HTMLTextAreaElement).value).toBe('原备注')
    expect((container.querySelector('.task-editor-custom-fields input') as HTMLInputElement).value).toBe('已知值')
    expect(container.textContent).not.toContain('legacy_field')
  })

  it('preserves unknown custom fields and calls onSuccess after PATCH', async () => {
    const onSuccess = vi.fn()
    const { container } = await renderEdit(fullTask, onSuccess)
    await submit(container)
    await waitFor(() => onSuccess.mock.calls.length === 1)

    expect(taskCalls()).toHaveLength(1)
    expect(String(taskCalls()[0][0])).toBe('/api/tasks?id=task-1')
    expect(taskCalls()[0][1]?.method).toBe('PATCH')
    expect(postedBody().custom_fields).toEqual({ legacy_field: '老数据', A字段: '已知值' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('drops previous-type unknown fields after changing type', async () => {
    const { container } = await renderEdit(fullTask)
    await setControlValue(container.querySelector('select[name="type_id"]') as HTMLSelectElement, 'type-b')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    expect(postedBody().type_id).toBe('type-b')
    expect(postedBody().custom_fields).toEqual({})
    expect(postedBody().custom_fields).not.toHaveProperty('legacy_field')
  })

  it('sends due_date null after clearing the date', async () => {
    const { container } = await renderEdit(fullTask)
    await setControlValue(container.querySelector('input[name="due_date"]') as HTMLInputElement, '')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    expect(postedBody()).toHaveProperty('due_date', null)
  })

  it('sends an empty string after clearing notes', async () => {
    const { container } = await renderEdit(fullTask)
    await setControlValue(container.querySelector('textarea[name="notes"]') as HTMLTextAreaElement, '')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    expect(postedBody()).toHaveProperty('notes', '')
  })

  it('sends type_id null after explicitly selecting no type', async () => {
    const { container } = await renderEdit(fullTask)
    await setControlValue(container.querySelector('select[name="type_id"]') as HTMLSelectElement, '')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)

    expect(postedBody()).toHaveProperty('type_id', null)
    expect(postedBody()).toHaveProperty('custom_fields', {})
  })

  it('treats invalid custom_fields JSON as empty and still renders and submits', async () => {
    const invalidTask = { ...fullTask, type_id: 'type-b', custom_fields: '{not json' }
    const { container } = await renderEdit(invalidTask)

    expect(container.querySelector('form')).not.toBeNull()
    expect(container.textContent).toContain('原自定义字段格式异常')
    await submit(container)
    await waitFor(() => taskCalls().length === 1)
    expect(postedBody().custom_fields).toEqual({})
  })

  it('shows a PATCH error, preserves the form, and can submit again', async () => {
    taskResponse = { status: 500, body: { ok: false, error: { message: '保存失败' } } }
    const onSuccess = vi.fn()
    const { container } = await renderEdit(fullTask, onSuccess)
    const title = container.querySelector('input[name="title"]') as HTMLInputElement
    await setControlValue(title, '修改后标题')
    await submit(container)
    await waitFor(() => container.textContent?.includes('保存失败'))

    expect(title.value).toBe('修改后标题')
    expect(onSuccess).not.toHaveBeenCalled()

    taskResponse = { status: 200, body: { ok: true, data: { id: 'task-1' } } }
    await submit(container)
    await waitFor(() => onSuccess.mock.calls.length === 1)
    expect(taskCalls()).toHaveLength(2)
  })
})
