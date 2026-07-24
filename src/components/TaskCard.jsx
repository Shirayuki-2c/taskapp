import { formatCompletedAt, formatDueDate } from '../utils/date'
import { TASK_STATUS } from '../lib/meta/constants'
import './TaskCard.css'

function Icon({ name, size = 16, className }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    trash: <><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></>,
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function DefaultTypeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function formatFieldValue(value, fieldType) {
  if (value === undefined || value === null || value === '') return ''
  if (fieldType === 'date' && typeof value === 'number') {
    return formatDueDate(value, { withTime: false }).text
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object' && value.name) return value.name
  return String(value)
}

function customFieldValues(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || value === '') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function pickCardFields(fields, customFields) {
  return fields
    .filter((field) => field.showOnCard === true || field.show_on_card === true)
    .map((field) => {
      const key = field.key ?? field.name ?? field.id
      return {
        id: field.metaId ?? field.id ?? key,
        label: field.label ?? field.name ?? key,
        value: formatFieldValue(customFields[key], field.kind ?? field.field_type),
      }
    })
    .filter((field) => field.value !== '')
}

export default function TaskCard({
  task,
  typeMeta,
  fields = [],
  onToggleComplete,
  onEdit,
  onDelete,
}) {
  const isCompleted = task.status === TASK_STATUS.DONE
  const isCancelled = task.status === TASK_STATUS.CANCELLED
  const isDoing = task.status === TASK_STATUS.DOING
  const typeColor = typeMeta?.color || '#c9cdd4'
  const typeName = typeMeta?.name || '未分类'
  const dateInfo = task.due_date ? formatDueDate(task.due_date, { withTime: true }) : null
  const showOverdue = Boolean(dateInfo?.isOverdue && !isCompleted && !isCancelled)
  const completedText = isCompleted && task.completed_at
    ? formatCompletedAt(task.completed_at)
    : ''
  const cardFields = pickCardFields(fields, customFieldValues(task.custom_fields))
  const note = task.notes ?? task.note
  const cardClass = [
    'task-card',
    isCompleted && 'task-card--completed',
    isCancelled && 'task-card--cancelled',
    showOverdue && 'task-card--overdue',
  ].filter(Boolean).join(' ')

  return (
    <article className={cardClass} style={{ '--type-color': typeColor }}>
      <div className="task-card__header">
        <button
          type="button"
          className={`task-card__checkbox ${isCompleted ? 'is-checked' : ''}`}
          onClick={() => onToggleComplete?.(task)}
          aria-label={isCompleted ? '标记为未完成' : '标记为完成'}
        >
          {isCompleted && <Icon name="check" size={14} />}
        </button>

        <div className="task-card__title">{task.title}</div>

        <div className="task-card__actions">
          <button type="button" className="task-card__action-btn" onClick={() => onEdit?.(task)} aria-label="编辑" title="编辑">
            <Icon name="edit" />
          </button>
          <button type="button" className="task-card__action-btn task-card__action-btn--danger" onClick={() => onDelete?.(task)} aria-label="删除" title="删除">
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <div className="task-card__meta">
        <span className="task-card__type-tag">
          {typeMeta?.icon
            ? <span className="task-card__type-emoji" aria-hidden="true">{typeMeta.icon}</span>
            : <DefaultTypeIcon className="task-card__type-icon" />}
          {typeName}
        </span>

        {(dateInfo || completedText || isCancelled) && <span className="task-card__meta-divider">·</span>}

        {isCancelled ? (
          <span className="task-card__date">{TASK_STATUS.CANCELLED}</span>
        ) : completedText ? (
          <span className="task-card__date"><Icon name="clock" size={13} />{completedText}</span>
        ) : dateInfo ? (
          <span className={`task-card__date ${showOverdue ? 'is-overdue' : ''}`}>
            <Icon name="clock" size={13} />
            {dateInfo.text}
            {showOverdue && <span className="task-card__overdue-badge">逾期 {dateInfo.overdueDays} 天</span>}
          </span>
        ) : null}

        {isDoing && (
          <span className="task-card__status-badge">
            <span className="task-card__status-dot" />{TASK_STATUS.DOING}
          </span>
        )}
      </div>

      {cardFields.length > 0 && (
        <div className="task-card__fields">
          {cardFields.map((field) => (
            <div className="task-card__field-chip" key={field.id}>
              <span className="task-card__field-label">{field.label}</span>
              <span className="task-card__field-value">{field.value}</span>
            </div>
          ))}
        </div>
      )}

      {note && (
        <div className="task-card__note">
          <Icon name="message" size={12} />
          <span className="task-card__note-preview">{note}</span>
          <div className="task-card__note-tooltip" role="tooltip">{note}</div>
        </div>
      )}
    </article>
  )
}
