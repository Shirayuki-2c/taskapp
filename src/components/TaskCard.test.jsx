// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS } from '../lib/meta/constants'
import TaskCard from './TaskCard'

let root
let container

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  root = null
  container = null
  document.body.innerHTML = ''
  vi.useRealTimers()
})

async function renderCard(props) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<TaskCard {...props} />))
  return container
}

describe('TaskCard', () => {
  it('shows type metadata, enabled custom fields, notes, and invokes actions', async () => {
    const onToggleComplete = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const task = {
      id: 'task-1', title: '准备发布', status: TASK_STATUS.DOING, type_id: 'type-1',
      notes: '发布前再次核对链接',
      custom_fields: { 需求方: '市场部', 优先级: '高', 内部字段: '隐藏' },
    }
    await renderCard({
      task,
      typeMeta: { id: 'type-1', name: '文案需求', icon: '📝', color: 'blue' },
      fields: [
        { metaId: 'a', key: '需求方', label: '需求方', kind: 'text', showOnCard: true },
        { metaId: 'b', key: '优先级', label: '优先级', kind: 'select', showOnCard: true },
        { metaId: 'c', key: '内部字段', label: '内部字段', kind: 'text', showOnCard: false },
      ],
      onToggleComplete,
      onEdit,
      onDelete,
    })

    expect(container.textContent).toContain('文案需求')
    expect(container.textContent).toContain('需求方市场部')
    expect(container.textContent).toContain('优先级高')
    expect(container.textContent).not.toContain('内部字段')
    expect(container.textContent).toContain('发布前再次核对链接')
    expect(container.textContent).toContain(TASK_STATUS.DOING)

    for (const label of ['标记为完成', '编辑', '删除']) {
      await act(async () => container.querySelector(`[aria-label="${label}"]`)
        .dispatchEvent(new MouseEvent('click', { bubbles: true })))
    }
    expect(onToggleComplete).toHaveBeenCalledWith(task)
    expect(onEdit).toHaveBeenCalledWith(task)
    expect(onDelete).toHaveBeenCalledWith(task)
  })

  it('marks an unfinished overdue task but suppresses overdue state after completion', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0))
    const dueDate = new Date(2026, 0, 8, 18, 0).getTime()
    const baseProps = {
      typeMeta: null,
      fields: [],
      onToggleComplete: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }

    await renderCard({
      ...baseProps,
      task: { id: 'task-1', title: '已逾期', status: TASK_STATUS.TODO, due_date: dueDate },
    })
    expect(container.querySelector('.task-card--overdue')).not.toBeNull()
    expect(container.textContent).toContain('逾期 2 天')
    expect(container.textContent).toContain('未分类')

    await act(async () => root.render(
      <TaskCard
        {...baseProps}
        task={{
          id: 'task-1', title: '完成任务', status: TASK_STATUS.DONE, due_date: dueDate,
          completed_at: new Date(2026, 0, 10, 8, 0).getTime(),
        }}
      />,
    ))
    expect(container.querySelector('.task-card--overdue')).toBeNull()
    expect(container.textContent).not.toContain('逾期 2 天')
    expect(container.textContent).toContain('今天 08:00 完成')
  })
})
