// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, tasksApi } from './api'

afterEach(() => vi.unstubAllGlobals())

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }
}

describe('tasksApi.get', () => {
  it('returns one task from a 200 response', async () => {
    const fetchMock = vi.fn(async () => response(200, {
      ok: true,
      data: { id: 'task-1', title: '任务' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(tasksApi.get('task-1')).resolves.toEqual({
      ok: true,
      data: { id: 'task-1', title: '任务' },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks?id=task-1', expect.objectContaining({ method: 'GET' }))
  })

  it('throws an identifiable ApiError for a 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(404, { message: '任务不存在' })))

    const error = await tasksApi.get('missing').catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: '任务不存在' })
  })
})
