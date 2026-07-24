import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatCompletedAt, formatDueDate } from './date'

describe('date formatting', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses relative labels for today and tomorrow', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0))

    expect(formatDueDate(new Date(2026, 0, 10, 18, 30).getTime()).text).toBe('今天 18:30')
    expect(formatDueDate(new Date(2026, 0, 11, 8, 0).getTime()).text).toBe('明天 08:00')
  })

  it('returns overdue state and the number of overdue days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0))

    expect(formatDueDate(new Date(2026, 0, 8, 18, 0).getTime())).toEqual({
      text: '01-08 18:00',
      isOverdue: true,
      overdueDays: 2,
    })
  })

  it('formats completion timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0))

    expect(formatCompletedAt(new Date(2026, 0, 10, 8, 15).getTime())).toBe('今天 08:15 完成')
  })
})
