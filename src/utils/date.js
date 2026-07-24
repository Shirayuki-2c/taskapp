const ONE_DAY = 24 * 60 * 60 * 1000

function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
}

function pad2(number) {
  return number < 10 ? `0${number}` : String(number)
}

function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function getWeekStart(now = new Date()) {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return date
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDueDate(timestamp, options = {}) {
  if (!timestamp) return { text: '', isOverdue: false, overdueDays: 0 }

  const { withTime = true } = options
  const now = new Date()
  const target = new Date(timestamp)
  const timeText = withTime ? ` ${formatTime(target)}` : ''

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const targetStart = new Date(target)
  targetStart.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((targetStart - todayStart) / ONE_DAY)
  const isOverdue = diffDays < 0
  const overdueDays = isOverdue ? Math.abs(diffDays) : 0

  if (isSameDay(timestamp, now.getTime())) {
    return { text: `今天${timeText}`, isOverdue: false, overdueDays: 0 }
  }
  if (isSameDay(timestamp, now.getTime() + ONE_DAY)) {
    return { text: `明天${timeText}`, isOverdue: false, overdueDays: 0 }
  }
  if (isSameDay(timestamp, now.getTime() - ONE_DAY)) {
    return { text: `昨天${timeText}`, isOverdue, overdueDays }
  }

  const weekStart = getWeekStart(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  if (target >= now && target < weekEnd) {
    return {
      text: `${WEEKDAY_LABELS[target.getDay()]}${timeText}`,
      isOverdue: false,
      overdueDays: 0,
    }
  }

  if (target.getFullYear() === now.getFullYear()) {
    return {
      text: `${pad2(target.getMonth() + 1)}-${pad2(target.getDate())}${timeText}`,
      isOverdue,
      overdueDays,
    }
  }

  return {
    text: `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(target.getDate())}`,
    isOverdue,
    overdueDays,
  }
}

export function formatCompletedAt(timestamp) {
  if (!timestamp) return ''
  const { text } = formatDueDate(timestamp, { withTime: true })
  return `${text} 完成`
}
