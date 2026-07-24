// @vitest-environment jsdom

import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS } from '../lib/meta/constants'
import Dashboard from './Dashboard'

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/', state: null },
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => router.location,
  useNavigate: () => router.navigate,
}))

vi.mock('../lib/meta/useMeta', () => ({
  useMeta: () => ({
    status: 'success',
    meta: { types: [], activeTypes: [], fieldsByTypeId: {} },
  }),
}))

vi.mock('../components/TaskCard', () => ({
  default: ({ task, onDelete, onToggleComplete }) => (
    <article data-task-id={task.id}>
      <span data-task-title>{task.title}</span>
      <span data-task-status>{task.status}</span>
      <button type="button" onClick={() => onDelete(task)}>删除-{task.id}</button>
      <button type="button" onClick={() => onToggleComplete(task)}>完成-{task.id}</button>
    </article>
  ),
}))

const taskA = { id: 'a', title: '任务 A', status: TASK_STATUS.TODO }
const taskB = { id: 'b', title: '任务 B', status: TASK_STATUS.TODO }
const taskC = { id: 'c', title: '任务 C', status: TASK_STATUS.TODO }

let root
let container
let fetchMock
let listTasks

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  router.navigate.mockReset()
  router.location = { pathname: '/', state: null }
  listTasks = []
  fetchMock = vi.fn(async (_url, init) => response(200, {
    ok: true,
    data: init?.method === 'GET' ? listTasks : [],
  }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  root = null
  container = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }
}

async function renderDashboard() {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<StrictMode><Dashboard /></StrictMode>))
  await flush()
  return container
}

async function rerenderDashboard() {
  await act(async () => root.render(<StrictMode><Dashboard /></StrictMode>))
  await flush()
}

async function flush() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function click(label) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === label)
  await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await flush()
}

function callsFor(method) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method)
}

function taskIds() {
  return [...container.querySelectorAll('[data-task-id]')].map((item) => item.getAttribute('data-task-id'))
}

describe('Dashboard state payloads', () => {
  it('requests the task list once on every mount', async () => {
    await renderDashboard()
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/tasks')).toHaveLength(1)

    await act(async () => root.unmount())
    root = null
    container.remove()
    container = null

    await renderDashboard()
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/tasks')).toHaveLength(2)
  })

  it('prepends createdTask over the list GET result and clears route state', async () => {
    listTasks = [taskA]
    router.location = { pathname: '/', state: { createdTask: taskB } }
    await renderDashboard()

    expect(taskIds()).toEqual(['b', 'a'])
    expect(callsFor('GET')).toHaveLength(1)
    expect(router.navigate).toHaveBeenCalledTimes(1)
    expect(router.navigate).toHaveBeenCalledWith('/', { replace: true, state: null })
  })

  it('replaces an existing id for createdTask instead of duplicating it', async () => {
    listTasks = [taskA]
    router.location = { pathname: '/', state: { createdTask: { ...taskA, title: '替换 A' } } }
    await renderDashboard()

    expect(taskIds()).toEqual(['a'])
    expect(container.textContent).toContain('替换 A')
    expect(callsFor('GET')).toHaveLength(1)
  })

  it('replaces the matching updatedTask over the list GET result', async () => {
    listTasks = [taskA, taskB]
    router.location = { pathname: '/', state: { updatedTask: { ...taskB, title: '更新 B' } } }
    await renderDashboard()

    expect(taskIds()).toEqual(['a', 'b'])
    expect(container.textContent).toContain('更新 B')
    expect(callsFor('GET')).toHaveLength(1)
  })

  it('appends an updatedTask whose id is not in the list', async () => {
    listTasks = [taskA]
    router.location = { pathname: '/', state: { updatedTask: taskB } }
    await renderDashboard()

    expect(taskIds()).toEqual(['a', 'b'])
    expect(callsFor('GET')).toHaveLength(1)
  })
})

describe('Dashboard optimistic operations', () => {
  it('removes a task immediately and calls DELETE once', async () => {
    listTasks = [taskA, taskB]
    await renderDashboard()
    await click('删除-a')

    expect(taskIds()).toEqual(['b'])
    expect(callsFor('DELETE')).toHaveLength(1)
  })

  it('restores a failed delete at its clamped original index and shows the message', async () => {
    listTasks = [taskA, taskB, taskC]
    fetchMock.mockImplementation(async (_url, init) => (
      init?.method === 'DELETE'
        ? response(500, { message: '删除 A 失败' })
        : response(200, { ok: true, data: listTasks })
    ))
    await renderDashboard()
    await click('删除-b')

    expect(taskIds()).toEqual(['a', 'b', 'c'])
    expect(container.textContent).toContain('删除 A 失败')
    expect(callsFor('DELETE')).toHaveLength(1)
  })

  it('does not duplicate a failed delete if the id was added back meanwhile', async () => {
    let rejectDelete
    const pendingDelete = new Promise((resolve) => { rejectDelete = resolve })
    listTasks = [taskA, taskB]
    fetchMock.mockImplementation(async (_url, init) => (
      init?.method === 'DELETE' ? pendingDelete : response(200, { ok: true, data: listTasks })
    ))
    await renderDashboard()
    await click('删除-a')
    expect(taskIds()).toEqual(['b'])

    router.location = { pathname: '/', state: { createdTask: { ...taskA, title: '重新加入 A' } } }
    await rerenderDashboard()
    expect(taskIds()).toEqual(['a', 'b'])

    await act(async () => rejectDelete(response(500, { message: '延迟删除失败' })))
    await flush()
    expect(taskIds()).toEqual(['a', 'b'])
  })

  it('keeps two pending deletes independent when one fails', async () => {
    let failA
    const pendingA = new Promise((resolve) => { failA = resolve })
    listTasks = [taskA, taskB, taskC]
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'DELETE' && String(url).includes('id=a')) return pendingA
      return response(200, { ok: true, data: listTasks })
    })
    await renderDashboard()
    await click('删除-a')
    await click('删除-b')
    expect(taskIds()).toEqual(['c'])

    await act(async () => failA(response(500, { message: 'A 删除失败' })))
    await flush()
    expect(taskIds()).toEqual(['a', 'c'])
    expect(container.textContent).toContain('A 删除失败')
    expect(callsFor('DELETE')).toHaveLength(2)
  })

  it('optimistically toggles completion and calls PATCH', async () => {
    listTasks = [taskA]
    await renderDashboard()
    await click('完成-a')

    expect(container.querySelector('[data-task-status]')?.textContent).toBe(TASK_STATUS.DONE)
    expect(callsFor('PATCH')).toHaveLength(1)
  })

  it('rolls status back and shows the message when PATCH fails', async () => {
    listTasks = [taskA]
    fetchMock.mockImplementation(async (_url, init) => (
      init?.method === 'PATCH'
        ? response(500, { message: '标记失败' })
        : response(200, { ok: true, data: listTasks })
    ))
    await renderDashboard()
    await click('完成-a')

    expect(container.querySelector('[data-task-status]')?.textContent).toBe(TASK_STATUS.TODO)
    expect(container.textContent).toContain('标记失败')
    expect(callsFor('PATCH')).toHaveLength(1)
  })
})
